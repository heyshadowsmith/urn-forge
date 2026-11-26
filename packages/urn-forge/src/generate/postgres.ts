/**
 * The Postgres schema of the objects that the config names as tables, `schema.generated.sql`. Each
 * table is keyed by its identifier. An embedded object is columns, and a list is a child table
 * (src/generate/tables.ts). The rules that SQL can say are CHECK constraints, UNIQUE constraints, or
 * constraint triggers that count the rows of a list; a comment names each rule that SQL cannot say,
 * which the harness checks. The config adds foreign keys (references) and unique values (unique).
 */
import { domainUrn, partUrn } from '../urn.js';
import type { CelType } from '../cel/check.js';
import type { Expr } from '../cel/parse.js';
import type { PostgresConfig } from '../config.js';
import type { Diagnostic } from '../diagnostics.js';
import type { Model } from '../model.js';
import { allTables, buildTables, type Column, type Table, type TableProblem } from './tables.js';
import type { Application } from '../rules.js';
import { durationMs } from './emit-cel.js';

const ident = (name: string): string => `"${name.replace(/"/g, '""')}"`;
const literal = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/** A value of a rule's argument as SQL, or undefined. */
function sqlValue(value: unknown): string | undefined {
  if (typeof value === 'string') return literal(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (Array.isArray(value)) {
    const items = value.map(sqlValue);
    return items.every((i) => i !== undefined) && items.length > 0 ? `ARRAY[${items.join(', ')}]` : undefined;
  }
  return undefined;
}

class Untranslatable extends Error {}

/** What a path below the value of a rule is in a table: a column, an embedded object, or a list. */
type Part =
  | { readonly kind: 'value'; readonly column: string }
  | { readonly kind: 'object'; readonly columns: readonly string[] }
  | { readonly kind: 'list'; readonly flag?: string };

/**
 * A rule as SQL. `part` gives what a path below `self` is in the table (the empty path is `self`),
 * `args` the arguments. A form that SQL cannot say throws Untranslatable.
 */
function toSql(expr: Expr, types: ReadonlyMap<Expr, CelType>, part: (path: readonly string[]) => Part | undefined, args: Readonly<Record<string, unknown>>): string {
  /** The path of a chain `self.a.b`, or undefined. */
  const pathOf = (e: Expr): string[] | undefined => {
    if (e.kind === 'name') return e.name === 'self' ? [] : undefined;
    if (e.kind === 'select') {
      const operand = pathOf(e.operand);
      return operand ? [...operand, e.field] : undefined;
    }
    return undefined;
  };
  const column = (e: Expr): string => {
    const path = pathOf(e);
    const found = path ? part(path) : undefined;
    if (found?.kind !== 'value') throw new Untranslatable();
    return ident(found.column);
  };
  const sql = (e: Expr): string => {
    switch (e.kind) {
      case 'name': {
        if (e.name === 'self') return column(e);
        if (Object.hasOwn(args, e.name)) {
          const value = sqlValue(args[e.name]);
          if (value === undefined) throw new Untranslatable();
          return value;
        }
        throw new Untranslatable();
      }
      case 'int':
      case 'double':
        return String(e.value);
      case 'string':
        return literal(e.value);
      case 'bool':
        return e.value ? 'TRUE' : 'FALSE';
      case 'list':
        return `ARRAY[${e.items.map(sql).join(', ')}]`;
      case 'select':
        return column(e);
      case 'call':
        switch (e.fn) {
          case 'has': {
            const path = pathOf(e.args[0]!);
            const found = path ? part(path) : undefined;
            if (found?.kind === 'value') return `(${ident(found.column)} IS NOT NULL)`;
            if (found?.kind === 'object' && found.columns.length > 0) return `(${found.columns.map((c) => `${ident(c)} IS NOT NULL`).join(' OR ')})`;
            if (found?.kind === 'list' && found.flag) return ident(found.flag);
            throw new Untranslatable();
          }
          case 'size': {
            const target = e.target ?? e.args[0]!;
            if (types.get(target)?.kind !== 'string') throw new Untranslatable();
            return `char_length(${sql(target)})`;
          }
          case 'matches':
            return `(${sql(e.target!)} ~ ${sql(e.args[0]!)})`;
          case 'timestamp':
            return `(${sql(e.args[0]!)})::TIMESTAMPTZ`;
          case 'duration':
            return `INTERVAL ${literal(`${durationMs((e.args[0] as Expr & { kind: 'string' }).value)} milliseconds`)}`;
          default:
            throw new Untranslatable();
        }
      case 'macro':
        throw new Untranslatable();
      case 'unary':
        return e.op === '!' ? `(NOT ${sql(e.operand)})` : `(-${sql(e.operand)})`;
      case 'binary': {
        const left = sql(e.left);
        const right = sql(e.right);
        switch (e.op) {
          case '&&':
            return `(${left} AND ${right})`;
          case '||':
            return `(${left} OR ${right})`;
          case '==':
            return `(${left} = ${right})`;
          case '!=':
            return `(${left} <> ${right})`;
          case 'in':
            if (types.get(e.right)?.kind !== 'list') throw new Untranslatable();
            return `(${left} = ANY(${right}))`;
          case '/':
            return types.get(e)?.kind === 'int' ? `TRUNC(${left}::NUMERIC / ${right})::BIGINT` : `(${left} / ${right})`;
          default:
            if (['+', '-'].includes(e.op) && types.get(e)?.kind === 'list') throw new Untranslatable();
            if (e.op === '+' && types.get(e)?.kind === 'string') return `(${left} || ${right})`;
            return `(${left} ${e.op} ${right})`;
        }
      }
    }
  };
  return sql(expr);
}

/** The SQL type of a column: a position (a key column with no definition) is an INTEGER. */
function sqlType(column: Column): string {
  return column.definition === undefined && column.base === 'integer' ? 'INTEGER' : SCALAR_TYPES[column.base]!;
}

const SCALAR_TYPES: Readonly<Record<string, string>> = { string: 'TEXT', integer: 'BIGINT', number: 'DOUBLE PRECISION', boolean: 'BOOLEAN' };

/** The problems of the postgres config: tables that are not objects with an identifier, and wrong names. */
export function postgresProblems(model: Model, config: PostgresConfig): Diagnostic[] {
  const problems: Diagnostic[] = [];
  const problem = (path: (string | number)[], message: string): void => {
    problems.push({ code: 'postgres-config', severity: 'error', path: ['postgres', ...path], message });
  };
  const tables = new Set(config.tables);
  config.tables.forEach((table, i) => {
    const definition = model.definitions[table];
    if (!definition || definition.base !== 'object' || definition.root !== table) problem(['tables', i], `${table} is not an object definition of the manifest`);
    else if (!definition.identifier) problem(['tables', i], `${table} has no identifier; a table needs one for its primary key`);
  });
  for (const [table, references] of Object.entries(config.references ?? {})) {
    if (!tables.has(table)) problem(['references', table], `${table} is not a table`);
    for (const [property, target] of Object.entries(references)) {
      const owner = model.definitions[table];
      const targetDefinition = model.definitions[target];
      if (!owner?.properties?.includes(property)) problem(['references', table, property], `${property} is not a property of ${table}`);
      else if (!tables.has(target) || !targetDefinition?.identifier) problem(['references', table, property], `${target} is not a table`);
      else {
        const valueRoot = model.definitions[property]?.root;
        const keyRoot = model.definitions[targetDefinition.identifier]?.root;
        if (valueRoot !== keyRoot) problem(['references', table, property], `${property} is not of the type of the identifier of ${target}, ${targetDefinition.identifier}`);
      }
    }
  }
  for (const [table, entries] of Object.entries(config.unique ?? {})) {
    if (!tables.has(table)) problem(['unique', table], `${table} is not a table`);
    entries.forEach((entry, i) => {
      for (const property of entry) if (!model.definitions[table]?.properties?.includes(property)) problem(['unique', table, i], `${property} is not a property of ${table}`);
    });
  }
  if (problems.length === 0) {
    const tableProblems: TableProblem[] = [];
    buildTables(model, config.tables, tableProblems);
    for (const problem of tableProblems) problems.push({ code: 'postgres-column', severity: 'error', path: ['postgres', 'tables', problem.table], message: problem.message });
  }
  return problems;
}

/** The names of a schema that Postgres would cut: longer than 63 bytes. Constraints, functions and triggers too. */
export function longNames(schema: string): string[] {
  const names = new Set<string>();
  for (const [, name] of schema.matchAll(/"((?:[^"]|"")+)"/g)) if (Buffer.byteLength(name!.replace(/""/g, '"')) > 63) names.add(name!);
  return [...names];
}

