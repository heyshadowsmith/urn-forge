/** reportOn: the property that the issue of an invariant goes on. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';

const HEADER = 'manifest:\n  namespace: demo\n  domain: resto\n  version: 0.1.0\n';
const BASE =
  'b.field.party_size: { primitive: integer }\nb.field.deposit: { primitive: decimal }\nb.field.seats: { primitive: integer }\nb.field.notes: { primitive: string }\n' +
  'b.entity.request:\n  description: d\n  fields:\n    - ref: b.field.party_size\n    - { ref: b.field.deposit, required: false }\n    - ref: b.field.seats\n    - { ref: b.field.notes, as: guest_notes, required: false }\n';
const withReportOn = (reportOn: string, rule = 'party_size <= 6 or deposit is present') =>
  compile(`${HEADER}${BASE}b.invariant.paid:\n  description: d\n  on: b.entity.request\n  rule: ${rule}\n  reportOn: ${reportOn}\n  message: m\n`);
const messages = (reportOn: string, rule?: string) => withReportOn(reportOn, rule).diagnostics.map((d) => `${d.code}: ${d.message}`);

describe('reportOn in the manifest and the IR', () => {
  it('keeps a property that the rule names, also one in a presence condition or with an as name', () => {
    expect(withReportOn('deposit').ir!.invariants['urn:demo:resto:b:invariant:paid' as never]).toMatchObject({ reportOn: 'deposit' });
    expect(messages('party_size')).toEqual([]);
    expect(messages('guest_notes', "guest_notes is absent or guest_notes != ''")).toEqual([]);
  });

  it('refuses a property that the rule does not name, one the entity does not have, and a short key', () => {
    expect(messages('seats')).toEqual([
      'invalid-report-on: urn:demo:resto:b:invariant:paid: reportOn "seats" is a property that the rule does not name; name one of the properties in the rule (party_size, deposit)',
    ]);
    expect(messages('nope')).toEqual([
      'invalid-report-on: urn:demo:resto:b:invariant:paid: reportOn "nope" is not a property of the entity; name one of the properties in the rule (party_size, deposit)',
    ]);
    expect(messages('b.field.deposit')).toEqual([
      'invalid-report-on: urn:demo:resto:b:invariant:paid: reportOn "b.field.deposit" is not a property of the entity; name one of the properties in the rule (party_size, deposit)',
    ]);
  });

  it('adds nothing to the IR of an invariant without reportOn, so no fingerprint changes', () => {
    const insurance = compile(readFileSync(new URL('../insurance/domain.manifest.yaml', import.meta.url), 'utf8')).ir!;
    for (const invariant of Object.values(insurance.invariants)) expect(invariant).not.toHaveProperty('reportOn');
  });
});

describe('the issue goes on reportOn (fixture: report-on)', async () => {
  const runtime = await import('./fixtures/report-on/expected/domain.runtime.generated.js');
  const { assertRejectedOn } = await import('../src/gherkin/steps.js');
  const BOOK = 'urn:demo:resto:booking:operation:book';
  const core = { [BOOK]: (request: never) => runtime.ok(request) } as never;

  it('puts the issue of a party of 7 with no deposit on deposit, with its field URN', () => {
    const result = runtime.executeOperation(BOOK, { party_size: 7 }, core);
    expect(result).toMatchObject({
      ok: false,
      kind: 'InputRejected',
      issues: [
        {
          path: 'deposit',
          fieldUrn: 'urn:demo:resto:booking:field:deposit',
          invariantUrn: 'urn:demo:resto:booking:invariant:large_party_has_deposit',
          message: 'A party of 7 or more must pay a deposit',
        },
      ],
    });
    // The scenario step follows the issue: rejected on "deposit", not on "party_size".
    const fields = runtime.DispatchMap[BOOK].input.fields;
    expect(() => assertRejectedOn(result as never, 'deposit', fields as never, BOOK)).not.toThrow();
    expect(() => assertRejectedOn(result as never, 'party_size', fields as never, BOOK)).toThrow('rejected the input, but not on "party_size"');
  });

  it('accepts a party of 7 with a deposit', () => {
    expect(runtime.executeOperation(BOOK, { party_size: 7, deposit: '50.00' }, core)).toMatchObject({ ok: true });
  });
});
