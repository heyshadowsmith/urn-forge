/**
 * The Postgres schema of the booking fixture runs on PGlite, and its CHECK constraints refuse what the
 * rules refuse.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { compileManifest } from '../src/index.js';
import ts from 'typescript';
import { longNames, postgresProblems, postgresSchema } from '../src/generate/postgres.js';
import { storeFile } from '../src/generate/store.js';

const schema = readFileSync(new URL('./fixtures/booking/generated/schema.generated.sql', import.meta.url), 'utf8');

const row: Record<string, unknown> = {
  reference: 'ABCDEFGH',
  party_size: 4,
  state: 'confirmed',
  starts_at: '2026-11-24T19:00:00Z',
  ends_at: '2026-11-24T21:00:00Z',
  contact_email: 'ada@example.com',
  has_tables: false,
  has_dishes: false,
};

async function insert(values: Record<string, unknown>): Promise<string> {
  const db = new PGlite();
  await db.exec(schema);
  const keys = Object.keys(values);
  try {
    await db.query(`INSERT INTO "booking"."booking" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(values));
    return 'inserted';
  } catch (error) {
    const e = error as { constraint?: string; column?: string; message: string };
    return e.constraint ?? (e.column ? `not null: ${e.column}` : e.message);
  } finally {
    await db.close();
  }
}

describe('the booking table', () => {
  it('takes a row that keeps the rules', async () => {
    expect(await insert(row)).toBe('inserted');
  });

  it.each([
    [{ party_size: 0 }, 'booking_party_size_minimum'],
    [{ reference: 'abc' }, 'booking_reference_pattern'],
    [{ state: 'lost' }, 'booking_state_enum'],
    [{ party_size: 8 }, 'booking_large_party_pays_deposit'],
    [{ ends_at: '2026-11-24T19:15:00Z' }, 'booking_ends_after_start'],
    [{ note: 'A table by the window too' }, 'booking_note_maxLength'],
  ])('refuses %j with %s', async (change, constraint) => {
    expect(await insert({ ...row, ...change })).toBe(constraint);
  });

  it('refuses a row with no required property', async () => {
    const withoutState = Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'state'));
    expect(await insert(withoutState)).toBe('not null: state');
  });

  it('names the rules that SQL cannot say, and has no JSONB column', () => {
    expect(schema).toContain('-- Not in SQL; the harness checks these rules: booking: total_is_the_dishes');
    expect(schema).not.toContain('JSONB');
  });
});

it('joins two strings with ||, not +', () => {
  const manifest = `manifest:
  namespace: demo
  domain: dates
  version: 0.1.0
definitions:
  code:
    description: A code
    type: string
  day:
    description: A day
    type: string
    rules:
      - format: date
  holiday:
    description: A holiday
    type: object
    identifier: code
    properties: [code, day]
    rules:
      - required: [code, day]
      - after_2000
rules:
  after_2000:
    description: After 2000
    rule: timestamp(self.day + 'T00:00:00Z') > timestamp('2000-01-01T00:00:00Z')
    failure_message: Before 2000
`;
  const compiled = compileManifest(manifest);
  const sql = postgresSchema(compiled.model!, compiled.applications, { tables: ['holiday'] });
  expect(sql).toContain(`CHECK (((("day" || 'T00:00:00Z'))::TIMESTAMPTZ > ('2000-01-01T00:00:00Z')::TIMESTAMPTZ))`);
});

describe('the postgres config', () => {
  const { model } = compileManifest(readFileSync(new URL('./fixtures/booking/domain.manifest.yaml', import.meta.url), 'utf8'));

  it('takes objects with an identifier as tables', () => {
    expect(postgresProblems(model!, { tables: ['contact', 'reference'] }).map((p) => p.message)).toEqual([
      'contact has no identifier; a table needs one for its primary key',
      'reference is not an object definition of the manifest',
    ]);
  });

  it('takes references to the identifier of a table, and unique properties of the table', () => {
    const problems = postgresProblems(model!, { tables: ['booking'], references: { booking: { state: 'booking' } }, unique: { booking: [['starts_at', 'room']] } });
    expect(problems.map((p) => p.message)).toEqual(['state is not of the type of the identifier of booking, reference', 'room is not a property of booking']);
  });
});

describe('nested parts', () => {
  const manifest = `manifest:
  namespace: demo
  domain: shop
  version: 0.1.0
definitions:
  order_id:
    description: An order id
    type: string
  street:
    description: A street
    type: string
  zip:
    description: A zip code
    type: string
    rules:
      - pattern: '^[0-9]{5}$'
  address:
    description: An address
    type: object
    properties: [street, zip]
    rules:
      - required: [street]
  tag:
    description: A tag
    type: string
  tags:
    description: Tags
    type: array
    items: tag
    rules:
      - uniqueItems
  sku:
    description: A SKU
    type: string
  line:
    description: A line
    type: object
    properties: [sku, tags]
    rules:
      - required: [sku, tags]
  lines:
    description: The lines of an order
    type: array
    items: line
    rules:
      - minItems: 1
  notes:
    description: Notes
    type: array
    items: tag
  order:
    description: An order
    type: object
    identifier: order_id
    properties: [order_id, address, lines, notes]
    rules:
      - required: [order_id, lines]
`;
  const compiled = compileManifest(manifest);
  const sql = postgresSchema(compiled.model!, compiled.applications, { tables: ['order'] });
  type Statement = { text: string; values: readonly unknown[] };
  /** The store file of the order, run as JavaScript. */
  const storeModule = (): { insertOrder: (v: unknown) => Statement[]; replaceOrder: (v: unknown) => Statement[]; selectOrder: (id: string) => Statement[]; orderFromRows: (rows: unknown[][]) => unknown } => {
    const source = storeFile(compiled.model!, ['order'], '').replace(/^import type .*$/m, '');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} as Record<string, (...args: any[]) => Statement[]> };
    new Function('module', 'exports', js)(module, module.exports);
    return module.exports as never;
  };

  async function attempt(statements: string[]): Promise<string> {
    const db = new PGlite();
    await db.exec(sql);
    try {
      await db.exec('BEGIN');
      for (const statement of statements) await db.exec(statement);
      await db.exec('COMMIT');
      return 'ok';
    } catch (error) {
      return (error as { constraint?: string }).constraint ?? (error as Error).message;
    } finally {
      await db.close();
    }
  }
  const order = (columns: string, values: string) => `INSERT INTO "shop"."order" ("order_id", "has_notes"${columns}) VALUES ('o1', FALSE${values})`;
  const line = `INSERT INTO "shop"."order__lines" ("order_id", "position", "sku") VALUES ('o1', 0, 'A1')`;

  it('gives a list inside an item a table of the child, with both positions in its key', () => {
    expect(sql).toContain('CREATE TABLE "shop"."order__lines__tags" (');
    expect(sql).toContain('CONSTRAINT "order__lines__tags_pkey" PRIMARY KEY ("order_id", "lines_position", "position")');
  });

  it('takes an order with a line and no address', async () => {
    expect(await attempt([order('', ''), line])).toBe('ok');
  });

  it('refuses an address with no street, but not an absent address', async () => {
    expect(await attempt([order(', "address_zip"', ", '12345'"), line])).toBe('order_address_required');
    expect(await attempt([order(', "address_street", "address_zip"', ", 'Main', '1'"), line])).toBe('order_address_zip_pattern');
  });

  it('refuses an order with no line at the end of the transaction', async () => {
    expect(await attempt([order('', '')])).toBe('order__lines_minItems');
  });

  it('refuses rows of an optional list whose flag is false', async () => {
    expect(await attempt([order('', ''), line, `INSERT INTO "shop"."order__notes" ("order_id", "position", "value") VALUES ('o1', 0, 'gift')`])).toBe('order__notes_listed');
  });

  it('writes an order with lists inside lists as rows, and builds it back', async () => {
    const store = storeModule();
    const db = new PGlite();
    await db.exec(sql);
    const order = { order_id: 'o1', address: { street: 'Main' }, lines: [{ sku: 'A1', tags: ['x', 'y'] }, { sku: 'B2', tags: [] }] };
    await db.exec('BEGIN');
    for (const statement of store.insertOrder(order)) await db.query(statement.text, [...statement.values]);
    await db.exec('COMMIT');
    const rows = [];
    for (const statement of store.selectOrder('o1')) rows.push((await db.query(statement.text, [...statement.values])).rows);
    expect(store.orderFromRows(rows)).toEqual(order);
    // An absent optional list and an empty one stay apart.
    await db.exec('BEGIN');
    for (const statement of store.replaceOrder({ ...order, notes: [] })) await db.query(statement.text, [...statement.values]);
    await db.exec('COMMIT');
    const again = [];
    for (const statement of store.selectOrder('o1')) again.push((await db.query(statement.text, [...statement.values])).rows);
    expect(store.orderFromRows(again)).toEqual({ ...order, notes: [] });
    expect(store.orderFromRows([[], [], [], []])).toBeUndefined();
    await db.close();
  });

  it('refuses a tag two times in one line', async () => {
    const tags = `INSERT INTO "shop"."order__lines__tags" ("order_id", "lines_position", "position", "value") VALUES ('o1', 0, 0, 'x'), ('o1', 0, 1, 'x')`;
    expect(await attempt([order('', ''), line, tags])).toBe('order__lines__tags_uniqueItems');
  });
});

describe('every committed schema of the repository', () => {
  const files = [
    'tests/fixtures/booking/generated/schema.generated.sql',
  ];
  it.each(files)('%s runs on PGlite', async (file) => {
    const db = new PGlite();
    await db.exec(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
    await db.close();
  });
});

it('names each name of a schema that Postgres would cut, also of a constraint', () => {
  expect(longNames(`CONSTRAINT "${'a'.repeat(64)}" CHECK (TRUE), "short"`)).toEqual(['a'.repeat(64)]);
});
