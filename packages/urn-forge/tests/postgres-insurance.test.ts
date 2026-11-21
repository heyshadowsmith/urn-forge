/**
 * The target of the Postgres plan, written first: insurance's generated SQL, applied to real
 * Postgres (PGlite), accepts a correct policy and refuses each broken write by the name of the
 * rule that refuses it.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

/** Set to true when the plugin writes insurance's SQL (Postgres plan, step 4). */
const TARGET_READY = false;

const CUSTOMER = '9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d';
const POLICY = '123e4567-e89b-12d3-a456-426614174000';

interface Coverage {
  readonly peril: string;
  readonly limit: string;
  readonly note?: string;
}

const literal = (value: string | undefined) => (value === undefined ? 'NULL' : `'${value.replaceAll("'", "''")}'`);

/** One transaction that writes a policy and its coverages, as a shell would. */
function writePolicy(options: { holder?: string; premium?: string; coverages?: readonly Coverage[] } = {}): string {
  const { holder = CUSTOMER, premium = '120.00', coverages = [{ peril: 'fire', limit: '1000.00' }, { peril: 'flood', limit: '500.00', note: 'Basement excluded, see {clause 4}' }] } = options;
  return [
    'BEGIN;',
    `INSERT INTO "policy"."policy" ("policy_id", "holder", "effective_date", "expiry_date", "premium") VALUES (${literal(POLICY)}, ${literal(holder)}, '2026-01-01', '2026-12-31', ${literal(premium)});`,
    ...coverages.map(
      (c, i) =>
        `INSERT INTO "policy"."policy__coverages" ("policy_id", "position", "peril", "limit", "note") VALUES (${literal(POLICY)}, ${i}, ${literal(c.peril)}, ${literal(c.limit)}, ${literal(c.note)});`,
    ),
    'COMMIT;',
  ].join('\n');
}

interface PgError {
  readonly code?: string;
  readonly constraint?: string;
}

describe.runIf(TARGET_READY)('insurance in Postgres', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(readFileSync(new URL('../insurance/generated/schema.generated.sql', import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO "customer"."customer" ("customer_id", "name") VALUES ('${CUSTOMER}', 'Ada Smith');`);
  });

  /** Runs a write and returns the Postgres error, or undefined if it committed. */
  async function failure(sql: string): Promise<PgError | undefined> {
    try {
      await db.exec(sql);
      return undefined;
    } catch (error) {
      await db.exec('ROLLBACK;').catch(() => undefined);
      return error as PgError;
    }
  }

  it('accepts a correct policy with two coverages, one with a note that holds a comma and braces', async () => {
    expect(await failure(writePolicy())).toBeUndefined();
    const rows = await db.query<{ peril: string; limit: string; note: string | null }>(
      'SELECT "peril", "limit"::text AS "limit", "note" FROM "policy"."policy__coverages" ORDER BY "position"',
    );
    expect(rows.rows).toEqual([
      { peril: 'fire', limit: '1000.00', note: null },
      { peril: 'flood', limit: '500.00', note: 'Basement excluded, see {clause 4}' },
    ]);
  });

  it.each([
    ['a holder that is not a customer', { holder: '00000000-0000-4000-8000-000000000000' }, '23503', 'policy_holder_fkey'],
    ['a coverage with a limit of 0', { coverages: [{ peril: 'fire', limit: '0' }] }, '23514', 'limit_is_positive'],
    ['a repeated peril', { coverages: [{ peril: 'fire', limit: '1.00' }, { peril: 'fire', limit: '2.00' }] }, '23505', undefined],
    ['no coverages', { coverages: [] }, '23514', 'coverages_count'],
    ['four coverages', { coverages: ['fire', 'flood', 'theft', 'fire'].map((peril, i) => ({ peril, limit: `${i + 1}.00` })) }, undefined, undefined],
    ['a premium with three decimals', { premium: '1.005' }, '23514', 'premium'],
    ['a peril that is not in the enum', { coverages: [{ peril: 'hail', limit: '1.00' }] }, '23514', 'peril'],
  ] as const)('refuses %s', async (_, options, code, constraint) => {
    const error = await failure(writePolicy(options));
    expect(error).toBeDefined();
    if (code !== undefined) expect(error?.code).toBe(code);
    if (constraint !== undefined) expect(error?.constraint).toBe(constraint);
  });
});
