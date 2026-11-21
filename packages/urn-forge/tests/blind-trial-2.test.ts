/** Findings of the second blind trial (restaurant reservations). */
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { assertRecordedAs } from '../src/gherkin/steps.js';
import { indexFeatureSource } from '../src/verify/feature-index.js';
import { checkGherkin } from '../src/verify/gherkin.js';
import type { GateContext } from '../src/verify/types.js';

const HEADER = 'manifest:\n  namespace: demo\n  domain: resto\n  version: 1.0.0\n';
const BODY =
  'r.field.party: { primitive: integer, min: 1, max: 12 }\nr.field.deposit: { primitive: decimal, scale: 2 }\nr.field.seats: { primitive: integer }\n' +
  'r.entity.request:\n  description: d\n  fields:\n    - ref: r.field.party\n    - { ref: r.field.deposit, required: false }\n' +
  'r.invariant.small_or_paid:\n  description: d\n  on: r.entity.request\n  rule: party <= 6 or deposit is present\n  message: m\n' +
  'r.invariant.not_huge:\n  description: d\n  on: r.entity.request\n  rule: party <= 10 or (deposit is present and deposit > 100)\n  message: m\n' +
  'r.error.full:\n  description: d\n  category: conflict\n  retryable: true\n  message: m\n  fields:\n    - ref: r.field.seats\n' +
  'r.operation.book:\n  description: d\n  input: r.entity.request\n  output: r.entity.request\n  errors: [r.error.full]\n';
const ir = compile(`${HEADER}${BODY}`).ir!;
const gate3 = (feature: string) =>
  checkGherkin({ ir, features: { directory: 'features', features: [indexFeatureSource(feature, 'f.feature')!], problems: [] } } as unknown as GateContext).problems.filter(
    (p) => p.severity === 'error' && p.code !== 'uncovered-boundary',
  );
const TAG = '@urn:demo:resto:r:operation:book';

describe('gate 3 reads an outline as Cucumber runs it', () => {
  it('substitutes placeholders in the step text, for each Examples row', () => {
    const feature = `${TAG}\nFeature: x\n  Scenario Outline: y\n    When I run the operation with:\n      | party   | deposit   |\n      | <party> | <deposit> |\n    Then the input is rejected by "<invariant>"\n\n    Examples:\n      | party | deposit | invariant |\n      | 7     |         | urn:demo:resto:r:invariant:small_or_paid |\n      | 11    | 50.00   | urn:demo:resto:r:invariant:not_huge |\n\n  Scenario: z\n    When I run the operation with:\n      | party |\n      | 3     |\n    Then the operation fails with "urn:demo:resto:r:error:full"\n`;
    // Both invariants are broken by a row, the column fills only the step text, and nothing is reported.
    expect(gate3(feature).map((p) => `${p.code}: ${p.message}`)).toEqual([]);
  });

  it('reports a substituted URN that is not an invariant of the operation, once', () => {
    const feature = `${TAG}\nFeature: x\n  Scenario Outline: y\n    When I run the operation with:\n      | party   |\n      | <party> |\n    Then the input is rejected by "<invariant>"\n\n    Examples:\n      | party | invariant |\n      | 7     | urn:demo:resto:r:invariant:nope |\n      | 8     | urn:demo:resto:r:invariant:nope |\n`;
    expect(gate3(feature).filter((p) => p.code === 'undeclared-invariant').map((p) => p.message)).toEqual([
      expect.stringContaining('"urn:demo:resto:r:invariant:nope" is not an invariant of the input of urn:demo:resto:r:operation:book'),
    ]);
  });

  it('allows an Examples column that fills a placeholder in the step text, and still refuses one that fills nothing', () => {
    const rejectedOn = `${TAG}\nFeature: x\n  Scenario Outline: y\n    When I run the operation with:\n      | party   |\n      | <party> |\n    Then the input is rejected on "<field>"\n\n    Examples:\n      | party | field |\n      | 0     | party |\n`;
    expect(gate3(rejectedOn).filter((p) => p.code === 'unknown-header')).toEqual([]);
    const unused = rejectedOn.replace('| party | field |', '| party | other |').replace('"<field>"', '"party"');
    expect(gate3(unused).filter((p) => p.code === 'unknown-header').map((p) => p.message)).toEqual([expect.stringContaining('table header "other"')]);
  });
});

describe('diff: a new required list on a stored entity', () => {
  it('is compatible for the rows already stored when the list may be empty', async () => {
    const { diffManifests } = await import('../src/diff/index.js');
    const base =
      'r.field.id: { primitive: integer }\nr.field.tag: { primitive: enum, values: [a, b] }\n' +
      'r.entity.booking:\n  description: d\n  key: r.field.id\n  fields:\n    - ref: r.field.id\n';
    const added = base + '    - { ref: r.field.tag, as: tags, many: {} }\n';
    const plugins = { tables: ['r.entity.booking'] };
    const result = diffManifests(`${HEADER}${base}`, `${HEADER}${added}`, plugins as never);
    expect(result).toMatchObject({ ok: true, breaking: [], changes: [{ class: 'compatible', message: 'adds the required list "tags", which rows already stored hold as an empty list' }] });
    // With minItems 1 an old row has too few items, so the change still breaks stored rows.
    const atLeastOne = diffManifests(`${HEADER}${base}`, `${HEADER}${added.replace('many: {}', 'many: { minItems: 1 }')}`, plugins as never);
    expect(JSON.stringify(atLeastOne)).toContain('breaks rows already stored');
    // An entity that callers send: they must now send the list, which breaks them.
    const sent = `r.operation.save:\n  description: d\n  input: r.entity.booking\n  output: r.entity.booking\n`;
    const sentResult = diffManifests(`${HEADER}${base}${sent}`, `${HEADER}${added}${sent}`, plugins as never);
    expect(JSON.stringify(sentResult)).toContain('breaks callers that send it');
    expect(JSON.stringify(sentResult)).not.toContain('rows already stored');
  });
});

describe('the record of a refusal (recordAs)', () => {
  const RECORD = 'urn:demo:resto:r:event:refused';
  const refused = { ok: false as const, kind: 'DomainError' as const, error: { urn: 'urn:demo:resto:r:error:full', message: 'm', fields: {}, record: { urn: RECORD, fields: { kind: RECORD, seats: 4 } } } };

  it('passes when the refusal is recorded as the event, with its fields', () => {
    expect(() => assertRecordedAs(refused, RECORD, 'op', { seats: 4 })).not.toThrow();
  });

  it('fails on a success, on another record, on no record, and on other fields', () => {
    expect(() => assertRecordedAs({ ok: true, output: {} }, RECORD, 'op')).toThrow('op succeeded; expected a refusal recorded as urn:demo:resto:r:event:refused');
    expect(() => assertRecordedAs(refused, 'urn:demo:resto:r:event:other', 'op')).toThrow('which is recorded as urn:demo:resto:r:event:refused; expected it to be recorded as urn:demo:resto:r:event:other');
    const { record: _, ...bare } = refused.error;
    expect(() => assertRecordedAs({ ...refused, error: bare }, RECORD, 'op')).toThrow('which has no record');
    expect(() => assertRecordedAs(refused, RECORD, 'op', { seats: 5 })).toThrow('urn:demo:resto:r:event:refused fields differ: seats: expected 5, got 4');
  });
});
