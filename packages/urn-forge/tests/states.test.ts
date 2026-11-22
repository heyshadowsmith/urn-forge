/**
 * States and moves: `moves` on an enum field, `changes` on an operation, and the record that
 * the call changes. The target (tests/states/domain.manifest.yaml) is a booking that can be
 * seated, changed or cancelled only while it is confirmed.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import type { Urn } from '../src/ir/types.js';

/** A test of the target that does not pass yet: `it.fails` until its step is built, then `it`. */
const target = { compile: it.fails, runtime: it.fails };

const pkg = fileURLToPath(new URL('..', import.meta.url));
const SEAT = 'urn:demo:states:booking:operation:seat_booking' as Urn;
const CHANGE = 'urn:demo:states:booking:operation:change_party' as Urn;
const CANCEL = 'urn:demo:states:booking:operation:cancel_booking' as Urn;
const INVALID_STATE = 'urn:demo:states:booking:error:invalid_state' as Urn;
const STATE = 'urn:demo:states:booking:field:state' as Urn;

const booking = (state: string) => ({ reference: 'KMPQXRTA', state, party_size: 4 });

let source: string;
beforeAll(async () => {
  source = await readFile(join(pkg, 'tests/states/domain.manifest.yaml'), 'utf8');
});

describe('the states target compiles', () => {
  target.compile('with no diagnostics, and the IR holds the moves and the change of each operation', () => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.fields[STATE]).toMatchObject({ moves: { confirmed: ['seated', 'cancelled'], seated: ['completed'] } });
    expect(result.ir?.operations[SEAT]).toMatchObject({
      changes: { entity: 'urn:demo:states:booking:entity:booking', property: 'state', from: ['confirmed'], to: 'seated', otherwise: INVALID_STATE },
    });
    expect((result.ir?.operations[CHANGE] as { readonly changes?: object } | undefined)?.changes).not.toHaveProperty('to');
  });
});

describe('the runtime of the states target', () => {
  let dir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runtime: any;
  const calls: string[] = [];
  // A core that records each call, and seats, changes and cancels as asked.
  const core = {
    [SEAT]: (_input: unknown, current: ReturnType<typeof booking>) => (calls.push(SEAT), { ok: true, value: { ...current, state: 'seated' }, events: [] }),
    [CHANGE]: (input: { party_size: number }, current: ReturnType<typeof booking>) => (calls.push(CHANGE), { ok: true, value: { ...current, party_size: input.party_size }, events: [] }),
    [CANCEL]: (input: { reference: string }) => (calls.push(CANCEL), { ok: true, value: { reference: input.reference, refund: '0.00' }, events: [] }),
  };

  beforeAll(async () => {
    dir = await mkdtemp(join(pkg, '.states-'));
    const result = compile(source);
    for (const file of result.files) await writeFile(join(dir, file.relativePath), file.content);
    // Until the manifest compiles there is no runtime, and each test below fails on it.
    if (result.files.length > 0) runtime = await import(join(dir, 'domain.runtime.generated.ts'));
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  target.runtime('runs the handler with the current record when its state is in from', () => {
    const result = runtime.executeOperation(SEAT, { reference: 'KMPQXRTA' }, core, { current: booking('confirmed') });
    expect(result).toMatchObject({ ok: true, output: { state: 'seated' } });
  });

  target.runtime('refuses a state outside from with otherwise, filled from the record, and never calls the handler', () => {
    calls.length = 0;
    const result = runtime.executeOperation(SEAT, { reference: 'KMPQXRTA' }, core, { current: booking('cancelled') });
    expect(result).toMatchObject({ ok: false, kind: 'DomainError', error: { urn: INVALID_STATE, fields: { reference: 'KMPQXRTA', state: 'cancelled' }, message: 'Booking KMPQXRTA is cancelled' } });
    expect(calls).toEqual([]);
  });

  target.runtime('keeps the state when the change has no to', () => {
    expect(runtime.executeOperation(CHANGE, { reference: 'KMPQXRTA', party_size: 6 }, core, { current: booking('confirmed') })).toMatchObject({ ok: true, output: { state: 'confirmed', party_size: 6 } });
  });

  target.runtime('does not check the state of an answer that is not the changed entity', () => {
    expect(runtime.executeOperation(CANCEL, { reference: 'KMPQXRTA' }, core, { current: booking('confirmed') })).toMatchObject({ ok: true });
  });

  target.runtime('is a ContractViolation when the answer is not in the state of to', () => {
    const wrong = { ...core, [SEAT]: (_i: unknown, current: ReturnType<typeof booking>) => ({ ok: true, value: { ...current, state: 'completed' }, events: [] }) };
    expect(runtime.executeOperation(SEAT, { reference: 'KMPQXRTA' }, wrong, { current: booking('confirmed') })).toMatchObject({ ok: false, kind: 'ContractViolation' });
  });

  target.runtime('is a ContractViolation when the answer has a different key', () => {
    const wrong = { ...core, [SEAT]: (_i: unknown, current: ReturnType<typeof booking>) => ({ ok: true, value: { ...current, reference: 'ZZZZZZZZ', state: 'seated' }, events: [] }) };
    expect(runtime.executeOperation(SEAT, { reference: 'KMPQXRTA' }, wrong, { current: booking('confirmed') })).toMatchObject({ ok: false, kind: 'ContractViolation' });
  });

  target.runtime('is a ContractViolation when the shell passes a record that does not parse, or none', () => {
    expect(runtime.executeOperation(SEAT, { reference: 'KMPQXRTA' }, core, { current: { reference: 'KMPQXRTA', state: 'lost', party_size: 4 } })).toMatchObject({ ok: false, kind: 'ContractViolation' });
    expect(runtime.executeOperation(SEAT, { reference: 'KMPQXRTA' }, core)).toMatchObject({ ok: false, kind: 'ContractViolation' });
  });
});
