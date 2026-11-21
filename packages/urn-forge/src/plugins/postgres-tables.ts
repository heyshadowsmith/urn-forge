/**
 * The tables of the Postgres plugin (Postgres plan, decisions 1, 6 and 7).
 *
 * - An entity in `tables` is a root table, `"<context>"."<identifier>"`, keyed by its `key`.
 * - A property with a list, or with an embedded entity, is a child table,
 *   `"<context>"."<parent table>__<property>"`. Its key is the parent's key columns, and
 *   `position` for a list. It references its parent, and goes when the parent goes.
 * - A link is a column with the key field's domain and a foreign key to the target's root
 *   table. The foreign keys come after every table, so links can form cycles.
 * - A count (`minItems`, `maxItems`, a required embedded entity) is a constraint trigger that
 *   Postgres runs when the transaction commits, so a shell can write the parent and its
 *   items in any order.
 */
import { invariantsOf, type IRPropertyRef, type UniversalIR, type Urn } from '../ir/types.js';
import { ruleSql } from './postgres-rules.js';
import { describe, domainName, ident, literal, urnParts } from './postgres.plugin.js';

/** One column, with its SQL type. */
interface Column {
  readonly name: string;
  readonly type: string;
}

/** A table, as the tables under it need to know it. */
interface Table {
  readonly schema: string;
  readonly name: string;
  /** The primary key columns, in order. */
  readonly key: readonly Column[];
  /** The property of the parent that this table holds; undefined for a root table. */
  readonly property?: string;
  /** The entity whose property this table holds; undefined for a root table. */
  readonly owner?: Urn;
}

export interface TableHooks {
  /** Reports a name over 63 bytes. */
  readonly checkName: (name: string, urn: Urn, what: string) => void;
  /** Reports two parts of the schema with one name. */
  readonly nameTaken: (name: string, urn: Urn, what: string, owner: Urn) => void;
  /** Reports a rule that the SQL cannot enforce. */
  readonly unenforced: (urn: Urn, what: string) => void;
}

const qualified = (table: { readonly schema: string; readonly name: string }) => `${ident(table.schema)}.${ident(table.name)}`;
const columnList = (columns: readonly Column[]) => columns.map((c) => ident(c.name)).join(', ');

/** The SQL type of a field's column: its domain. */
const domainType = (field: Urn) => {
  const domain = domainName(field);
  return `${ident(domain.schema)}.${ident(domain.name)}`;
};

/** The text of a count rule: "between 1 and 3", "at least 1", "at most 3", "exactly 1". */
function countText(min: number, max: number | undefined): string {
  if (max === undefined) return `at least ${min}`;
  if (min === max) return `exactly ${min}`;
  if (min === 0) return `at most ${max}`;
  return `between ${min} and ${max}`;
}

