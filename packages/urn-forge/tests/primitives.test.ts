/**
 * The primitive registry (foundations plan, phase 2): the meta-schema, the coherence pass,
 * the Valibot translations and the step library all read each primitive from one place.
 */
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import * as shop from './fixtures/shop/expected/domain.schemas.generated.js';
import { compile } from '../src/engine.js';
import { coerceCell } from '../src/gherkin/steps.js';
import { validateManifest } from '../src/meta-schema.js';
import { PRIMITIVES, PRIMITIVE_NAMES, constraintKeys, type Primitive } from '../src/primitives/index.js';
import type { ValibotTranslation, ValibotTranslations } from '../src/plugins/valibot.plugin.js';

const header = { namespace: 'demo', domain: 'math', version: '0.1.0' };
const HEADER = 'manifest:\n  namespace: demo\n  domain: math\n  version: 0.1.0\n';

describe('primitive registry', () => {
  it('lists the primitives and their constraints in a fixed order', () => {
    expect(PRIMITIVE_NAMES).toEqual(['boolean', 'float', 'integer', 'string']);
    expect(Object.fromEntries(PRIMITIVE_NAMES.map((p) => [p, constraintKeys(p)]))).toEqual({
      boolean: ['mustBe'],
      float: ['min', 'max', 'notEqual'],
      integer: ['min', 'max', 'notEqual'],
      string: ['minLength', 'maxLength', 'regex', 'oneOf'],
    });
  });

  it('drives the meta-schema: each primitive accepts its own constraints and no others', () => {
    const sample: Record<string, unknown> = { mustBe: true, min: 1, max: 1, notEqual: 1, minLength: 1, maxLength: 1, regex: 'a', oneOf: ['a'] };
    for (const primitive of PRIMITIVE_NAMES) {
      for (const other of PRIMITIVE_NAMES) {
        for (const key of constraintKeys(other)) {
          const result = validateManifest({ manifest: header, 'a.field.b': { primitive, [key]: sample[key] } });
          expect(result.success, `${key} on ${primitive}`).toBe(constraintKeys(primitive).includes(key));
        }
      }
    }
  });

  it('drives cell parsing in the step library', () => {
    const field = (primitive: Primitive) => ({ urn: 'urn:demo:math:a:field:b', primitive, required: true });
    expect(coerceCell('10', field('float'))).toBe(10);
    expect(coerceCell('10', field('integer'))).toBe(10);
    expect(coerceCell('10', field('string'))).toBe('10');
    expect([coerceCell('true', field('boolean')), coerceCell('false', field('boolean')), coerceCell('yes', field('boolean'))]).toEqual([
      true,
      false,
      'yes',
    ]);
    expect(PRIMITIVES.float.parseCell('abc')).toBe('abc');
  });
});

describe('constraint coherence (pass 7)', () => {
  const diagnose = (body: string) => compile(`${HEADER}${body}`).diagnostics;

  it('rejects min above max, pointing at max', () => {
    for (const primitive of ['float', 'integer']) {
      expect(diagnose(`a.field.b:\n  primitive: ${primitive}\n  min: 5\n  max: 1\n`)).toEqual([
        {
          code: 'incoherent-constraints',
          severity: 'error',
          urn: 'urn:demo:math:a:field:b',
          message: 'urn:demo:math:a:field:b: min (5) is greater than max (1), so no value is valid',
          location: { line: 8, column: 8 },
        },
      ]);
    }
  });

  it('rejects a range of one value that notEqual excludes', () => {
    expect(diagnose('a.field.b: { primitive: integer, min: 3, max: 3, notEqual: 3 }\n')).toEqual([
      expect.objectContaining({
        code: 'incoherent-constraints',
        message: 'urn:demo:math:a:field:b: min and max are both 3 and notEqual is 3, so no value is valid',
      }),
    ]);
  });

  it('rejects minLength above maxLength', () => {
    expect(diagnose('a.field.b: { primitive: string, minLength: 5, maxLength: 2 }\n')).toEqual([
      expect.objectContaining({ code: 'incoherent-constraints', message: expect.stringContaining('minLength (5) is greater than maxLength (2)') }),
    ]);
  });

  it('accepts ranges that admit a value', () => {
    expect(diagnose('a.field.b: { primitive: integer, min: 3, max: 3 }\n')).toEqual([]);
    expect(diagnose('a.field.b: { primitive: integer, min: 3, max: 4, notEqual: 3 }\n')).toEqual([]);
    expect(diagnose('a.field.b: { primitive: string, minLength: 2, maxLength: 2 }\n')).toEqual([]);
  });
});

