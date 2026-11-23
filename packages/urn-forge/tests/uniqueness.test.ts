/**
 * Uniqueness: no two stored records share the values of a unique entry; among the records where
 * `when` holds, and with `forever` also not with a record that is gone. The database refuses a
 * clash, and commitOnce gives the declared refusal and writes nothing. The target is
 * tests/fixtures/uniqueness, on PGlite.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { PLUGINS } from '../src/plugins/index.js';

const CREATE = 'urn:demo:unique:subscription:operation:create_subscription';
const CONFLICT = 'urn:demo:unique:subscription:error:conflict';

const dir = new URL('./fixtures/uniqueness/', import.meta.url);
const source = readFileSync(new URL('domain.manifest.yaml', dir), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime: any = await import(new URL('expected/domain.runtime.generated.ts', dir).href);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: any = await import(new URL('expected/domain.store.generated.ts', dir).href);

type Statement = { text: string; values: readonly unknown[] };
const core = { [CREATE]: (input: Record<string, unknown>) => runtime.ok({ ...input, status: 'active' }) };
const database = async () => {
  const db = new PGlite();
  await db.exec(readFileSync(new URL('expected/schema.generated.sql', dir), 'utf8'));
  return db;
};
const query = (db: PGlite) => async (s: Statement) => (await db.query(s.text, s.values as unknown[])) as { rows: Record<string, unknown>[] };
/** One call in its own transaction: commitOnce writes a success, and gives the declared refusal of a clash. */
const call = async (db: PGlite, body: Record<string, unknown>) =>
  db.transaction(async (tx) => {
    const run = async (s: Statement) => (await tx.query(s.text, s.values as unknown[])) as { rows: Record<string, unknown>[] };
    return store.commitOnce(run, runtime.executeOperation(CREATE, body, core), (output: unknown) => store.insertSubscriptionSubscription(output));
  });
const rows = async (db: PGlite) => (await db.query<{ subscription_id: string; status: string }>('SELECT "subscription_id", "status" FROM "subscription"."subscription" ORDER BY 1')).rows;

describe('the uniqueness target compiles', () => {
  it('with no diagnostics, and the IR holds each entry', () => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir!.entities['urn:demo:unique:subscription:entity:subscription' as never]).toMatchObject({
      unique: [{ by: ['customer_id', 'plan_id'], when: { ruleText: "status = 'active'" }, otherwise: CONFLICT }, { by: ['subscription_id'], forever: true }],
    });
  });

  it('refuses a property that is not one value of the entity, a forever entry with when or otherwise, and an error that the record cannot fill', () => {
    const messages = (from: string, to: string) => compile(source.replace(from, to)).diagnostics.map((d) => [d.code, d.message.replace(/^urn:demo:unique:subscription:entity:subscription: /, '')]);
    expect(messages('    - by: [customer_id, plan_id]', '    - by: [customer_id, plan]')).toEqual([
      ['invalid-unique', 'unique.0: by: "plan" is not a property of the entity (properties: subscription_id, customer_id, plan_id, status)'],
    ]);
    expect(messages('      forever: true', '      forever: true\n      when: status = \'active\'')).toEqual([
      ['invalid-unique', 'unique.1: forever: a value used once is used for good, so a forever entry has no when'],
    ]);
    expect(messages("      when: status = 'active'", "      when: status = 'gone'")[0]?.[0]).toBe('rule-type');
    const unfilled = source.replace('    - ref: subscription.field.plan_id\nsubscription.operation', '    - ref: subscription.field.plan_id\n    - ref: subscription.field.status\n      as: other\nsubscription.operation');
    expect(messages(source, unfilled)).toEqual([
      ['invalid-unique', 'unique.0.otherwise: urn:demo:unique:subscription:error:conflict needs other, which the record does not have; the error is filled by name from the record'],
    ]);
  });

  it('refuses unique on an entity that is not a table of the postgres plugin', () => {
    const plugins = [
      { plugin: PLUGINS.valibot, config: {} },
      { plugin: PLUGINS.postgres, config: { tables: [] } },
    ];
    expect(compile(source, plugins).diagnostics.map((d) => [d.code, d.message])).toEqual([
      [
        'invalid-unique',
        'urn:demo:unique:subscription:entity:subscription: unique: the entity is not a table of the postgres plugin, so nothing keeps its values unique; add it to tables',
      ],
    ]);
  });
});