/** The schema of the tables of the config: a table for each object, and a child table for each list. */
export function postgresSchema(model: Model, applications: readonly Application[], config: PostgresConfig): string {
  const schema = ident(model.header.domain);
  const qualified = (name: string): string => `${schema}.${ident(name)}`;
  const lines: string[] = [`CREATE SCHEMA IF NOT EXISTS ${schema};`, `COMMENT ON SCHEMA ${schema} IS ${literal(domainUrn(model.header))};`];
  const rulesOf = (definition: string): Application[] => applications.filter((a) => a.place.kind === 'definition' && a.place.definition === definition);
  /** The definition, then each definition it is named as the type of. */
  const chain = (name: string): string[] => {
    const names: string[] = [];
    for (let d = model.definitions[name]!; ; d = model.definitions[d.type]!) {
      names.push(d.name);
      if (d.root === d.name) break;
    }
    return names;
  };
  const isStandard = (a: Application): boolean => a.owner !== model;
  const triggers: string[] = [];

  for (const table of allTables(buildTables(model, config.tables))) {
    const columns: string[] = [];
    const keys: string[] = [];
    const checks: string[] = [];
    const notInSql: string[] = [];

    /** What a path below a part of the row is: a column, an embedded object, or a list. */
    const partOf = (base: readonly string[]) => (path: readonly string[]): Part | undefined => {
      const full = [...base, ...path];
      const same = (p: readonly string[]): boolean => p.length === full.length && p.every((x, i) => x === full[i]);
      if (table.kind === 'values') return path.length === 0 ? { kind: 'value', column: 'value' } : undefined;
      const exact = table.columns.find((c) => same(c.path));
      if (exact?.definition !== undefined) return { kind: 'value', column: exact.name };
      const child = table.children.find((c) => same(c.list!.path));
      if (child) return { kind: 'list', ...(child.list!.flag ? { flag: child.list!.flag } : {}) };
      const inside = table.columns.filter((c) => c.definition !== undefined && c.path.length > full.length && full.every((x, i) => c.path[i] === x));
      return inside.length > 0 ? { kind: 'object', columns: inside.map((c) => c.name) } : undefined;
    };
    const check = (name: string, application: Application, base: readonly string[], guard: string | undefined): void => {
      try {
        const rule = toSql(application.rule.expr, application.types, partOf(base), application.arguments);
        checks.push(`CONSTRAINT ${ident(name)} CHECK (${guard ? `NOT ${guard} OR ` : ''}${rule})`);
      } catch (error) {
        if (!(error instanceof Untranslatable)) throw error;
        notInSql.push(`${[...base].join('.') || table.definition}: ${application.rule.name}`);
      }
    };

    for (const column of [...table.parentKey, ...(table.kind === 'root' ? [] : [table.key.at(-1)!])]) {
      columns.push(`${ident(column.name)} ${sqlType(column)} NOT NULL`);
    }
    for (const column of table.columns) {
      columns.push(`${ident(column.name)} ${SCALAR_TYPES[column.base]}${column.notNull ? ' NOT NULL' : ''}`);
      // The rules of the column's value.
      if (column.definition === undefined) continue;
      for (const name of chain(column.definition)) {
        for (const application of rulesOf(name)) {
          check(`${table.name}_${column.name === 'value' ? 'value' : column.name}_${application.rule.name}`, application, column.path, undefined);
        }
      }
    }
    // The rules of each object of the row: the row itself, and each embedded object.
    for (const object of table.objects) {
      // An optional object is present when a column of one of its values is: not a flag of one of its lists.
      const valueColumns = Object.values(object.columns).filter((name) => table.columns.some((c) => c.name === name && c.definition !== undefined));
      const presence = object.optional && valueColumns.length > 0 ? `(${valueColumns.map((c) => `${ident(c)} IS NOT NULL`).join(' OR ')})` : undefined;
      const prefix = object.path.length > 0 ? `${object.path.join('_')}_` : '';
      for (const name of chain(object.definition)) {
        for (const application of rulesOf(name)) {
          if (application.rule.name === 'required' && isStandard(application)) {
            // A required part of an optional object: present when the object is.
            if (!presence) continue;
            const required = (application.arguments['property_names'] as string[]).map((p) => partOf(object.path)([p])).filter((p): p is Part & { kind: 'value' } => p?.kind === 'value');
            if (required.length > 0) checks.push(`CONSTRAINT ${ident(`${table.name}_${prefix}required`)} CHECK (NOT ${presence} OR (${required.map((p) => `${ident(p.column)} IS NOT NULL`).join(' AND ')}))`);
            continue;
          }
          check(`${table.name}_${prefix}${application.rule.name}`, application, object.path, presence);
        }
      }
    }
    // The rules of the list of a child table.
    const list = table.list;
    let count: { min?: number; max?: number } | undefined;
    if (list) {
      for (const name of chain(list.definition)) {
        for (const application of rulesOf(name)) {
          const rule = application.rule.name;
          if (isStandard(application) && rule === 'uniqueItems') {
            const item = model.definitions[model.definitions[table.definition]!.root]!;
            const identity = table.kind === 'values' ? ['value'] : item.identifier ? [item.identifier] : table.columns.map((c) => c.name);
            keys.push(`CONSTRAINT ${ident(`${table.name}_uniqueItems`)} UNIQUE NULLS NOT DISTINCT (${[...table.parentKey.map((c) => c.name), ...identity].map(ident).join(', ')})`);
          } else if (isStandard(application) && (rule === 'minItems' || rule === 'maxItems')) {
            count = { ...count, [rule === 'minItems' ? 'min' : 'max']: application.arguments['count'] as number };
          } else {
            notInSql.push(`${list.path.join('.')}: ${rule}`);
          }
        }
      }
    }

    const primary = table.kind === 'root' ? table.key : table.key;
    keys.unshift(`CONSTRAINT ${ident(`${table.name}_pkey`)} PRIMARY KEY (${primary.map((c) => ident(c.name)).join(', ')})`);
    if (list) {
      const parent = list.parent;
      keys.push(
        `CONSTRAINT ${ident(`${table.name}_parent_fkey`)} FOREIGN KEY (${table.parentKey.map((c) => ident(c.name)).join(', ')}) REFERENCES ${qualified(parent.name)} (${parent.key.map((c) => ident(c.name)).join(', ')}) ON DELETE CASCADE`,
      );
    } else {
      for (const [property, target] of Object.entries(config.references?.[table.name] ?? {})) {
        const targetKey = model.definitions[target]!.identifier!;
        keys.push(`CONSTRAINT ${ident(`${table.name}_${property}_fkey`)} FOREIGN KEY (${ident(property)}) REFERENCES ${qualified(target)} (${ident(targetKey)})`);
      }
      for (const entry of config.unique?.[table.name] ?? []) keys.push(`CONSTRAINT ${ident(`${table.name}_${entry.join('_')}_unique`)} UNIQUE (${entry.map(ident).join(', ')})`);
    }
    // A rule of the table's object that SQL cannot say, by its text.
    lines.push('', `CREATE TABLE ${qualified(table.name)} (`, [...columns, ...keys, ...checks].map((l) => `  ${l}`).join(',\n'), ');');
    const description = model.definitions[list ? list.definition : table.definition]!.description;
    lines.push(`COMMENT ON TABLE ${qualified(table.name)} IS ${literal(`${partUrn(model.header, 'definition', list ? list.definition : table.definition)}: ${description}`)};`);
    if (notInSql.length > 0) lines.push(`-- Not in SQL; the harness checks these rules: ${notInSql.join('; ')}`);

    // The count of a list, and whether an optional list has rows: a trigger at the end of the transaction.
    if (list && (count?.min || count?.max !== undefined || list.flag)) triggers.push(...countTrigger(qualified, table, count ?? {}));
  }
  return `${[...lines, ...triggers].join('\n')}\n`;
}

