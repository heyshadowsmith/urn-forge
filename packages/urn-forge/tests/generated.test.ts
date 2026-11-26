/**
 * The generated file of the booking fixture: it is current, and its checks and its harness keep the
 * contract. The tests run the committed file, which tsc type-checks with the tests.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileManifest, generate } from '../src/index.js';
import { core } from './fixtures/booking/core.js';
import { check, Definitions, runOperation, type DomainCore, type Failure } from './fixtures/booking/generated/domain.generated.js';

const MANIFEST = 'domain.manifest.yaml';
const manifest = readFileSync(new URL('./fixtures/booking/domain.manifest.yaml', import.meta.url), 'utf8');

const booking = {
  reference: 'ABCDEFGH',
  party_size: 4,
  state: 'confirmed',
  starts_at: '2026-11-24T19:00:00Z',
  ends_at: '2026-11-24T21:00:00Z',
  contact: { email: 'ada@example.com' },
};

/** The rules that a value breaks, as `rule at path`. */
function breaks(definition: Parameters<typeof check>[0], value: unknown): string[] {
  const result = check(definition, value);
  return result.ok ? [] : result.failures.map((f) => `${f.rule} at ${f.path || '(the value)'}: ${f.message}`);
}

it('the committed file is the file that compile gives', () => {
  const compiled = compileManifest(manifest);
  const [file] = generate(compiled as Parameters<typeof generate>[0], MANIFEST);
  expect(readFileSync(new URL('./fixtures/booking/generated/domain.generated.ts', import.meta.url), 'utf8')).toBe(file!.content);
});

describe('check', () => {
  it('accepts a booking that keeps every rule', () => {
    expect(breaks('booking', booking)).toEqual([]);
  });

  it.each([
    [{ ...booking, reference: 'abc' }, 'pattern at reference: Must match ^[A-Z]{8}$'],
    [{ ...booking, party_size: 0 }, 'minimum at party_size: Must be at least 1'],
    [{ ...booking, party_size: 2.5 }, 'type at party_size: Must be an integer'],
    [{ ...booking, state: 'lost' }, 'enum at state: Must be one of confirmed, seated, completed, cancelled'],
    [{ ...booking, starts_at: '24/11/2026' }, 'format at starts_at: Must be a date-time'],
    [{ ...booking, tables: [1, 1] }, 'uniqueItems at tables: Must not have an item two times'],
    [{ ...booking, tables: [1, 0] }, 'minimum at tables[1]: Must be at least 1'],
    [{ ...booking, contact: {} }, 'required at contact: Must have email'],
    [{ ...booking, contact: { email: 'ada@example.com', fax: '1' } }, 'properties at contact.fax: Must be one of the properties of contact: email, phone'],
    [{ ...booking, party_size: 8 }, 'large_party_pays_deposit at (the value): A party of 7 or more pays a deposit'],
    [{ ...booking, ends_at: '2026-11-24T19:15:00Z' }, 'ends_after_start at (the value): A booking lasts more than 30 minutes'],
    [{ ...booking, dishes: [{ course: 'main', amount: 1500 }], total: 1000 }, 'total_is_the_dishes at (the value): The total is not the sum of the dishes'],
    [{ ...booking, deposit: -1 }, 'at_least at deposit: Must be at least 0'],
  ])('refuses %j: %s', (value, failure) => {
    expect(breaks('booking', value)).toEqual([failure]);
  });

  it('gives the required rule first, and no other rule of the object after it', () => {
    const { reference: _, ...noReference } = booking;
    expect(breaks('booking', { ...noReference, party_size: 8 })).toEqual(['required at (the value): Must have reference, party_size, state, starts_at, ends_at, contact']);
  });

  it('breaks a rule that cannot give a result, such as timestamp() of a time that does not exist', () => {
    expect(breaks('booking', { ...booking, starts_at: '2026-02-30T19:00:00Z' })).toEqual(['ends_after_start at (the value): A booking lasts more than 30 minutes']);
  });

  it('checks a definition named as a type with the rules of that definition', () => {
    expect(breaks('stored_booking', { ...booking, party_size: 0 })).toEqual(['minimum at party_size: Must be at least 1']);
  });

  it('exports the type of a failure', () => {
    const result = check('party_size', 0);
    const failures: readonly Failure[] = result.ok ? [] : result.failures;
    expect(failures).toEqual([{ definition: 'party_size', rule: 'minimum', path: '', message: 'Must be at least 1' }]);
  });

  it('describes each definition for the Gherkin steps', () => {
    expect(Definitions.booking.base).toBe('object');
    expect(Definitions.tables).toEqual({ urn: 'urn:demo:booking:definition:tables', base: 'array', items: 'table_number', rules: ['maxItems', 'uniqueItems'] });
  });
});

