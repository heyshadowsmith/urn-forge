/**
 * The loader and the model: the shape of each part of a manifest, and the names between the parts.
 */
import { describe, expect, it } from 'vitest';
import { loadManifest } from '../src/index.js';

const HEADER = 'manifest:\n  namespace: demo\n  domain: shop\n  version: 0.1.0\n';

function load(body: string) {
  return loadManifest(HEADER + body);
}

function codes(body: string): string[] {
  return load(body).diagnostics.map((d) => `${d.code} ${d.path.join('.')}`);
}

describe('the header', () => {
  it('needs a semver version', () => {
    expect(loadManifest('manifest:\n  namespace: demo\n  domain: shop\n  version: one\n').diagnostics.map((d) => d.code)).toEqual(['manifest-shape']);
  });

  it('takes compatibility: { callers: ignore-unknown } only', () => {
    expect(load('').model?.header.compatibility).toBeUndefined();
    const text = 'manifest:\n  namespace: demo\n  domain: shop\n  version: 1.0.0-rc.1\n  compatibility:\n    callers: ignore-unknown\n';
    expect(loadManifest(text).model?.header.compatibility).toEqual({ callers: 'ignore-unknown' });
    expect(codes('').length).toBe(0);
  });

  it('reports YAML that does not parse', () => {
    expect(loadManifest('manifest: [').diagnostics[0]?.code).toBe('yaml-syntax');
  });
});

describe('definitions', () => {
  it('report an unknown key with the keys allowed', () => {
    const [problem] = load('definitions:\n  sku:\n    description: A SKU\n    type: string\n    minLength: 1\n').diagnostics;
    expect(problem?.code).toBe('manifest-shape');
    expect(problem?.path).toEqual(['definitions', 'sku', 'minLength']);
    expect(problem?.message).toContain('the keys are description, type, properties, items, identifier, rules, deprecated');
  });

  it('give properties to type: object only, and items to type: array only', () => {
    expect(codes('definitions:\n  sku:\n    description: A SKU\n    type: string\n    properties: [sku]\n')).toEqual(['manifest-shape definitions.sku.properties']);
    expect(codes('definitions:\n  line:\n    description: A line\n    type: object\n')).toEqual(['manifest-shape definitions.line.properties']);
    expect(codes('definitions:\n  lines:\n    description: Lines\n    type: array\n')).toEqual(['manifest-shape definitions.lines.items']);
  });

  it('resolve a definition named as a type to its base and root', () => {
    const { model } = load(
      'definitions:\n  sku:\n    description: A SKU\n    type: string\n  line:\n    description: A line\n    type: object\n    properties: [sku]\n  first_line:\n    description: The first line\n    type: line\n',
    );
    expect(model?.definitions['first_line']).toMatchObject({ base: 'object', root: 'line' });
    expect(model?.definitions['sku']).toMatchObject({ base: 'string', root: 'sku' });
  });

  it('report a property listed two times', () => {
    expect(codes('definitions:\n  sku:\n    description: A SKU\n    type: string\n  line:\n    description: A line\n    type: object\n    properties: [sku, sku]\n')).toEqual([
      'duplicate-property definitions.line.properties.1',
    ]);
  });

  it('report a required name that is not a property', () => {
    expect(
      codes('definitions:\n  sku:\n    description: A SKU\n    type: string\n  line:\n    description: A line\n    type: object\n    properties: [sku]\n    rules:\n      - required: [quantity]\n'),
    ).toEqual(['unknown-property definitions.line.rules.0.required']);
  });

  it('take an identifier that is one value: not an object or a list', () => {
    const body =
      'definitions:\n  sku:\n    description: A SKU\n    type: string\n  skus:\n    description: SKUs\n    type: array\n    items: sku\n  line:\n    description: A line\n    type: object\n    properties: [skus]\n    identifier: skus\n    rules:\n      - required: [skus]\n';
    expect(load(body).diagnostics[0]?.message).toBe('the identifier skus is of type array; an identifier is one value');
  });
});

describe('rules', () => {
  it('report a parameter that is not a definition', () => {
    expect(codes("rules:\n  at_least:\n    description: At least\n    parameters: [limit]\n    rule: self >= limit\n    message: At least {limit}\n")).toEqual([
      'unknown-definition rules.at_least.parameters.0',
    ]);
  });

  it('read a use with no argument, and a use with one', () => {
    const { model } = load(
      "definitions:\n  sku:\n    description: A SKU\n    type: string\n    rules:\n      - trimmed\n      - maxLength: 12\nrules:\n  trimmed:\n    description: Not empty\n    rule: size(self) > 0\n    message: Must not be empty\n",
    );
    expect(model?.definitions['sku']?.rules).toEqual([
      { rule: 'trimmed', path: ['definitions', 'sku', 'rules', 0] },
      { rule: 'maxLength', argument: { value: 12 }, path: ['definitions', 'sku', 'rules', 1] },
    ]);
  });
});

describe('operations', () => {
  const objects = 'definitions:\n  sku:\n    description: A SKU\n    type: string\n  line:\n    description: A line\n    type: object\n    properties: [sku]\n';

  it('take objects as the input and each output', () => {
    expect(codes(objects + 'operations:\n  add:\n    description: Add a line\n    input: sku\n    output: [line]\n')).toEqual(['not-an-object operations.add.input']);
  });

  it('read each output with its own rules', () => {
    const { model } = load(
      objects +
        'operations:\n  add:\n    description: Add a line\n    input: line\n    output:\n      - line: [kept]\nrules:\n  kept:\n    description: The line is kept\n    rule: output == input\n    message: The line changed\n',
    );
    expect(model?.operations['add']?.outputs).toEqual([
      { object: 'line', rules: [{ rule: 'kept', path: ['operations', 'add', 'output', 0, 'line', 0] }], path: ['operations', 'add', 'output', 0] },
    ]);
  });

  it('report an output listed two times', () => {
    expect(codes(objects + 'operations:\n  add:\n    description: Add a line\n    input: line\n    output: [line, line]\n')).toEqual([
      'duplicate-output operations.add.output.1',
    ]);
  });
});
