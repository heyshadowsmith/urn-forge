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
import { PRIMITIVES, PRIMITIVE_NAMES, boundaryCases, constraintKeys, type Primitive } from '../src/primitives/index.js';
import type { ValibotTranslation, ValibotTranslations } from '../src/plugins/valibot.plugin.js';

const header = { namespace: 'demo', domain: 'math', version: '0.1.0' };
const HEADER = 'manifest:\n  namespace: demo\n  domain: math\n  version: 0.1.0\n';

describe('primitive registry', () => {
  it('lists the primitives and their constraints in a fixed order', () => {
    expect(PRIMITIVE_NAMES).toEqual(['boolean', 'enum', 'float', 'integer', 'string']);
    expect(Object.fromEntries(PRIMITIVE_NAMES.map((p) => [p, constraintKeys(p)]))).toEqual({
      boolean: ['mustBe'],
      enum: ['values'],
      float: ['min', 'max', 'notEqual'],
      integer: ['min', 'max', 'notEqual'],
      string: ['minLength', 'maxLength', 'regex'],
    });
  });

  it('drives the meta-schema: each primitive accepts its own constraints and no others', () => {
    const sample: Record<string, unknown> = { mustBe: true, values: ['a'], min: 1, max: 1, notEqual: 1, minLength: 1, maxLength: 1, regex: 'a' };
    for (const primitive of PRIMITIVE_NAMES) {
      // An enum must list its values, so each try starts from a valid enum.
      const base = primitive === 'enum' ? { values: ['a'] } : {};
      for (const other of PRIMITIVE_NAMES) {
        for (const key of constraintKeys(other)) {
          const result = validateManifest({ manifest: header, 'a.field.b': { primitive, ...base, [key]: sample[key] } });
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

describe('enum (a closed set of names)', () => {
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
      values: ['standard', 'express', 'click & collect'],
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

describe('boundary cases (boundary coverage plan, step 1)', () => {
  /** Each case's label, with the sample values that cover it. */
  const covered = (primitive: Primitive, constraints: Record<string, unknown>, samples: readonly unknown[]) =>
    boundaryCases(primitive, constraints as never).map((c) => [c.label, samples.filter((s) => c.covers(s))]);

  it('integer: the value at each bound and one step beyond, and the excluded value', () => {
    expect(covered('integer', { min: 1, max: 99, notEqual: 13 }, [0, 1, 2, 99, 100, 13, '0'])).toEqual([
      ['value at min 1', [1]],
      ['value at min − 1 (0)', [0]],
      ['value at max 99', [99]],
      ['value at max + 1 (100)', [100]],
      ['value equal to notEqual 13', [13]],
    ]);
  });

  it('float: the value at each bound and any value beyond it; -0 counts as 0', () => {
    expect(covered('float', { min: 0, max: 1.5 }, [0, -0, -0.001, -Infinity, 1.5, 7, 'abc'])).toEqual([
      ['value at min 0', [0, -0]],
      ['value below min 0', [-0.001, -Infinity]],
      ['value at max 1.5', [1.5]],
      ['value above max 1.5', [7]],
    ]);
  });

  it('string: lengths at and beyond each bound, and regex matches and misses', () => {
    expect(covered('string', { minLength: 1, maxLength: 3 }, ['', 'a', 'abc', 'abcd', 5])).toEqual([
      ['value of length 1 (minLength)', ['a']],
      ['value of length 0 (below minLength)', ['']],
      ['value of length 3 (maxLength)', ['abc']],
      ['value of length 4 (above maxLength)', ['abcd']],
    ]);
    expect(covered('string', { minLength: 0 }, [''])).toEqual([['value of length 0 (minLength)', ['']]]);
    expect(covered('string', { regex: '[a-z]+' }, ['abc', 'Abc', 'abc1', 7])).toEqual([
      ['valid value for regex [a-z]+', ['abc']],
      ['invalid value for regex [a-z]+', ['Abc', 'abc1']],
    ]);
  });

  it('enum: every listed value, and one value outside the list', () => {
    expect(covered('enum', { values: ['s', 'm'] }, ['s', 'm', 'xl', 3])).toEqual([
      ['value "s" (values)', ['s']],
      ['value "m" (values)', ['m']],
      ['value outside values', ['xl']],
    ]);
  });

  it('boolean: the mustBe value and the other one; no constraint, no case', () => {
    expect(covered('boolean', { mustBe: true }, [true, false, 'true'])).toEqual([
      ['value true (mustBe)', [true]],
      ['value false (not mustBe)', [false]],
    ]);
    expect(covered('boolean', {}, [true])).toEqual([]);
  });

  it('a "" cell sends the empty string to a string field, so length 0 can be covered', () => {
    const field = (primitive: Primitive) => ({ urn: 'urn:demo:shop:order:field:note', primitive, required: true });
    expect(coerceCell('""', field('string'))).toBe('');
    expect(coerceCell('', field('string'))).toBeUndefined();
    expect(coerceCell('""', field('integer'))).toBe('""');
    expect(v.safeParse(shop.OrderSkuSchema, coerceCell('""', field('string'))).issues?.[0]?.message).toContain('received ""');
  });
});

describe('the MECE model (primitives plan)', () => {
  const specs = PRIMITIVE_NAMES.flatMap((p) =>
    Object.entries(PRIMITIVES[p].constraints as Record<string, { aspect: string }>).map(([key, spec]) => ({ primitive: p, key, aspect: spec.aspect })),
  );

  it('gives one constraint name one aspect on every primitive', () => {
    const aspects = new Map<string, Set<string>>();
    for (const { key, aspect } of specs) aspects.set(key, (aspects.get(key) ?? new Set()).add(aspect));
    expect([...aspects].filter(([, set]) => set.size > 1)).toEqual([]);
  });

  it('groups as exclusive only constraints of the primitive that share one aspect', () => {
    for (const p of PRIMITIVE_NAMES) {
      const descriptor = PRIMITIVES[p] as { constraints: Record<string, { aspect: string }>; exclusive?: readonly { keys: readonly string[] }[] };
      for (const group of descriptor.exclusive ?? []) {
        expect(group.keys.length, `${p}: ${group.keys.join(', ')}`).toBeGreaterThan(1);
        const groupAspects = new Set(group.keys.map((key) => descriptor.constraints[key]?.aspect));
        expect(groupAspects.has(undefined), `${p}: ${group.keys.join(', ')}`).toBe(false);
        expect(groupAspects.size, `${p}: ${group.keys.join(', ')}`).toBe(1);
      }
    }
  });
});
