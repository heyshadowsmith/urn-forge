/**
 * `domain.store.generated.ts`: for each table entity, the statements that insert,
 * replace and delete one value. The tables are the model that tablesSql builds in the same pass
 * as the CREATE statements, so a column of the schema cannot be missing from an insert.
 *
 * A statement is `{ text, values }` with `$1`, `$2`, … parameters: no driver, so node-postgres,
 * PGlite and postgres.js can each run it. The shell runs the statements of one call in one
 * transaction; the count triggers check at COMMIT.
 */
import type { UniversalIR } from '../ir/types.js';
import { schemaNames } from '../naming.js';
import { answersImports, answersStore, hasAnswers } from './postgres-idempotency.js';
import { hasOutbox, outboxStore } from './postgres-outbox.js';
import type { StoreChild, StoreRoot, StoreTable } from './postgres-tables.js';
import { FCIS_RUNTIME_FILE } from './fcis.plugin.js';
import { uniqueIndexName } from './postgres.plugin.js';
import { valuesInUrnOrder } from './plugin.interface.js';

export const POSTGRES_STORE_FILE = 'domain.store.generated.ts';

/** Fixed text: the Statement type and the functions that turn a value into rows. */
const RUNTIME = `/** A statement to run, with its parameters: the form that node-postgres and PGlite take. */
export interface Statement {
  readonly text: string;
  readonly values: readonly unknown[];
}

/** A table: its key columns, and each other column with the property that gives its value ('' for a list of values). */
interface Table {
  readonly schema: string;
  readonly name: string;
  readonly key: readonly string[];
  readonly columns: readonly (readonly [column: string, property: string])[];
  readonly children: readonly Child[];
}

/** A child table: the property of the parent that it holds, and whether it is a list (with a position). */
interface Child extends Table {
  readonly property: string;
  readonly many: boolean;
}

const quote = (name: string) => \`"\${name.replaceAll('"', '""')}"\`;

/** One INSERT for the row, then the rows of its child tables, parent before child. */
function insertRow(table: Table, columns: readonly string[], values: readonly unknown[], out: Statement[]): void {
  const parameters = values.map((_, i) => \`$\${i + 1}\`).join(', ');
  out.push({ text: \`INSERT INTO \${quote(table.schema)}.\${quote(table.name)} (\${columns.map(quote).join(', ')}) VALUES (\${parameters})\`, values });
}

/** The rows of a child table for the value of its parent; \`parentKey\` is the key of the parent row. */
function insertChild(child: Child, parent: Readonly<Record<string, unknown>>, parentKey: readonly unknown[], out: Statement[]): void {
  const held = parent[child.property];
  const items: readonly unknown[] = held === undefined || held === null ? [] : child.many ? (held as readonly unknown[]) : [held];
  items.forEach((item, position) => {
    const key = child.many ? [...parentKey, position] : [...parentKey];
    const values = child.columns.map(([, property]) => (property === '' ? item : ((item as Record<string, unknown>)[property] ?? null)));
    insertRow(child, [...child.key, ...child.columns.map(([column]) => column)], [...key, ...values], out);
    for (const grandchild of child.children) insertChild(grandchild, item as Record<string, unknown>, key, out);
  });
}

function insertRows(table: Table, keyProperty: string, value: Readonly<Record<string, unknown>>): readonly Statement[] {
  const out: Statement[] = [];
  insertRow(table, table.columns.map(([column]) => column), table.columns.map(([, property]) => value[property] ?? null), out);
  for (const child of table.children) insertChild(child, value, [value[keyProperty]], out);
  return out;
}

/** One DELETE of the root row: the child rows go with it (ON DELETE CASCADE). */
function deleteRows(table: Table, key: unknown): readonly Statement[] {
  return [{ text: \`DELETE FROM \${quote(table.schema)}.\${quote(table.name)} WHERE \${quote(table.key[0]!)} = $1\`, values: [key] }];
}`;