export function tablesSql(ir: UniversalIR, roots: readonly Urn[], hooks: TableHooks): string[] {
  const tables: string[] = [];
  const links: string[] = [];
  const counts: string[] = [];
  const names = new Map<string, Urn>();
  const unenforcedRules = new Set<Urn>();

  /** The invariants of an entity as named CHECKs on `table`, with a comment that holds each URN. */
  const invariants = (table: Table, entity: Urn): { lines: string[]; comments: string[] } => {
    const lines: string[] = [];
    const comments: string[] = [];
    const constraintNames = new Map<string, Urn>();
    for (const invariant of invariantsOf(ir, entity)) {
      const translated = ruleSql(ir, invariant.rule, ir.entities[entity]!.fields);
      if (!translated.ok) {
        if (!unenforcedRules.has(invariant.urn)) hooks.unenforced(invariant.urn, `the rule ${invariant.ruleText}: ${translated.reason}`);
        unenforcedRules.add(invariant.urn);
        comments.push(`-- Not enforced here: ${invariant.urn} (${invariant.ruleText}).`);
        continue;
      }
      const name = urnParts(invariant.urn).identifier;
      const owner = constraintNames.get(name);
      if (owner !== undefined) hooks.nameTaken(`${table.name}.${name}`, invariant.urn, 'check constraint', owner);
      constraintNames.set(name, invariant.urn);
      lines.push(`CONSTRAINT ${ident(name)} CHECK (${translated.sql})`);
      comments.push(`COMMENT ON CONSTRAINT ${ident(name)} ON ${qualified(table)} IS ${literal(`${invariant.urn} — ${invariant.message}`)};`);
    }
    return { lines, comments };
  };

  /** A table or index name must be unique in its schema. */
  const claim = (schema: string, name: string, urn: Urn, what: string) => {
    hooks.checkName(name, urn, what);
    const at = `${schema}.${name}`;
    const owner = names.get(at);
    if (owner !== undefined) hooks.nameTaken(at, urn, what, owner);
    names.set(at, urn);
  };

  /** The column of a key field in an entity: the property that holds it. */
  const keyColumn = (entity: Urn): Column => {
    const node = ir.entities[entity]!;
    const ref = node.fields.find((f) => 'field' in f && f.field === node.key)!;
    return { name: ref.name, type: domainType(node.key!) };
  };

  /** A link column's foreign key, or a note that the target is not a table. */
  const link = (table: Table, column: string, target: Urn, from: Urn) => {
    if (!roots.includes(target)) {
      hooks.unenforced(from, `the link "${column}" to ${target}: that entity is not a table in the postgres config, so no foreign key can name it`);
      return;
    }
    const { context, identifier } = urnParts(target);
    const name = `${table.name}_${column}_fkey`;
    hooks.checkName(name, from, 'foreign key');
    links.push(
      `ALTER TABLE ${qualified(table)} ADD CONSTRAINT ${ident(name)} FOREIGN KEY (${ident(column)}) REFERENCES ${ident(context)}.${ident(identifier)} (${ident(keyColumn(target).name)});`,
    );
  };

  /** The column of one single-valued property in `table`: a field's value, or a link. */
  const property = (table: Table, entity: Urn, ref: IRPropertyRef, columns: string[], comments: string[]) => {
    if ('entity' in ref) return;
    const field = 'field' in ref ? ref.field : ir.entities[ref.link]!.key!;
    columns.push(`${ident(ref.name)} ${domainType(field)}${ref.required ? ' NOT NULL' : ''}`);
    comments.push(`COMMENT ON COLUMN ${qualified(table)}.${ident(ref.name)} IS ${literal('field' in ref ? field : `${ref.link} (a link: the value of its key)`)};`);
    if ('link' in ref) link(table, ref.name, ref.link, entity);
  };

  /** A table for an entity: a root table, or a child table that holds one embedded entity per row. */
  const entityTable = (table: Table, entity: Urn, before: readonly string[], keyLines: readonly string[], comment: string) => {
    const columns: string[] = [...before];
    // A property cannot have the name of a column that the plugin adds: a parent key column or position.
    for (const ref of ir.entities[entity]!.fields) {
      if (table.owner !== undefined && !('entity' in ref) && ref.many === undefined && table.key.some((c) => c.name === ref.name)) {
        hooks.nameTaken(`${table.name}.${ref.name}`, entity, 'column', table.owner);
      }
    }
    const comments: string[] = [`COMMENT ON TABLE ${qualified(table)} IS ${literal(comment)};`];
    const children: (() => void)[] = [];
    for (const ref of ir.entities[entity]!.fields) {
      if ('entity' in ref || ref.many !== undefined) children.push(() => child(table, entity, ref));
      else property(table, entity, ref, columns, comments);
    }
    const checks = invariants(table, entity);
    tables.push('', `CREATE TABLE ${qualified(table)} (`, [...columns, ...keyLines, ...checks.lines].map((l) => `  ${l}`).join(',\n'), ');', ...comments, ...checks.comments);
    for (const make of children) make();
  };

  /** A child table for a list, or for an embedded entity. */
  const child = (parent: Table, owner: Urn, ref: IRPropertyRef) => {
    const name = `${parent.name}__${ref.name}`;
    claim(parent.schema, name, owner, 'child table');
    // The parent's key columns; a parent's own position is named after its property.
    const parentColumns = parent.key.map((c) => (c.name === 'position' ? { ...c, name: `${parent.property}_position` } : c));
    const many = ref.many;
    const key: Column[] = [...parentColumns, ...(many ? [{ name: 'position', type: 'INTEGER' }] : [])];
    const table: Table = { schema: parent.schema, name, key, property: ref.name, owner };
    for (const c of key) hooks.checkName(c.name, owner, 'column');

    const before = key.map((c) => `${ident(c.name)} ${c.type} NOT NULL${c.name === 'position' && many ? ' CHECK ("position" >= 0)' : ''}`);
    const keyLines = [
      `CONSTRAINT ${ident(`${name}_pkey`)} PRIMARY KEY (${columnList(key)})`,
      `CONSTRAINT ${ident(`${name}_parent_fkey`)} FOREIGN KEY (${columnList(parentColumns)}) REFERENCES ${qualified(parent)} (${columnList(parent.key)}) ON DELETE CASCADE`,
    ];
    hooks.checkName(`${name}_parent_fkey`, owner, 'foreign key');
    claim(parent.schema, `${name}_pkey`, owner, 'primary key');

    let comment: string;
    if ('entity' in ref) {
      comment = `${ref.entity} (embedded in ${owner} as ${ref.name})`;
      if (many?.unique) {
        const keyName = keyColumn(ref.entity).name;
        claim(parent.schema, `${name}_${keyName}_key`, owner, 'unique constraint');
        keyLines.push(`CONSTRAINT ${ident(`${name}_${keyName}_key`)} UNIQUE (${columnList([...parentColumns, { name: keyName, type: '' }])})`);
      }
      entityTable(table, ref.entity, before, keyLines, comment);
    } else {
      // A list of values: one value per row, in a column named after the property.
      const field = 'field' in ref ? ref.field : ir.entities[ref.link]!.key!;
      comment = `${'field' in ref ? ref.field : ref.link} (a list in ${owner} as ${ref.name})`;
      if (many?.unique) {
        claim(parent.schema, `${name}_${ref.name}_key`, owner, 'unique constraint');
        keyLines.push(`CONSTRAINT ${ident(`${name}_${ref.name}_key`)} UNIQUE (${columnList([...parentColumns, { name: ref.name, type: '' }])})`);
      }
      if (key.some((c) => c.name === ref.name)) hooks.nameTaken(`${name}.${ref.name}`, owner, 'column', owner);
      const columns = [...before, `${ident(ref.name)} ${domainType(field)} NOT NULL`];
      tables.push('', `CREATE TABLE ${qualified(table)} (`, [...columns, ...keyLines].map((l) => `  ${l}`).join(',\n'), ');', `COMMENT ON TABLE ${qualified(table)} IS ${literal(comment)};`);
      if ('link' in ref) link(table, ref.name, ref.link, owner);
    }

    // The count of items: absent and empty are both no rows, so an optional list cannot keep them apart.
    if (many && !ref.required) {
      hooks.unenforced(owner, `the optional list "${ref.name}": no rows can mean absent or empty, so the SQL keeps them apart only as no rows`);
    }
    const min = many ? (many.minItems ?? 0) : ref.required ? 1 : 0;
    const max = many ? many.maxItems : ref.required ? 1 : undefined;
    // An optional list may be absent, which is no rows: only a list with rows must have its count.
    const absentAllowed = many !== undefined && !ref.required;
    if (min > 0 || max !== undefined) count(parent, table, parentColumns, ref.name, owner, min, max, absentAllowed);
  };

  /** A deferred constraint trigger on the parent and on the child, which counts the child's rows. */
  const count = (parent: Table, table: Table, parentColumns: readonly Column[], propertyName: string, owner: Urn, min: number, max: number | undefined, absentAllowed: boolean) => {
    const check = `${table.name}_count`;
    for (const name of [check, `${check}_parent`, `${check}_item`]) hooks.checkName(name, owner, 'count function');
    hooks.checkName(`${propertyName}_count`, owner, 'count trigger');
    const params = parentColumns.map((c, i) => `p${i + 1} ${c.type}`).join(', ');
    const match = (columns: readonly Column[]) => columns.map((c, i) => `${ident(c.name)} = p${i + 1}`).join(' AND ');
    const args = (record: string, columns: readonly Column[]) => columns.map((c) => `${record}.${ident(c.name)}`).join(', ');
    const fn = (name: string) => `${ident(table.schema)}.${ident(name)}`;
    const bounds = [min > 0 ? `n < ${min}` : undefined, max === undefined ? undefined : `n > ${max}`].filter(Boolean).join(' OR ');
    const outside = absentAllowed ? `n > 0 AND (${bounds})` : bounds;
    counts.push(
      '',
      `CREATE FUNCTION ${fn(check)}(${params}) RETURNS void LANGUAGE plpgsql AS $$`,
      'DECLARE n bigint;',
      'BEGIN',
      `  IF NOT EXISTS (SELECT 1 FROM ${qualified(parent)} WHERE ${match(parent.key)}) THEN RETURN; END IF;`,
      `  SELECT count(*) INTO n FROM ${qualified(table)} WHERE ${match(parentColumns)};`,
      `  IF ${outside} THEN`,
      `    RAISE EXCEPTION ${literal(`${owner}: "${propertyName}" has % item(s); it must have ${countText(min, max)}`)}, n`,
      `      USING ERRCODE = 'check_violation', CONSTRAINT = ${literal(`${propertyName}_count`)}, SCHEMA = ${literal(parent.schema)}, TABLE = ${literal(parent.name)};`,
      '  END IF;',
      'END $$;',
      `CREATE FUNCTION ${fn(`${check}_parent`)}() RETURNS trigger LANGUAGE plpgsql AS $$`,
      `BEGIN PERFORM ${fn(check)}(${args('NEW', parent.key)}); RETURN NULL; END $$;`,
      `CREATE FUNCTION ${fn(`${check}_item`)}() RETURNS trigger LANGUAGE plpgsql AS $$`,
      'BEGIN',
      `  IF TG_OP <> 'DELETE' THEN PERFORM ${fn(check)}(${args('NEW', parentColumns)}); END IF;`,
      `  IF TG_OP <> 'INSERT' THEN PERFORM ${fn(check)}(${args('OLD', parentColumns)}); END IF;`,
      '  RETURN NULL;',
      'END $$;',
      `CREATE CONSTRAINT TRIGGER ${ident(`${propertyName}_count`)} AFTER INSERT OR UPDATE ON ${qualified(parent)} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${fn(`${check}_parent`)}();`,
      `CREATE CONSTRAINT TRIGGER ${ident(`${propertyName}_count`)} AFTER INSERT OR UPDATE OR DELETE ON ${qualified(table)} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${fn(`${check}_item`)}();`,
    );
  };

  for (const root of roots) {
    const { context, identifier } = urnParts(root);
    claim(context, identifier, root, 'table');
    const key = keyColumn(root);
    const table: Table = { schema: context, name: identifier, key: [key] };
    claim(context, `${identifier}_pkey`, root, 'primary key');
    const node = ir.entities[root]!;
    entityTable(table, root, [], [`CONSTRAINT ${ident(`${identifier}_pkey`)} PRIMARY KEY (${ident(key.name)})`], describe(root, node.description, node));
  }

  return [...tables, ...(links.length > 0 ? ['', ...links] : []), ...counts];
}

