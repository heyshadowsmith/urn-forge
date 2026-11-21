/** The event kind (events plan): the manifest, the IR, and recordAs. */
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';

const HEADER = 'manifest:\n  namespace: demo\n  domain: shop\n  version: 1.0.0\n';
const run = (body: string) => compile(`${HEADER}${body}`);
const report = (body: string) => run(body).diagnostics.map((d) => `${d.code}: ${d.message}`);
const SHOP =
  'order.field.order_id: { primitive: integer }\norder.field.total: { primitive: decimal, scale: 2 }\norder.field.note: { primitive: string }\n' +
  'order.entity.order:\n  description: d\n  fields:\n    - ref: order.field.order_id\n    - ref: order.field.total\n' +
  'order.event.placed:\n  description: An order was placed\n  fields:\n    - ref: order.field.order_id\n    - ref: order.field.total\n' +
  'order.event.refused:\n  description: An order was refused\n  fields:\n    - ref: order.field.order_id\n    - { ref: order.field.note, required: false }\n' +
  'order.error.closed:\n  description: d\n  category: precondition\n  retryable: true\n  message: m\n  fields:\n    - ref: order.field.order_id\n  recordAs: order.event.refused\n' +
  'order.operation.place:\n  description: d\n  input: order.entity.order\n  output: order.entity.order\n  errors: [order.error.closed]\n  emits: [order.event.placed]\n';

describe('the event kind', () => {
  it('builds an event, emits on the operation, and recordAs on the error', () => {
    const ir = run(SHOP).ir!;
    expect(ir.events['urn:demo:shop:order:event:placed' as never]).toEqual({
      urn: 'urn:demo:shop:order:event:placed',
      brandIdentifier: 'OrderPlaced',
      description: 'An order was placed',
      fields: [
        { field: 'urn:demo:shop:order:field:order_id', name: 'order_id', required: true },
        { field: 'urn:demo:shop:order:field:total', name: 'total', required: true },
      ],
    });
    expect(ir.operations['urn:demo:shop:order:operation:place' as never]?.emits).toEqual(['urn:demo:shop:order:event:placed']);
    expect(ir.errors['urn:demo:shop:order:error:closed' as never]?.recordAs).toBe('urn:demo:shop:order:event:refused');
  });

  it('gives every operation an emits list, empty when it has none', () => {
    const ir = run(SHOP.replace('  emits: [order.event.placed]\n', '')).ir!;
    expect(ir.operations['urn:demo:shop:order:operation:place' as never]?.emits).toEqual([]);
  });

  it('refuses an emits that names another kind, and an event field named kind', () => {
    expect(report(SHOP.replace('emits: [order.event.placed]', 'emits: [order.entity.order]'))).toEqual([
      'wrong-ref-kind: urn:demo:shop:order:operation:place: emits[0] "order.entity.order" must name an event, but urn:demo:shop:order:entity:order is an entity',
    ]);
    expect(report(`${SHOP}order.event.typed:\n  description: d\n  fields:\n    - { ref: order.field.note, as: kind }\n`)).toEqual([
      'reserved-property: urn:demo:shop:order:event:typed: fields[0] becomes property "kind", which an event reserves for its URN; choose another name with as',
    ]);
  });

  it('refuses a recordAs event that the error\'s fields cannot build', () => {
    expect(report(SHOP.replace('    - { ref: order.field.note, required: false }\n', '    - ref: order.field.note\n'))).toEqual([
      'invalid-record-as: urn:demo:shop:order:error:closed: recordAs urn:demo:shop:order:event:refused has the required property "note", which the error does not have; make it optional, so the error\'s fields can build the event',
    ]);
    expect(report(SHOP.replace('recordAs: order.event.refused', 'recordAs: order.event.placed'))).toEqual([
      'invalid-record-as: urn:demo:shop:order:error:closed: recordAs urn:demo:shop:order:event:placed has the required property "total", which the error does not have; make it optional, so the error\'s fields can build the event',
    ]);
  });
});

