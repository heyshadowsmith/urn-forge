/**
 * The primitive registry (foundations plan, phase 2): the meta-schema, the coherence pass,
 * the Valibot translations and the step library all read each primitive from one place.
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { coerceCell } from '../src/gherkin/steps.js';
import { validateManifest } from '../src/meta-schema.js';
import { PRIMITIVES, PRIMITIVE_NAMES, constraintKeys, type Primitive } from '../src/primitives/index.js';
import type { ValibotTranslation, ValibotTranslations } from '../src/plugins/valibot.plugin.js';

const header = { namespace: 'demo', domain: 'math', version: '0.1.0' };
const HEADER = 'manifest:\n  namespace: demo\n  domain: math\n  version: 0.1.0\n';

describe('primitive registry', () => {
  it('lists the primitives and their constraints in a fixed order', () => {
    expect(PRIMITIVE_NAMES).toEqual(['float', 'integer', 'string']);
    expect(Object.fromEntries(PRIMITIVE_NAMES.map((p) => [p, constraintKeys(p)]))).toEqual({
      float: ['min', 'max', 'notEqual'],
      integer: ['min', 'max', 'notEqual'],
      string: ['minLength', 'maxLength'],
    });
  });

  it('drives the meta-schema: each primitive accepts its own constraints and no others', () => {
    for (const primitive of PRIMITIVE_NAMES) {
      for (const other of PRIMITIVE_NAMES) {
        for (const key of constraintKeys(other)) {
          const result = validateManifest({ manifest: header, 'a.field.b': { primitive, [key]: 1 } });
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
