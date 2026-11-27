/**
 * The types of a rule, and its guards. Each name and property has a type; each operator, function
 * and macro takes and gives the types of CEL. A property that can be absent is read only after a
 * guard, `has(…)`, that shows it is present: a stricter check than CEL makes, and still valid CEL.
 */
import { resolve, signatures } from './functions.js';
import type { Expr } from './parse.js';
import { durationMs, MAX_DURATION_MS } from './time.js';
import { print } from './print.js';

export type CelType =
  | { readonly kind: 'int' }
  | { readonly kind: 'double' }
  | { readonly kind: 'string' }
  | { readonly kind: 'bool' }
  | { readonly kind: 'timestamp' }
  | { readonly kind: 'duration' }
  | { readonly kind: 'list'; readonly of: CelType }
  /** A map with string keys: the type of each value. */
  | { readonly kind: 'map'; readonly of: CelType }
  /** The item of an empty list, `[]`: it fits each type. */
  | { readonly kind: 'any' }
  /** A tagged union: the name of its definition. Its tag tells its variant. */
  | { readonly kind: 'union'; readonly name: string }
  /** An object: the name of the definition that declares its properties. */
  | { readonly kind: 'object'; readonly name: string };

export const INT: CelType = { kind: 'int' };
export const DOUBLE: CelType = { kind: 'double' };
export const STRING: CelType = { kind: 'string' };
export const BOOL: CelType = { kind: 'bool' };
export const TIMESTAMP: CelType = { kind: 'timestamp' };
export const DURATION: CelType = { kind: 'duration' };

/** A property of an object: its type, and whether it can be absent. */
export interface PropertyType {
  readonly type: CelType;
  readonly optional: boolean;
}

/** What a rule can read: its names, and the properties of each object. */
export interface Scope {
  readonly names: Readonly<Record<string, CelType>>;
  readonly properties: (object: string) => Readonly<Record<string, PropertyType>> | undefined;
  /** The tag of a tagged union, and the object variant of each value of the tag. */
  readonly union?: (name: string) => { readonly tag: string; readonly variants: Readonly<Record<string, string>> } | undefined;
}

/** A problem in a rule: `rule-type`, `rule-guard` or `rule-scope`, with the offset of the node. */
export interface RuleProblem {
  readonly code: 'rule-type' | 'rule-guard' | 'rule-scope';
  readonly message: string;
  readonly at: number;
}

export function showType(type: CelType): string {
  switch (type.kind) {
    case 'list':
      return `list(${showType(type.of)})`;
    case 'map':
      return `map(string, ${showType(type.of)})`;
    case 'object':
      return type.name;
    default:
      return type.kind;
  }
}

function same(a: CelType, b: CelType): boolean {
  if (a.kind === 'any' || b.kind === 'any') return true;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'list' || a.kind === 'map') return same(a.of, (b as typeof a).of);
  if (a.kind === 'object' || a.kind === 'union') return a.name === (b as typeof a).name;
  return true;
}

const isNumber = (type: CelType): boolean => type.kind === 'int' || type.kind === 'double' || type.kind === 'any';

/** The more exact of two types that are the same: list(int) rather than list(any). */
function merge(a: CelType, b: CelType): CelType {
  if (a.kind === 'any') return b;
  if (a.kind === 'list' && b.kind === 'list') return { kind: 'list', of: merge(a.of, b.of) };
  return a;
}

/** The text of a chain of names and properties, `self.contact.email`, which a guard names. */
function chain(expr: Expr): string | undefined {
  if (expr.kind === 'name') return expr.name;
  if (expr.kind === 'select') {
    const operand = chain(expr.operand);
    return operand === undefined ? undefined : `${operand}.${expr.field}`;
  }
  return undefined;
}

