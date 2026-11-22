/** The store model (store plan, decision 2): each table's columns in the model are the columns of its CREATE TABLE. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { tablesSql, type StoreTable } from '../src/plugins/postgres-tables.js';

const cases = [
  { name: 'insurance', manifest: '../insurance/domain.manifest.yaml', tables: ['customer.entity.customer', 'policy.entity.policy'] },
  { name: 'postgres fixture', manifest: './fixtures/postgres/domain.manifest.yaml', tables: ['value.entity.sample'] },
] as const;

/** The column names of each CREATE TABLE, by "schema"."name". */
function createdColumns(lines: readonly string[]): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  const sql = lines.join('\n');
  for (const match of sql.matchAll(/CREATE TABLE "([^"]+)"\."([^"]+)" \(\n([\s\S]*?)\n\);/gu)) {
    const columns = match[3]!.split(',\n').map((l) => l.trim()).filter((l) => l.startsWith('"')).map((l) => /^"([^"]+)"/u.exec(l)![1]!);
    tables.set(`${match[1]}.${match[2]}`, columns);
  }
  return tables;
}

/** Every table of the model, with the columns that a store statement writes: the key, then the values. */
function modelColumns(tables: readonly StoreTable[], into = new Map<string, string[]>()): Map<string, string[]> {
  for (const table of tables) {
    // A root's key is also one of its value columns; a child's key columns come from the parent and position.
    const columns = [...table.key, ...table.columns.map((c) => c.column)];
    into.set(`${table.schema}.${table.name}`, [...new Set(columns)]);
    modelColumns(table.children, into);
  }
  return into;
}

describe('the store model', () => {
  it.each(cases)('$name: each table of the model writes each column of its CREATE TABLE', ({ manifest, tables }) => {
    const ir = compile(readFileSync(new URL(manifest, import.meta.url), 'utf8')).ir!;
    const noop = () => undefined;
    const roots = tables.map((key) => Object.keys(ir.entities).find((urn) => urn.endsWith(`:${key.replace('.entity.', ':entity:')}`))!);
    const { lines, store } = tablesSql(ir, roots as never, { checkName: noop, nameTaken: noop, unenforced: noop });
    const created = createdColumns(lines);
    const model = modelColumns(store);
    expect([...model.keys()].sort()).toEqual([...created.keys()].sort());
    for (const [table, columns] of created) expect([...model.get(table)!].sort(), table).toEqual([...columns].sort());
  });
});
