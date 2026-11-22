/**
 * Idempotency: a repeat with the same key in the window returns the first answer, with no second
 * effect. The Postgres extra keeps the answers, and runOnce runs a call at most once for each key.
 * The target is tests/fixtures/idempotency, on PGlite.
 */
import { existsSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { indexFeatureSource } from '../src/verify/feature-index.js';
import { checkGherkin } from '../src/verify/gherkin.js';
import type { GateContext } from '../src/verify/types.js';

const CREATE = 'urn:demo:idempotency:payment:operation:create_payment';
const REFUND = 'urn:demo:idempotency:payment:operation:refund_payment';

const dir = new URL('./fixtures/idempotency/', import.meta.url);
const source = readFileSync(new URL('domain.manifest.yaml', dir), 'utf8');
const load = async (file: string) => (existsSync(new URL(`expected/${file}`, dir)) ? await import(new URL(`expected/${file}`, dir).href) : undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime: any = await load('domain.runtime.generated.ts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: any = await load('domain.store.generated.ts');

const merchant = { merchant_id: 'mer_abc123' };
let payments = 0;
const core = {
  [CREATE]: (input: { amount: number }) => {
    payments += 1;
    const payment_id = `pay_${String(payments).padStart(8, '0')}`;
    return runtime.ok({ payment_id, amount: input.amount }, [runtime.emit('urn:demo:idempotency:payment:event:created', { payment_id })]);
  },
  [REFUND]: (input: { payment_id: string; amount: number }) => runtime.ok({ payment_id: input.payment_id, amount: input.amount }),
};

async function answers(): Promise<{ db: PGlite; query: (s: { text: string; values: readonly unknown[] }) => Promise<{ rows: Record<string, unknown>[] }> }> {
  const db = new PGlite();
  await db.exec(readFileSync(new URL('expected/schema.generated.sql', dir), 'utf8'));
  return { db, query: async ({ text, values }) => (await db.query(text, values as unknown[])) as { rows: Record<string, unknown>[] } };
}
const once = (query: unknown, urn: string, body: unknown, now: string, caller: unknown = merchant) =>
  store.runOnce(query, urn, body, { caller, now }, () => runtime.executeOperation(urn, body, core, { caller }));

describe('the idempotency target compiles', () => {
  it('with no diagnostics, and the IR holds the key, its owners, the window and the conflict', () => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect((result.ir?.operations as Record<string, { idempotency?: unknown }>)[CREATE]?.idempotency).toEqual({
      key: 'idempotency_key',
      scope: ['caller.merchant_id'],
      window: '24 hours',
      windowMs: 86_400_000,
      otherwise: 'urn:demo:idempotency:payment:error:idempotency_conflict',
    });
  });

  it('refuses a key that is not a text of the input, a scope that is not the caller or the input, and a window that is not a time', () => {
    const messages = (from: string, to: string) => compile(source.replace(from, to)).diagnostics.map((d) => [d.code, d.message.replace(/^urn:demo:idempotency:payment:operation:/, '')]);
    expect(messages('    key: input.idempotency_key\n    scope', '    key: input.amount\n    scope')).toEqual([
      ['invalid-idempotency', 'create_payment: idempotency.key: "input.amount" is integer; the key is a text that the caller chooses'],
    ]);
    expect(messages('    scope: caller.merchant_id', '    scope: output.payment_id')).toEqual([
      ['invalid-idempotency', 'create_payment: idempotency.scope: "output.payment_id" is not a property of the caller or the input (values: input.idempotency_key, input.amount, caller.merchant_id)'],
    ]);
    expect(messages('    window: 24 hours\n    otherwise', '    window: a day\n    otherwise')).toEqual([
      ['invalid-idempotency', 'create_payment: idempotency.window: "a day" is not a time; write one such as 24 hours'],
    ]);
  });
});

describe('runOnce of the idempotency target, on PGlite', () => {
  const body = { idempotency_key: 'key-0001', amount: 500 };

  it('returns the first answer to a repeat with the same body, with no second change or event', async () => {
    const { query } = await answers();
    const first = await once(query, CREATE, body, '2026-11-22T10:00:00Z');
    expect(first).toMatchObject({ ok: true, events: [{ urn: 'urn:demo:idempotency:payment:event:created' }] });
    const before = payments;
    // The same body, with the properties in another order: one body.
    const repeat = await once(query, CREATE, { amount: 500, idempotency_key: 'key-0001' }, '2026-11-23T09:59:59.999Z');
    expect(repeat).toMatchObject({ ok: true, output: first.output, events: [] });
    expect(payments).toBe(before);
  });

  it('refuses the same key with another body with the declared error, or returns the first answer without one', async () => {
    const { query } = await answers();
    await once(query, CREATE, body, '2026-11-22T10:00:00Z');
    expect(await once(query, CREATE, { ...body, amount: 501 }, '2026-11-22T10:00:01Z')).toMatchObject({
      ok: false,
      kind: 'DomainError',
      error: { urn: 'urn:demo:idempotency:payment:error:idempotency_conflict', message: 'The key key-0001 belongs to another request' },
    });
    const refund = { idempotency_key: 'key-0002', payment_id: 'pay_00000001', amount: 100 };
    const first = await once(query, REFUND, refund, '2026-11-22T10:00:00Z');
    expect(await once(query, REFUND, { ...refund, amount: 200 }, '2026-11-22T10:00:01Z')).toMatchObject({ ok: true, output: first.output });
  });

  it('frees a key after the window, and keeps the keys of each merchant apart', async () => {
    const { query } = await answers();
    await once(query, CREATE, body, '2026-11-22T10:00:00Z');
    const before = payments;
    expect(await once(query, CREATE, body, '2026-11-23T10:00:00Z')).toMatchObject({ ok: true, events: [{}] });
    expect(await once(query, CREATE, body, '2026-11-23T10:00:01Z', { merchant_id: 'mer_zzz999' })).toMatchObject({ ok: true, events: [{}] });
    expect(payments).toBe(before + 2);
  });

  it('does not store a refusal, and runs a call with no key each time', async () => {
    const { query } = await answers();
    const refused = await store.runOnce(query, CREATE, body, { caller: merchant, now: '2026-11-22T10:00:00Z' }, () => ({ ok: false, kind: 'DomainError', urn: CREATE, error: {} }));
    expect(refused).toMatchObject({ ok: false });
    expect(await once(query, CREATE, body, '2026-11-22T10:00:01Z')).toMatchObject({ ok: true, events: [{}] });
    const before = payments;
    await once(query, CREATE, { amount: 500 }, '2026-11-22T10:00:02Z');
    await once(query, CREATE, { amount: 500 }, '2026-11-22T10:00:03Z');
    expect(payments).toBe(before + 2);
  });

  it('refuses a second answer for one key in the window: the primary key', async () => {
    const { query } = await answers();
    await once(query, CREATE, body, '2026-11-22T10:00:00Z');
    // A repeat that ran while the first was in its transaction: its find saw nothing.
    const blind = async (s: { text: string; values: readonly unknown[] }) => (s.text.startsWith('SELECT') ? { rows: [] } : query(s));
    await expect(once(blind, CREATE, body, '2026-11-22T10:00:01Z')).rejects.toThrow(/duplicate key/);
  });
});

describe('gate 3 for idempotency', () => {
  const ir = compile(source).ir!;
  const gate3 = (steps: string) =>
    checkGherkin({ ir, features: { directory: 'features', features: [indexFeatureSource(`Feature: f\n  @${REFUND}\n  Scenario: s\n${steps}`, 'f.feature')!], problems: [] }, boundaryCoverage: 'warn' } as unknown as GateContext)
      .problems.filter((p) => p.code === 'uncovered-idempotency')
      .map((p) => p.message);
  const caller = '    Given the caller is:\n      | merchant_id |\n      | mer_abc123 |\n';
  const call = (verb: string) => `    ${verb} I run the operation${verb === 'And' ? ' again' : ''} with:\n      | idempotency_key | payment_id | amount |\n      | key-0002 | pay_00000001 | 100 |\n`;

  it('asks for a scenario that repeats the call', () => {
    expect(gate3(caller + call('When'))).toEqual([
      `${REFUND} returns the first answer to a repeat with the same idempotency_key, and no scenario repeats a call; add one with When I run the operation again with:`,
    ]);
    expect(gate3(caller + call('When') + call('And') + '    Then the answer is the first answer\n')).toEqual([]);
  });
});