/** The properties shown present when `expr` is `when`: from has(), &&, || and !. */
function facts(expr: Expr, when: boolean): Set<string> {
  if (expr.kind === 'call' && expr.fn === 'has' && when) {
    const name = chain(expr.args[0]!);
    return new Set(name === undefined ? [] : [name]);
  }
  // x.tag == 'v' shows the variant of a tagged union: x.tag=v. So does x.tag != 'v' when it is false.
  if (expr.kind === 'binary' && expr.op === (when ? '==' : '!=') && expr.left.kind === 'select' && expr.right.kind === 'string') {
    const name = chain(expr.left);
    return new Set(name === undefined ? [] : [`${name}=${expr.right.value}`]);
  }
  if (expr.kind === 'unary' && expr.op === '!') return facts(expr.operand, !when);
  if (expr.kind === 'binary' && expr.op === (when ? '&&' : '||')) return new Set([...facts(expr.left, when), ...facts(expr.right, when)]);
  return new Set();
}

class Checker {
  readonly problems: RuleProblem[] = [];
  /** The type of each node that typed, for the code generator: `/` on two ints is a division of ints. */
  readonly types = new Map<Expr, CelType>();

  constructor(private readonly scope: Scope) {}

  private problem(code: RuleProblem['code'], at: number, message: string): undefined {
    this.problems.push({ code, message, at });
    return undefined;
  }

  /** The type of `expr`, or undefined after a problem. `guards` are the properties shown present. */
  type(expr: Expr, names: Readonly<Record<string, CelType>>, guards: ReadonlySet<string>): CelType | undefined {
    const type = this.infer(expr, names, guards);
    if (type) this.types.set(expr, type);
    return type;
  }

  private infer(expr: Expr, names: Readonly<Record<string, CelType>>, guards: ReadonlySet<string>): CelType | undefined {
    switch (expr.kind) {
      case 'int':
        return INT;
      case 'double':
        return DOUBLE;
      case 'string':
        return STRING;
      case 'bool':
        return BOOL;
      case 'name':
        if (Object.hasOwn(names, expr.name)) return names[expr.name];
        return this.problem('rule-scope', expr.at, `${expr.name} is not a name here; the names are ${Object.keys(names).join(', ') || 'none'}`);
      case 'list': {
        const types = expr.items.map((item) => this.type(item, names, guards));
        if (types.some((t) => t === undefined)) return undefined;
        const first = types.reduce<CelType>((a, t) => merge(a, t!), { kind: 'any' });
        if (!types.every((t) => same(t!, first))) return this.problem('rule-type', expr.at, `the items of ${print(expr)} must have one type`);
        return { kind: 'list', of: first };
      }
      case 'select':
        return this.select(expr, names, guards, false);
      case 'index': {
        const operand = this.type(expr.operand, names, guards);
        const index = this.type(expr.index, names, guards);
        if (!operand || !index) return undefined;
        // A map and a string key; a list and an int.
        if (operand.kind === 'map') return index.kind === 'string' || index.kind === 'any' ? operand.of : this.wrong(expr, '[ ] of a map takes a string key', operand, index);
        return (operand.kind === 'list' || operand.kind === 'any') && (index.kind === 'int' || index.kind === 'any') ? (operand.kind === 'list' ? operand.of : operand) : this.wrong(expr, '[ ] takes a list and an int', operand, index);
      }
      case 'unary': {
        const operand = this.type(expr.operand, names, guards);
        if (!operand) return undefined;
        if (operand.kind === 'any') return operand;
        if (expr.op === '!') return operand.kind === 'bool' ? BOOL : this.wrong(expr, '! takes a bool', operand);
        return isNumber(operand) || operand.kind === 'duration' ? operand : this.wrong(expr, '- takes an int, a double or a duration', operand);
      }
      case 'binary':
        return this.binary(expr, names, guards);
      case 'bind': {
        // A name of cel.bind() can hide a name of the scope, as in CEL.
        const value = this.type(expr.value, names, guards);
        if (!value) return undefined;
        return this.type(expr.body, { ...names, [expr.name]: value }, guards);
      }
      case 'conditional': {
        const condition = this.type(expr.condition, names, guards);
        // Each value can read what the condition shows present, as after && and ||.
        const then = this.type(expr.then, names, new Set([...guards, ...facts(expr.condition, true)]));
        const otherwise = this.type(expr.otherwise, names, new Set([...guards, ...facts(expr.condition, false)]));
        if (!condition || !then || !otherwise) return undefined;
        if (condition.kind !== 'bool') return this.wrong(expr, 'the condition of ?: must be a bool', condition);
        return same(then, otherwise) ? merge(then, otherwise) : this.wrong(expr, 'the two values of ?: must have one type', then, otherwise);
      }
      case 'call':
        return this.call(expr, names, guards);
      case 'macro': {
        const target = this.type(expr.target, names, guards);
        if (!target) return undefined;
        // A macro of a map runs over its keys, as in CEL.
        if (target.kind === 'map' && !['all', 'exists', 'exists_one'].includes(expr.macro)) return this.wrong(expr, `${expr.macro}() is a macro of a list; of a map, all(), exists() and exists_one() run over its keys`, target);
        if (target.kind !== 'list' && target.kind !== 'any' && target.kind !== 'map') return this.wrong(expr, `${expr.macro}() is a macro of a list or a map`, target);
        for (const name of [expr.variable, ...(expr.index !== undefined ? [expr.index] : [])]) {
          if (Object.hasOwn(names, name)) return this.problem('rule-scope', expr.at, `${name} is already a name; give each item another name`);
        }
        if (expr.index === expr.variable) return this.problem('rule-scope', expr.at, `${expr.index} names both the position and the item`);
        const inner = { ...names, [expr.variable]: target.kind === 'list' ? target.of : target.kind === 'map' ? STRING : target, ...(expr.index !== undefined ? { [expr.index]: INT } : {}) };
        if (expr.filter) {
          const filter = this.type(expr.filter, inner, guards);
          if (!filter) return undefined;
          if (filter.kind !== 'bool' && filter.kind !== 'any') return this.wrong(expr, `the condition of ${expr.macro}() must be a bool`, filter);
        }
        const body = this.type(expr.body, inner, guards);
        if (!body) return undefined;
        if (expr.macro === 'map' || expr.macro === 'transformList') return { kind: 'list', of: body };
        if (body.kind !== 'bool' && body.kind !== 'any') return this.wrong(expr, `the condition of ${expr.macro}() must be a bool`, body);
        // filter() keeps the items for which the condition is true: a list of the same type.
        return expr.macro === 'filter' ? target : BOOL;
      }
    }
  }