/** Fixed text for a store with an entity that an operation changes: the DELETE that only takes a row in one of the states. */
const RUNTIME_FROM = `
/** One DELETE of the root row, only while its state is one of \`from\`: no row when the record moved first. */
function deleteRowsFrom(table: Table, key: unknown, column: string, from: readonly string[]): readonly Statement[] {
  return [{ text: \`DELETE FROM \${quote(table.schema)}.\${quote(table.name)} WHERE \${quote(table.key[0]!)} = $1 AND \${quote(column)} = ANY($2)\`, values: [key, from] }];
}`;

/** A table of the model as a TypeScript literal. */
function tableLiteral(table: StoreTable, indent: string): string {
  const inner = `${indent}  `;
  const child = (table as Partial<StoreChild>).property !== undefined ? `${inner}property: ${JSON.stringify((table as StoreChild).property)},\n${inner}many: ${(table as StoreChild).many},\n` : '';
  const columns = table.columns.map((c) => `[${JSON.stringify(c.column)}, ${JSON.stringify(c.property)}]`).join(', ');
  const children = table.children.length === 0 ? '[]' : `[\n${table.children.map((c) => `${inner}  ${tableLiteral(c, `${inner}  `).trimStart()}`).join(',\n')},\n${inner}]`;
  return `${indent}{\n${inner}schema: ${JSON.stringify(table.schema)},\n${inner}name: ${JSON.stringify(table.name)},\n${inner}key: [${table.key.map((k) => JSON.stringify(k)).join(', ')}],\n${inner}columns: [${columns}],\n${child}${inner}children: ${children},\n${indent}}`;
}

/** The query of a timed change: the keys of the rows that it is due for. */
export interface DueQuery {
  /** The export: select<Operation brand>Due. */
  readonly name: string;
  readonly operation: string;
  readonly ruleText: string;
  readonly from: readonly string[];
  /** The SELECT, with now as $1, the states of from as $2 and the limit as $3. */
  readonly text: string;
}

