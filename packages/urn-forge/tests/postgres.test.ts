/**
 * The Postgres schema of the booking fixture runs on PGlite, and its CHECK constraints refuse what the
 * rules refuse.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { compileManifest } from '../src/index.js';
import { postgresProblems, postgresSchema } from '../src/generate/postgres.js';

const schema = readFileSync(new URL('./fixtures/booking/generated/schema.generated.sql', import.meta.url), 'utf8');

const row: Record<string, unknown> = {
  reference: 'ABCDEFGH',
  party_size: 4,
  state: 'confirmed',
  starts_at: '2026-11-24T19:00:00Z',
  ends_at: '2026-11-24T21:00:00Z',
  contact: JSON.stringify({ email: 'ada@example.com' }),
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

  it('names the rules that SQL cannot say', () => {
    expect(schema).toContain('-- Not in SQL; the harness checks these rules: tables: maxItems; tables: uniqueItems; tables: minimum of table_number; contact: required; contact: pattern of email; dishes: required of dish; dishes: enum of course; dishes: minimum of amount; booking: total_is_the_dishes');
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
    message: Before 2000
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
