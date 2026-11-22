/**
 * Conditions on an operation: `requires` rules, which answer a declared error before the
 * handler runs, and `ensures` rules, which the answer must keep. The target is
 * tests/fixtures/conditions: a booking with two requires rules, a claim whose version must
 * match the record and go up by one, and a refund that may not exceed the captured amount.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import type { Urn } from '../src/ir/types.js';

const CREATE = 'urn:demo:conditions:booking:operation:create_booking';
const SUBMIT = 'urn:demo:conditions:claim:operation:submit_claim';
const REFUND = 'urn:demo:conditions:payment:operation:refund_payment';

const source = readFileSync(new URL('./fixtures/conditions/domain.manifest.yaml', import.meta.url), 'utf8');
const runtimeFile = new URL('./fixtures/conditions/expected/domain.runtime.generated.ts', import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime: any = existsSync(runtimeFile) ? await import(runtimeFile.href) : undefined;

describe('the conditions target compiles', () => {
  it('with no diagnostics, and the IR holds the rules of each operation', () => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    const ops = result.ir?.operations as Readonly<Record<Urn, unknown>> | undefined;
    expect(ops?.[CREATE as Urn]).toMatchObject({
      requires: [
        { ruleText: 'input.party_size < 13', otherwise: 'urn:demo:conditions:booking:error:party_too_large_for_online' },
        { ruleText: 'input.party_size < 7 or input.deposit_token is present', otherwise: 'urn:demo:conditions:booking:error:deposit_required' },
      ],
    });
    expect(ops?.[SUBMIT as Urn]).toMatchObject({ ensures: [{ ruleText: 'output.version = input.version + 1' }] });
  });
});

describe('the runtime of the conditions target', () => {
  const calls: string[] = [];
  const core = {
    [CREATE]: (input: { party_size: number }) => (calls.push(CREATE), runtime.ok({ reference: 'KMPQXRTA', party_size: input.party_size })),
    [SUBMIT]: (_input: unknown, current: { version: number }) => runtime.ok({ ...current, state: 'SUBMITTED', version: current.version + 1 }),
    [REFUND]: (input: { amount: string }, current: { refunded_amount: string }) =>
      runtime.ok({ ...current, refunded_amount: (Number(current.refunded_amount) + Number(input.amount)).toFixed(2) }),
  };
  const claim = (state: string, version: number) => ({ claim_id: 'CLM-0000000001', state, version });
  const payment = (refunded: string) => ({ payment_id: 'pay_abcd1234', status: 'captured', captured_amount: '12.00', refunded_amount: refunded });

  it('runs the handler when each requires rule holds', () => {
    expect(runtime.executeOperation(CREATE, { party_size: 4 }, core)).toMatchObject({ ok: true });
    expect(runtime.executeOperation(CREATE, { party_size: 8, deposit_token: 'tok' }, core)).toMatchObject({ ok: true });
  });

  it('answers the otherwise of the first rule that fails, filled from the request, and never calls the handler', () => {
    calls.length = 0;
    expect(runtime.executeOperation(CREATE, { party_size: 13 }, core)).toMatchObject({
      ok: false,
      kind: 'DomainError',
      error: { urn: 'urn:demo:conditions:booking:error:party_too_large_for_online', message: 'A party of 13 books by phone' },
    });
    expect(runtime.executeOperation(CREATE, { party_size: 7 }, core)).toMatchObject({ ok: false, error: { urn: 'urn:demo:conditions:booking:error:deposit_required' } });
    expect(calls).toEqual([]);
  });

  it('checks the state of changes before the requires rules, and fills an error from the record', () => {
    expect(runtime.executeOperation(SUBMIT, { claim_id: 'CLM-0000000001', version: 3 }, core, { current: claim('SUBMITTED', 2) })).toMatchObject({
      ok: false,
      error: { urn: 'urn:demo:conditions:claim:error:invalid_state' },
    });
    expect(runtime.executeOperation(SUBMIT, { claim_id: 'CLM-0000000001', version: 3 }, core, { current: claim('DRAFT', 2) })).toMatchObject({
      ok: false,
      error: { urn: 'urn:demo:conditions:claim:error:version_conflict', message: 'Claim CLM-0000000001 is at version 2' },
    });
    expect(runtime.executeOperation(SUBMIT, { claim_id: 'CLM-0000000001', version: 2 }, core, { current: claim('DRAFT', 2) })).toMatchObject({
      ok: true,
      output: { version: 3 },
    });
  });

  it('is a ContractViolation, with the rule, when the answer breaks an ensures rule', () => {
    const wrong = { ...core, [SUBMIT]: (_input: unknown, current: { version: number }) => runtime.ok({ ...current, state: 'SUBMITTED' }) };
    expect(runtime.executeOperation(SUBMIT, { claim_id: 'CLM-0000000001', version: 2 }, wrong, { current: claim('DRAFT', 2) })).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ path: '', message: `the handler for ${SUBMIT} answered a value that breaks ensures: output.version = input.version + 1` }],
    });
  });

  it('compares decimals exactly, with arithmetic over the request and the record', () => {
    expect(runtime.executeOperation(REFUND, { payment_id: 'pay_abcd1234', amount: '2.00' }, core, { current: payment('10.00') })).toMatchObject({
      ok: true,
      output: { refunded_amount: '12.00' },
    });
    expect(runtime.executeOperation(REFUND, { payment_id: 'pay_abcd1234', amount: '2.01' }, core, { current: payment('10.00') })).toMatchObject({
      ok: false,
      error: { urn: 'urn:demo:conditions:payment:error:amount_exceeds_captured', message: 'Payment pay_abcd1234 has 12.00 captured and 10.00 refunded' },
    });
  });
});

describe('requires rules in a domain where no operation changes a record', async () => {
  const plain = await import('./fixtures/conditions-plain/expected/domain.runtime.generated.js');
  const core = {
    [CREATE]: (input) => plain.ok({ reference: 'KMPQXRTA', party_size: input.party_size }),
  } satisfies import('./fixtures/conditions-plain/expected/domain.runtime.generated.js').DomainCoreImplementation;

  it('answers the otherwise of a failed rule, and runs the handler when the rules hold', () => {
    expect(plain.executeOperation(CREATE, { party_size: 7 }, core)).toMatchObject({ ok: false, error: { urn: 'urn:demo:conditions:booking:error:deposit_required' } });
    expect(plain.executeOperation(CREATE, { party_size: 7, deposit_token: 'tok' }, core)).toMatchObject({ ok: true });
  });
});
