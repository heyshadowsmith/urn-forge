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
