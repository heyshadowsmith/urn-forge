/**
 * The target of the plan of Valibot schemas and relational tables: the generated schemas are Valibot
 * schemas with each rule by name, and the Postgres schema keeps an embedded object as columns and a
 * list as a child table, whose rules the database checks. The store file writes a value as rows and
 * builds it back. Each test is it.fails until its step.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

/** A test of the target that does not pass yet: it.fails until its step is built, then it. */
const target = { schemas: it, columns: it.fails, lists: it.fails, store: it.fails };

const GENERATED = './fixtures/booking/generated/domain.generated.js';
const STORE = './fixtures/booking/generated/domain.store.generated.js';
const schema = (): string => readFileSync(new URL('./fixtures/booking/generated/schema.generated.sql', import.meta.url), 'utf8');

const booking = {
  reference: 'ABCDEFGH',
  party_size: 4,
  state: 'confirmed',
  starts_at: '2026-11-24T19:00:00Z',
  ends_at: '2026-11-24T21:00:00Z',
  tables: [3, 4],
  contact: { email: 'ada@example.com', phone: '555 0100' },
  dishes: [
    { course: 'starter', amount: 800 },
    { course: 'main', amount: 2200 },
  ],
  total: 3000,
};

/** Runs statements on a database with the schema; gives the constraint of the first error, or 'ok'. */
async function run(statements: (db: PGlite) => Promise<void>): Promise<string> {
  const db = new PGlite();
  await db.exec(schema());
  try {
    await db.exec('BEGIN');
    await statements(db);
    await db.exec('COMMIT');
    return 'ok';
  } catch (error) {
    return (error as { constraint?: string; message: string }).constraint ?? (error as Error).message;
  } finally {
    await db.close();
  }
}

describe('the schemas', () => {
  target.schemas('are Standard Schemas, whose issues name each rule', async () => {
    const generated = (await import(GENERATED)) as Record<string, unknown>;
    const BookingSchema = generated['BookingSchema'] as v.GenericSchema;
    expect(BookingSchema['~standard' as never]).toBeDefined();
    expect(v.safeParse(BookingSchema, booking).success).toBe(true);
    const result = v.safeParse(BookingSchema, { ...booking, party_size: 0 });
    expect(result.success).toBe(false);
    const check = generated['check'] as (d: string, value: unknown) => { ok: boolean; failures?: unknown[] };
    expect(check('booking', { ...booking, party_size: 0 }).failures).toEqual([
      { definition: 'party_size', rule: 'minimum', path: 'party_size', message: 'Must be at least 1' },
    ]);
  });
});

describe('the Postgres schema', () => {
  target.columns('keeps an embedded object as columns, with their rules as CHECKs', async () => {
    expect(schema()).toContain('"contact_email" TEXT NOT NULL');
    expect(schema()).not.toContain('JSONB');
    const result = await run(async (db) => {
      await db.query(`INSERT INTO "booking"."booking" ("reference", "party_size", "state", "starts_at", "ends_at", "contact_email", "has_tables", "has_dishes") VALUES ('ABCDEFGH', 4, 'confirmed', '2026-11-24T19:00:00Z', '2026-11-24T21:00:00Z', 'ada', FALSE, FALSE)`);
    });
    expect(result).toBe('booking_contact_email_pattern');
  });

  target.lists('keeps a list as a child table, with the rules of its items, UNIQUE and a count', async () => {
    const root = `INSERT INTO "booking"."booking" ("reference", "party_size", "state", "starts_at", "ends_at", "contact_email", "has_tables", "has_dishes") VALUES ('ABCDEFGH', 4, 'confirmed', '2026-11-24T19:00:00Z', '2026-11-24T21:00:00Z', 'ada@example.com', TRUE, TRUE)`;
    expect(
      await run(async (db) => {
        await db.query(root);
        await db.query(`INSERT INTO "booking"."booking__dishes" ("reference", "position", "course", "amount") VALUES ('ABCDEFGH', 0, 'drink', 100)`);
      }),
    ).toBe('booking__dishes_course_enum');
    expect(
      await run(async (db) => {
        await db.query(root);
        await db.query(`INSERT INTO "booking"."booking__tables" ("reference", "position", "value") VALUES ('ABCDEFGH', 0, 3), ('ABCDEFGH', 1, 3)`);
      }),
    ).toBe('booking__tables_uniqueItems');
    expect(
      await run(async (db) => {
        await db.query(root);
        for (let i = 0; i < 5; i++) await db.query(`INSERT INTO "booking"."booking__tables" ("reference", "position", "value") VALUES ('ABCDEFGH', ${i}, ${i + 1})`);
      }),
    ).toBe('booking__tables_maxItems');
  });
});

describe('the store file', () => {
  target.store('writes a value as rows and builds it back', async () => {
    const store = (await import(STORE)) as Record<string, (...args: unknown[]) => unknown>;
    const db = new PGlite();
    await db.exec(schema());
    for (const statement of store['insertBooking']!(booking) as { text: string; values: unknown[] }[]) await db.query(statement.text, statement.values);
    const rows: unknown[][] = [];
    for (const statement of store['selectBooking']!('ABCDEFGH') as { text: string; values: unknown[] }[]) rows.push((await db.query(statement.text, statement.values)).rows);
    expect(store['bookingFromRows']!(rows)).toEqual(booking);
    await db.close();
  });
});
