/**
 * Changes on a clock: an operation with `due` is one that the shell's clock calls, for each
 * record that is due. The runtime refuses a call that is not due, and the Postgres extra gives the
 * query that finds the records that are due, from the same rule. The target is tests/fixtures/clock.
 */
import { existsSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { indexFeatureSource } from '../src/verify/feature-index.js';
import { checkGherkin } from '../src/verify/gherkin.js';
import type { GateContext } from '../src/verify/types.js';

const EXPIRE = 'urn:demo:clock:payment:operation:expire_payment';
const CAPTURE = 'urn:demo:clock:payment:operation:capture_payment';
const REPORT = 'urn:demo:clock:claim:operation:report_overdue';

const dir = new URL('./fixtures/clock/', import.meta.url);
const source = readFileSync(new URL('domain.manifest.yaml', dir), 'utf8');
const load = async (file: string) => (existsSync(new URL(`expected/${file}`, dir)) ? await import(new URL(`expected/${file}`, dir).href) : undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime: any = await load('domain.runtime.generated.ts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: any = await load('domain.store.generated.ts');

const payment = (status: string, authorized_at = '2026-11-01T12:00:00Z', payment_id = 'pay_abcd1234') => ({ payment_id, status, authorized_at });
const claim = (overdue_reported_at?: string) => ({ claim_id: 'CLM-0000000001', state: 'SUBMITTED', submitted_at: '2026-10-01T09:00:00Z', ...(overdue_reported_at ? { overdue_reported_at } : {}) });
const core = {
  [EXPIRE]: (_i: unknown, current: Record<string, unknown>) => runtime.ok({ ...current, status: 'expired' }, [runtime.emit('urn:demo:clock:payment:event:expired', { payment_id: current.payment_id })]),
  [CAPTURE]: (_i: unknown, current: Record<string, unknown>) => runtime.ok({ ...current, status: 'captured' }),
  [REPORT]: (_i: unknown, current: Record<string, unknown>, now: string) =>
    runtime.ok({ ...current, overdue_reported_at: now }, [runtime.emit('urn:demo:clock:claim:event:decision_overdue', { claim_id: current.claim_id })]),
};
const run = (urn: string, current: unknown, now: string) => runtime.executeOperation(urn, { [urn === REPORT ? 'claim_id' : 'payment_id']: urn === REPORT ? 'CLM-0000000001' : 'pay_abcd1234' }, core, { current, now });

describe('the clock target compiles', () => {
  it('with no diagnostics, and the IR holds each due rule', () => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect((result.ir?.operations as Record<string, { due?: { ruleText: string } }>)[EXPIRE]?.due?.ruleText).toBe('now >= current.authorized_at + 7 days');
  });

  it('refuses due on an operation with no changes, or a due rule that reads the request', () => {
    const messages = (from: string, to: string) => compile(source.replace(from, to)).diagnostics.map((d) => [d.code, d.message.replace(/^urn:demo:clock:[a-z]+:operation:/, '')]);
    expect(messages('  due: now >= current.authorized_at + 7 days\n', '  due: now >= current.authorized_at + 7 days and input.payment_id = current.payment_id\n')).toEqual([
      ['invalid-due', 'expire_payment: due: "input.payment_id" is not the record or the time; a due rule reads current. and now, as no request starts the call'],
    ]);
    expect(messages('  requires:\n    - rule: now < current.authorized_at + 7 days', '  due: now >= today + 1\n  requires:\n    - rule: now < current.authorized_at + 7 days')).toContainEqual([
      'rule-type',
      expect.stringContaining('capture_payment: due:'),
    ]);
  });
});

describe('the runtime of the clock target', () => {
  it('runs a timed change for a record that is due, and refuses one that is not', () => {
    expect(run(EXPIRE, payment('authorized'), '2026-11-08T12:00:00Z')).toMatchObject({ ok: true, output: { status: 'expired' }, events: [{ urn: 'urn:demo:clock:payment:event:expired' }] });
    expect(run(EXPIRE, payment('authorized'), '2026-11-08T11:59:59.999Z')).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ message: `${EXPIRE} is not due for this record: now >= current.authorized_at + 7 days` }],
    });
  });

  it('answers otherwise for a record that moved first, as a capture before the clock', () => {
    expect(run(EXPIRE, payment('captured'), '2026-12-01T00:00:00Z')).toMatchObject({ ok: false, kind: 'DomainError', error: { urn: 'urn:demo:clock:payment:error:invalid_status' } });
  });

  it('refuses a capture after 7 days, before the clock expires the payment', () => {
    expect(run(CAPTURE, payment('authorized'), '2026-11-08T11:59:59.999Z')).toMatchObject({ ok: true });
    expect(run(CAPTURE, payment('authorized'), '2026-11-08T12:00:00Z')).toMatchObject({ ok: false, error: { urn: 'urn:demo:clock:payment:error:invalid_status' } });
  });

  it('reports an overdue claim once: the mark makes the second call not due', () => {
    const first = run(REPORT, claim(), '2026-10-31T09:00:00Z');
    expect(first).toMatchObject({ ok: true, output: { state: 'SUBMITTED', overdue_reported_at: '2026-10-31T09:00:00Z' } });
    expect(run(REPORT, first.output, '2026-11-01T09:00:00Z')).toMatchObject({ ok: false, kind: 'ContractViolation' });
  });
});