  private wrong(expr: Expr, rule: string, ...types: CelType[]): undefined {
    return this.problem('rule-type', expr.at, `${print(expr)}: ${rule}, not ${types.map(showType).join(' and ')}`);
  }

  /** `a.b`: a property of an object. Inside has(), the last property needs no guard. */
  private select(expr: Expr & { kind: 'select' }, names: Readonly<Record<string, CelType>>, guards: ReadonlySet<string>, inHas: boolean): CelType | undefined {
    const operand = this.type(expr.operand, names, guards);
    if (!operand) return undefined;
    if (operand.kind === 'union') return this.variantProperty(expr, operand.name, guards);
    if (operand.kind !== 'object') return this.problem('rule-type', expr.at, `${print(expr.operand)} is a ${showType(operand)}, which has no property ${expr.field}`);
    const property = this.scope.properties(operand.name)?.[expr.field];
    if (!property) {
      const known = Object.keys(this.scope.properties(operand.name) ?? {});
      return this.problem('rule-type', expr.at, `${expr.field} is not a property of ${operand.name}; the properties are ${known.join(', ')}`);
    }
    if (inHas && !property.optional) return this.problem('rule-type', expr.at, `has(${print(expr)}) is always true: ${expr.field} is required`);
    if (!inHas && property.optional) {
      const name = chain(expr);
      if (name === undefined || !guards.has(name)) {
        return this.problem('rule-guard', expr.at, `${print(expr)} can be absent: read it after has(${print(expr)}) &&, or after !has(${print(expr)}) ||`);
      }
    }
    return property.type;
  }

