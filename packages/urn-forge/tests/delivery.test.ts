/**
 * Event delivery: an operation emits exactly one event when its `when` rule holds, the event
 * carries the values that `ensures` names with `event.`, the shell gives the event id, and the
 * outbox of the Postgres extra keeps the events of each payment in order until they are
 * published. The target is tests/fixtures/delivery.
 */
import { existsSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import type { Urn } from '../src/ir/types.js';
import { PLUGINS } from '../src/plugins/index.js';

const CREATE = 'urn:demo:delivery:payment:operation:create_payment';
const CAPTURE = 'urn:demo:delivery:payment:operation:capture_payment';
const AUTHORIZED = 'urn:demo:delivery:payment:event:authorized';
const PENDING = 'urn:demo:delivery:payment:event:pending';
const CAPTURED = 'urn:demo:delivery:payment:event:captured';

const dir = new URL('./fixtures/delivery/', import.meta.url);
const source = readFileSync(new URL('domain.manifest.yaml', dir), 'utf8');
const load = async (file: string) => (existsSync(new URL(`expected/${file}`, dir)) ? await import(new URL(`expected/${file}`, dir).href) : undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime: any = await load('domain.runtime.generated.ts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: any = await load('domain.store.generated.ts');
const schemaFile = new URL('expected/schema.generated.sql', dir);

let ids = 0;
const newEventId = () => `00000000-0000-4000-8000-${String((ids += 1)).padStart(12, '0')}`;
const payment = (status: string) => ({ payment_id: 'pay_abcd1234', status, amount: 500 });

describe('the delivery target compiles', () => {
  it('with no diagnostics, and the IR holds the events of each operation and their delivery', () => {
    const result = compile(source, [
      { plugin: PLUGINS.valibot, config: {} },
      { plugin: PLUGINS.fcis, config: {} },
      { plugin: PLUGINS.postgres, config: { tables: ['payment.entity.payment'] } },
    ]);
    expect(result.diagnostics).toEqual([]);
    const ops = result.ir?.operations as Readonly<Record<Urn, unknown>> | undefined;
    expect(ops?.[CREATE as Urn]).toMatchObject({
      emits: [AUTHORIZED, PENDING],
      exactly: [
        { event: AUTHORIZED, when: { ruleText: "output.status = 'authorized'" } },
        { event: PENDING, when: { ruleText: "output.status = 'pending'" } },
      ],
    });
    expect(ops?.[CAPTURE as Urn]).toMatchObject({ exactly: [{ event: CAPTURED }], ensures: [{}, {}, { ruleText: 'event.previous_status = current.status' }] });
    expect(result.ir?.events[CAPTURED as Urn]).toMatchObject({ delivery: { id: 'event_id', orderBy: ['payment_id'], sequence: 'sequence' } });
  });
});

describe('the runtime of the delivery target', () => {
  const answer = (status: string, events: readonly unknown[]) => ({ [CREATE]: () => runtime.ok(payment(status), events) });
  const authorized = () => runtime.emit(AUTHORIZED, payment('authorized'));

  it('gives each event the id from newEventId, and leaves the sequence to the outbox', () => {
    const result = runtime.executeOperation(CREATE, { amount: 500 }, answer('authorized', [authorized()]), { newEventId });
    expect(result).toMatchObject({ ok: true, events: [{ urn: AUTHORIZED, fields: { kind: AUTHORIZED, payment_id: 'pay_abcd1234', status: 'authorized' } }] });
    expect(result.events[0].fields.event_id).toMatch(/^00000000-0000-4000-8000-/);
    expect(result.events[0].fields).not.toHaveProperty('sequence');
  });

  it('refuses a success with no event, two events, or an event whose when rule does not hold', () => {
    const run = (status: string, events: readonly unknown[]) => runtime.executeOperation(CREATE, { amount: 500 }, answer(status, events), { newEventId });
    expect(run('authorized', []).issues[0].message).toBe(`${CREATE} emitted 0 ${AUTHORIZED}, but it emits exactly one when output.status = 'authorized'`);
    expect(run('authorized', [authorized(), authorized()]).issues[0].message).toBe(`${CREATE} emitted 2 ${AUTHORIZED}, but it emits exactly one when output.status = 'authorized'`);
    expect(run('pending', [authorized(), runtime.emit(PENDING, payment('pending'))]).issues[0].message).toBe(
      `${CREATE} emitted ${AUTHORIZED}, but it emits it only when output.status = 'authorized'`,
    );
  });

  it('checks the values of the event with ensures', () => {
    const capture = (previous: string) => ({
      [CAPTURE]: () => runtime.ok(payment('captured'), [runtime.emit(CAPTURED, { payment_id: 'pay_abcd1234', status: 'captured', previous_status: previous })]),
    });
    const run = (previous: string) => runtime.executeOperation(CAPTURE, { payment_id: 'pay_abcd1234' }, capture(previous), { current: payment('authorized'), newEventId });
    expect(run('authorized')).toMatchObject({ ok: true });
    expect(run('pending')).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ message: `the handler for ${CAPTURE} answered a value that breaks ensures: event.previous_status = current.status` }],
    });
  });

  it('needs newEventId for an event with delivery', () => {
    expect(runtime.executeOperation(CREATE, { amount: 500 }, answer('authorized', [authorized()])).issues[0].message).toBe(
      `${CREATE} emitted ${AUTHORIZED}, whose delivery needs an event id: pass newEventId to executeOperation`,
    );
  });
});

