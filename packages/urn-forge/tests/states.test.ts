/**
 * States and moves: `moves` on an enum field, `changes` on an operation, and the record that
 * the call changes. The target (tests/fixtures/states) is a booking that can be seated,
 * changed or cancelled only while it is confirmed.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import type { Urn } from '../src/ir/types.js';
import { indexFeatureSource } from '../src/verify/feature-index.js';
import { checkGherkin } from '../src/verify/gherkin.js';
import type { GateContext } from '../src/verify/types.js';
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

describe('gate 3 for the states target', () => {
  const ir = compile(source).ir!;
  const gate3 = (feature: string) =>
    checkGherkin({ ir, features: { directory: 'features', features: [indexFeatureSource(feature, 'f.feature')!], problems: [] }, boundaryCoverage: 'warn' } as unknown as GateContext);
  const states = (outcome: ReturnType<typeof gate3>) => outcome.problems.filter((p) => p.code === 'uncovered-state' || p.code === 'invalid-current').map((p) => p.message);

  const current = (state: string) => `    Given the current booking is:\n      | reference | state | party_size |\n      | KMPQXRTA | ${state} | 4 |\n`;
  const scenario = (tag: string, name: string, steps: string) => `  @${tag}\n  Scenario: ${name}\n${steps}`;
  const seat = (state: string, then: string) =>
    scenario(SEAT, `seat from ${state}`, `${current(state)}    When I run the operation with:\n      | reference |\n      | KMPQXRTA |\n    Then ${then}\n`);
  const SEAT_COVERED = seat('confirmed', 'the output is:\n      | reference | state | party_size |\n      | KMPQXRTA | seated | 4 |') + seat('cancelled', `the operation fails with "${INVALID_STATE}"`);

  it('passes, and counts the states, when each from state and a refused state have a scenario', () => {
    const outcome = gate3(`Feature: f\n${SEAT_COVERED}`);
    expect(states(outcome)).toEqual([]);
    expect(outcome.summary).toContain(', 2/6 states covered');
  });

  it('counts a state of an Examples row', () => {
    const outline =
      `  @${SEAT}\n  Scenario Outline: seat\n${current('<state>')}    When I run the operation with:\n      | reference |\n      | KMPQXRTA |\n` +
      `    Then the operation fails with "${INVALID_STATE}"\n    Examples:\n      | state |\n      | seated |\n`;
    expect(states(gate3(`Feature: f\n${outline}`)).filter((m) => m.includes('outside'))).toEqual([]);
  });

  it('reports a from state with no scenario, and no refused state', () => {
    expect(states(gate3(`Feature: f\n${seat('cancelled', 'the output is:\n      | state |\n      | seated |')}`))).toEqual([
      `${SEAT} starts from state "confirmed", which no scenario gives; add one with Given the current booking is: and state confirmed`,
      `${SEAT} has no scenario with a state outside confirmed that expects "${INVALID_STATE}"; add one with Given the current booking is: and Then the operation fails with "${INVALID_STATE}"`,
    ]);
  });

  it('reports a current record that names another entity, one on an operation with no changes, and a run with none', () => {
    const wrongWord = scenario(SEAT, 'w', `    Given the current table is:\n      | reference |\n      | KMPQXRTA |\n    When I run the operation with:\n      | reference |\n      | KMPQXRTA |\n`);
    const noRecord = scenario(SEAT, 'n', `    When I run the operation with:\n      | reference |\n      | KMPQXRTA |\n`);
    const messages = states(gate3(`Feature: f\n${SEAT_COVERED}${wrongWord}${noRecord}`));
    expect(messages).toEqual([
      `${SEAT} changes a record of urn:demo:states:booking:entity:booking: write "the current booking is:", not "the current table is:"`,
      `${SEAT} changes a record of urn:demo:states:booking:entity:booking; give it with "Given the current booking is:" before the operation runs`,
    ]);
  });

  it('checks the headers of the current record against the changed entity', () => {
    const extra = scenario(SEAT, 'x', `    Given the current booking is:\n      | reference | state | refund |\n      | KMPQXRTA | confirmed | 1.00 |\n    When I run the operation with:\n      | reference |\n      | KMPQXRTA |\n`);
    expect(gate3(`Feature: f\n${SEAT_COVERED}${extra}`).problems.filter((p) => p.code === 'unknown-header').map((p) => p.message)).toEqual([
      'table header "refund" is not a field key of urn:demo:states:booking:entity:booking (allowed: reference, state, party_size)',
    ]);
  });
});

describe('the store of the states target, on PGlite', async () => {
  const { insertBookingBooking, replaceBookingBookingFrom } = await import('./fixtures/states/expected/domain.store.generated.js');
  const schema = readFileSync(new URL('./fixtures/states/expected/schema.generated.sql', import.meta.url), 'utf8');
  type Statement = { readonly text: string; readonly values: readonly unknown[] };
  type Booking = Parameters<typeof insertBookingBooking>[0];
  const stored = (state: string) => ({ reference: 'KMPQXRTA', state, party_size: 4 }) as unknown as Booking;

  /** A shell that runs one move in a transaction: it rolls back when the DELETE took no row. Gives that count. */
  async function move(db: PGlite, statements: readonly Statement[]): Promise<number> {
    await db.exec('BEGIN');
    const [first, ...rest] = statements;
    const deleted = (await db.query(first!.text, first!.values as unknown[])).affectedRows ?? 0;
    if (deleted !== 1) {
      await db.exec('ROLLBACK');
      return deleted;
    }
    for (const { text, values } of rest) await db.query(text, values as unknown[]);
    await db.exec('COMMIT');
    return deleted;
  }

  it('moves a record from a state in from, and the second of two moves of one record deletes no row', async () => {
    const db = new PGlite();
    await db.exec(schema);
    for (const { text, values } of insertBookingBooking(stored('confirmed'))) await db.query(text, values as unknown[]);
    // Two shells loaded the confirmed booking: one seats it, then the other cancels it.
    expect(await move(db, replaceBookingBookingFrom(stored('seated'), ['confirmed']))).toBe(1);
    expect(await move(db, replaceBookingBookingFrom(stored('cancelled'), ['confirmed']))).toBe(0);
    // A shell that does not check still cannot win: the INSERT finds the row of the first move.
    await db.exec('BEGIN');
    const statements = replaceBookingBookingFrom(stored('cancelled'), ['confirmed']);
    await expect((async () => {
      for (const { text, values } of statements) await db.query(text, values as unknown[]);
    })()).rejects.toThrow(/duplicate key/);
    await db.exec('ROLLBACK');
    expect((await db.query('SELECT "state" FROM "booking"."booking"')).rows).toEqual([{ state: 'seated' }]);
    await db.close();
  });
});
