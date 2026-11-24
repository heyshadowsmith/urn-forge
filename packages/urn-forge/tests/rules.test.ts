/**
 * Rules where they are applied: the standard set, arguments, and the names each use can read.
 */
import { describe, expect, it } from 'vitest';
import { loadManifest, standard } from '../src/index.js';

const HEADER = 'manifest:\n  namespace: demo\n  domain: shop\n  version: 0.1.0\n';
const DEFINITIONS = `definitions:
  sku:
    description: A SKU
    type: string
  quantity:
    description: A quantity
    type: integer
  price:
    description: A price
    type: number
  line:
    description: A line
    type: object
    properties: [sku, quantity, price]
    rules:
      - required: [sku, quantity]
  bad_line:
    description: A refusal
    type: object
    properties: [sku]
`;

function problems(body: string): string[] {
  return loadManifest(HEADER + DEFINITIONS + body).diagnostics.map((d) => `${d.code} ${d.path.join('.')}: ${d.message}`);
}

describe('the standard set', () => {
  it('loads with no problem, and has the keywords of JSON Schema', () => {
    expect(Object.keys(standard().rules)).toEqual([
      'enum',
      'const',
      'minimum',
      'maximum',
      'exclusiveMinimum',
      'exclusiveMaximum',
      'multipleOf',
      'minLength',
      'maxLength',
      'pattern',
      'format',
      'minItems',
      'maxItems',
      'uniqueItems',
      'required',
    ]);
  });

  it('applies to the types that its rule types for', () => {
    const body = `rules:
  placeholder:
    description: A rule
    rule: 'true'
    message: Never
`;
    expect(problems(body)).toEqual([]);
    const ok = loadManifest(
      HEADER +
        `definitions:
  code:
    description: A code
    type: string
    rules:
      - minLength: 2
      - maxLength: 8
      - pattern: '^[A-Z]+$'
      - enum: [AB, CD]
      - const: AB
  count:
    description: A count
    type: integer
    rules:
      - minimum: 0
      - exclusiveMaximum: 10.5
      - multipleOf: 2
  when:
    description: A time
    type: string
    rules:
      - format: date-time
  codes:
    description: Codes
    type: array
    items: code
    rules:
      - minItems: 1
      - maxItems: 3
      - uniqueItems
`,
    );
    expect(ok.diagnostics).toEqual([]);
  });

  it('refuses a rule that types for another type: enum on an integer', () => {
    const text = HEADER + 'definitions:\n  size:\n    description: A size\n    type: integer\n    rules:\n      - enum: [s, m]\n';
    expect(loadManifest(text).diagnostics.map((d) => d.message)).toEqual([
      'enum: self in choices: in takes a value and a list of that type, or a name and an object, not int and list(string)',
    ]);
  });
});

describe('a use of a rule', () => {
  it('names a rule of the manifest or a standard rule', () => {
    expect(problems('operations:\n  add:\n    description: Add\n    input: line\n    output: [line]\n    rules: [kept]\n')).toEqual([
      'unknown-rule operations.add.rules.0: kept is not a rule of this manifest or a standard rule',
    ]);
  });

  it('gives an argument for each parameter, and none to a rule with no parameter', () => {
    const body = `rules:
  between:
    description: Between low and high
    parameters: [quantity, price]
    rule: self >= quantity && self <= price
    message: Must be between {quantity} and {price}
  positive:
    description: More than 0
    rule: self > 0
    message: Must be more than 0
`;
    const use = (rules: string) =>
      loadManifest(HEADER + DEFINITIONS.replace('  price:\n', `  amount:\n    description: An amount\n    type: integer\n    rules:\n${rules}  price:\n`) + body).diagnostics.map(
        (d) => `${d.code} ${d.path.join('.')}: ${d.message}`,
      );
    expect(use('      - between: { quantity: 1, price: 9.5 }\n      - positive\n')).toEqual([]);
    expect(use('      - between: 1\n')).toEqual([
      'rule-argument definitions.amount.rules.0.between: between: the rule has the parameters quantity, price; give a map of each to its value',
    ]);
    expect(use('      - between: { quantity: 1, cost: 2 }\n')).toEqual([
      'rule-argument definitions.amount.rules.0.between.cost: between: cost is not a parameter; the parameters are quantity, price',
      'rule-argument definitions.amount.rules.0.between: between: the argument has no price',
    ]);
    expect(use('      - between: { quantity: 1.5, price: 2 }\n')).toEqual([
      'rule-argument definitions.amount.rules.0.between.quantity: between: 1.5 is not an integer; quantity is a quantity',
    ]);
    expect(use('      - positive: 1\n')).toEqual(['rule-argument definitions.amount.rules.0.positive: positive: the rule has no parameter; write - positive']);
    expect(use('      - between\n')).toEqual([
      'rule-argument definitions.amount.rules.0: between: the rule has the parameters quantity, price; write - between: <argument>',
    ]);
  });

  it('checks a list argument item by item', () => {
    const text = HEADER + 'definitions:\n  size:\n    description: A size\n    type: string\n    rules:\n      - enum: [s, 2]\n';
    expect(loadManifest(text).diagnostics.map((d) => `${d.path.join('.')}: ${d.message}`)).toEqual([
      'definitions.size.rules.0.enum: enum: 2 is not a string; choices is the values that are allowed',
    ]);
  });
});

describe('the names of a rule', () => {
  const rules = `rules:
  same_sku:
    description: The output has the SKU of the input
    rule: output.sku == input.sku
    message: Another SKU
  has_sku:
    description: The value has a SKU
    rule: "self.sku != ''"
    message: No SKU
`;

  it('are input and output in an output of an operation', () => {
    expect(problems(rules + 'operations:\n  add:\n    description: Add\n    input: line\n    output:\n      - line: [same_sku]\n      - bad_line\n')).toEqual([]);
  });

  it('do not have output in the rules of an operation with two outputs', () => {
    expect(problems(rules + 'operations:\n  add:\n    description: Add\n    input: line\n    output: [line, bad_line]\n    rules: [same_sku]\n')).toEqual([
      'rule-scope operations.add.rules.0: same_sku: output is not a name here; the names are input (applied to the operation add)',
    ]);
  });

  it('are self in a definition', () => {
    expect(problems(rules + 'operations:\n  add:\n    description: Add\n    input: line\n    output:\n      - line: [has_sku]\n')).toEqual([
      'rule-scope operations.add.output.0.line.0: has_sku: self is not a name here; the names are input, output (applied to the output line of add)',
    ]);
  });
});

describe('a rule', () => {
  it('cannot take the name of a standard rule', () => {
    expect(problems('rules:\n  minimum:\n    description: Mine\n    rule: self > 0\n    message: Must be more than 0\n')).toContain(
      'standard-name rules.minimum: minimum is a standard rule; give this rule another name',
    );
  });

  it('names only its parameters in its message', () => {
    expect(problems('rules:\n  positive:\n    description: More than 0\n    rule: self > 0\n    message: Must be more than {bound}\n')).toEqual([
      'invalid-message rules.positive.message: {bound} is not a parameter of positive; the rule has no parameter',
    ]);
  });

  it('gives a bool', () => {
    const text = HEADER + DEFINITIONS + 'rules:\n  twice:\n    description: Twice\n    rule: self * 2\n    message: Twice\n';
    const withUse = text.replace('    type: integer\n', '    type: integer\n    rules: [twice]\n');
    expect(loadManifest(withUse).diagnostics.map((d) => d.message)).toEqual(['twice gives the type int; a rule must give a bool']);
  });
});
