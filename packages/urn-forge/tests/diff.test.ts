/**
 * diff: each change is breaking or compatible by the side of the value, and the version decides
 * whether the breaking changes are allowed.
 */
import { describe, expect, it } from 'vitest';
import { compileManifest } from '../src/index.js';
import { classify } from '../src/diff/classify.js';
import { allowsBreaking } from '../src/diff/command.js';

const BASE = `manifest:
  namespace: demo
  domain: shop
  version: 1.0.0
definitions:
  quantity:
    description: A quantity
    type: integer
    rules:
      - minimum: 1
      - maximum: 10
  sku:
    description: A SKU
    type: string
  status:
    description: A status
    type: string
    rules:
      - enum: [open, closed]
  note:
    description: A note
    type: string
  order_request:
    description: A request
    type: object
    properties: [sku, quantity]
    rules:
      - required: [sku]
  order:
    description: An order
    type: object
    properties: [sku, quantity, status]
    rules:
      - required: [sku, status]
  refusal:
    description: A refusal
    type: object
    properties: [sku]
rules:
  same_sku:
    description: The order has the SKU of the request
    rule: output.sku == input.sku
    message: Another SKU
  at_least:
    description: At least the limit
    parameters: [quantity]
    rule: self >= quantity
    message: At least {quantity}
operations:
  place:
    description: Place an order
    input: order_request
    output:
      - order: [same_sku]
`;

