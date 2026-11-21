/** Structure (structure plan): the reference forms in the IR, and the cell reader. */
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { CellSyntaxError, readCell, type PropertyShape } from '../src/gherkin/cells.js';

const HEADER = 'manifest:\n  namespace: demo\n  domain: shop\n  version: 0.1.0\n';
const SHOP =
  'customer.field.customer_id: { primitive: string }\n' +
  'customer.entity.customer:\n  description: d\n  key: customer.field.customer_id\n  fields:\n    - ref: customer.field.customer_id\n' +
  'order.field.sku: { primitive: string }\norder.field.quantity: { primitive: integer, min: 1 }\n' +
  'order.entity.line:\n  description: d\n  key: order.field.sku\n  fields:\n    - ref: order.field.sku\n    - ref: order.field.quantity\n' +
  'order.entity.order:\n  description: d\n  fields:\n' +
  '    - { link: customer.entity.customer, as: payer }\n' +
  '    - { link: customer.entity.customer, as: receiver, required: false }\n' +
  '    - { ref: order.entity.line, as: lines, many: { minItems: 1, unique: true } }\n';

describe('the reference forms', () => {
  it('build a field value, a link and an embedded entity, each named by as', () => {
    const ir = compile(`${HEADER}${SHOP}`).ir!;
    expect(ir.entities['urn:demo:shop:order:entity:order' as never]?.fields).toEqual([
      { link: 'urn:demo:shop:customer:entity:customer', name: 'payer', required: true },
      { link: 'urn:demo:shop:customer:entity:customer', name: 'receiver', required: false },
      { entity: 'urn:demo:shop:order:entity:line', name: 'lines', required: true, many: { minItems: 1, unique: true } },
    ]);
    expect(ir.entities['urn:demo:shop:order:entity:line' as never]?.key).toBe('urn:demo:shop:order:field:sku');
  });

  it('emit an embedded schema before the entity that embeds it, and a link as the key field', () => {
    const schemas = compile(`${HEADER}${SHOP}`).files.find((f) => f.relativePath.endsWith('schemas.generated.ts'))!.content;
    expect(schemas.indexOf('export const OrderLineSchema')).toBeLessThan(schemas.indexOf('export const OrderOrderSchema'));
    expect(schemas).toContain('  payer: CustomerCustomerIdSchema,');
    expect(schemas).toContain('  receiver: v.optional(CustomerCustomerIdSchema),');
    expect(schemas).toContain("new Set(list.map((item) => item.sku)).size === list.length, 'Invalid items: Expected no sku more than once'");
  });

  it('refuse a field reference with both ref and link, or with neither', () => {
    const messages = (refs: string) =>
      compile(`${HEADER}a.field.x: { primitive: float }\na.entity.e:\n  description: d\n  fields:\n${refs}`).diagnostics.map((d) => d.message);
    expect(messages('    - { ref: a.field.x, link: a.entity.e }\n')).toEqual(['a.entity.e.fields.0: must have either ref or link']);
    expect(messages('    - { as: x }\n')).toEqual(['a.entity.e.fields.0: must have either ref or link']);
  });

  it('reserve the property name kind in an error, whether it comes from as or from the identifier', () => {
    const codes = (refs: string) =>
      compile(
        `${HEADER}a.field.kind: { primitive: string }\na.field.sku: { primitive: string }\n` +
          `a.error.e:\n  description: d\n  category: precondition\n  retryable: false\n  message: m\n  fields:\n${refs}`,
      ).diagnostics.map((d) => d.code);
    expect(codes('    - { ref: a.field.sku, as: kind }\n')).toEqual(['reserved-property']);
    expect(codes('    - { ref: a.field.kind }\n')).toEqual(['reserved-property']);
    expect(codes('    - { ref: a.field.kind, as: item_kind }\n')).toEqual([]);
  });
});

describe('the cell reader', () => {
  const sku: PropertyShape = { primitive: 'string', many: true };
  const line: PropertyShape = {
    entity: 'urn:demo:shop:order:entity:line',
    many: true,
    fields: { sku: { primitive: 'string' }, quantity: { primitive: 'integer' }, note: { primitive: 'string' } },
  };

  it('reads bare values by their primitive, and quoted values with commas, braces and quotes', () => {
    expect(readCell('[a, b]', sku)).toEqual(['a', 'b']);
    expect(readCell('["Smith, Ada", "x{y} [z]", "a \\"quoted\\" word", ""]', sku)).toEqual(['Smith, Ada', 'x{y} [z]', 'a "quoted" word', '']);
    expect(readCell('[]', sku)).toEqual([]);
    expect(readCell('[{ sku: A-1, quantity: 2 }, { sku: B-2, quantity: "3", note: "Leave it, please" }]', line)).toEqual([
      { sku: 'A-1', quantity: 2 },
      { sku: 'B-2', quantity: 3, note: 'Leave it, please' },
    ]);
  });

  it('keeps a plain cell as text when it does not open a list or an object', () => {
    expect(readCell('a, b', sku)).toBe('a, b');
    expect(readCell('{ sku: A }', sku)).toBe('{ sku: A }');
  });

  it('gives the column of a malformed cell, and names an unknown property', () => {
    const problem = (cell: string, shape: PropertyShape) => {
      try {
        readCell(cell, shape);
        return undefined;
      } catch (error) {
        return error instanceof CellSyntaxError ? error.message : String(error);
      }
    };
    expect(problem('[a, b', sku)).toBe('expected "," or "]" (at column 6 of the cell)');
    expect(problem('["Smith, Ada]', sku)).toBe('a quoted value has no closing quote (at column 2 of the cell)');
    expect(problem('[{ sku: A, sku: B }]', line)).toBe('property "sku" occurs more than once (at column 2 of the cell)');
    expect(problem('[{ skew: A }]', line)).toBe(
      '"skew" is not a property of urn:demo:shop:order:entity:line (properties: sku, quantity, note) (at column 4 of the cell)',
    );
  });
});
