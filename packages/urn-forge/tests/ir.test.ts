import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildIr, buildIrFromSource } from '../src/ir/build.js';
import { toBrandIdentifier } from '../src/naming.js';
import { canonicalJson, fingerprint } from '../src/ir/canonical.js';
import type { IRBuildResult, UniversalIR } from '../src/ir/types.js';
import { validateManifest } from '../src/meta-schema.js';

const mathSource = readFileSync(
  fileURLToPath(new URL('./fixtures/math.manifest.yaml', import.meta.url)),
  'utf8',
);

const header = { namespace: 'demo', domain: 'math', version: '0.1.0' };

function expectIr(result: IRBuildResult): UniversalIR {
  if (!result.success) throw new Error(result.issues.map((i) => i.message).join('\n'));
  return result.ir;
}

/** Builds the IR from a manifest object and returns the issue messages (expects failure). */
function issuesFor(doc: Record<string, unknown>): string[] {
  const validated = validateManifest({ manifest: header, ...doc });
  if (!validated.success) throw new Error(validated.issues.map((i) => i.message).join('\n'));
  const result = buildIr(validated.manifest);
  expect(result.success).toBe(false);
  return result.success ? [] : result.issues.map((i) => i.message);
}

/** Pretty-printed canonical JSON: sorted keys, readable diffs. */
const pretty = (value: unknown) => `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;

describe('IR builder', () => {
  it('matches the golden math IR', async () => {
    const ir = expectIr(buildIrFromSource(mathSource));
    await expect(pretty(ir)).toMatchFileSnapshot('./golden/math.ir.json');
  });

  it('keys every record by URN in code-unit order and keeps entity field order', () => {
    const ir = expectIr(buildIrFromSource(mathSource));
    for (const record of [ir.fields, ir.entities, ir.operations]) {
      const keys = Object.keys(record);
      expect(keys).toEqual([...keys].sort());
    }
    expect(
      ir.entities['urn:demo:math:arithmetic:entity:division' as never]?.fields.map((f) => f.name),
    ).toEqual(['dividend', 'divisor']);
  });

  it('builds the same canonical IR whatever the declaration order', () => {
    const lines = mathSource.split('\n\n');
    const reordered = [lines[0], ...lines.slice(1).reverse()].join('\n\n');
    expect(canonicalJson(expectIr(buildIrFromSource(reordered)))).toBe(
      canonicalJson(expectIr(buildIrFromSource(mathSource))),
    );
  });

  it('derives PascalCase brand identifiers', () => {
    expect(toBrandIdentifier('policy', 'deductible_amount')).toBe('PolicyDeductibleAmount');
    expect(toBrandIdentifier('arithmetic', 'safe_divide')).toBe('ArithmeticSafeDivide');
  });

  it('rejects a dangling ref, naming the URN', () => {
    expect(
      issuesFor({
        'geometry.entity.circle': { description: 'A circle', fields: [{ ref: 'geometry.field.diameter' }] },
      }),
    ).toEqual([
      'urn:demo:math:geometry:entity:circle: fields[0].ref "geometry.field.diameter" does not resolve ' +
        '(no atom urn:demo:math:geometry:field:diameter in this manifest)',
    ]);
  });

  it('rejects a duplicate brand name, naming both URNs', () => {
    expect(
      issuesFor({
        'geo_metry.field.radius': { primitive: 'float' },
        'geo.field.metry_radius': { primitive: 'float' },
      }),
    ).toEqual([
      'urn:demo:math:geo_metry:field:radius: brandIdentifier "GeoMetryRadius" is already used by ' +
        'urn:demo:math:geo:field:metry_radius; rename one of them',
    ]);
  });

  it('rejects a brand name shared across kinds', () => {
    const [message, ...rest] = issuesFor({
      'geometry.field.circle': { primitive: 'float' },
      'geometry.entity.circle': { description: 'A circle', fields: [{ ref: 'geometry.field.circle' }] },
    });
    expect(rest).toEqual([]);
    expect(message).toContain('urn:demo:math:geometry:field:circle');
    expect(message).toContain('"GeometryCircle"');
  });

  it('rejects references to the wrong kind, naming the URN', () => {
    expect(
      issuesFor({
        'geometry.field.radius': { primitive: 'float' },
        'geometry.entity.circle': { description: 'A circle', fields: [{ ref: 'geometry.entity.circle' }] },
        'geometry.operation.compute_area': {
          description: 'Area',
          input: 'geometry.field.radius',
          output: 'geometry.operation.compute_area',
        },
      }),
    ).toEqual([
      'urn:demo:math:geometry:entity:circle: fields[0].ref "geometry.entity.circle" must name a field, ' +
        'but urn:demo:math:geometry:entity:circle is an entity',
      'urn:demo:math:geometry:operation:compute_area: input "geometry.field.radius" must name an entity, ' +
        'but urn:demo:math:geometry:field:radius is a field',
      'urn:demo:math:geometry:operation:compute_area: output "geometry.operation.compute_area" must name ' +
        'an entity, but urn:demo:math:geometry:operation:compute_area is an operation',
    ]);
  });

  it('rejects two fields that become the same entity property', () => {
    expect(
      issuesFor({
        'geometry.field.size': { primitive: 'float' },
        'arithmetic.field.size': { primitive: 'float' },
        'geometry.entity.shape': {
          description: 'A shape',
          fields: [{ ref: 'geometry.field.size' }, { ref: 'arithmetic.field.size' }],
        },
      }),
    ).toEqual([
      'urn:demo:math:geometry:entity:shape: fields[1].ref urn:demo:math:arithmetic:field:size and ' +
        'urn:demo:math:geometry:field:size both become property "size"',
    ]);
  });
});

describe('canonical JSON and fingerprint', () => {
  it('sorts keys regardless of insertion order and drops undefined properties', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: undefined, B: 3 }] })).toBe('{"a":[{"B":3,"d":2}],"b":1}');
  });

  it('refuses values with no canonical JSON form', () => {
    expect(() => canonicalJson({ x: Number.NaN })).toThrow('$.x');
    expect(() => canonicalJson({ x: new Map() })).toThrow('$.x');
  });

  it('changes when the IR, config, generator version or plugins change', () => {
    const ir = expectIr(buildIrFromSource(mathSource));
    const base = { ir, config: {}, generatorVersion: '0.1.0', plugins: [{ name: 'valibot', version: '0.1.0' }] };
    const print = fingerprint(base);
    expect(print).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(fingerprint({ ...base })).toBe(print);
    expect(fingerprint({ ...base, generatorVersion: '0.1.1' })).not.toBe(print);
    expect(fingerprint({ ...base, config: { out: 'x' } })).not.toBe(print);
    expect(fingerprint({ ...base, plugins: [] })).not.toBe(print);
    expect(fingerprint({ ...base, ir: { ...ir, meta: { ...ir.meta, manifestVersion: '0.2.0' } } })).not.toBe(print);
  });
});