function changes(edit: (text: string) => string): string[] {
  const old = compileManifest(BASE);
  const next = compileManifest(edit(BASE));
  expect(old.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(next.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return classify(old as never, next as never).map((c) => `${c.class} ${c.place}: ${c.message}`);
}

const ignoreUnknown = (t: string): string => t.replace('  version: 1.0.0\n', '  version: 1.0.0\n  compatibility:\n    callers: ignore-unknown\n');

describe('a rule of a definition', () => {
  it('accepts less on the input: breaking', () => {
    expect(changes((t) => t.replace('- minimum: 1', '- minimum: 2'))).toEqual(['breaking urn:demo:shop:definition:quantity: minimum is now 2, not 1: it accepts less']);
  });

  it('accepts more on the input only: compatible', () => {
    const sentOnly = BASE.replace('properties: [sku, quantity, status]', 'properties: [sku, status]');
    const old = compileManifest(sentOnly);
    const next = compileManifest(sentOnly.replace('- maximum: 10', '- maximum: 20'));
    expect(classify(old as never, next as never).map((c) => `${c.class} ${c.place}: ${c.message}`)).toEqual([
      'compatible urn:demo:shop:definition:quantity: maximum is now 20, not 10: it accepts more',
    ]);
  });

  it('accepts more on the output: breaking, unless callers ignore what they do not know', () => {
    expect(changes((t) => t.replace('[open, closed]', '[open, closed, held]'))).toEqual([
      'breaking urn:demo:shop:definition:status: enum is now ["open","closed","held"], not ["open","closed"]: it accepts more',
    ]);
    const old = compileManifest(ignoreUnknown(BASE));
    const next = compileManifest(ignoreUnknown(BASE).replace('[open, closed]', '[open, closed, held]'));
    expect(classify(old as never, next as never).map((c) => c.class)).toEqual(['compatible']);
  });

  it('is new on a value that is only received: compatible', () => {
    expect(changes((t) => t.replace('      - enum: [open, closed]', '      - enum: [open, closed]\n      - minLength: 4'))).toEqual([
      'compatible urn:demo:shop:definition:status: the rule minLength is new: it accepts less',
    ]);
  });

  it('is removed from a received value: breaking', () => {
    expect(changes((t) => t.replace('      - required: [sku, status]', '      - required: [sku]'))).toEqual([
      'breaking urn:demo:shop:definition:order: required is now ["sku"], not ["sku","status"]: it accepts more',
    ]);
  });

  it('requires more of the input: breaking', () => {
    expect(changes((t) => t.replace('      - required: [sku]\n  order:', '      - required: [sku, quantity]\n  order:'))).toEqual([
      'breaking urn:demo:shop:definition:order_request: required is now ["sku","quantity"], not ["sku"]: it accepts less',
    ]);
  });

  it('of the manifest takes its direction from its form: self >= parameter', () => {
    const use = (n: number) => (t: string) => t.replace('  sku:\n    description: A SKU\n    type: string\n', `  sku:\n    description: A SKU\n    type: string\n`).replace('      - maximum: 10\n', `      - maximum: 10\n      - at_least: ${n}\n`);
    const old = compileManifest(use(1)(BASE));
    const next = compileManifest(use(3)(BASE));
    expect(classify(old as never, next as never).map((c) => `${c.class} ${c.message}`)).toEqual(['breaking at_least is now 3, not 1: it accepts less']);
  });

  it('whose text changes is breaking where it is used', () => {
    expect(changes((t) => t.replace('rule: output.sku == input.sku', 'rule: output.sku != input.sku'))).toEqual([
      'breaking urn:demo:shop:rule:same_sku: the rule is now output.sku != input.sku, not output.sku == input.sku',
    ]);
  });
});

it('calls a change of a definition that no operation uses compatible', () => {
  const withSpare = BASE.replace('  note:\n    description: A note\n    type: string\n', '  note:\n    description: A note\n    type: string\n    rules:\n      - pattern: a\n');
  const old = compileManifest(withSpare);
  const next = compileManifest(withSpare.replace('- pattern: a', '- pattern: b'));
  expect(classify(old as never, next as never).map((c) => `${c.class} ${c.place}`)).toEqual(['compatible urn:demo:shop:definition:note']);
});

describe('an operation', () => {
  it('with a new output: breaking, unless callers ignore what they do not know', () => {
    const add = (t: string) => t.replace('      - order: [same_sku]\n', '      - order: [same_sku]\n      - refusal\n');
    expect(changes(add)).toEqual(['breaking urn:demo:shop:operation:place: the output refusal is new: callers can get an answer that they do not handle']);
    expect(classify(compileManifest(ignoreUnknown(BASE)) as never, compileManifest(add(ignoreUnknown(BASE))) as never).map((c) => c.class)).toEqual(['compatible']);
  });

  it('whose output promises less: breaking; more: compatible', () => {
    expect(changes((t) => t.replace('      - order: [same_sku]', '      - order'))).toEqual(['breaking urn:demo:shop:operation:place: the rule same_sku of the output order is removed: the answer promises less']);
    const none = (t: string) => t.replace('      - order: [same_sku]', '      - order');
    expect(classify(compileManifest(none(BASE)) as never, compileManifest(BASE) as never).map((c) => `${c.class} ${c.message}`)).toEqual([
      'compatible the rule same_sku of the output order is new: the answer promises more',
    ]);
  });

  it('that is removed: breaking; new: compatible', () => {
    const without = BASE.slice(0, BASE.indexOf('operations:'));
    expect(classify(compileManifest(BASE) as never, compileManifest(without) as never).map((c) => `${c.class} ${c.place}`)).toContain('breaking urn:demo:shop:operation:place');
    expect(classify(compileManifest(without) as never, compileManifest(BASE) as never).map((c) => `${c.class} ${c.place}`)).toContain('compatible urn:demo:shop:operation:place');
  });
});

describe('the version', () => {
  it.each([
    ['1.4.0', '1.5.0', false],
    ['1.4.0', '2.0.0', true],
    ['1.4.0', '2.0.0-alpha.1', true],
    ['2.0.0-alpha.1', '2.0.0-alpha.2', true],
    ['0.3.0', '0.4.0', true],
    ['2.0.0', '2.0.1', false],
  ])('from %s to %s allows a breaking change: %s', (from, to, allowed) => {
    expect(allowsBreaking(from, to).allowed).toBe(allowed);
  });
});