describe('commitOnce, on PGlite', () => {
  const body = { subscription_id: 'sub_00000001', customer_id: 'cus_0001', plan_id: 'pln_gold' };

  it('writes the first live subscription, and gives the declared conflict for a second, writing nothing', async () => {
    const db = await database();
    expect(await call(db, body)).toMatchObject({ ok: true });
    const second = await call(db, { ...body, subscription_id: 'sub_00000002' });
    expect(second).toMatchObject({ ok: false, kind: 'DomainError', error: { urn: CONFLICT, message: 'Customer cus_0001 already has plan pln_gold' } });
    expect(await rows(db)).toEqual([{ subscription_id: 'sub_00000001', status: 'active' }]);
    // Another plan, or another customer, does not clash.
    expect(await call(db, { ...body, subscription_id: 'sub_00000003', plan_id: 'pln_silver' })).toMatchObject({ ok: true });
  });

  it('lets a customer take the plan again once the subscription is canceled', async () => {
    const db = await database();
    await call(db, body);
    await db.query(`UPDATE "subscription"."subscription" SET "status" = 'canceled'`);
    expect(await call(db, { ...body, subscription_id: 'sub_00000002' })).toMatchObject({ ok: true });
  });

  it('never gives an id to another subscription, also after the first is gone', async () => {
    const db = await database();
    await call(db, body);
    await db.query('DELETE FROM "subscription"."subscription"');
    await expect(call(db, { ...body, customer_id: 'cus_0002' })).rejects.toThrow(/subscription_(once|used)/);
    // The same subscription may write its id again, as a replace does.
    const replace = store.replaceSubscriptionSubscription({ ...body, status: 'active' }) as Statement[];
    await db.transaction(async (tx) => {
      for (const s of replace) await tx.query(s.text, s.values as unknown[]);
    });
    expect(await rows(db)).toEqual([{ subscription_id: 'sub_00000001', status: 'active' }]);
  });

  it('refuses a second live subscription in the index itself, written without commitOnce: a database error', async () => {
    const db = await database();
    await call(db, body);
    const second = store.insertSubscriptionSubscription({ ...body, subscription_id: 'sub_00000009', status: 'active' }) as Statement[];
    await expect(db.transaction(async (tx) => { for (const s of second) await tx.query(s.text, s.values as unknown[]); })).rejects.toThrow(/subscription_customer_id_plan_id_unique/);
  });
});

describe('the Gherkin steps and gate 3', () => {
  const entity = runtime.UniqueContract['urn:demo:unique:subscription:entity:subscription'];
  const live = { subscription_id: 'sub_00000001', customer_id: 'cus_0001', plan_id: 'pln_gold', status: 'active' };

  it('find a clash with a live stored record, as the index does, and none with a canceled one or the record itself', async () => {
    const { uniqueClash } = await import('../src/gherkin/steps.js');
    const next = { ...live, subscription_id: 'sub_00000002' };
    expect(uniqueClash(entity, next, [live])).toEqual({ by: ['customer_id', 'plan_id'], otherwise: CONFLICT });
    expect(uniqueClash(entity, next, [{ ...live, status: 'canceled' }])).toBeUndefined();
    expect(uniqueClash(entity, live, [live])).toEqual({ by: ['subscription_id'] });
    expect(uniqueClash(entity, { ...next, customer_id: 'cus_0002' }, [{ ...live, status: 'canceled' }])).toBeUndefined();
  });

  it('asks for a scenario of each clash with otherwise', async () => {
    const { checkGherkin } = await import('../src/verify/gherkin.js');
    const { indexFeatureSource } = await import('../src/verify/feature-index.js');
    const ir = compile(source).ir!;
    const gate3 = (steps: string) =>
      checkGherkin({ ir, features: { directory: 'features', features: [indexFeatureSource(`Feature: f\n  @${CREATE}\n  Scenario: s\n${steps}`, 'f.feature')!], problems: [] }, boundaryCoverage: 'warn' } as never)
        .problems.filter((p) => p.code === 'uncovered-unique')
        .map((p) => p.message);
    const run = '    When I run the operation with:\n      | subscription_id | customer_id | plan_id |\n      | sub_00000002 | cus_0001 | pln_gold |\n';
    expect(gate3(run)).toEqual([
      `urn:demo:unique:subscription:entity:subscription refuses a second record with the same customer_id, plan_id where status = 'active' with ${CONFLICT}, and no scenario shows it; add one with Given these subscription records are stored: and Then the operation fails with "${CONFLICT}"`,
    ]);
    const stored = '    Given these subscription records are stored:\n      | subscription_id | customer_id | plan_id | status |\n      | sub_00000001 | cus_0001 | pln_gold | active |\n';
    expect(gate3(stored + run + `    Then the operation fails with "${CONFLICT}"\n`)).toEqual([]);
  });
});