describe('the outbox of the delivery target, on PGlite', () => {
  const event = (status: string, id = 'pay_abcd1234') => ({
    urn: status === 'authorized' ? AUTHORIZED : PENDING,
    fields: { kind: status === 'authorized' ? AUTHORIZED : PENDING, event_id: newEventId(), payment_id: id, status, amount: 500 },
  });
  async function outbox(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(readFileSync(schemaFile, 'utf8'));
    return db;
  }
  const run = async (db: PGlite, statements: readonly { text: string; values: readonly unknown[] }[]) => {
    for (const { text, values } of statements) await db.query(text, values as unknown[]);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next = async (db: PGlite, limit = 10): Promise<any[]> => {
    const { text, values } = store.nextEvents(limit);
    return (await db.query(text, values as unknown[])).rows;
  };

  it('gives the events of one payment in order, with a sequence from 1 in each payload', async () => {
    const db = await outbox();
    await run(db, store.insertEvents([event('pending'), event('authorized', 'pay_zzzz9999')]));
    await run(db, store.insertEvents([event('authorized')]));
    const rows = await next(db);
    expect(rows.map((row) => [row.payload.payment_id, row.payload.status, row.payload.sequence])).toEqual([
      ['pay_abcd1234', 'pending', 1],
      ['pay_zzzz9999', 'authorized', 1],
      ['pay_abcd1234', 'authorized', 2],
    ]);
    expect(rows[0]).toMatchObject({ urn: PENDING, sequence: 1 });
  });

  it('gives an event again until it is marked published: at least once', async () => {
    const db = await outbox();
    await run(db, store.insertEvents([event('pending')]));
    const [first] = await next(db);
    expect((await next(db)).map((row) => row.id)).toEqual([first.id]);
    await run(db, [store.markPublished(first.id)]);
    expect(await next(db)).toEqual([]);
  });

  it('refuses a second event with the same id', async () => {
    const db = await outbox();
    const one = event('pending');
    await run(db, store.insertEvents([one]));
    await expect(run(db, store.insertEvents([one]))).rejects.toThrow(/duplicate key/);
  });
});

describe('the compile errors of delivery', () => {
  const messages = (from: string, to: string) => compile(source.replace(from, to)).diagnostics.map((d) => [d.code, d.message.replace(/^.*?: /, '')]);

  it('refuses event. in an operation whose emits are not each { event }', () => {
    expect(messages("    - event: payment.event.captured\n", '    - payment.event.captured\n')).toEqual([
      ['invalid-condition', 'ensures.0: "event.payment_id" reads the event, so each item of emits must have the form { event } or { event, when }'],
      ['invalid-condition', 'ensures.1: "event.status" reads the event, so each item of emits must have the form { event } or { event, when }'],
      ['invalid-condition', 'ensures.2: "event.previous_status" reads the event, so each item of emits must have the form { event } or { event, when }'],
    ]);
  });

  it('refuses event. in a when rule, and a property that not every event has', () => {
    expect(messages("when: output.status = 'pending'", 'when: event.status = output.status')).toEqual([
      ['invalid-condition', 'emits.1.when: "event.status" reads the event, which only an ensures rule can'],
    ]);
    expect(messages('    - event.status = output.status\n  payment.operation.capture_payment', '    - event.previous_status = output.status\n  payment.operation.capture_payment').length).toBe(0);
  });

  it('refuses a delivery that names a property of the wrong kind', () => {
    expect(messages('    sequence: sequence\npayment.event.pending', '    sequence: amount\npayment.event.pending')).toEqual([]);
    expect(messages('    id: event_id\n    orderBy: payment_id\n    sequence: sequence\npayment.event.captured', '    id: sequence\n    orderBy: [payment_id, reference]\n    sequence: payment_id\npayment.event.captured')).toEqual([
      ['invalid-delivery', 'delivery.id: "sequence" is integer, but the id must be a string'],
      ['invalid-delivery', 'delivery.orderBy[1]: "reference" is not a property of the event (properties: event_id, sequence, payment_id, status, amount)'],
      ['invalid-delivery', 'delivery.sequence: "payment_id" is string, but the sequence must be an integer'],
    ]);
  });
});
