/**
 * An invariant rule as a TypeScript expression over `p`, the parsed entity. Each comparison follows its primitive: `decimal` exactly (compareDecimal),
 * `date` as text (or as day numbers when the rule counts days), `timestamp` as instants,
 * the others with === and the order operators.
 * The rule has passed pass 6, so every field exists and both sides of each operator agree.
 */
import type { Primitive } from '../primitives/index.js';
import { hasDateArithmetic, itemPrimitives, UNIT_MS, valueType, type RuleExpr } from './index.js';

export interface EmittedRule {
  readonly code: string;
  /** Helpers the code calls, by the names of VALIBOT_HELPERS. */
  readonly helpers: ReadonlySet<'decimal' | 'decimalArithmetic' | 'days'>;
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

/** One property of an embedded entity, for the equality of two of them. */
export interface EmbeddedProperty {
  readonly name: string;
  readonly required: boolean;
  /** The property holds an embedded entity, compared in its turn. */
  readonly embedded: boolean;
}

/**
 * `propertiesOf` gives the properties of an embedded entity by the name of a property that holds
 * one (`output.plan`), so `=` between two of them compares each property; undefined for a value.
 */
export function emitRule(
  rule: RuleExpr,
  outerPrimitiveOf: (field: string) => Primitive,
  propertiesOf: (field: string) => readonly EmbeddedProperty[] | undefined = () => undefined,
): EmittedRule {
  const helpers = new Set<'decimal' | 'decimalArithmetic' | 'days'>();
  // Inside a sum, the item's names: a local variable, and the primitives of the list's items.
  let primitiveOf = outerPrimitiveOf;
  const bound = new Set<string>();
  /** A name in the code: a property of p, or of the item of an enclosing sum. */
  const ref = (name: string) => {
    const [head, ...rest] = name.split('.');
    // After the first name (a prefix, an item or a property), each step may be absent: read it with ?.
    const path = [head, ...rest.map((part, i) => (i === 0 && (bound.has(head!) || ['input', 'current', 'output'].includes(head!)) ? `.${part}` : `?.${part}`))].join('');
    return bound.has(head!) ? path : `p.${path}`;
  };

  /** The primitive of a value: a field's or an arithmetic's; undefined for a literal. */
  const typeOf = (e: RuleExpr): Primitive | undefined => valueType(e, primitiveOf);

  /** A date as a day number: a field, a date text, or a date ± days. */
  const days = (e: RuleExpr): string => {
    helpers.add('days');
    switch (e.op) {
      case 'field':
        return `epochDay((${ref(e.name)} as string))`;
      case 'text':
        return `epochDay(${JSON.stringify(e.value)})`;
      case '+':
      case '-':
        return `(${days(e.left)} ${e.op} ${value(e.right, 'integer')})`;
      default:
        throw new Error(`internal error: ${e.op} is not a date`);
    }
  };

  /** A timestamp as milliseconds since the epoch: a field, a timestamp text, or a timestamp ± a time. Exact, as each is UTC. */
  const instant = (e: RuleExpr): string => {
    if ((e.op === '+' || e.op === '-') && e.right.op === 'duration') {
      return `(${instant(e.left)} ${e.op} ${value(e.right.value, 'integer')} * ${UNIT_MS[e.right.unit]})`;
    }
    return `Date.parse(${value(e, 'timestamp')})`;
  };

  const value = (e: RuleExpr, primitive: Primitive): string => {
    switch (e.op) {
      case 'field':
        // Two fields carry different brands, and TypeScript does not compare two brands.
        // The rule has passed pass 6, so the plain type of the primitive is correct here.
        return `(${ref(e.name)} as ${PLAIN_TYPE[primitive]})`;
      case 'number':
        return primitive === 'decimal' ? JSON.stringify(e.value) : e.value;
      case 'text':
        return JSON.stringify(e.value);
      case 'boolean':
        return String(e.value);
      case '+':
      case '-':
        // A timestamp ± a time: compared as instants, so its value here is the instant as text.
        if (e.right.op === 'duration') return `new Date(${instant(e)}).toISOString()`;
        // The days between two dates: a date (or a date text) minus a date.
        if (primitive === 'integer' && (typeOf(e.left) === 'date' || typeOf(e.right) === 'date')) return `(${days(e.left)} - ${days(e.right)})`;
        if (primitive === 'decimal') {
          helpers.add('decimalArithmetic');
          return `${e.op === '+' ? 'addDecimal' : 'subtractDecimal'}(${value(e.left, primitive)}, ${value(e.right, primitive)})`;
        }
        return `(${value(e.left, primitive)} ${e.op} ${value(e.right, primitive)})`;
      case '*': {
        // An integer times an integer, or an integer times a decimal: exact.
        if (primitive === 'integer') return `(${value(e.left, 'integer')} * ${value(e.right, 'integer')})`;
        helpers.add('decimalArithmetic');
        const side = (x: RuleExpr) => {
          const own = x.op === 'number' ? (x.value.includes('.') ? 'decimal' : 'integer') : typeOf(x);
          return own === 'integer' ? `String(${value(x, 'integer')})` : value(x, 'decimal');
        };
        return `multiplyDecimal(${side(e.left)}, ${side(e.right)})`;
      }
      case 'sum': {
        // The total over the items; an absent list adds up to 0.
        const list = `((${ref(e.list)} ?? []) as readonly any[])`;
        const outer = primitiveOf;
        primitiveOf = itemPrimitives(e, outer);
        bound.add(e.item);
        const item = value(e.value, primitive);
        bound.delete(e.item);
        primitiveOf = outer;
        if (primitive === 'decimal') {
          helpers.add('decimalArithmetic');
          return `${list}.reduce((total: string, ${e.item}) => addDecimal(total, ${item}), '0')`;
        }
        return `${list}.reduce((total: number, ${e.item}) => total + ${item}, 0)`;
      }
      default:
        throw new Error(`internal error: ${e.op} is not a value`);
    }
  };

  const condition = (e: RuleExpr): string => {
    switch (e.op) {
      case 'present':
        return `${ref(e.field)} !== undefined`;
      case 'absent':
        return `${ref(e.field)} === undefined`;
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
        // Two embedded entities: each property, with the comparison of its primitive.
        if ((e.op === '=' || e.op === '!=') && e.left.op === 'field' && e.right.op === 'field' && propertiesOf(e.left.name)) {
          const same = equal(ref(e.left.name), ref(e.right.name), e.left.name);
          return e.op === '=' ? same : `!${same}`;
        }
        const primitive = typeOf(e.left) ?? typeOf(e.right);
        if (primitive === undefined) throw new Error('internal error: a comparison of two literals passed pass 6');
        // A date with days in it compares as day numbers; two plain dates still compare as text.
        if (primitive === 'date' && (hasDateArithmetic(e.left, primitiveOf) || hasDateArithmetic(e.right, primitiveOf))) {
          return `${days(e.left)} ${JS_OPERATOR[e.op]!} ${days(e.right)}`;
        }
        const [left, right, op] = [value(e.left, primitive), value(e.right, primitive), JS_OPERATOR[e.op]!];
        if (primitive === 'decimal') {
          helpers.add('decimal');
          return `compareDecimal(${left}, ${right}) ${op} 0`;
        }
        if (primitive === 'timestamp') {
          // A time added to a timestamp compares as milliseconds; plain timestamps as before.
          const timed = (x: RuleExpr) => (x.op === '+' || x.op === '-') && x.right.op === 'duration';
          if (timed(e.left) || timed(e.right)) return `${instant(e.left)} ${op} ${instant(e.right)}`;
          return `Date.parse(${left}) ${op} Date.parse(${right})`;
        }
        return `${left} ${op} ${right}`;
      }
      default:
        throw new Error(`internal error: ${e.op} is not a condition`);
    }
  };

  /** Two embedded entities at `a` and `b` in the code, of the entity of the property `name`: equal property by property. */
  function equal(a: string, b: string, name: string): string {
    const parts = propertiesOf(name)!.map((property) => {
      const [x, y, path] = [`${a}.${property.name}`, `${b}.${property.name}`, `${name}.${property.name}`];
      let same: string;
      if (property.embedded) same = equal(x, y, path);
      else {
        const primitive = primitiveOf(path);
        const [l, r] = [`(${x} as ${PLAIN_TYPE[primitive]})`, `(${y} as ${PLAIN_TYPE[primitive]})`];
        if (primitive === 'decimal') {
          helpers.add('decimal');
          same = `compareDecimal(${l}, ${r}) === 0`;
        } else same = primitive === 'timestamp' ? `Date.parse(${l}) === Date.parse(${r})` : `${l} === ${r}`;
      }
      return property.required ? same : `(${x} === undefined ? ${y} === undefined : ${y} !== undefined && ${same})`;
    });
    return `(${parts.length === 0 ? 'true' : parts.join(' && ')})`;
  }

  return { code: condition(rule), helpers };
}