  /** A property of a tagged union: its tag at any time; another property only after a test of the tag shows a variant that has it. */
  private variantProperty(expr: Expr & { kind: 'select' }, union: string, guards: ReadonlySet<string>): CelType | undefined {
    const info = this.scope.union?.(union);
    if (!info) return this.problem('rule-type', expr.at, `${print(expr.operand)} is a ${union}, which has no property ${expr.field}`);
    const variants = Object.entries(info.variants);
    if (expr.field === info.tag) return this.scope.properties(variants[0]![1])?.[info.tag]?.type;
    const operand = chain(expr.operand);
    const shown = variants.find(([value]) => operand !== undefined && guards.has(`${operand}.${info.tag}=${value}`));
    if (!shown) {
      const having = variants.filter(([, v]) => this.scope.properties(v)?.[expr.field]).map(([value]) => `${print(expr.operand)}.${info.tag} == '${value}'`);
      if (having.length === 0) return this.problem('rule-type', expr.at, `${expr.field} is not a property of a variant of ${union}`);
      return this.problem('rule-guard', expr.at, `${print(expr)} is a property of one variant of ${union}: read it after ${having.join(' or ')} &&`);
    }
    const property = this.scope.properties(shown[1])?.[expr.field];
    if (!property) return this.problem('rule-type', expr.at, `${expr.field} is not a property of ${shown[1]}, the variant of ${print(expr.operand)}.${info.tag} == '${shown[0]}'`);
    if (property.optional) {
      const name = chain(expr);
      if (name === undefined || !guards.has(name)) return this.problem('rule-guard', expr.at, `${print(expr)} can be absent: read it after has(${print(expr)}) &&, or after !has(${print(expr)}) ||`);
    }
    return property.type;
  }

  private binary(expr: Expr & { kind: 'binary' }, names: Readonly<Record<string, CelType>>, guards: ReadonlySet<string>): CelType | undefined {
    if (expr.op === '&&' || expr.op === '||') {
      const left = this.type(expr.left, names, guards);
      // The right side can read what the left side shows present: has(x) && …, !has(x) || ….
      const right = this.type(expr.right, names, new Set([...guards, ...facts(expr.left, expr.op === '&&')]));
      if (!left || !right) return undefined;
      return (left.kind === 'bool' || left.kind === 'any') && (right.kind === 'bool' || right.kind === 'any') ? BOOL : this.wrong(expr, `${expr.op} takes two bools`, left, right);
    }
    const typedLeft = this.type(expr.left, names, guards);
    const typedRight = this.type(expr.right, names, guards);
    if (!typedLeft || !typedRight) return undefined;
    // An item of an empty list takes the type of the other side.
    const left = typedLeft.kind === 'any' ? typedRight : typedLeft;
    const right = typedRight.kind === 'any' ? left : typedRight;
    switch (expr.op) {
      case '==':
      case '!=':
        return same(left, right) || (isNumber(left) && isNumber(right)) ? BOOL : this.wrong(expr, `${expr.op} compares two values of one type`, left, right);
      case '<':
      case '<=':
      case '>':
      case '>=': {
        const ordered = (isNumber(left) && isNumber(right)) || (same(left, right) && ['string', 'bool', 'timestamp', 'duration', 'any'].includes(left.kind));
        return ordered ? BOOL : this.wrong(expr, `${expr.op} compares two numbers, strings, bools, timestamps or durations`, left, right);
      }
      case 'in':
        if (right.kind === 'any') return BOOL;
        if (right.kind === 'list' && (same(left, right.of) || (isNumber(left) && isNumber(right.of)))) return BOOL;
        if ((right.kind === 'object' || right.kind === 'map') && left.kind === 'string') return BOOL;
        return this.wrong(expr, 'in takes a value and a list of that type, a key and a map, or a name and an object', left, right);
      case '+':
        if (same(left, right) && ['int', 'double', 'string', 'list', 'duration', 'any'].includes(left.kind)) return merge(left, right);
        if (left.kind === 'timestamp' && right.kind === 'duration') return TIMESTAMP;
        if (left.kind === 'duration' && right.kind === 'timestamp') return TIMESTAMP;
        return this.wrong(expr, '+ adds two ints, two doubles, two strings, two lists, two durations, or a timestamp and a duration', left, right);
      case '-':
        if (same(left, right) && ['int', 'double', 'duration', 'any'].includes(left.kind)) return left;
        if (left.kind === 'timestamp' && right.kind === 'duration') return TIMESTAMP;
        if (left.kind === 'timestamp' && right.kind === 'timestamp') return DURATION;
        return this.wrong(expr, '- takes two ints, two doubles, two durations, a timestamp and a duration, or two timestamps', left, right);
      case '*':
      case '/':
        return same(left, right) && isNumber(left) ? left : this.wrong(expr, `${expr.op} takes two ints or two doubles`, left, right);
      case '%':
        return (left.kind === 'int' || left.kind === 'any') && (right.kind === 'int' || right.kind === 'any') ? INT : this.wrong(expr, '% takes two ints', left, right);
    }
  }

