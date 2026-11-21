/**
 * An invariant rule as a TypeScript expression over `p`, the parsed entity (invariants plan,
 * step 3). Each comparison follows its primitive: `decimal` exactly (compareDecimal),
 * `date` as text, `timestamp` as instants, the others with === and the order operators.
 * The rule has passed pass 6, so every field exists and both sides of each operator agree.
 */
import type { Primitive } from '../primitives/index.js';
import type { RuleExpr } from './index.js';

export interface EmittedRule {
  readonly code: string;
  /** Helpers the code calls, by the names of VALIBOT_HELPERS. */
  readonly helpers: ReadonlySet<'decimal' | 'decimalArithmetic'>;
}

const PLAIN_TYPE: { readonly [P in Primitive]: string } = {
  boolean: 'boolean',
  date: 'string',
  decimal: 'string',
  enum: 'string',
  float: 'number',
  integer: 'number',
  string: 'string',
  timestamp: 'string',
};

const JS_OPERATOR: Readonly<Record<string, string>> = { '=': '===', '!=': '!==', '<': '<', '<=': '<=', '>': '>', '>=': '>=' };

export function emitRule(rule: RuleExpr, primitiveOf: (field: string) => Primitive): EmittedRule {
  const helpers = new Set<'decimal' | 'decimalArithmetic'>();

  /** The primitive of a value: a field's, or for a literal the other side's. */
  const typeOf = (e: RuleExpr): Primitive | undefined => {
    if (e.op === 'field') return primitiveOf(e.name);
    if (e.op === '+' || e.op === '-') return typeOf(e.left) ?? typeOf(e.right);
    return undefined;
  };

  const value = (e: RuleExpr, primitive: Primitive): string => {
    switch (e.op) {
      case 'field':
        // Two fields carry different brands, and TypeScript does not compare two brands.
        // The rule has passed pass 6, so the plain type of the primitive is correct here.
        return `(p.${e.name} as ${PLAIN_TYPE[primitive]})`;
      case 'number':
        return primitive === 'decimal' ? JSON.stringify(e.value) : e.value;
      case 'text':
        return JSON.stringify(e.value);
      case 'boolean':
        return String(e.value);
      case '+':
      case '-':
        if (primitive === 'decimal') {
          helpers.add('decimalArithmetic');
          return `${e.op === '+' ? 'addDecimal' : 'subtractDecimal'}(${value(e.left, primitive)}, ${value(e.right, primitive)})`;
        }
        return `(${value(e.left, primitive)} ${e.op} ${value(e.right, primitive)})`;
      default:
        throw new Error(`internal error: ${e.op} is not a value`);
    }
  };

  const condition = (e: RuleExpr): string => {
    switch (e.op) {
      case 'present':
        return `p.${e.field} !== undefined`;
      case 'absent':
        return `p.${e.field} === undefined`;
      case 'not':
        return `!(${condition(e.operand)})`;
      case 'and':
      case 'or':
        return `(${condition(e.left)} ${e.op === 'and' ? '&&' : '||'} ${condition(e.right)})`;
      case '<':
      case '<=':
      case '=':
      case '!=':
      case '>=':
      case '>': {
        const primitive = typeOf(e.left) ?? typeOf(e.right);
        if (primitive === undefined) throw new Error('internal error: a comparison of two literals passed pass 6');
        const [left, right, op] = [value(e.left, primitive), value(e.right, primitive), JS_OPERATOR[e.op]!];
        if (primitive === 'decimal') {
          helpers.add('decimal');
          return `compareDecimal(${left}, ${right}) ${op} 0`;
        }
        if (primitive === 'timestamp') return `Date.parse(${left}) ${op} Date.parse(${right})`;
        return `${left} ${op} ${right}`;
      }
      default:
        throw new Error(`internal error: ${e.op} is not a condition`);
    }
  };

  return { code: condition(rule), helpers };
}
