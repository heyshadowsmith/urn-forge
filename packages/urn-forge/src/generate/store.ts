/**
 * The store file, `domain.store.generated.ts`: for each table of the config, pure functions that give
 * the statements of a write or a read, and build a value back from the rows of a read. They make no
 * call: the shell runs the statements with its own driver, in its own transaction.
 */
import type { Model } from '../model.js';
import { pascal, typeName } from './code.js';
import { buildTables, type Table } from './tables.js';

/** The tree of tables, as data for the helpers of the store file. */
function describe(table: Table, schema: string): unknown {
  return {
    name: `"${schema}"."${table.name}"`,
    kind: table.kind,
    key: table.key.map((c) => c.name),
    parentKey: table.parentKey.map((c) => c.name),
    columns: table.columns.map((c) => ({ name: c.name, path: c.path, integer: c.base === 'integer', ...(c.definition === undefined ? { flag: true } : {}) })),
    // A list with no flag is required: it is a list, also with no rows.
    lists: table.children.map((c) => ({ path: c.list!.path, ...(c.list!.flag ? { flag: c.list!.flag } : {}) })),
    children: table.children.map((c) => describe(c, schema)),
  };
}

const HELPERS = `/** A statement of a write or a read, for the driver of the shell: its text, and the values of $1, $2, …. */
export interface Statement {
  readonly text: string;
  readonly values: readonly unknown[];
}

/** A row that the driver gives for a statement of a read. */
export type Row = Readonly<Record<string, unknown>>;

interface TableInfo {
  readonly name: string;
  readonly kind: 'root' | 'objects' | 'values';
  readonly key: readonly string[];
  readonly parentKey: readonly string[];
  readonly columns: readonly { readonly name: string; readonly path: readonly string[]; readonly integer: boolean; readonly flag?: true }[];
  readonly lists: readonly { readonly path: readonly string[]; readonly flag?: string }[];
  readonly children: readonly TableInfo[];
}

const quote = (name: string): string => \`"\${name.replace(/"/g, '""')}"\`;

function at(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) current = typeof current === 'object' && current !== null ? (current as Record<string, unknown>)[key] : undefined;
  return current;
}

function put(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let current = target;
  path.slice(0, -1).forEach((key) => {
    current = (current[key] ??= {}) as Record<string, unknown>;
  });
  current[path.at(-1)!] = value;
}

/** The statements that insert a row and the rows of its lists. */
function insertRows(table: TableInfo, value: unknown, parentKey: readonly unknown[], position: number | undefined, statements: Statement[]): void {
  const names = [...table.parentKey, ...(position === undefined ? [] : ['position']), ...table.columns.map((c) => c.name)];
  const values: unknown[] = [...parentKey, ...(position === undefined ? [] : [position])];
  for (const column of table.columns) {
    const part = table.kind === 'values' ? value : at(value, column.path);
    values.push(column.flag ? part !== undefined : (part ?? null));
  }
  statements.push({
    text: \`INSERT INTO \${table.name} (\${names.map(quote).join(', ')}) VALUES (\${values.map((_, i) => \`$\${i + 1}\`).join(', ')})\`,
    values,
  });
  const key = table.key.map((name) => values[names.indexOf(name)]);
  table.children.forEach((child, i) => {
    const list = at(value, table.lists[i]!.path);
    if (Array.isArray(list)) list.forEach((item, index) => insertRows(child, item, key, index, statements));
  });
}

/** The statements that read a row and the rows of its lists, by the identifier of the row. */
function selectRows(table: TableInfo, statements: Statement[], keyColumn: string, identifier: unknown): void {
  statements.push({ text: \`SELECT * FROM \${table.name} WHERE \${quote(keyColumn)} = $1 ORDER BY \${table.key.map(quote).join(', ')}\`, values: [identifier] });
  for (const child of table.children) selectRows(child, statements, keyColumn, identifier);
}

/** The value of a row: its columns at their paths, with no part for a column that is null. */
function rowValue(table: TableInfo, row: Row): { value: Record<string, unknown> | unknown } {
  if (table.kind === 'values') {
    const column = table.columns[0]!;
    const raw = row['value'];
    return { value: column.integer && raw !== null ? Number(raw) : raw };
  }
  const value: Record<string, unknown> = {};
  for (const column of table.columns) {
    if (column.flag) continue;
    const raw = row[column.name];
    if (raw === null || raw === undefined) continue;
    put(value, column.path, column.integer ? Number(raw) : raw);
  }
  // A required list, or an optional one whose flag is true, is a list, also with no rows.
  for (const list of table.lists) if (!list.flag || row[list.flag] === true) put(value, list.path, []);
  return { value };
}

/** A value built back from the rows of the statements of a read, in their order; undefined for no row. */
function fromRows(root: TableInfo, rows: readonly (readonly Row[])[]): unknown {
  const tables: { table: TableInfo; parent?: TableInfo; path?: readonly string[] }[] = [];
  const walk = (table: TableInfo, parent?: TableInfo, path?: readonly string[]): void => {
    tables.push({ table, ...(parent ? { parent, path: path! } : {}) });
    table.children.forEach((child, i) => walk(child, table, table.lists[i]!.path));
  };
  walk(root);
  const byKey = new Map<TableInfo, Map<string, unknown>>();
  let result: unknown;
  tables.forEach(({ table, parent, path }, i) => {
    const values = new Map<string, unknown>();
    byKey.set(table, values);
    for (const row of rows[i] ?? []) {
      const { value } = rowValue(table, row);
      values.set(JSON.stringify(table.key.map((k) => String(row[k]))), value);
      if (!parent) {
        result = value;
        continue;
      }
      const owner = byKey.get(parent)!.get(JSON.stringify(table.parentKey.map((k) => String(row[k]))));
      const list = at(owner, path!);
      if (Array.isArray(list)) list[Number(row['position'])] = value;
    }
  });
  return result;
}
`;

