/**
 * The Postgres schema of the objects that the config names as tables, `schema.generated.sql`. It is
 * a schema only: no runtime code. Each table has a column for each property and the identifier as its
 * primary key. A property that is a list or an embedded object is a JSONB column. The rules that SQL
 * can say are CHECK constraints; a comment names each rule that it cannot say, which the harness
 * checks. The config adds foreign keys (references) and unique values (unique).
 */
import type { CelType } from '../cel/check.js';
import type { Expr } from '../cel/parse.js';
import { print } from '../cel/print.js';
import type { PostgresConfig } from '../config.js';
import type { Diagnostic } from '../diagnostics.js';
import { requiredOf, type Model } from '../model.js';
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

/**
 * A rule as SQL. `columns` gives the column of each property that `self.<property>` reads (or of
 * `self` itself), `args` the arguments. A form that SQL cannot say throws Untranslatable.
 */
function toSql(expr: Expr, types: ReadonlyMap<Expr, CelType>, self: string | Readonly<Record<string, string>>, args: Readonly<Record<string, unknown>>): string {
  const sql = (e: Expr): string => {
    switch (e.kind) {
      case 'name': {
        if (e.name === 'self' && typeof self === 'string') return ident(self);
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
      case 'list': {
        const value = `ARRAY[${e.items.map(sql).join(', ')}]`;
        return value;
      }
      case 'select': {
        // Only a column of the table: self.<property> of a scalar property.
        if (e.operand.kind === 'name' && e.operand.name === 'self' && typeof self !== 'string' && Object.hasOwn(self, e.field)) return ident(self[e.field]!);
        throw new Untranslatable();
      }
      case 'call':
        switch (e.fn) {
          case 'has': {
            const select = e.args[0] as Expr & { kind: 'select' };
            return `(${sql(select)} IS NOT NULL)`;
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
            return `(${left} ${e.op} ${right})`;
        }
      }
    }
  };
  return sql(expr);
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
  return problems;
}

/** The schema of the tables of the config. */
export function postgresSchema(model: Model, applications: readonly Application[], config: PostgresConfig): string {
  const schema = ident(model.header.domain);
  const lines: string[] = [`CREATE SCHEMA IF NOT EXISTS ${schema};`];
  const rulesOf = (definition: string): Application[] => applications.filter((a) => a.place.kind === 'definition' && a.place.definition === definition);
  for (const table of config.tables) {
    const definition = model.definitions[table]!;
    const required = requiredOf(definition);
    const columns: string[] = [];
    const checks: string[] = [];
    const notInSql: string[] = [];
    const scalarColumns: Record<string, string> = {};
    for (const property of definition.properties ?? []) {
      const target = model.definitions[property]!;
      const type = SCALAR_TYPES[target.base] ?? 'JSONB';
      columns.push(`${ident(property)} ${type}${required.has(property) ? ' NOT NULL' : ''}`);
      if (type !== 'JSONB') scalarColumns[property] = property;
      // The rules of the property's definition, and of the definitions it is named as a type of.
      const chain: string[] = [];
      for (let d = target; ; d = model.definitions[d.type]!) {
        chain.push(d.name);
        if (d.root === d.name) break;
      }
      for (const name of chain) {
        for (const application of rulesOf(name)) {
          if (type === 'JSONB') {
            notInSql.push(`${property}: ${application.rule.name}`);
            continue;
          }
          try {
            checks.push(`CONSTRAINT ${ident(`${table}_${property}_${application.rule.name}`)} CHECK (${toSql(application.rule.expr, application.types, property, application.arguments)})`);
          } catch (error) {
            if (!(error instanceof Untranslatable)) throw error;
            notInSql.push(`${property}: ${application.rule.name}`);
          }
        }
      }
    }
    for (const application of rulesOf(table)) {
      if (application.rule.name === 'required' && application.owner !== model) continue; // NOT NULL
      try {
        checks.push(`CONSTRAINT ${ident(`${table}_${application.rule.name}`)} CHECK (${toSql(application.rule.expr, application.types, scalarColumns, application.arguments)})`);
      } catch (error) {
        if (!(error instanceof Untranslatable)) throw error;
        notInSql.push(`${table}: ${application.rule.name}: ${print(application.rule.expr)}`);
      }
    }
    const keys = [`CONSTRAINT ${ident(`${table}_pkey`)} PRIMARY KEY (${ident(definition.identifier!)})`];
    for (const [property, target] of Object.entries(config.references?.[table] ?? {})) {
      const targetKey = model.definitions[target]!.identifier!;
      keys.push(`CONSTRAINT ${ident(`${table}_${property}_fkey`)} FOREIGN KEY (${ident(property)}) REFERENCES ${schema}.${ident(target)} (${ident(targetKey)})`);
    }
    for (const entry of config.unique?.[table] ?? []) keys.push(`CONSTRAINT ${ident(`${table}_${entry.join('_')}_unique`)} UNIQUE (${entry.map(ident).join(', ')})`);
    lines.push('', `CREATE TABLE ${schema}.${ident(table)} (`, [...columns, ...keys, ...checks].map((l) => `  ${l}`).join(',\n'), ');');
    lines.push(`COMMENT ON TABLE ${schema}.${ident(table)} IS ${literal(definition.description)};`);
    if (notInSql.length > 0) lines.push(`-- Not in SQL; the harness checks these rules: ${notInSql.join('; ')}`);
  }
  return `${lines.join('\n')}\n`;
}