describe('events in the runtime (insurance)', async () => {
  const { core } = await import('../insurance/core.js');
  const { emit, executeOperation, ok } = await import('../insurance/generated/domain.runtime.generated.js');
  type Core = import('../insurance/generated/domain.runtime.generated.js').DomainCoreImplementation;
  const ISSUE = 'urn:acme:insurance:policy:operation:issue_policy';
  const CANCEL = 'urn:acme:insurance:policy:operation:cancel_policy';
  const ISSUED = 'urn:acme:insurance:policy:event:policy_issued';
  const CANCELLED = 'urn:acme:insurance:policy:event:policy_cancelled';
  const POLICY = {
    policy_id: '123e4567-e89b-12d3-a456-426614174000',
    holder: '9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d',
    coverages: [{ peril: 'fire', limit: '1000.00' }],
    effective_date: '2026-01-01',
    expiry_date: '2026-12-31',
    premium: '120.00',
  };

  it('returns the events of the operation, parsed, after its output', () => {
    const result = executeOperation(ISSUE, POLICY, core);
    expect(result.ok && result.events).toEqual([
      { urn: ISSUED, fields: { kind: ISSUED, policy_id: POLICY.policy_id, holder: POLICY.holder, premium: '120.00' } },
    ]);
    const cancelled = executeOperation(CANCEL, { effective_date: '2026-01-01', expiry_date: '2026-12-31', premium: '365.00', cancellation_date: '2026-07-02' }, core);
    expect(cancelled.ok && cancelled.events).toEqual([{ urn: CANCELLED, fields: { kind: CANCELLED, cancellation_date: '2026-07-02', refund: '182.00' } }]);
  });

  it('returns the recordAs event of a declared error, built from its fields', () => {
    const result = executeOperation(CANCEL, { effective_date: '2026-01-01', expiry_date: '2026-12-31', premium: '365.00', cancellation_date: '2026-12-31' }, core);
    expect(result).toMatchObject({
      kind: 'DomainError',
      error: {
        urn: 'urn:acme:insurance:policy:error:refund_below_minimum',
        record: { urn: 'urn:acme:insurance:policy:event:refund_refused', fields: { kind: 'urn:acme:insurance:policy:event:refund_refused', refund: '0.00' } },
      },
    });
  });

  it('calls an event that the operation does not emit, or one that does not parse, a ContractViolation', () => {
    const undeclared = { ...core, [CANCEL]: () => ok({ refund: '1.00' }, [emit(ISSUED, { policy_id: POLICY.policy_id, holder: POLICY.holder, premium: '1.00' })]) };
    expect(executeOperation(CANCEL, { effective_date: '2026-01-01', expiry_date: '2026-12-31', premium: '365.00', cancellation_date: '2026-07-02' }, undeclared as unknown as Core)).toMatchObject({
      kind: 'ContractViolation',
      issues: [{ message: `${CANCEL} emitted ${ISSUED}, which it does not emit` }],
    });
    const malformed = { ...core, [ISSUE]: () => ok(POLICY, [emit(ISSUED, { policy_id: POLICY.policy_id, holder: POLICY.holder, premium: '1.005' })]) };
    expect(executeOperation(ISSUE, POLICY, malformed as unknown as Core)).toMatchObject({
      kind: 'ContractViolation',
      issues: [{ path: 'premium', fieldUrn: 'urn:acme:insurance:policy:field:premium' }],
    });
  });

  it('types the events of a handler by its operation\'s emits (checked by tsc)', () => {
    const handlers = {
      ...core,
      // @ts-expect-error cancel_policy does not emit policy_issued
      [CANCEL]: () => ok({ refund: '1.00' }, [emit(ISSUED, { policy_id: POLICY.policy_id, holder: POLICY.holder, premium: '1.00' })]),
    } satisfies Core;
    // @ts-expect-error policy_issued needs premium
    const partial = emit(ISSUED, { policy_id: POLICY.policy_id, holder: POLICY.holder });
    expect([handlers, partial]).toBeDefined();
  });
});