/** The store file of the tables of the config. */
export function storeFile(model: Model, tableNames: readonly string[], header: string): string {
  const tables = buildTables(model, tableNames);
  const schema = model.header.domain;
  const lines: string[] = [header, HELPERS];
  const types = new Set<string>();
  for (const table of tables) {
    const type = typeName(table.definition);
    const identifier = model.definitions[table.definition]!.identifier!;
    const keyType = typeName(identifier);
    types.add(type);
    types.add(keyType);
    const info = `${pascal(table.name).toUpperCase()}_TABLE`;
    const name = pascal(table.name);
    const camel = name[0]!.toLowerCase() + name.slice(1);
    lines.push(
      `const ${info}: TableInfo = ${JSON.stringify(describe(table, schema))};`,
      '',
      `/** The statements that write a new ${table.definition}: its row and the rows of its lists. */`,
      `export function insert${name}(value: ${type}): Statement[] {`,
      `  const statements: Statement[] = [];`,
      `  insertRows(${info}, value, [], undefined, statements);`,
      `  return statements;`,
      `}`,
      '',
      `/** The statement that deletes a ${table.definition}; its lists go with it. */`,
      `export function delete${name}(${identifier}: ${keyType}): Statement[] {`,
      `  return [{ text: \`DELETE FROM \${${info}.name} WHERE "${identifier}" = $1\`, values: [${identifier}] }];`,
      `}`,
      '',
      `/** The statements that write a ${table.definition} in the place of the one with its identifier. */`,
      `export function replace${name}(value: ${type}): Statement[] {`,
      `  return [...delete${name}(value.${identifier}), ...insert${name}(value)];`,
      `}`,
      '',
      `/** The statements that read a ${table.definition} by its identifier: run each, and give their rows to ${camel}FromRows. */`,
      `export function select${name}(${identifier}: ${keyType}): Statement[] {`,
      `  const statements: Statement[] = [];`,
      `  selectRows(${info}, statements, ${JSON.stringify(identifier)}, ${identifier});`,
      `  return statements;`,
      `}`,
      '',
      `/** The ${table.definition} of the rows of the statements of select${name}, in their order, or undefined when it has no row. */`,
      `export function ${camel}FromRows(rows: readonly (readonly Row[])[]): ${type} | undefined {`,
      `  return fromRows(${info}, rows) as ${type} | undefined;`,
      `}`,
      '',
    );
  }
  lines.splice(1, 0, `import type { ${[...types].sort().join(', ')} } from './domain.generated.js';`, '');
  return lines.join('\n');
}
