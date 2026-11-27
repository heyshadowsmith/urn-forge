/**
 * A property with its own definition: `- rules: rule_uses` in `properties`. The same name can then be
 * of different definitions in different objects, as the keys of many JSON formats are.
 */
import { describe, expect, it } from 'vitest';
import { checksOf, compileManifest } from '../src/compile.js';
import { classify } from '../src/diff/classify.js';
import { generatedFile } from '../src/generate/code.js';
import type { Failure } from '../src/generate/runtime.js';
import { tableValue } from '../src/gherkin/cells.js';

const manifest = (shipProperty = 'address: street_address') => `manifest: {namespace: test, domain: aliases, version: 0.1.0}
definitions:
  address: {description: An email address, type: string, rules: [{pattern: '^[^@]+@[^@]+$'}]}
  street_address: {description: A street address, type: string, rules: [{minLength: 3}]}
  weight: {description: A weight in grams, type: integer, rules: [{minimum: 1}]}
  contact:
    description: How to reach a person
    type: object
    properties: [address]
    rules:
      - required: [address]
  parcel:
    description: Where a parcel goes
    type: object
    properties:
      - ${shipProperty}
      - weight
      - contact
    rules:
      - required: [address, weight]
      - heavy_to_a_street
rules:
  heavy_to_a_street:
    description: A parcel goes to a street address of more than 5 characters
    rule: size(self.address) > 5
    failure_message: The address is too short
`;

function compiled(shipProperty?: string) {
  const c = compileManifest(manifest(shipProperty));
  if (!c.model) throw new Error(c.diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'));
  return c;
}

function failures(value: unknown): Failure[] {
  const c = compiled();
  const out: Failure[] = [];
  checksOf(c.model!, c.applications)['parcel']!(value, '', out);
  return out;
}

describe('a property with its own definition', () => {
  it('has the type of its definition', () => {
    const c = compiled();
    const file = generatedFile(c.model!, c.applications, 'domain.manifest.yaml', () => 'x');
    expect(file).toContain('readonly address: StreetAddress;');
    expect(file).toContain('readonly address: Address;');
  });

  it('is checked with the check of its definition', () => {
    expect(failures({ address: '1 Main Street', weight: 3 })).toEqual([]);
    // An email address would break the pattern of address; a street address has no pattern.
    expect(failures({ address: 'ab', weight: 3 }).map((f) => [f.definition, f.rule, f.path])).toEqual([['street_address', 'minLength', 'address']]);
    expect(failures({ address: '1 Main Street', weight: 3, contact: { address: 'no' } }).map((f) => [f.definition, f.rule, f.path])).toEqual([['address', 'pattern', 'contact.address']]);
  });

  it('has the type of its definition in a rule', () => {
    const c = compileManifest(manifest().replace('size(self.address) > 5', 'self.address > 5'));
    expect(c.diagnostics.map((d) => d.code)).toContain('rule-type');
  });

  it('is read from a table as a value of its definition', () => {
    const c = compiled();
    const table = Object.fromEntries(
      Object.values(c.model!.definitions).map((d) => [d.name, { base: d.base, ...(d.properties ? { properties: d.properties } : {}), ...(d.propertyTypes ? { propertyTypes: d.propertyTypes } : {}) }]),
    );
    expect(tableValue([['address', 'weight', 'contact.address'], ['1 Main Street', '3', 'a@b']], 'parcel', table)).toEqual({ address: '1 Main Street', weight: 3, contact: { address: 'a@b' } });
  });

  it('names a definition of the manifest', () => {
    const c = compileManifest(manifest('address: postal_address'));
    expect(c.diagnostics.map((d) => [d.code, d.message])).toContainEqual(['unknown-definition', 'postal_address is not a definition of this manifest']);
  });

  it('is one name with one definition', () => {
    const c = compileManifest(manifest('{address: street_address, weight: weight}'));
    expect(c.diagnostics.map((d) => d.code)).toContain('manifest-shape');
  });

  it('is a change of a contract when its definition changes', () => {
    const old = compiled();
    const next = compiled('address');
    expect(classify(old as never, next as never).map((c) => `${c.class}: ${c.message}`)).toContainEqual('compatible: the property address is now of address, not street_address');
  });
});
