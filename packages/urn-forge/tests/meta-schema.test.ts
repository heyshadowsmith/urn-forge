import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseManifest, validateManifest, type MetaSchemaResult } from '../src/meta-schema.js';

const mathSource = readFileSync(
  fileURLToPath(new URL('./fixtures/math/domain.manifest.yaml', import.meta.url)),
  'utf8',
);

const header = { namespace: 'demo', domain: 'math', version: '0.1.0' };

function messages(result: MetaSchemaResult): string[] {
  expect(result.success).toBe(false);
  return result.success ? [] : result.issues.map((issue) => issue.message);
}

describe('meta-schema', () => {
  it('accepts the math manifest', () => {
    const result = parseManifest(mathSource);
    if (!result.success) throw new Error(result.issues.map((i) => i.message).join('\n'));
    expect(result.manifest.header).toEqual(header);
    expect(Object.keys(result.manifest.fields)).toHaveLength(5);
    expect(Object.keys(result.manifest.entities)).toHaveLength(4);
    expect(Object.keys(result.manifest.operations)).toHaveLength(2);
    // `required` defaults to true on every field ref.
    expect(result.manifest.entities['arithmetic.entity.division']?.fields).toEqual([
      { ref: 'arithmetic.field.dividend', required: true },
      { ref: 'arithmetic.field.divisor', required: true },
    ]);
  });

  it('rejects a bad key, naming the key', () => {
    const result = validateManifest({
      manifest: header,
      'Geometry.field.radius': { primitive: 'float' },
    });
    const [message, ...rest] = messages(result);
    expect(rest).toEqual([]);
    expect(message).toContain('Geometry.field.radius');
    expect(message).toContain('<context>.<kind>.<identifier>');
  });

  it('rejects an unknown primitive, naming the key', () => {
    const result = validateManifest({
      manifest: header,
      'geometry.field.radius': { primitive: 'money' },
    });
    const [message, ...rest] = messages(result);
    expect(rest).toEqual([]);
    expect(message).toContain('geometry.field.radius');
    expect(message).toContain('unknown primitive "money"');
  });

  it('rejects minLength on a float, naming the key', () => {
    const result = validateManifest({
      manifest: header,
      'geometry.field.radius': { primitive: 'float', minLength: 1 },
    });
    const [message, ...rest] = messages(result);
    expect(rest).toEqual([]);
    expect(message).toContain('geometry.field.radius');
    expect(message).toContain('"minLength" is not a constraint of primitive "float"');
  });

  it('calls a key that is no constraint of any primitive an unknown property, not a constraint', () => {
    const result = validateManifest({ manifest: header, 'geometry.field.radius': { primitive: 'float', colour: 'red' } });
    expect(result.success ? [] : result.issues.map((i) => [i.code, i.message])).toEqual([
      ['unknown-property', 'geometry.field.radius.colour: unknown property "colour"'],
    ]);
  });

  it('rejects a kind cut from the MVP, naming the key', () => {
    const result = validateManifest({
      manifest: header,
      'policy.invariant.term_is_positive': { on: 'policy.entity.policy' },
    });
    expect(messages(result)).toEqual([
      expect.stringContaining('policy.invariant.term_is_positive'),
    ]);
  });

  it('rejects a constraint literal of the wrong type, naming the key', () => {
    const result = validateManifest({
      manifest: header,
      'arithmetic.field.count': { primitive: 'integer', min: 'abc' },
      'arithmetic.field.ratio': { primitive: 'integer', max: 1.5 },
    });
    const all = messages(result);
    expect(all).toHaveLength(2);
    expect(all[0]).toContain('arithmetic.field.count.min');
    expect(all[1]).toContain('arithmetic.field.ratio.max');
  });

  it('rejects a missing or malformed header', () => {
    expect(messages(validateManifest({}))).toEqual([expect.stringContaining('missing header')]);
    expect(
      messages(validateManifest({ manifest: { namespace: 'Demo', domain: 'math', version: '1' } })),
    ).toEqual([
      expect.stringContaining('manifest.namespace'),
      expect.stringContaining('manifest.version'),
    ]);
  });

  it('reports duplicate YAML keys', () => {
    const result = parseManifest(`${mathSource}\ngeometry.field.radius: { primitive: float }\n`);
    expect(messages(result)).toEqual([expect.stringMatching(/YAML: .*unique/i)]);
  });
});
