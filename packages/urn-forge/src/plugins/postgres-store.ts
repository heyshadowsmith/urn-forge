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
  const parts = [`import type * as s from './domain.schemas.generated.js';`, ...(answers ? [answersImports()] : []), '', changed ? RUNTIME + RUNTIME_FROM : RUNTIME];
  for (const root of store) {
    const entity = ir.entities[root.entity]!;
    const brand = entity.brandIdentifier;
    const keyBrand = ir.fields[entity.key!]!.brandIdentifier;
    const table = `${brand}Table`;
    const key = JSON.stringify(root.keyProperty);
    parts.push(
      '',
      `/** The tables of ${root.entity}. */`,
      `const ${table}: Table = ${tableLiteral(root, '').trimStart()};`,
      '',
      `/** The statements that insert one ${root.entity}, and its child rows. */`,
      `export function insert${brand}(value: s.${brand}): readonly Statement[] {`,
      `  return insertRows(${table}, ${key}, value as Readonly<Record<string, unknown>>);`,
      '}',
      '',
      `/** The statements that replace one ${root.entity}: a delete of the old rows, then an insert. */`,
      `export function replace${brand}(value: s.${brand}): readonly Statement[] {`,
      `  return [...deleteRows(${table}, value[${key}]), ...insertRows(${table}, ${key}, value as Readonly<Record<string, unknown>>)];`,
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
        `  return [...deleteRowsFrom(${table}, value[${key}], ${JSON.stringify(column)}, from), ...insertRows(${table}, ${key}, value as Readonly<Record<string, unknown>>)];`,
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
  const commit = commitStore(ir, store, outbox);
  if (commit) parts.push(commit);
  return `${parts.join('\n')}\n`;
}

/**
 * `commit`: the statements of a call, for a domain with an operation that changes a stored record or
 * with an outbox. A refusal gives none. A success gives the new record of an operation that changes
 * a stored record and answers it, the statements of `writes`, and the events that the outbox holds.
 */
function commitStore(ir: UniversalIR, store: readonly StoreRoot[], outbox: boolean): string | undefined {
  const tables = new Set(store.map((root) => root.entity));
  const changes = valuesInUrnOrder(ir.operations).flatMap((op) => {
    if (!op.changes || !tables.has(op.changes.entity) || op.output !== op.changes.entity) return [];
    const brand = ir.entities[op.changes.entity]!.brandIdentifier;
    return [`  ${JSON.stringify(op.urn)}: (output) => replace${brand}From(output as s.${brand}, ${JSON.stringify(op.changes.from)}),`];
  });
  const changesTable = valuesInUrnOrder(ir.operations).some((op) => op.changes !== undefined && tables.has(op.changes.entity));
  if (!changesTable && !outbox) return undefined;
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
