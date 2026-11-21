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
