/** reportOn (reportOn plan): the property that the issue of an invariant goes on. */
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
