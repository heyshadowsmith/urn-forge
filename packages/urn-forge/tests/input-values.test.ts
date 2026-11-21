/**
 * Each operation's input values, as boundary coverage reads them (boundary coverage plan,
 * step 2). On the real features they must match the values the plan's target was built from.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { indexFeatureSource, indexFeatures } from '../src/verify/feature-index.js';
import { inputValues } from '../src/verify/input-values.js';

const repo = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const irOf = (manifest: string) => compile(readFileSync(repo(manifest), 'utf8')).ir!;

/** `operation identifier.field` → values, for comparing whole domains at once. */
async function valuesOf(manifest: string, featuresDir: string) {
  const ir = irOf(manifest);
  const result = inputValues(ir, await indexFeatures(repo(featuresDir), repo('')));
  return Object.fromEntries(
    [...result].flatMap(([op, fields]) => [...fields].map(([name, list]) => [`${op.split(':').at(-1)}.${name}`, list])),
  );
}

describe('input values on the real features', () => {
  it('math example', async () => {
    expect(await valuesOf('tests/fixtures/math/domain.manifest.yaml', 'example/features')).toEqual({
      'compute_area.radius': [0, 1, 2, -1],
      'safe_divide.dividend': [10, -9, 1],
      'safe_divide.divisor': [2, 3, 0],
    });
  });

  it('self/', async () => {
    expect(await valuesOf('self/domain.manifest.yaml', 'self/features')).toEqual({
      'parse_short_key.short_key': [
        'geometry.field.radius',
        'arithmetic.operation.safe_divide',
        'shop.entity.line_2',
        'geometry.radius',
        'Geometry.field.radius',
        'geometry.Field.radius',
        'geometry.field.radius.x',
        'policy.event.placed',
        'policy.widget.x',
        // Added in boundary coverage step 6: the length-1 key and the empty string (a "" cell).
        'a',
        '',
      ],
      'to_brand_identifier.context': ['policy', 'geometry', 'api', 'a', 'geo_metry', 'geo', 'a'.repeat(64), 'Policy', '2fa', 'has-dash', 'geometry', 'geometry', 'geometry', 'geometry'],
      // The outline's examples, then the 64-character context, then the three invalid contexts;
      // the missing-identifier scenario's empty cell is no value.
      'to_brand_identifier.identifier': ['deductible_amount', 'circle_area', 'v2_key', 'b_', 'radius', 'metry_radius', 'radius', 'radius', 'radius', 'radius', 'Radius', '2d', 'has-dash'],
      'to_urn.namespace': ['demo', 'acme', 'urn_forge', 'urn_forge', 'demo', 'demo', 'demo', 'Demo', 'demo', 'demo', 'demo'],
      'to_urn.domain': ['math', 'insurance', 'toolchain', 'toolchain', 'math', 'math', 'math', 'math', 'Math', 'math', 'math'],
      'to_urn.context': ['arithmetic', 'policy', 'naming', 'naming', 'geometry', 'geometry', 'geometry', 'geometry', 'geometry', 'geo-metry', 'geometry'],
      'to_urn.kind': ['operation', 'field', 'entity', 'error', 'event', 'widget', 'Field', 'field', 'field', 'field', 'field'],
      'to_urn.identifier': ['safe_divide', 'deductible_amount', 'atom_address', 'invalid_short_key', 'radius', 'radius', 'radius', 'radius', 'radius', 'radius', '2radius'],
    });
  });
});

describe('input values', () => {
  const ir = irOf('tests/fixtures/shop/domain.manifest.yaml');
  const PRICE = '@urn:demo:shop:order:operation:price_line';
  const valuesFor = (source: string) => {
    const result = inputValues(ir, { directory: 'f', features: [indexFeatureSource(source, 'f.feature')!], problems: [] });
    return Object.fromEntries(result.get('urn:demo:shop:order:operation:price_line' as never)!);
  };

  it('converts cells by primitive, skips empty cells, reads "" as the empty string and ignores unknown headers', () => {
    expect(
      valuesFor(
        `${PRICE}\nFeature: x\n  Scenario: y\n    When I run the operation with:\n      | sku | quantity | note | gift_wrap | colour |\n      | ABC-1234 | 2 | "" | true | red |\n      | ABC-9999 |   | hi | false | blue |\n`,
      ),
    ).toEqual({ sku: ['ABC-1234', 'ABC-9999'], quantity: [2], note: ['', 'hi'], gift_wrap: [true, false] });
  });

  it('substitutes placeholders anywhere in a cell, once per Examples row', () => {
    expect(
      valuesFor(
        `${PRICE}\nFeature: x\n  Scenario Outline: y\n    When I run the operation with:\n      | sku          | quantity |\n      | <code>-<num> | <qty>    |\n    Examples:\n      | code | num  | qty |\n      | ABC  | 1234 | 1   |\n      | XYZ  | 0001 | 99  |\n`,
      ),
    ).toEqual({ sku: ['ABC-1234', 'XYZ-0001'], quantity: [1, 99] });
  });

  it('counts an Examples block for the operation its own tag names', () => {
    const source = `Feature: x\n  Scenario Outline: y\n    When I run the operation with:\n      | sku |\n      | <sku> |\n    ${PRICE}\n    Examples:\n      | sku |\n      | ABC-1234 |\n    Examples:\n      | sku |\n      | NOT-0000 |\n`;
    expect(valuesFor(source)).toEqual({ sku: ['ABC-1234'] });
  });
});