  private call(expr: Expr & { kind: 'call' }, names: Readonly<Record<string, CelType>>, guards: ReadonlySet<string>): CelType | undefined {
    if (expr.fn === 'has') {
      const select = expr.args[0] as Expr & { kind: 'select' };
      const type = this.select(select, names, guards, true);
      if (type) this.types.set(select, type);
      return type ? BOOL : undefined;
    }
    if (expr.fn === 'duration') {
      // A literal, so that the duration is known: diff and SQL read it.
      const arg = expr.args[0]!;
      if (arg.kind !== 'string') {
        const type = this.type(arg, names, guards);
        if (type?.kind === 'duration') return DURATION;
        return this.problem('rule-type', expr.at, `duration() takes a literal string, such as duration('2h')`);
      }
      if (!/^-?(\d+(\.\d+)?(h|m|s|ms|us|ns))+$/.test(arg.value)) {
        return this.problem('rule-type', expr.at, `'${arg.value}' is not a duration; write hours, minutes or seconds, such as '2h', '30m' or '1h30m'`);
      }
      if (Math.abs(durationMs(arg.value)) > MAX_DURATION_MS) return this.problem('rule-type', expr.at, `'${arg.value}' is longer than CEL's longest duration, about 10000 years`);
      return DURATION;
    }
    const target = expr.target ? this.type(expr.target, names, guards) : undefined;
    const args = expr.args.map((arg) => this.type(arg, names, guards));
    if (expr.fn === 'flatten' && expr.args.length === 1 && target) {
      // The type depends on the depth, so the depth is a literal, as the depth of a list is known.
      const depth = expr.args[0]!;
      if (depth.kind !== 'int') return this.problem('rule-type', expr.at, 'flatten() takes a literal depth, such as flatten(2)');
      if (depth.value < 0) return this.problem('rule-type', expr.at, 'flatten() takes a depth of 0 or more');
      let type = target;
      for (let level = 0; level < depth.value && type.kind === 'list' && type.of.kind === 'list'; level++) type = type.of;
      return type;
    }
    if ((expr.target && !target) || args.some((a) => a === undefined)) return undefined;
    const resolved = resolve(expr.fn, target, args as CelType[]);
    if (resolved) return resolved.result;
    const given = [...(target ? [target] : []), ...(args as CelType[])];
    // Numbers of two types, such as math.greatest(1, 2.5), need a dynamic type in CEL.
    if (given.length > 1 && given.every(isNumber) && !given.every((t) => same(t, given[0]!))) {
      return this.problem('rule-type', expr.at, `${print(expr)}: the arguments of ${expr.fn}() must have one type`);
    }
    return this.wrong(expr, `${expr.fn}() takes ${signatures(expr.fn)}`, ...given);
  }
}

/** The type of a rule in a scope, and its problems. */
export function checkRule(
  expr: Expr,
  scope: Scope,
): { readonly type: CelType | undefined; readonly problems: readonly RuleProblem[]; readonly types: ReadonlyMap<Expr, CelType> } {
  const checker = new Checker(scope);
  const type = checker.type(expr, scope.names, new Set());
  return { type, problems: checker.problems, types: checker.types };
}