/** The store file for the tables and the outbox, or undefined when there is neither. */
export function storeFile(ir: UniversalIR, store: readonly StoreRoot[], dues: readonly DueQuery[] = []): string | undefined {
  const outbox = hasOutbox(ir);
  const answers = hasAnswers(ir);
  if (store.length === 0 && !outbox && !answers) return undefined;
  // The state property of each table entity that an operation changes.
  const states = new Map<string, string>();
  for (const operation of Object.values(ir.operations)) if (operation.changes) states.set(operation.changes.entity, operation.changes.property);
  const changed = store.some((root) => states.has(root.entity));
  const unique = store.some((root) => (ir.entities[root.entity]!.unique ?? []).length > 0);
  const anyForever = store.some((root) => (ir.entities[root.entity]!.unique ?? []).some((u) => u.forever));
  const parts = [
    `import type * as s from './domain.schemas.generated.js';`,
    ...(answers ? [answersImports()] : []),
    ...(unique ? [`import { refusalOf, type ExecuteResult } from './${FCIS_RUNTIME_FILE.replace(/\.ts$/, '.js')}';`] : []),
    '',
    (changed ? RUNTIME + RUNTIME_FROM : RUNTIME) + (anyForever ? USED : ''),
  ];
  for (const root of store) {
    const entity = ir.entities[root.entity]!;
    const brand = entity.brandIdentifier;
    const keyBrand = ir.fields[entity.key!]!.brandIdentifier;
    const table = `${brand}Table`;
    const key = JSON.stringify(root.keyProperty);
    // The values that a record uses for good: forever entries of unique, kept in the table of used values.
    const foreverBy = (entity.unique ?? []).filter((u) => u.forever).map((u) => u.by);
    const forever = foreverBy.length > 0;
    // A new record claims its values; a replace of a record may write its own values again.
    const usedCall = (fresh: boolean) => `usedValues(${JSON.stringify(root.name)}, ${JSON.stringify(foreverBy)}, value as Readonly<Record<string, unknown>>, ${key}, ${fresh})`;
    parts.push(
      '',
      `/** The tables of ${root.entity}. */`,
      `const ${table}: Table = ${tableLiteral(root, '').trimStart()};`,
      '',
      `/** The statements that insert one ${root.entity}, and its child rows${forever ? ', and the values that it uses for good' : ''}. */`,
      `export function insert${brand}(value: s.${brand}): readonly Statement[] {`,
      `  return ${forever ? '[...' : ''}insertRows(${table}, ${key}, value as Readonly<Record<string, unknown>>)${forever ? `, ...${usedCall(true)}]` : ''};`,
      '}',
      '',
      `/** The statements that replace one ${root.entity}: a delete of the old rows, then an insert. */`,
      `export function replace${brand}(value: s.${brand}): readonly Statement[] {`,
      `  return [...deleteRows(${table}, value[${key}]), ...insertRows(${table}, ${key}, value as Readonly<Record<string, unknown>>)${forever ? `, ...${usedCall(false)}` : ''}];`,
      '}',
      '',
      `/** The statement that deletes one ${root.entity} by its key, with its child rows. */`,
      `export function delete${brand}(key: s.${keyBrand}): readonly Statement[] {`,
      `  return deleteRows(${table}, key);`,
      '}',
    );
    const property = states.get(root.entity);
    const column = property === undefined ? undefined : root.columns.find((c) => c.property === property)?.column;
    if (property !== undefined && column !== undefined) {
      const ref = entity.fields.find((f) => f.name === property);
      const stateBrand = ref && 'field' in ref ? ir.fields[ref.field]!.brandIdentifier : undefined;
      parts.push(
        '',
        `/**`,
        ` * The statements that replace one ${root.entity} while its ${property} is one of \`from\`. The first statement`,
        ` * deletes no row when the record moved since the shell loaded it: check that it deleted one, else roll back.`,
        ` */`,
        `export function replace${brand}From(value: s.${brand}, from: readonly ${stateBrand ? `s.${schemaNames(stateBrand).input}` : 'string'}[]): readonly Statement[] {`,
        `  return [...deleteRowsFrom(${table}, value[${key}], ${JSON.stringify(column)}, from), ...insertRows(${table}, ${key}, value as Readonly<Record<string, unknown>>)${forever ? `, ...${usedCall(false)}` : ''}];`,
        '}',
      );
    }
  }
  for (const due of dues) {
    parts.push(
      '',
      `/**`,
      ` * The keys of the rows that ${due.operation} is due for at \`now\`: in a state of ${due.from.join(', ')}, where ${due.ruleText}.`,
      ` * The shell's clock runs the operation for each, in its own transaction.`,
      ` */`,
      `export function ${due.name}(now: string, limit: number): Statement {`,
      `  return { text: ${JSON.stringify(due.text)}, values: [now, ${JSON.stringify(due.from)}, limit] };`,
      '}',
    );
  }
  if (outbox) parts.push(outboxStore(ir));
  if (answers) parts.push(answersStore(ir));
  const commit = commitStore(ir, store, outbox, unique);
  if (commit) parts.push(commit);
  if (unique) parts.push(commitOnceStore(ir, store, answers));
  return `${parts.join('\n')}\n`;
}

/**
 * `commit`: the statements of a call, for a domain with an operation that changes a stored record or
 * with an outbox. A refusal gives none. A success gives the new record of an operation that changes
 * a stored record and answers it, the statements of `writes`, and the events that the outbox holds.
 */
function commitStore(ir: UniversalIR, store: readonly StoreRoot[], outbox: boolean, unique = false): string | undefined {
  const tables = new Set(store.map((root) => root.entity));
  const changes = valuesInUrnOrder(ir.operations).flatMap((op) => {
    if (!op.changes || !tables.has(op.changes.entity) || op.output !== op.changes.entity) return [];
    const brand = ir.entities[op.changes.entity]!.brandIdentifier;
    return [`  ${JSON.stringify(op.urn)}: (output) => replace${brand}From(output as s.${brand}, ${JSON.stringify(op.changes.from)}),`];
  });
  const changesTable = valuesInUrnOrder(ir.operations).some((op) => op.changes !== undefined && tables.has(op.changes.entity));
  if (!changesTable && !outbox && !unique) return undefined;
  return `
/** A result of executeOperation: a success has its output and events; a refusal has neither. */
export type CommitResult =
  | { readonly ok: true; readonly urn: string; readonly output: unknown; readonly events: readonly { readonly urn: string; readonly fields: object }[] }
  | { readonly ok: false };

/** For each operation that changes a stored record and answers it: the statements of the new record, while it is in a state of from. */
const Changes: Readonly<Record<string, (output: unknown) => readonly Statement[]>> = {
${changes.join('\n')}
};

/**
 * The statements of a call, to run in its transaction. A refusal changes nothing: it gives no
 * statement. A success gives the new record of an operation that changes a stored record and
 * answers it, then the statements that \`writes\` gives for the output${outbox ? ', then the events of the outbox' : ''}.
 * Write nothing for a call but these.
 */
export function commit(result: CommitResult, writes: (output: unknown) => readonly Statement[] = () => []): readonly Statement[] {
  if (!result.ok) return [];
  const change = Object.hasOwn(Changes, result.urn) ? Changes[result.urn]! : () => [];
  return [...change(result.output), ...writes(result.output)${outbox ? ', ...insertEvents(result.events.filter((event) => Object.hasOwn(Delivery, event.urn)))' : ''}];
}`;
}