describe('ValibotTranslations (type level, checked by tsc)', () => {
  it('requires every primitive and every constraint', () => {
    const numeric: ValibotTranslation<'float'> = {
      base: [],
      // @ts-expect-error notEqual is missing
      constraints: { min: String, max: String },
    };
    const wrongValue: ValibotTranslation<'string'> = {
      base: [],
      // @ts-expect-error minLength takes a number, not a string
      constraints: { minLength: (s: string) => s.trim(), maxLength: String },
    };
    // @ts-expect-error the string primitive is missing
    const partial: ValibotTranslations = {
      float: { base: [], constraints: { min: String, max: String, notEqual: String } },
      integer: { base: [], constraints: { min: String, max: String, notEqual: String } },
    };
    expect([numeric, wrongValue, partial]).toBeDefined();
  });
});

describe('boolean (the first primitive added through the registry)', () => {
  const line = { sku: 'ABC-1234', quantity: 2, unit_cost: 1.5, terms_accepted: true };

  it('parses true and false, and keeps an optional flag optional', () => {
    expect(v.safeParse(shop.OrderLineSchema, line).success).toBe(true);
    expect(v.safeParse(shop.OrderLineSchema, { ...line, gift_wrap: false }).success).toBe(true);
    expect(v.safeParse(shop.OrderGiftWrapSchema, 'true').success).toBe(false);
  });

  it('enforces mustBe, reporting the field', () => {
    const result = v.safeParse(shop.OrderLineSchema, { ...line, terms_accepted: false });
    expect(result.success).toBe(false);
    expect(result.issues?.map((i) => [v.getDotPath(i), i.message])).toEqual([
      ['terms_accepted', 'Invalid value: Expected true but received false'],
    ]);
  });

  it('turns a non-boolean cell into a value the schema rejects', () => {
    const field = { urn: 'urn:demo:shop:order:field:gift_wrap', primitive: 'boolean' as const, required: false };
    expect(v.safeParse(shop.OrderGiftWrapSchema, coerceCell('yes', field)).success).toBe(false);
  });
});

describe('oneOf (the first constraint that is not a number)', () => {
  const line = { sku: 'ABC-1234', quantity: 2, unit_cost: 1.5, terms_accepted: true };

  it('accepts only the listed values, reporting the field', () => {
    expect(v.safeParse(shop.OrderLineSchema, { ...line, delivery: 'click & collect' }).success).toBe(true);
    const result = v.safeParse(shop.OrderLineSchema, { ...line, delivery: 'drone' });
    expect(result.issues?.map((i) => v.getDotPath(i))).toEqual(['delivery']);
  });

  it('narrows the parsed type to the listed values (checked by tsc)', () => {
    const parsed = v.parse(shop.OrderDeliverySchema, 'express');
    // Compiles only because the type is the union: a plain `string` is not assignable to it.
    const narrowed: 'standard' | 'express' | 'click & collect' = parsed;
    expect(narrowed).toBe('express');
  });

  it('keeps the list as a JSON value in the IR', () => {
    const ir = compile(readFileSync(new URL('./fixtures/shop/domain.manifest.yaml', import.meta.url), 'utf8')).ir!;
    expect(ir.fields['urn:demo:shop:order:field:delivery' as never]?.constraints).toEqual({
      oneOf: ['standard', 'express', 'click & collect'],
    });
  });
});

describe('regex', () => {
  const line = { sku: 'ABC-1234', quantity: 2, unit_cost: 1.5, terms_accepted: true };

  it('matches the whole value, reporting the field', () => {
    expect(v.safeParse(shop.OrderSkuSchema, 'ABC-1234').success).toBe(true);
    for (const partial of ['abc-1234', 'xABC-1234', 'ABC-12345']) expect(v.safeParse(shop.OrderSkuSchema, partial).success, partial).toBe(false);
    expect(v.safeParse(shop.OrderLineSchema, { ...line, sku: 'nope' }).issues?.map((i) => v.getDotPath(i))).toEqual(['sku']);
  });

  it('keeps a slash, a dot and a backslash in the pattern', () => {
    expect(v.safeParse(shop.OrderTrackingUrlSchema, 'https://track.example/42').success).toBe(true);
    expect(v.safeParse(shop.OrderTrackingUrlSchema, 'https://trackXexample/42').success).toBe(false);
  });
});