/** The functions and the constraint triggers that count the rows of a list for each parent. */
function countTrigger(qualified: (name: string) => string, table: Table, count: { readonly min?: number; readonly max?: number }): string[] {
  const list = table.list!;
  const parent = list.parent;
  const params = table.parentKey.map((c, i) => `k${i} ${sqlType(c)}`).join(', ');
  const parentMatch = parent.key.map((c, i) => `${ident(c.name)} = k${i}`).join(' AND ');
  const childMatch = table.parentKey.map((c, i) => `${ident(c.name)} = k${i}`).join(' AND ');
  const fn = qualified(`${table.name}_count`);
  const raise = (constraint: string, message: string): string =>
    `RAISE EXCEPTION '%', ${literal(message)} USING ERRCODE = 'check_violation', CONSTRAINT = ${literal(constraint)}, TABLE = ${literal(table.name)};`;
  const body = [
    `CREATE FUNCTION ${fn}(${params}) RETURNS void LANGUAGE plpgsql AS $$`,
    'DECLARE n integer; listed boolean;',
    'BEGIN',
    `  SELECT ${list.flag ? ident(list.flag) : 'TRUE'} INTO listed FROM ${qualified(parent.name)} WHERE ${parentMatch};`,
    '  IF NOT FOUND THEN RETURN; END IF;',
    `  SELECT count(*) INTO n FROM ${qualified(table.name)} WHERE ${childMatch};`,
    ...(list.flag ? [`  IF NOT listed AND n > 0 THEN ${raise(`${table.name}_listed`, `${list.flag} is false, and the list has rows`)} END IF;`] : []),
    ...(count.min ? [`  IF listed AND n < ${count.min} THEN ${raise(`${table.name}_minItems`, `Must have at least ${count.min} items`)} END IF;`] : []),
    ...(count.max !== undefined ? [`  IF n > ${count.max} THEN ${raise(`${table.name}_maxItems`, `Must have at most ${count.max} items`)} END IF;`] : []),
    'END $$;',
  ];
  const args = (row: string, columns: readonly Column[]): string => columns.map((c) => `${row}.${ident(c.name)}`).join(', ');
  const childFn = qualified(`${table.name}_count_rows`);
  const parentFn = qualified(`${table.name}_count_parent`);
  return [
    '',
    ...body,
    `CREATE FUNCTION ${childFn}() RETURNS trigger LANGUAGE plpgsql AS $$`,
    'BEGIN',
    `  IF TG_OP <> 'INSERT' THEN PERFORM ${fn}(${args('OLD', table.parentKey)}); END IF;`,
    `  IF TG_OP <> 'DELETE' THEN PERFORM ${fn}(${args('NEW', table.parentKey)}); END IF;`,
    '  RETURN NULL;',
    'END $$;',
    `CREATE CONSTRAINT TRIGGER ${ident(`${table.name}_count`)} AFTER INSERT OR UPDATE OR DELETE ON ${qualified(table.name)} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${childFn}();`,
    `CREATE FUNCTION ${parentFn}() RETURNS trigger LANGUAGE plpgsql AS $$`,
    'BEGIN',
    `  PERFORM ${fn}(${args('NEW', parent.key)});`,
    '  RETURN NULL;',
    'END $$;',
    `CREATE CONSTRAINT TRIGGER ${ident(`${table.name}_count_parent`)} AFTER INSERT OR UPDATE ON ${qualified(parent.name)} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${parentFn}();`,
  ];
}