/** The used values of a record: for each forever entry of unique, one row that is never deleted. */
const USED = `

/**
 * The statements that keep the values that a record uses for good. A new record (\`fresh\`) claims
 * each value: a value used before, by any record, also one that is gone, is refused. A replace of a
 * record may write its own values again; another record's value is refused.
 */
function usedValues(table: string, entries: readonly (readonly string[])[], value: Readonly<Record<string, unknown>>, key: string, fresh: boolean): readonly Statement[] {
  return entries.map((by) => ({
    text: \`INSERT INTO \${quote('used')}.\${quote(table)} ("by", "value", "owner") VALUES ($1, $2, $3)\${fresh ? '' : ' ON CONFLICT ("by", "value", "owner") DO NOTHING'}\`,
    values: [by.join(','), JSON.stringify(by.map((name) => value[name])), JSON.stringify(value[key])],
  }));
}`;

/**
 * \`commitOnce\`: the statements of \`commit\`, run in a savepoint. A clash with an index of a unique
 * entry that has \`otherwise\` rolls back to the savepoint and gives the declared refusal.
 */
function commitOnceStore(ir: UniversalIR, store: readonly StoreRoot[], answers: boolean): string {
  const clashes = store.flatMap((root) =>
    (ir.entities[root.entity]!.unique ?? []).flatMap((entry) => (entry.otherwise && !entry.forever ? [`  ${JSON.stringify(uniqueIndexName(root.name, entry.by))}: ${JSON.stringify(entry.otherwise)},`] : [])),
  );
  return `${answers ? '' : `
/** Runs one statement, in the transaction of the call, and gives its rows: the query function of your driver. */
export type Query = (statement: Statement) => Promise<{ readonly rows: readonly Readonly<Record<string, unknown>>[] }>;
`}
/** The index of each unique entry with otherwise, and the declared error of a clash with it. */
const Clashes: Readonly<Record<string, string>> = {
${clashes.join('\n')}
};

/**
 * Runs the statements of \`commit\` in the transaction of the call, in a savepoint. A clash with a unique
 * entry that has \`otherwise\` rolls back to the savepoint, so the call writes nothing, and gives the declared
 * error, filled by name from the answer. Any other error of the database is thrown, as it is.
 */
export async function commitOnce(
  query: Query,
  result: CommitResult,
  writes: (output: unknown) => readonly Statement[] = () => [],
): Promise<CommitResult | ExecuteResult> {
  if (!result.ok) return result;
  await query({ text: 'SAVEPOINT urn_forge_commit', values: [] });
  try {
    for (const statement of commit(result, writes)) await query(statement);
  } catch (error) {
    const { code, constraint } = error as { readonly code?: unknown; readonly constraint?: unknown };
    const errorUrn = code === '23505' && typeof constraint === 'string' && Object.hasOwn(Clashes, constraint) ? Clashes[constraint] : undefined;
    const refusal = errorUrn === undefined ? undefined : refusalOf(result.urn, errorUrn, result.output as Readonly<Record<string, unknown>>);
    if (!refusal) throw error;
    await query({ text: 'ROLLBACK TO SAVEPOINT urn_forge_commit', values: [] });
    return refusal;
  }
  await query({ text: 'RELEASE SAVEPOINT urn_forge_commit', values: [] });
  return result;
}`;
}
