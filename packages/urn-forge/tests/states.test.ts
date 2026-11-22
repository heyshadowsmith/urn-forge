/**
 * States and moves: `moves` on an enum field, `changes` on an operation, and the record that
 * the call changes. The target (tests/fixtures/states) is a booking that can be seated,
 * changed or cancelled only while it is confirmed.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import type { Urn } from '../src/ir/types.js';
import {
  executeOperation,
  ok,
  type DomainCoreImplementation,
} from './fixtures/states/expected/domain.runtime.generated.js';

const SEAT = 'urn:demo:states:booking:operation:seat_booking';
const CHANGE = 'urn:demo:states:booking:operation:change_party';
const CANCEL = 'urn:demo:states:booking:operation:cancel_booking';
const INVALID_STATE = 'urn:demo:states:booking:error:invalid_state';

const source = readFileSync(new URL('./fixtures/states/domain.manifest.yaml', import.meta.url), 'utf8');
const booking = (state: string) => ({ reference: 'KMPQXRTA', state, party_size: 4 });

describe('the states target compiles', () => {
  it('with no diagnostics, and the IR holds the moves and the change of each operation', () => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.fields['urn:demo:states:booking:field:state' as Urn]).toMatchObject({ moves: { confirmed: ['seated', 'cancelled'], seated: ['completed'] } });
    expect(result.ir?.operations[SEAT as Urn]).toMatchObject({
      changes: { entity: 'urn:demo:states:booking:entity:booking', property: 'state', from: ['confirmed'], to: 'seated', otherwise: INVALID_STATE },
    });
    expect(result.ir?.operations[CHANGE as Urn]?.changes).not.toHaveProperty('to');
  });
});

describe('the runtime of the states target', () => {
  const calls: string[] = [];
  // A core that records each call, and seats, changes and cancels as asked.
  const core = {
    [SEAT]: (_input, current) => (calls.push(SEAT), ok({ ...current, state: 'seated' })),
    [CHANGE]: (input, current) => (calls.push(CHANGE), ok({ ...current, party_size: input.party_size })),
    [CANCEL]: (input) => (calls.push(CANCEL), ok({ reference: input.reference, refund: '0.00' })),
  } satisfies DomainCoreImplementation;

  it('runs the handler with the current record when its state is in from', () => {
    expect(executeOperation(SEAT, { reference: 'KMPQXRTA' }, core, { current: booking('confirmed') })).toMatchObject({ ok: true, output: { state: 'seated' } });
  });

  it('refuses a state outside from with otherwise, filled from the record, and never calls the handler', () => {
    calls.length = 0;
    expect(executeOperation(SEAT, { reference: 'KMPQXRTA' }, core, { current: booking('cancelled') })).toMatchObject({
      ok: false,
      kind: 'DomainError',
      error: { urn: INVALID_STATE, fields: { reference: 'KMPQXRTA', state: 'cancelled' }, message: 'Booking KMPQXRTA is cancelled' },
    });
    expect(calls).toEqual([]);
  });

  it('keeps the state when the change has no to', () => {
    expect(executeOperation(CHANGE, { reference: 'KMPQXRTA', party_size: 6 }, core, { current: booking('confirmed') })).toMatchObject({ ok: true, output: { state: 'confirmed', party_size: 6 } });
  });

  it('checks the state of the record also when the answer is not the changed entity, but not the answer', () => {
    expect(executeOperation(CANCEL, { reference: 'KMPQXRTA' }, core, { current: booking('confirmed') })).toMatchObject({ ok: true, output: { refund: '0.00' } });
    expect(executeOperation(CANCEL, { reference: 'KMPQXRTA' }, core, { current: booking('seated') })).toMatchObject({ ok: false, kind: 'DomainError', error: { urn: INVALID_STATE } });
  });

  it('is a ContractViolation when the answer is not in the state of to', () => {
    const wrong = { ...core, [SEAT]: (_input, current) => ok({ ...current, state: 'completed' }) } satisfies DomainCoreImplementation;
    expect(executeOperation(SEAT, { reference: 'KMPQXRTA' }, wrong, { current: booking('confirmed') })).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ path: 'state', message: `the handler for ${SEAT} answered state "completed", but the operation moves to "seated"` }],
    });
  });

  it('is a ContractViolation when the state changes and the operation has no to', () => {
    const wrong = { ...core, [CHANGE]: (_input, current) => ok({ ...current, state: 'seated' }) } satisfies DomainCoreImplementation;
    expect(executeOperation(CHANGE, { reference: 'KMPQXRTA', party_size: 6 }, wrong, { current: booking('confirmed') })).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ path: 'state', message: `the handler for ${CHANGE} answered state "seated", but the state stays "confirmed"` }],
    });
  });

  it('is a ContractViolation when the answer has a different key', () => {
    const wrong = { ...core, [SEAT]: (_input, current) => ok({ ...current, reference: 'ZZZZZZZZ', state: 'seated' }) } satisfies DomainCoreImplementation;
    expect(executeOperation(SEAT, { reference: 'KMPQXRTA' }, wrong, { current: booking('confirmed') })).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ path: 'reference', message: `the handler for ${SEAT} answered reference "ZZZZZZZZ", but the record has "KMPQXRTA"` }],
    });
  });

  it('is a ContractViolation when the shell passes a record that does not parse, or none', () => {
    expect(executeOperation(SEAT, { reference: 'KMPQXRTA' }, core, { current: { reference: 'KMPQXRTA', state: 'lost', party_size: 4 } })).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ path: 'current.state' }],
    });
    expect(executeOperation(SEAT, { reference: 'KMPQXRTA' }, core)).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ path: 'current', message: `${SEAT} changes a record of urn:demo:states:booking:entity:booking: pass it as { current }` }],
    });
  });

  it('types current as the stored entity, so tsc refuses a handler that reads it as something else', () => {
    const typed = {
      ...core,
      // @ts-expect-error: current is a booking, which has no refund
      [SEAT]: (_input, current: { readonly refund: string }) => ok({ reference: current.refund, state: 'seated', party_size: 1 }),
    } satisfies DomainCoreImplementation;
    expect(typed).toBeDefined();
  });
});