describe('found while the docs were written', () => {
  it('checks the links of an event in pass 5, as an entity\'s', () => {
    const body = SHOP.replace('order.event.placed:\n  description: An order was placed\n  fields:\n', 'order.event.placed:\n  description: An order was placed\n  fields:\n    - link: order.entity.order\n');
    expect(report(body)).toEqual([
      'missing-key: urn:demo:shop:order:event:placed: fields[0].link urn:demo:shop:order:entity:order has no key, so a link to it holds nothing; set key on it',
    ]);
  });
});

describe('found in the blind trial', () => {
  it('allows an Examples column that only an error or event table uses', async () => {
    const { checkGherkin } = await import('../src/verify/gherkin.js');
    const { indexFeatureSource } = await import('../src/verify/feature-index.js');
    const body =
      'order.field.order_id: { primitive: integer }\norder.field.limit: { primitive: integer }\norder.field.reason: { primitive: string }\n' +
      'order.entity.order:\n  description: d\n  fields:\n    - ref: order.field.order_id\n' +
      'order.event.placed:\n  description: d\n  fields:\n    - ref: order.field.reason\n' +
      'order.error.too_many:\n  description: d\n  category: precondition\n  retryable: false\n  message: m\n  fields:\n    - ref: order.field.limit\n' +
      'order.operation.place:\n  description: d\n  input: order.entity.order\n  output: order.entity.order\n  errors: [order.error.too_many]\n  emits: [order.event.placed]\n';
    const ir = run(body).ir!;
    const outline = (then: string, column: string) =>
      checkGherkin({
        ir,
        features: {
          directory: 'features',
          features: [
            indexFeatureSource(
              `@urn:demo:shop:order:operation:place\nFeature: x\n  Scenario Outline: y\n    When I run the operation with:\n      | order_id |\n      | 1 |\n    ${then}\n      | ${column} |\n      | <${column}> |\n    Examples:\n      | ${column} |\n      | 3 |\n`,
              'f.feature',
            )!,
          ],
          problems: [],
        },
      } as never).problems.filter((p) => p.code === 'unknown-header');
    expect(outline('Then the operation fails with "urn:demo:shop:order:error:too_many":', 'limit')).toEqual([]);
    expect(outline('Then the operation emits "urn:demo:shop:order:event:placed":', 'reason')).toEqual([]);
    // An error field that no step of the outline expects is still unknown.
    const stray = checkGherkin({
      ir,
      features: {
        directory: 'features',
        features: [indexFeatureSource('@urn:demo:shop:order:operation:place\nFeature: x\n  Scenario Outline: y\n    When I run the operation with:\n      | order_id |\n      | <limit> |\n    Examples:\n      | limit |\n      | 3 |\n', 'f.feature')!],
        problems: [],
      },
    } as never).problems.filter((p) => p.code === 'unknown-header');
    expect(stray.map((p) => p.message)).toEqual([expect.stringContaining('table header "limit" is not a field key of the input or output')]);
  });

  it('names the column of a link in a boundary gap', async () => {
    const { checkGherkin } = await import('../src/verify/gherkin.js');
    const { indexFeatureSource } = await import('../src/verify/feature-index.js');
    const body =
      'lib.field.member_id: { primitive: string, minLength: 3 }\nlib.field.days: { primitive: integer }\n' +
      'lib.entity.member:\n  description: d\n  key: lib.field.member_id\n  fields:\n    - ref: lib.field.member_id\n' +
      'lib.entity.loan:\n  description: d\n  fields:\n    - link: lib.entity.member\n      as: borrower\n    - ref: lib.field.days\n' +
      'lib.operation.lend:\n  description: d\n  input: lib.entity.loan\n  output: lib.entity.loan\n';
    const ir = run(body).ir!;
    const gaps = checkGherkin({
      ir,
      features: {
        directory: 'features',
        features: [indexFeatureSource('@urn:demo:shop:lib:operation:lend\nFeature: x\n  Scenario: y\n    When I run the operation with:\n      | borrower | days |\n      | abc | 1 |\n', 'f.feature')!],
        problems: [],
      },
    } as never).problems.filter((p) => p.code === 'uncovered-boundary');
    expect(gaps.map((p) => p.message)).toEqual([expect.stringMatching(/^urn:demo:shop:lib:field:member_id at borrower in the input of /)]);
  });
});