describe('the queries of the clock target, on PGlite', () => {
  async function tables(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(readFileSync(new URL('expected/schema.generated.sql', dir), 'utf8'));
    return db;
  }
  const run = async (db: PGlite, statements: readonly { text: string; values: readonly unknown[] }[]) => {
    for (const { text, values } of statements) await db.query(text, values as unknown[]);
  };
  const due = async (db: PGlite, statement: { text: string; values: readonly unknown[] }) => (await db.query(statement.text, statement.values as unknown[])).rows;

  it('finds the payments in a from state whose time has come, and no other', async () => {
    const db = await tables();
    await run(db, store.insertPaymentPayment(payment('authorized', '2026-11-01T12:00:00Z', 'pay_aaaaaaaa')));
    await run(db, store.insertPaymentPayment(payment('authorized', '2026-11-01T12:00:00.001Z', 'pay_bbbbbbbb')));
    await run(db, store.insertPaymentPayment(payment('captured', '2026-10-01T12:00:00Z', 'pay_cccccccc')));
    expect(await due(db, store.selectPaymentExpirePaymentDue('2026-11-08T12:00:00Z', 10))).toEqual([{ payment_id: 'pay_aaaaaaaa' }]);
    expect(await due(db, store.selectPaymentExpirePaymentDue('2026-11-09T00:00:00Z', 1))).toEqual([{ payment_id: 'pay_aaaaaaaa' }]);
  });

  it('finds a claim to report until it holds its mark', async () => {
    const db = await tables();
    await run(db, store.insertClaimClaim(claim()));
    expect(await due(db, store.selectClaimReportOverdueDue('2026-10-31T09:00:00Z', 10))).toEqual([{ claim_id: 'CLM-0000000001' }]);
    await run(db, store.replaceClaimClaim(claim('2026-10-31T09:00:00Z')));
    expect(await due(db, store.selectClaimReportOverdueDue('2026-11-30T09:00:00Z', 10))).toEqual([]);
  });
});

describe('gate 3 for a timed change', () => {
  const ir = compile(source).ir!;
  const gate3 = (then: string) =>
    checkGherkin({
      ir,
      features: {
        directory: 'features',
        features: [
          indexFeatureSource(
            `Feature: f\n  @${EXPIRE}\n  Scenario: s\n    Given the time is "2026-11-08T11:00:00Z"\n    And the current payment is:\n      | payment_id | status | authorized_at |\n      | pay_abcd1234 | authorized | 2026-11-01T12:00:00Z |\n    When I run the operation with:\n      | payment_id |\n      | pay_abcd1234 |\n    Then ${then}\n`,
            'f.feature',
          )!,
        ],
        problems: [],
      },
      boundaryCoverage: 'warn',
    } as unknown as GateContext)
      .problems.filter((p) => p.code === 'uncovered-due')
      .map((p) => p.message);

  it('asks for a scenario that calls it for a record that is not due', () => {
    expect(gate3('the operation emits no event')).toEqual([
      `${EXPIRE} runs when now >= current.authorized_at + 7 days, and no scenario calls it for a record that is not due; add one with Then the operation is not due`,
    ]);
    expect(gate3('the operation is not due')).toEqual([]);
  });
});
