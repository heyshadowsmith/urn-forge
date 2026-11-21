/**
 * Lists on a field reference (primitives plan, step 10): the manifest form, pass 7, the
 * generated schema, table cells, comparisons and boundary cases.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import * as kinds from './fixtures/primitives/expected/domain.schemas.generated.js';
import { compile } from '../src/engine.js';
import { assertOutput, coerceCell } from '../src/gherkin/steps.js';
import { listBoundaries } from '../src/kinds/field-refs.js';

const HEADER = 'manifest:\n  namespace: demo\n  domain: math\n  version: 0.1.0\n';
const messages = (body: string) => compile(`${HEADER}${body}`).diagnostics.map((d) => [d.code, d.message]);

describe('lists', () => {
  it('keep their rule in the IR; many: true is a list of any length', () => {
    const ir = compile(`${HEADER}a.field.x: { primitive: integer }\na.entity.e:\n  description: d\n  fields:\n    - { ref: a.field.x, many: true }\n`).ir!;
    expect(ir.entities['urn:demo:math:a:entity:e' as never]?.fields).toEqual([{ field: 'urn:demo:math:a:field:x', name: 'x', required: true, many: {} }]);
  });

  it('refuse an item count that no list can have, and a bad rule', () => {
    expect(messages('a.field.x: { primitive: integer }\na.entity.e:\n  description: d\n  fields:\n    - { ref: a.field.x, many: { minItems: 3, maxItems: 2 } }\n')).toEqual([
      ['incoherent-constraints', 'urn:demo:math:a:entity:e: fields[0] minItems (3) is greater than maxItems (2), so no list is valid'],
    ]);
    expect(messages('a.field.x: { primitive: integer }\na.entity.e:\n  description: d\n  fields:\n    - { ref: a.field.x, many: false }\n')[0]?.[1]).toContain('must be true or { minItems, maxItems, unique }');
  });

  it('cannot fill an error message placeholder', () => {
    const body = 'a.field.x: { primitive: integer }\na.error.e:\n  description: d\n  category: validation\n  retryable: false\n  message: bad {x}\n  fields:\n    - { ref: a.field.x, many: true }\n';
    expect(messages(body)).toEqual([['unknown-placeholder', 'urn:demo:math:a:error:e: message placeholder {x} names a list; placeholders must name single values (required fields: x)']]);
  });

  it('generate an array of the field schema, with its count and uniqueness', () => {
    const ok = { sku: ['ABC-1234'], size: ['s', 'm'] };
    expect(v.is(kinds.ValueListsSchema, ok)).toBe(true);
    expect(v.is(kinds.ValueListsSchema, { ...ok, sku: [] })).toBe(true);
    for (const bad of [{ ...ok, size: [] }, { ...ok, size: ['s', 'm', 'l', 's'] }, { ...ok, size: ['s', 's'] }, { ...ok, sku: ['nope'] }, { ...ok, price: ['1', '2', '3'] }]) {
      expect(v.is(kinds.ValueListsSchema, bad), JSON.stringify(bad)).toBe(false);
    }
    const issue = v.safeParse(kinds.ValueListsSchema, { ...ok, sku: ['ABC-1234', 'nope'] }).issues?.[0];
    expect(issue && v.getDotPath(issue)).toBe('sku.1');
  });

  it('read a table cell as [a, b, c], each item by the primitive, and [] as empty', () => {
    const list = (primitive: 'integer' | 'string') => ({ urn: 'urn:demo:math:a:field:x', primitive, required: true, many: true });
    expect(coerceCell('[1, 2, 3]', list('integer'))).toEqual([1, 2, 3]);
    expect(coerceCell('[]', list('integer'))).toEqual([]);
    expect(coerceCell('[ a , "" ]', list('string'))).toEqual(['a', '']);
    expect(coerceCell('1, 2', list('integer'))).toBe('1, 2');
  });

  it('compare item by item in Then the output is:', () => {
    const result = { ok: true as const, output: { x: [1, 2] } };
    expect(() => assertOutput(result, { x: [1, 2] }, 'urn:op')).not.toThrow();
    expect(() => assertOutput(result, { x: [2, 1] }, 'urn:op')).toThrow('x: expected [2, 1], got [1, 2]');
  });

  it('need the counts at and beyond each bound, and a repeated value', () => {
    const cases = listBoundaries({ minItems: 1, maxItems: 3, unique: true });
    const samples: unknown[] = [[], ['a'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd'], ['a', 'a'], 'a'];
    expect(cases.map((c) => [c.label, samples.filter((s) => c.covers(s))])).toEqual([
      ['list of 1 item(s) (minItems)', [['a']]],
      ['list of 0 item(s) (below minItems)', [[]]],
      ['list of 3 item(s) (maxItems)', [['a', 'b', 'c']]],
      ['list of 4 item(s) (above maxItems)', [['a', 'b', 'c', 'd']]],
      ['list with a repeated value (unique)', [['a', 'a']]],
    ]);
    expect(listBoundaries({})).toEqual([]);
  });
});
