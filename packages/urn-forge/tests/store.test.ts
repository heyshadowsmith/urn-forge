/**
 * The store plan: the target, written first. In the fourth blind trial, v2 added an optional
 * property to a stored entity, and the shell's hand-written INSERT never stored it. Here the
 * insurance policy gets an optional `agent_code`, and a policy is stored and read back.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { PLUGINS } from '../src/plugins/index.js';

const CUSTOMER = '9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d';
const POLICY = '123e4567-e89b-12d3-a456-426614174000';
const TABLES = { tables: ['customer.entity.customer', 'policy.entity.policy'] };

/** Insurance v2: the stored policy gets an optional agent code. */
const v2 = readFileSync(new URL('../insurance/domain.manifest.yaml', import.meta.url), 'utf8')
  .replace('    - ref: policy.field.deductible\n      required: false\n', '    - ref: policy.field.deductible\n      required: false\n    - ref: policy.field.agent_code\n      required: false\n')
  .concat('\npolicy.field.agent_code:\n  primitive: string\n  maxLength: 8\n  description: The agent who sold the policy\n');

const compiled = compile(v2, [{ plugin: PLUGINS.valibot, config: {} }, { plugin: PLUGINS.postgres, config: TABLES }]);
const file = (name: string) => compiled.files.find((f) => f.relativePath === name)?.content ?? '';

interface Statement {
  readonly text: string;
  readonly values: readonly unknown[];
}
type Policy = Record<string, unknown> & { readonly coverages: readonly Record<string, unknown>[] };

/** The shell of the trial: a hand-written insert that names its columns, written before agent_code existed. */
function handWrittenInsert(policy: Policy): Statement[] {
  return [
    {
      text: 'INSERT INTO "policy"."policy" ("policy_id", "holder", "effective_date", "expiry_date", "premium", "deductible") VALUES ($1, $2, $3, $4, $5, $6)',
      values: [policy['policy_id'], policy['holder'], policy['effective_date'], policy['expiry_date'], policy['premium'], policy['deductible'] ?? null],
    },
    ...policy.coverages.map((c, i) => ({
      text: 'INSERT INTO "policy"."policy__coverages" ("policy_id", "position", "peril", "limit", "note", "remark") VALUES ($1, $2, $3, $4, $5, $6)',
      values: [policy['policy_id'], i, c['peril'], c['limit'], c['note'] ?? null, c['remark'] ?? null],
    })),
  ];
}

// The generated store file of v2, written next to its schemas, as compile writes them.
const out = mkdtempSync(join(tmpdir(), 'urn-forge-store-'));
for (const f of compiled.files) writeFileSync(join(out, f.relativePath), f.content);
const generated = (await import(join(out, 'domain.store.generated.ts'))) as Record<string, (value: unknown) => readonly Statement[]>;
afterAll(() => rmSync(out, { recursive: true, force: true }));

/** The function under test: the generated insert (step 2). The hand-written one is kept to show the fault. */
const insertPolicy = generated['insertPolicyPolicy']!;

const policy: Policy = {
  policy_id: POLICY,
  holder: CUSTOMER,
  effective_date: '2026-01-01',
  expiry_date: '2026-12-31',
  premium: '120.00',
  agent_code: 'AB12',
  coverages: [
    { peril: 'fire', limit: '1000.00' },
    { peril: 'flood', limit: '500.00', remark: 'Basement excluded' },
  ],
};

describe('the store target (store plan, decision 12)', () => {
  let db: PGlite;
  const run = async (statements: readonly Statement[]) => {
    await db.exec('BEGIN');
    for (const { text, values } of statements) await db.query(text, values as unknown[]);
    await db.exec('COMMIT');
  };

  beforeEach(async () => {
    expect(compiled.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    db = new PGlite();
    await db.exec(file('schema.generated.sql'));
    await db.exec(`INSERT INTO "customer"."customer" ("customer_id", "name") VALUES ('${CUSTOMER}', 'Ada Smith')`);
  });

  it('stores the new optional property, which the hand-written insert of the trial drops', async () => {
    await run(insertPolicy(policy));
    const rows = await db.query<{ agent_code: string | null }>('SELECT "agent_code" FROM "policy"."policy"');
    expect(rows.rows).toEqual([{ agent_code: 'AB12' }]);
    // The fault of the trial, kept as a check that this test can fail.
    await db.exec('DELETE FROM "policy"."policy"');
    await run(handWrittenInsert(policy));
    expect((await db.query('SELECT "agent_code" FROM "policy"."policy"')).rows).toEqual([{ agent_code: null }]);
  });

  it('inserts the child rows, replaces with fewer, and deletes with the children', async () => {
    const coverages = async () => (await db.query<{ position: number; peril: string; remark: string | null }>('SELECT "position", "peril", "remark" FROM "policy"."policy__coverages" ORDER BY "position"')).rows;
    await run(insertPolicy(policy));
    expect(await coverages()).toEqual([
      { position: 0, peril: 'fire', remark: null },
      { position: 1, peril: 'flood', remark: 'Basement excluded' },
    ]);
    await run(generated['replacePolicyPolicy']!({ ...policy, premium: '99.00', coverages: [{ peril: 'theft', limit: '10.00' }] }));
    expect(await coverages()).toEqual([{ position: 0, peril: 'theft', remark: null }]);
    expect((await db.query('SELECT "premium"::text AS premium FROM "policy"."policy"')).rows).toEqual([{ premium: '99.00' }]);
    await run(generated['deletePolicyPolicy']!(POLICY));
    expect((await db.query('SELECT count(*)::int AS n FROM "policy"."policy"')).rows).toEqual([{ n: 0 }]);
    expect(await coverages()).toEqual([]);
  });

  it('gives the statements in order: the parent, then each child row', () => {
    expect(insertPolicy(policy).map((s) => s.text.split(' (')[0])).toEqual([
      'INSERT INTO "policy"."policy"',
      'INSERT INTO "policy"."policy__coverages"',
      'INSERT INTO "policy"."policy__coverages"',
    ]);
    expect(generated['deletePolicyPolicy']!(POLICY)).toEqual([{ text: 'DELETE FROM "policy"."policy" WHERE "policy_id" = $1', values: [POLICY] }]);
  });

  it('without a transaction, the count is checked at the end of each statement', async () => {
    const statements = insertPolicy({ ...policy, coverages: [] });
    await expect(db.query(statements[0]!.text, statements[0]!.values as unknown[])).rejects.toThrow('"coverages" has 0 item(s); it must have between 1 and 3');
  });
});

describe('the store functions take only the parsed entity (store plan, decision 5)', async () => {
  const { insertPolicyPolicy, deletePolicyPolicy } = await import('../insurance/generated/domain.store.generated.js');
  it('refuses a hand-made object and a plain key at compile time (checked by tsc)', () => {
    // @ts-expect-error a plain object is not a parsed PolicyPolicy
    const refused = () => insertPolicyPolicy({ policy_id: POLICY });
    // @ts-expect-error a plain string is not the branded key PolicyPolicyId
    const alsoRefused = () => deletePolicyPolicy(POLICY);
    expect([typeof refused, typeof alsoRefused]).toEqual(['function', 'function']);
  });
});
