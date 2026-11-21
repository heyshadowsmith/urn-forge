/**
 * The primitive registry (foundations plan, phase 2): the meta-schema, the coherence pass,
 * the Valibot translations and the step library all read each primitive from one place.
 */
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import * as shop from './fixtures/shop/expected/domain.schemas.generated.js';
import * as kinds from './fixtures/primitives/expected/domain.schemas.generated.js';
import { compile } from '../src/engine.js';
import { coerceCell } from '../src/gherkin/steps.js';
import { validateManifest } from '../src/meta-schema.js';
import { PRIMITIVES, PRIMITIVE_NAMES, boundaryCases, constraintKeys, type Primitive } from '../src/primitives/index.js';
import type { ValibotTranslation, ValibotTranslations } from '../src/plugins/valibot.plugin.js';

const header = { namespace: 'demo', domain: 'math', version: '0.1.0' };
const HEADER = 'manifest:\n  namespace: demo\n  domain: math\n  version: 0.1.0\n';

describe('primitive registry', () => {
  it('lists the primitives and their constraints in a fixed order', () => {
    expect(PRIMITIVE_NAMES).toEqual(['boolean', 'date', 'decimal', 'enum', 'float', 'integer', 'string', 'timestamp']);
    expect(Object.fromEntries(PRIMITIVE_NAMES.map((p) => [p, constraintKeys(p)]))).toEqual({
      boolean: ['mustBe'],
      date: ['min', 'max'],
      decimal: ['min', 'max', 'exclusiveMin', 'exclusiveMax', 'scale', 'notIn'],
      enum: ['values'],
      float: ['min', 'max', 'exclusiveMin', 'exclusiveMax', 'notIn'],
      integer: ['min', 'max', 'multipleOf', 'notIn'],
      string: ['minLength', 'maxLength', 'regex', 'format'],
      timestamp: ['min', 'max', 'exclusiveMin', 'exclusiveMax'],
    });
  });

  it('drives the meta-schema: each primitive accepts its own constraints and no others', () => {
    const numbers: Record<string, unknown> = { min: 1, max: 1, exclusiveMin: 0, exclusiveMax: 2, multipleOf: 1, notIn: [5] };
    const strings = (value: string): Record<string, unknown> => ({ min: value, max: value, exclusiveMin: value, exclusiveMax: value, notIn: [value] });
    // A valid value of each constraint, for each primitive, so only the key decides.
    const samples: Record<string, Record<string, unknown>> = {
      boolean: { mustBe: true },
      date: strings('2026-01-01'),
      decimal: { ...strings('1.5'), scale: 2 },
      enum: { values: ['a'] },
      float: numbers,
      integer: numbers,
      string: { minLength: 1, maxLength: 1, regex: 'a', format: 'uuid' },
      timestamp: strings('2026-01-01T00:00:00Z'),
    };
    const sample = (primitive: string, key: string) => samples[primitive]?.[key] ?? Object.values(samples).find((s) => key in s)?.[key];
    for (const primitive of PRIMITIVE_NAMES) {
      // An enum must list its values, so each try starts from a valid enum.
      const base = primitive === 'enum' ? { values: ['a'] } : {};
      for (const other of PRIMITIVE_NAMES) {
        for (const key of constraintKeys(other)) {
          const result = validateManifest({ manifest: header, 'a.field.b': { primitive, ...base, [key]: sample(primitive, key) } });
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
    // A decimal, a date and a timestamp stay text, so a decimal keeps every digit as written.
    expect(coerceCell('12.50', field('decimal'))).toBe('12.50');
    expect(coerceCell('2026-01-31', field('date'))).toBe('2026-01-31');
    expect(coerceCell('2026-01-31T09:30:00Z', field('timestamp'))).toBe('2026-01-31T09:30:00Z');
    expect(coerceCell('s', field('enum'))).toBe('s');
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

  it('rejects notIn that excludes every value the range and step allow', () => {
    expect(diagnose('a.field.b: { primitive: integer, min: 3, max: 3, notIn: [3] }\n')).toEqual([
      expect.objectContaining({
        code: 'incoherent-constraints',
        message: 'urn:demo:math:a:field:b: notIn lists every value that min, max allow, so no value is valid',
      }),
    ]);
    expect(diagnose('a.field.b: { primitive: integer, min: 1, max: 20, multipleOf: 10, notIn: [10, 20] }\n')).toEqual([
      expect.objectContaining({ message: 'urn:demo:math:a:field:b: notIn lists every value that min, max and multipleOf allow, so no value is valid' }),
    ]);
    expect(diagnose('a.field.b: { primitive: float, min: 2, max: 2, notIn: [2] }\n')).toEqual([
      expect.objectContaining({ message: 'urn:demo:math:a:field:b: min and max are both 2 and notIn lists it, so no value is valid' }),
    ]);
  });

  it('rejects a multipleOf with no multiple in the range', () => {
    expect(diagnose('a.field.b: { primitive: integer, min: 1, max: 4, multipleOf: 5 }\n')).toEqual([
      expect.objectContaining({ message: 'urn:demo:math:a:field:b: no multiple of 5 is between min (1) and max (4), so no value is valid' }),
    ]);
  });

  it('rejects exclusive bounds that leave no value', () => {
    expect(diagnose('a.field.b: { primitive: float, exclusiveMin: 1, max: 1 }\n')).toEqual([
      expect.objectContaining({ message: 'urn:demo:math:a:field:b: exclusiveMin and max are both 1, and one of them excludes it, so no value is valid' }),
    ]);
    expect(diagnose('a.field.b: { primitive: float, exclusiveMin: 2, exclusiveMax: 1 }\n')).toEqual([
      expect.objectContaining({ message: 'urn:demo:math:a:field:b: exclusiveMin (2) is greater than exclusiveMax (1), so no value is valid' }),
    ]);
  });

  it('rejects two constraints for one side, and checks no coherence then', () => {
    expect(diagnose('a.field.b: { primitive: float, min: 5, exclusiveMin: 0, max: 1 }\n')).toEqual([
      expect.objectContaining({ code: 'conflicting-constraints', message: 'urn:demo:math:a:field:b: min and exclusiveMin both set a lower bound; keep one' }),
    ]);
    expect(diagnose("a.field.b: { primitive: string, regex: '[a-z]+', format: email }\n")).toEqual([
      expect.objectContaining({ code: 'conflicting-constraints', message: 'urn:demo:math:a:field:b: regex and format both set the shape; keep one' }),
    ]);
  });

  it('rejects a uuid that the length constraints exclude', () => {
    expect(diagnose('a.field.b: { primitive: string, format: uuid, maxLength: 10 }\n')).toEqual([
      expect.objectContaining({ message: 'urn:demo:math:a:field:b: a uuid has 36 characters, which the length constraints exclude, so no value is valid' }),
    ]);
  });

  it('names what replaced a constraint, and refuses an exclusive bound on an integer', () => {
    expect(diagnose('a.field.b: { primitive: integer, notEqual: 3 }\n')).toEqual([
      expect.objectContaining({ code: 'unknown-property', message: 'a.field.b.notEqual: unknown property "notEqual"; to exclude values, use notIn: [ … ]' }),
    ]);
    expect(diagnose('a.field.b: { primitive: integer, exclusiveMin: 0 }\n')).toEqual([
      expect.objectContaining({ code: 'constraint-not-allowed', message: expect.stringContaining('"exclusiveMin" is not a constraint of primitive "integer" (allowed: min, max, multipleOf, notIn)') }),
    ]);
  });

  it('rejects minLength above maxLength', () => {
    expect(diagnose('a.field.b: { primitive: string, minLength: 5, maxLength: 2 }\n')).toEqual([
      expect.objectContaining({ code: 'incoherent-constraints', message: expect.stringContaining('minLength (5) is greater than maxLength (2)') }),
    ]);
  });

  it('accepts ranges that admit a value', () => {
    expect(diagnose('a.field.b: { primitive: integer, min: 3, max: 3 }\n')).toEqual([]);
    expect(diagnose('a.field.b: { primitive: integer, min: 3, max: 4, notIn: [3] }\n')).toEqual([]);
    expect(diagnose('a.field.b: { primitive: float, exclusiveMin: 0, exclusiveMax: 0.001 }\n')).toEqual([]);
    expect(diagnose('a.field.b: { primitive: integer, min: 1, max: 10, multipleOf: 5 }\n')).toEqual([]);
    expect(diagnose('a.field.b: { primitive: string, minLength: 2, maxLength: 2 }\n')).toEqual([]);
  });
});

describe('ValibotTranslations (type level, checked by tsc)', () => {
  it('requires every primitive and every constraint', () => {
    const numeric: ValibotTranslation<'float'> = {
      base: [],
      // @ts-expect-error notIn, exclusiveMin and exclusiveMax are missing
      constraints: { min: String, max: String },
    };
    const wrongValue: ValibotTranslation<'string'> = {
      base: [],
      // @ts-expect-error minLength takes a number, not a string
      constraints: { minLength: (s: string) => s.trim(), maxLength: String },
    };
    // @ts-expect-error the string primitive is missing
    const partial: ValibotTranslations = {
      float: { base: [], constraints: { min: String, max: String, exclusiveMin: String, exclusiveMax: String, notIn: String } },
      integer: { base: [], constraints: { min: String, max: String, multipleOf: String, notIn: String } },
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

describe('string length (Postgres plan, decision 5)', () => {
  // One emoji is one code point and two UTF-16 units.
  it('counts Unicode code points in the generated schema, as Postgres char_length does', () => {
    expect(v.safeParse(kinds.ValueCodeSchema, '😀😀😀😀').success).toBe(true);
    expect(v.safeParse(kinds.ValueCodeSchema, '😀').issues?.map((i) => i.message)).toEqual(['Invalid length: Expected >=2 but received 1']);
    expect(v.safeParse(kinds.ValueCodeSchema, '😀😀😀😀😀').issues?.map((i) => i.message)).toEqual(['Invalid length: Expected <=4 but received 5']);
  });

  it('counts Unicode code points in the boundary cases of gate 3', () => {
    const samples = ['😀', '😀😀', 'a😀😀a', 'a😀😀a😀'];
    expect(boundaryCases('string', { minLength: 2, maxLength: 4 }).map((c) => [c.label, samples.filter((s) => c.covers(s))])).toEqual([
      ['value of length 2 (minLength)', ['😀😀']],
      ['value of length 1 (below minLength)', ['😀']],
      ['value of length 4 (maxLength)', ['a😀😀a']],
      ['value of length 5 (above maxLength)', ['a😀😀a😀']],
    ]);
  });
});

describe('boundary cases (boundary coverage plan, step 1)', () => {
  /** Each case's label, with the sample values that cover it. */
  const covered = (primitive: Primitive, constraints: Record<string, unknown>, samples: readonly unknown[]) =>
    boundaryCases(primitive, constraints as never).map((c) => [c.label, samples.filter((s) => c.covers(s))]);

  it('integer: the value at each bound and one step beyond, and the excluded value', () => {
    expect(covered('integer', { min: 1, max: 99, notIn: [13, 50] }, [0, 1, 2, 99, 100, 13, 50, '0'])).toEqual([
      ['value at min 1', [1]],
      ['value at min − 1 (0)', [0]],
      ['value at max 99', [99]],
      ['value at max + 1 (100)', [100]],
      ['value 13 (notIn)', [13]],
      ['value 50 (notIn)', [50]],
    ]);
    expect(covered('integer', { multipleOf: 5 }, [10, -5, 7, 2.5])).toEqual([
      ['multiple of 5 (multipleOf)', [10, -5]],
      ['value that is not a multiple of 5', [7]],
    ]);
  });

  it('float: an exclusive bound needs the bound itself and a value inside it', () => {
    expect(covered('float', { exclusiveMin: 0, exclusiveMax: 1 }, [0, 0.5, 1, 2])).toEqual([
      ['value at exclusiveMin 0', [0]],
      ['value above exclusiveMin 0', [0.5, 1, 2]],
      ['value at exclusiveMax 1', [1]],
      ['value below exclusiveMax 1', [0, 0.5]],
    ]);
  });

  it('string: a valid and an invalid value of a format', () => {
    expect(covered('string', { format: 'uuid' }, ['123e4567-e89b-12d3-a456-426614174000', 'nope', 7])).toEqual([
      ['valid uuid (format)', ['123e4567-e89b-12d3-a456-426614174000']],
      ['value that is not a valid uuid', ['nope']],
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

  it('matches the constraint table of docs/reference/primitives.md, row for row', () => {
    const page = readFileSync(new URL('../../../docs/reference/primitives.md', import.meta.url), 'utf8');
    const section = page.slice(page.indexOf('\n## Constraints\n'), page.indexOf('\n### ', page.indexOf('\n## Constraints\n')));
    const rows = [...section.matchAll(/^\| `(\w+)` \| `(\w+)` \| (\w+) \|/gm)].map((m) => `${m[2]}.${m[1]} ${m[3]!.toLowerCase()}`);
    expect(rows.sort()).toEqual(specs.map(({ primitive, key, aspect }) => `${primitive}.${key} ${aspect}`).sort());
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

describe('the generated schema of each constraint (fixture: primitives)', () => {
  /** [schema, values it accepts, values it refuses] */
  const cases: readonly [string, v.GenericSchema, readonly unknown[], readonly unknown[]][] = [
    ['flag', kinds.ValueFlagSchema, [true, false], ['true', 1]],
    ['accepted (mustBe)', kinds.ValueAcceptedSchema, [true], [false]],
    ['size (enum values)', kinds.ValueSizeSchema, ['s', 'm', 'l'], ['xl', '', 'S']],
    ['code (minLength, maxLength)', kinds.ValueCodeSchema, ['ab', 'abcd'], ['a', 'abcde']],
    ['sku (regex)', kinds.ValueSkuSchema, ['ABC-1234'], ['abc-1234', 'ABC-12345']],
    ['id (format uuid)', kinds.ValueIdSchema, ['123e4567-e89b-12d3-a456-426614174000'], ['123e4567', '']],
    ['email (format email)', kinds.ValueEmailSchema, ['ada@example.com'], ['ada', 'ada@']],
    ['link (format uri)', kinds.ValueLinkSchema, ['https://example.com/a'], ['example.com', 'not a uri']],
    ['quantity (min, max, notIn)', kinds.ValueQuantitySchema, [1, 12, 14, 99], [0, 13, 100, 1.5]],
    ['pack (min, multipleOf)', kinds.ValuePackSchema, [0, 6, 12], [-6, 5, 7]],
    ['share (min, max)', kinds.ValueShareSchema, [0, 0.5, 1], [-0.1, 1.1]],
    ['weight (exclusiveMin, exclusiveMax)', kinds.ValueWeightSchema, [0.001, 999.9], [0, 1000, -1]],
    ['divisor (notIn)', kinds.ValueDivisorSchema, [1, -2.5], [0, -0]],
    ['amount (decimal)', kinds.ValueAmountSchema, ['0', '-12.50', '123456789012345678901234.5'], ['1e3', '+1', '.5', '01', '1.', 12, '']],
    ['price (min, max, scale, notIn)', kinds.ValuePriceSchema, ['0.01', '9999.99', '12.5', '14'], ['0.00', '0', '10000', '1.005', '13.00', '13.0', '13']],
    ['rate (exclusiveMin, exclusiveMax)', kinds.ValueRateSchema, ['0.0001', '0.9999'], ['0', '0.000', '1', '1.0']],
    ['day (date)', kinds.ValueDaySchema, ['2024-02-29', '0050-01-01'], ['2023-02-29', '2026-13-01', '2026-1-1', '20260101', 'x']],
    ['term_day (min, max)', kinds.ValueTermDaySchema, ['2026-01-01', '2026-12-31'], ['2025-12-31', '2027-01-01']],
    ['at (timestamp)', kinds.ValueAtSchema, ['2026-01-31T09:30:00Z', '2026-01-31T09:30:00.123Z'], ['2026-01-31T09:30:00+02:00', '2026-01-31T24:00:00Z', '2026-01-31 09:30:00Z', '2026-02-30T00:00:00Z', '2026-01-31T09:30:00.1234Z']],
    ['window (min, exclusiveMax)', kinds.ValueWindowSchema, ['2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000Z', '2026-12-31T23:59:59.999Z'], ['2025-12-31T23:59:59.999Z', '2027-01-01T00:00:00Z']],
  ];
  it.each(cases)('%s', (_name, schema, accepted, refused) => {
    for (const value of accepted) expect(v.is(schema, value), `accepts ${String(value)}`).toBe(true);
    for (const value of refused) expect(v.is(schema, value), `refuses ${String(value)}`).toBe(false);
  });

  it('types an enum as the union of its values (checked by tsc)', () => {
    const size: 's' | 'm' | 'l' = v.parse(kinds.ValueSizeSchema, 'm');
    expect(size).toBe('m');
  });
});

describe('decimal, date and timestamp: pass 7 and boundary cases', () => {
  const covered = (primitive: Primitive, constraints: Record<string, unknown>, samples: readonly unknown[]) =>
    boundaryCases(primitive, constraints as never).map((c) => [c.label, samples.filter((s) => c.covers(s))]);

  it('decimal: one step outside each bound at the scale, the scale itself, and each excluded value', () => {
    expect(covered('decimal', { min: '0.01', max: '9.99', scale: 2, notIn: ['5'] }, ['0.01', '0.010', '0.00', '0', '9.99', '10.00', '1.5', '1.25', '1.255', '5.00', 1])).toEqual([
      ['value at min 0.01', ['0.01', '0.010']],
      ['value one step below min (0.00)', ['0.00', '0']],
      ['value at max 9.99', ['9.99']],
      ['value one step above max (10.00)', ['10.00']],
      ['value with 2 digit(s) after the point (scale)', ['0.01', '0.00', '9.99', '10.00', '1.25', '5.00']],
      ['value with 3 digits after the point (above scale)', ['0.010', '1.255']],
      ['value 5 (notIn)', ['5.00']],
    ]);
    expect(covered('decimal', { exclusiveMin: '0' }, ['0', '-0', '0.0001', '-1'])).toEqual([
      ['value at exclusiveMin 0', ['0', '-0']],
      ['value above exclusiveMin 0', ['0.0001']],
    ]);
  });

  it('date: each bound and the day beyond it', () => {
    expect(covered('date', { min: '2024-03-01', max: '2024-12-31' }, ['2024-03-01', '2024-02-29', '2024-12-31', '2025-01-01'])).toEqual([
      ['value at min 2024-03-01', ['2024-03-01']],
      ['day before min (2024-02-29)', ['2024-02-29']],
      ['value at max 2024-12-31', ['2024-12-31']],
      ['day after max (2025-01-01)', ['2025-01-01']],
    ]);
  });

  it('timestamp: each bound, compared as an instant, and a value beyond it', () => {
    expect(covered('timestamp', { min: '2026-01-01T00:00:00Z' }, ['2026-01-01T00:00:00.000Z', '2025-12-31T23:59:59Z', 'x'])).toEqual([
      ['value at min 2026-01-01T00:00:00Z', ['2026-01-01T00:00:00.000Z']],
      ['value before min 2026-01-01T00:00:00Z', ['2025-12-31T23:59:59Z']],
    ]);
  });

  it('pass 7: bounds that admit no value', () => {
    const diagnose = (body: string) => compile(`${HEADER}${body}`).diagnostics.map((d) => [d.code, d.message.replace(/^\S+: /, '')]);
    expect(diagnose('a.field.b: { primitive: decimal, min: "2", max: "1.5" }\n')).toEqual([['incoherent-constraints', 'min (2) is greater than max (1.5), so no value is valid']]);
    expect(diagnose('a.field.b: { primitive: decimal, min: "0.001", max: "0.009", scale: 2 }\n')).toEqual([
      ['incoherent-constraints', 'no value with at most 2 digit(s) after the point is between min (0.001) and max (0.009), so no value is valid'],
    ]);
    expect(diagnose('a.field.b: { primitive: decimal, min: "0", max: "0.02", scale: 2, notIn: ["0", "0.01", "0.020"] }\n')).toEqual([
      ['incoherent-constraints', 'notIn lists every value that the bounds and scale allow, so no value is valid'],
    ]);
    expect(diagnose('a.field.b: { primitive: decimal, exclusiveMin: "0", exclusiveMax: "0.01", scale: 2 }\n')).toEqual([
      ['incoherent-constraints', 'no value with at most 2 digit(s) after the point is between exclusiveMin (0) and exclusiveMax (0.01), so no value is valid'],
    ]);
    expect(diagnose('a.field.b: { primitive: date, min: 2026-02-01, max: 2026-01-31 }\n')).toEqual([['incoherent-constraints', 'min (2026-02-01) is after max (2026-01-31), so no value is valid']]);
    expect(diagnose('a.field.b: { primitive: timestamp, exclusiveMin: "2026-01-01T00:00:00Z", max: "2026-01-01T00:00:00.000Z" }\n')).toEqual([
      ['incoherent-constraints', 'exclusiveMin and max are the same instant, and one of them excludes it, so no value is valid'],
    ]);
    expect(diagnose('a.field.b: { primitive: decimal, min: "0", max: "1", scale: 0 }\n')).toEqual([]);
  });

  it('pass 1: literals of the right form', () => {
    const messages = (body: string) => compile(`${HEADER}${body}`).diagnostics.map((d) => d.message);
    expect(messages('a.field.b: { primitive: decimal, min: 0.10 }\n')).toEqual(['a.field.b.min: must be a decimal in quotes, such as "0.01": a YAML number is not exact']);
    expect(messages('a.field.b: { primitive: decimal, min: "1e3" }\n')).toEqual(['a.field.b.min: must be a decimal such as "12.50": digits, an optional point and fraction, no exponent']);
    expect(messages('a.field.b: { primitive: date, min: 2026-02-30 }\n')).toEqual(['a.field.b.min: must be a real calendar day, YYYY-MM-DD']);
    expect(messages('a.field.b: { primitive: timestamp, min: "2026-01-01T00:00:00+01:00" }\n')).toEqual([
      'a.field.b.min: must be ISO 8601 in UTC: YYYY-MM-DDTHH:MM:SSZ, with an optional fraction of up to 3 digits',
    ]);
    expect(messages('a.field.b: { primitive: date, exclusiveMin: 2026-01-01 }\n')[0]).toContain('"exclusiveMin" is not a constraint of primitive "date" (allowed: min, max)');
  });
});
