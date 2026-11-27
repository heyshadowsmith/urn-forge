/**
 * The target of unions (decisions 2, 3 and 11 of the plan of urn-forge's own contract): a tagged
 * union of object variants, each by the value of its tag; a guard by the tag in the rule language;
 * and a union of base types told apart by their JSON type. Each test is it.fails until its step.
 */
import { describe, expect, it } from 'vitest';
import { checksOf, compileManifest } from '../src/compile.js';
import { generatedFile } from '../src/generate/code.js';
import type { Failure } from '../src/generate/runtime.js';

/** A test of the target that does not pass yet: it.fails until its step is built, then it. */
const target = { unions: it };

const manifest = (rule = 'true') => `manifest: {namespace: test, domain: unions, version: 0.1.0}
definitions:
  kind: {description: The kind of a shape, type: string, rules: [{enum: [circle, square]}]}
  radius: {description: The radius of a circle, type: number, rules: [{exclusiveMinimum: 0}]}
  side: {description: The side of a square, type: number, rules: [{exclusiveMinimum: 0}]}
  circle: {description: A circle, type: object, properties: [kind, radius], rules: [{required: [kind, radius]}]}
  square: {description: A square, type: object, properties: [kind, side], rules: [{required: [kind, side]}]}
  shape: {description: A circle or a square by its kind, type: union, tag: kind, variants: {circle: circle, square: square}}
  label: {description: A label, type: string}
  amount: {description: An amount, type: number}
  labels: {description: Labels, type: array, items: label}
  argument: {description: An argument of any JSON type but a bool, type: union, variants: [label, amount, labels]}
  drawing:
    description: A shape and an argument
    type: object
    properties: [shape, argument]
    rules:
      - required: [shape, argument]
      - the_rule
rules:
  the_rule: {description: The rule of the test, rule: ${JSON.stringify(rule)}, failure_message: The rule is broken}
`;

function compiled(rule?: string) {
  const c = compileManifest(manifest(rule));
  if (!c.model) throw new Error(c.diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'));
  return c;
}

function failures(value: unknown, rule?: string): [string, string, string][] {
  const c = compiled(rule);
  const out: Failure[] = [];
  checksOf(c.model!, c.applications)['drawing']!(value, '', out);
  return out.map((f) => [f.definition, f.rule, f.path]);
}

const circle = { kind: 'circle', radius: 2 };

describe('a tagged union', () => {
  target.unions('has the type of a union of its variants', () => {
    const c = compiled();
    expect(generatedFile(c.model!, c.applications, 'domain.manifest.yaml', () => 'x')).toContain('export type Shape = Circle | Square;');
  });

  target.unions('checks a value with the variant that its tag names', () => {
    expect(failures({ shape: circle, argument: 'x' })).toEqual([]);
    expect(failures({ shape: { kind: 'square', side: 3 }, argument: 'x' })).toEqual([]);
    expect(failures({ shape: { kind: 'circle', side: 3 }, argument: 'x' })).toEqual([
      ['circle', 'required', 'shape'],
      ['circle', 'properties', 'shape.side'],
    ]);
    expect(failures({ shape: { kind: 'triangle' }, argument: 'x' })).toEqual([['shape', 'variant', 'shape']]);
    expect(failures({ shape: { radius: 2 }, argument: 'x' })).toEqual([['shape', 'variant', 'shape']]);
  });

  target.unions('reads the properties of a variant after a test of the tag', () => {
    expect(failures({ shape: circle, argument: 'x' }, "self.shape.kind != 'circle' || self.shape.radius < 3")).toEqual([]);
    expect(failures({ shape: { kind: 'circle', radius: 5 }, argument: 'x' }, "self.shape.kind != 'circle' || self.shape.radius < 3")).toEqual([['drawing', 'the_rule', '']]);
    expect(compileManifest(manifest('self.shape.radius > 0')).diagnostics.map((d) => d.code)).toContain('rule-guard');
  });
});

describe('a union of base types', () => {
  target.unions('takes a value of each of its JSON types, and no other', () => {
    expect(failures({ shape: circle, argument: 'x' })).toEqual([]);
    expect(failures({ shape: circle, argument: 2.5 })).toEqual([]);
    expect(failures({ shape: circle, argument: ['a', 'b'] })).toEqual([]);
    expect(failures({ shape: circle, argument: true })).toEqual([['argument', 'type', 'argument']]);
    expect(failures({ shape: circle, argument: [1] })).toEqual([['label', 'type', 'argument[0]']]);
  });

  target.unions('refuses two variants of one JSON type, and an object variant with no tag', () => {
    const two = compileManifest(manifest().replace('variants: [label, amount, labels]', 'variants: [label, kind]'));
    expect(two.diagnostics.map((d) => `${d.code}: ${d.message}`)).toContain('manifest-shape: argument: two variants are a string: label and kind; give a union one variant of each JSON type');
    const untagged = compileManifest(manifest().replace('type: union, tag: kind, variants: {circle: circle, square: square}', 'type: union, variants: [circle, square]'));
    expect(untagged.diagnostics.map((d) => `${d.code}: ${d.message}`)).toContain('manifest-shape: shape: two variants are an object: circle and square; give the union a tag');
  });
});

describe('gate 3 and a union', () => {
  it('reports a variant that no scenario reaches', async () => {
    const { gherkinGate } = await import('../src/verify/gherkin.js');
    const c = compiled();
    const feature = (shape: string): string => `Feature: Drawings\n\n  Scenario: A drawing\n    When I check a "drawing" with:\n      | shape   | argument |\n      | ${shape} | x        |\n    Then the value is accepted\n`;
    const gaps = (text: string): string[] =>
      gherkinGate({ model: c.model!, applications: c.applications, features: [{ path: 'features/drawing.feature', text }] } as never)
        .problems.filter((p) => p.code === 'uncovered-variant')
        .map((p) => p.message);
    expect(gaps(feature('{"kind": "circle", "radius": 2}'))).toEqual([
      'no scenario reaches the variant square of shape; add one whose table has a value of it',
      'no scenario reaches the variant amount of argument; add one whose table has a value of it',
      'no scenario reaches the variant labels of argument; add one whose table has a value of it',
    ]);
  });
});