describe('runOperation', () => {
  it('answers the output of the core, when the input and the answer keep the contract', () => {
    expect(runOperation(core, 'seat_booking', { reference: 'ABCDEFGH', stored_booking: booking })).toEqual({
      ok: true,
      domain: 'urn:demo:booking',
      operation: 'seat_booking',
      output: 'booking',
      value: { ...booking, state: 'seated' },
    });
    expect(runOperation(core, 'seat_booking', { reference: 'ABCDEFGH', stored_booking: { ...booking, state: 'cancelled' } })).toMatchObject({
      ok: true,
      output: 'invalid_state',
      value: { reference: 'ABCDEFGH', state: 'cancelled' },
    });
  });

  it('rejects an input that breaks a rule, and does not call the core', () => {
    let called = false;
    const spy = { seat_booking: (input) => ((called = true), core.seat_booking(input)) } satisfies DomainCore;
    const result = runOperation(spy, 'seat_booking', { reference: 'ABCDEFGH', stored_booking: { ...booking, reference: 'ZZZZZZZZ' } });
    expect(result).toEqual({
      ok: false,
      domain: 'urn:demo:booking',
      operation: 'seat_booking',
      kind: 'InputRejected',
      failures: [{ definition: 'seat_request', rule: 'names_the_booking', path: '', message: 'The request names another booking than the one loaded' }],
    });
    expect(called).toBe(false);
  });

  it('reports an answer that breaks a rule of its output as a contract violation', () => {
    const wrong = { seat_booking: ({ stored_booking }) => ({ output: 'booking' as const, value: { ...stored_booking, state: 'seated' as const, party_size: 5 } }) } satisfies DomainCore;
    expect(runOperation(wrong, 'seat_booking', { reference: 'ABCDEFGH', stored_booking: booking })).toEqual({
      ok: false,
      domain: 'urn:demo:booking',
      operation: 'seat_booking',
      kind: 'ContractViolation',
      failures: [{ definition: 'seat_booking', rule: 'keeps_the_party', path: '', message: 'Seating may change only the state' }],
    });
  });

  it('reports a refusal for a confirmed booking as a contract violation', () => {
    const refuses = { seat_booking: ({ reference }) => ({ output: 'invalid_state' as const, value: { reference, state: 'confirmed' as const } }) } satisfies DomainCore;
    const result = runOperation(refuses, 'seat_booking', { reference: 'ABCDEFGH', stored_booking: booking });
    expect(result.ok === false && result.failures.map((f) => f.rule)).toEqual(['was_not_confirmed']);
  });

  it('reports an answer that is not an output, or whose value breaks its definition', () => {
    const other = { seat_booking: () => ({ output: 'receipt', value: {} }) } as unknown as DomainCore;
    expect(runOperation(other, 'seat_booking', { reference: 'ABCDEFGH', stored_booking: booking })).toMatchObject({
      kind: 'ContractViolation',
      failures: [{ rule: 'output', message: 'Must answer one of the outputs of seat_booking: booking, invalid_state' }],
    });
    const broken = { seat_booking: ({ stored_booking }) => ({ output: 'booking' as const, value: { ...stored_booking, state: 'seated' as const, party_size: 0 } }) } satisfies DomainCore;
    expect(runOperation(broken, 'seat_booking', { reference: 'ABCDEFGH', stored_booking: booking })).toMatchObject({
      kind: 'ContractViolation',
      failures: [{ definition: 'party_size', rule: 'minimum', path: 'output.party_size' }],
    });
  });
});

describe('arguments', () => {
  const HEADER = 'manifest:\n  namespace: demo\n  domain: shop\n  version: 0.1.0\n';
  it('break no rule of their parameter: a count of 0 or more', () => {
    const { diagnostics } = compileManifest(HEADER + 'definitions:\n  sku:\n    description: A SKU\n    type: string\n    rules:\n      - maxLength: -1\n');
    expect(diagnostics.map((d) => `${d.code} ${d.path.join('.')}: ${d.message}`)).toEqual([
      'rule-argument definitions.sku.rules.0.maxLength: maxLength: -1 breaks minimum of count: Must be at least 0',
    ]);
  });

  it('break no rule of a parameter of the manifest', () => {
    const { diagnostics } = compileManifest(HEADER + 'definitions:\n  sku:\n    description: A SKU\n    type: string\n    rules:\n      - format: time\n');
    expect(diagnostics.map((d) => d.message)).toEqual(['format: "time" breaks enum of date_format: Must be one of date, date-time']);
  });
});
