/**
 * Refusals: an input that does not parse answers the declared error of rejects, with the issues;
 * a refusal keeps the rules of refuses; and commit writes nothing for a refusal. The target is
 * tests/fixtures/refusals.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';

const CREATE = 'urn:demo:refusals:booking:operation:create_booking';
const NO_AVAILABILITY = 'urn:demo:refusals:booking:error:no_availability';

const dir = new URL('./fixtures/refusals/', import.meta.url);
const source = readFileSync(new URL('domain.manifest.yaml', dir), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime: any = await import(new URL('expected/domain.runtime.generated.ts', dir).href);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: any = await import(new URL('expected/domain.store.generated.ts', dir).href);

const request = { date: '2026-11-22', starts_at: '2026-11-22T19:00:00Z', party_size: 4 };
const refuse = (alternatives: { starts_at: string; party_size: number }[]) => ({
  [CREATE]: (input: { date: string }) => runtime.fail(NO_AVAILABILITY, { date: input.date, alternatives }),
});

describe('the refusals target compiles', () => {
  it('with no diagnostics, and the IR holds rejects and refuses', () => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    const op = result.ir!.operations[CREATE as never] as unknown as { rejects?: string; refuses?: { error: string; ensures: { ruleText: string }[] }[] };
    expect(op.rejects).toBe('urn:demo:refusals:booking:error:invalid_request');
    expect(op.refuses?.map((r) => [r.error, r.ensures.map((e) => e.ruleText)])).toEqual([
      [NO_AVAILABILITY, ['all(alt in error.alternatives: date(alt.starts_at) = input.date)', 'all(alt in error.alternatives: alt.party_size = input.party_size)']],
    ]);
  });

  it('refuses a rejects error that is not declared or has a required property, and a refuses rule that reads the answer', () => {
    const messages = (from: string, to: string) => compile(source.replace(from, to)).diagnostics.map((d) => [d.code, d.message.replace(/^urn:demo:refusals:booking:operation:/, '')]);
    expect(messages('  rejects: booking.error.invalid_request', '  rejects: booking.error.no_availability')).toEqual([
      ['invalid-rejects', 'create_booking: rejects: urn:demo:refusals:booking:error:no_availability has the required properties date, which an input that does not parse cannot fill; make them optional'],
    ]);
    expect(messages('  errors: [booking.error.invalid_request, booking.error.no_availability]', '  errors: [booking.error.no_availability]')).toEqual([
      ['invalid-rejects', 'create_booking: rejects: urn:demo:refusals:booking:error:invalid_request is not one of the errors of the operation; add it to errors'],
    ]);
    expect(messages("alt.party_size = input.party_size)'", "alt.party_size = output.party_size)'")).toEqual([
      ['invalid-refuses', 'create_booking: refuses.0.ensures.1: "output.party_size" reads the answer of a success, which a refusal does not have; read error.'],
    ]);
    expect(messages("        - 'all(alt in error.alternatives: date(alt.starts_at) = input.date)'\n", '')).toEqual([]);
    expect(messages('    - error: booking.error.no_availability', '    - error: booking.error.invalid_state')).toEqual([
      ['invalid-refuses', 'create_booking: refuses.0.error: urn:demo:refusals:booking:error:invalid_state is not one of the errors of the operation; add it to errors'],
    ]);
  });

  it('refuses error. outside refuses', () => {
    const diagnostics = compile(source.replace('  emits: [booking.event.created]\n', "  ensures:\n    - 'error.date = input.date'\n  emits: [booking.event.created]\n")).diagnostics;
    expect(diagnostics.map((d) => d.message)).toEqual([`${CREATE}: ensures.0: "error.date" reads a refusal, which only a rule of refuses can`]);
  });
});

describe('the helpers of a rule of refuses', () => {
  it('are in the schemas file: a rule that counts days gets epochDay', () => {
    const counted = source.replace("date(alt.starts_at) = input.date)'", "date(alt.starts_at) + 1 > input.date)'");
    const result = compile(counted);
    expect(result.diagnostics).toEqual([]);
    expect(result.files.find((f) => f.relativePath === 'domain.schemas.generated.ts')?.content).toContain('function epochDay(');
  });
});

describe('rejects', () => {
  it('answers an input that does not parse with the declared error, and the issues', () => {
    const result = runtime.executeOperation(CREATE, { ...request, party_size: 0 }, refuse([]));
    expect(result).toMatchObject({
      ok: false,
      kind: 'DomainError',
      error: { urn: 'urn:demo:refusals:booking:error:invalid_request', category: 'validation', retryable: false, message: 'The request is not valid' },
      issues: [{ path: 'party_size', fieldUrn: 'urn:demo:refusals:booking:field:party_size' }],
    });
  });

  it('keeps InputRejected for an operation without rejects', () => {
    const result = runtime.executeOperation('urn:demo:refusals:booking:operation:cancel_booking', { booking_id: 'nope' }, {}, { current: null });
    expect(result).toMatchObject({ ok: false, kind: 'InputRejected', issues: [{ path: 'booking_id' }] });
  });
});

describe('refuses', () => {
  it('passes a refusal whose alternatives are on the requested date for the same party', () => {
    const alternatives = [
      { starts_at: '2026-11-22T00:00:00Z', party_size: 4 },
      { starts_at: '2026-11-22T23:59:59.999Z', party_size: 4 },
    ];
    expect(runtime.executeOperation(CREATE, request, refuse(alternatives))).toMatchObject({ ok: false, kind: 'DomainError', error: { urn: NO_AVAILABILITY, fields: { alternatives } } });
    expect(runtime.executeOperation(CREATE, request, refuse([]))).toMatchObject({ ok: false, kind: 'DomainError' });
  });

  it('answers a ContractViolation for an alternative on another date, or for another party', () => {
    expect(runtime.executeOperation(CREATE, request, refuse([{ starts_at: '2026-11-23T00:00:00Z', party_size: 4 }]))).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ message: `the handler for ${CREATE} refused with ${NO_AVAILABILITY}, whose payload breaks refuses: all(alt in error.alternatives: date(alt.starts_at) = input.date)` }],
    });
    expect(runtime.executeOperation(CREATE, request, refuse([{ starts_at: '2026-11-22T20:00:00Z', party_size: 2 }]))).toMatchObject({ ok: false, kind: 'ContractViolation' });
  });
});

describe('commit, on PGlite', () => {
  const CANCEL = 'urn:demo:refusals:booking:operation:cancel_booking';
  const booking = { booking_id: 'bkg_abcd1234', status: 'CONFIRMED', date: '2026-11-22', starts_at: '2026-11-22T19:00:00Z', party_size: 4 };
  const core = {
    [CANCEL]: (_input: unknown, current: typeof booking) => runtime.ok({ ...current, status: 'CANCELLED' }, [runtime.emit('urn:demo:refusals:booking:event:cancelled', { booking_id: current.booking_id })]),
  };
  const database = async () => {
    const db = new PGlite();
    await db.exec(readFileSync(new URL('expected/schema.generated.sql', dir), 'utf8'));
    for (const statement of store.insertBookingBooking(booking)) await db.query(statement.text, statement.values as unknown[]);
    return db;
  };
  const run = async (db: PGlite, statements: readonly { text: string; values: readonly unknown[] }[]) => {
    for (const statement of statements) await db.query(statement.text, statement.values as unknown[]);
  };
  const status = async (db: PGlite) => (await db.query<{ status: string }>('SELECT "status" FROM "booking"."booking"')).rows.map((r) => r.status);

  it('writes the new record of a success, in a state of from', async () => {
    const db = await database();
    const result = runtime.executeOperation(CANCEL, { booking_id: booking.booking_id }, core, { current: booking });
    expect(result).toMatchObject({ ok: true });
    await run(db, store.commit(result));
    expect(await status(db)).toEqual(['CANCELLED']);
  });

  it('gives no statement for a refusal, a rejected input, or a refusal of the core', async () => {
    const db = await database();
    const refused = runtime.executeOperation(CANCEL, { booking_id: booking.booking_id }, core, { current: { ...booking, status: 'CANCELLED' } });
    expect(refused).toMatchObject({ ok: false, kind: 'DomainError', error: { urn: 'urn:demo:refusals:booking:error:invalid_state' } });
    expect(store.commit(refused)).toEqual([]);
    expect(store.commit(runtime.executeOperation(CREATE, { party_size: 0 }, refuse([])))).toEqual([]);
    expect(store.commit(runtime.executeOperation(CREATE, request, refuse([])), () => [{ text: 'DELETE FROM "booking"."booking"', values: [] }])).toEqual([]);
    expect(await status(db)).toEqual(['CONFIRMED']);
  });

  it('adds the statements of writes to a success', async () => {
    const db = await database();
    const result = runtime.executeOperation(CANCEL, { booking_id: booking.booking_id }, core, { current: booking });
    const statements = store.commit(result, (output: { booking_id: string }) => [{ text: 'SELECT $1::text AS id', values: [output.booking_id] }]);
    expect(statements.at(-1)).toEqual({ text: 'SELECT $1::text AS id', values: [booking.booking_id] });
    await run(db, statements);
  });
});
