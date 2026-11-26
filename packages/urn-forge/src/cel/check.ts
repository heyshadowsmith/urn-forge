/**
 * The types of a rule, and its guards. Each name and property has a type; each operator, function
 * and macro takes and gives the types of CEL. A property that can be absent is read only after a
 * guard, `has(…)`, that shows it is present: a stricter check than CEL makes, and still valid CEL.
 */
import type { Expr } from './parse.js';
import { print } from './print.js';

export type CelType =
  | { readonly kind: 'int' }
  | { readonly kind: 'double' }
  | { readonly kind: 'string' }
  | { readonly kind: 'bool' }
  | { readonly kind: 'timestamp' }
  | { readonly kind: 'duration' }
  | { readonly kind: 'list'; readonly of: CelType }
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
    case 'object':
      return type.name;
    default:
      return type.kind;
  }
}

function same(a: CelType, b: CelType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'list') return same(a.of, (b as typeof a).of);
  if (a.kind === 'object') return a.name === (b as typeof a).name;
  return true;
}

const isNumber = (type: CelType): boolean => type.kind === 'int' || type.kind === 'double';

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
        if (expr.items.length === 0) return this.problem('rule-type', expr.at, 'an empty list has no type');
        const types = expr.items.map((item) => this.type(item, names, guards));
        if (types.some((t) => t === undefined)) return undefined;
        const first = types[0]!;
        if (!types.every((t) => same(t!, first))) return this.problem('rule-type', expr.at, `the items of ${print(expr)} must have one type`);
        return { kind: 'list', of: first };
      }
      case 'select':
        return this.select(expr, names, guards, false);
      case 'index': {
        const operand = this.type(expr.operand, names, guards);
        const index = this.type(expr.index, names, guards);
        if (!operand || !index) return undefined;
        // A list and an int: the manifest has no map, so no other index.
        return operand.kind === 'list' && index.kind === 'int' ? operand.of : this.wrong(expr, '[ ] takes a list and an int', operand, index);
      }
      case 'unary': {
        const operand = this.type(expr.operand, names, guards);
        if (!operand) return undefined;
        if (expr.op === '!') return operand.kind === 'bool' ? BOOL : this.wrong(expr, '! takes a bool', operand);
        return isNumber(operand) || operand.kind === 'duration' ? operand : this.wrong(expr, '- takes an int, a double or a duration', operand);
      }
      case 'binary':
        return this.binary(expr, names, guards);
      case 'conditional': {
        const condition = this.type(expr.condition, names, guards);
        // Each value can read what the condition shows present, as after && and ||.
        const then = this.type(expr.then, names, new Set([...guards, ...facts(expr.condition, true)]));
        const otherwise = this.type(expr.otherwise, names, new Set([...guards, ...facts(expr.condition, false)]));
        if (!condition || !then || !otherwise) return undefined;
        if (condition.kind !== 'bool') return this.wrong(expr, 'the condition of ?: must be a bool', condition);
        return same(then, otherwise) ? then : this.wrong(expr, 'the two values of ?: must have one type', then, otherwise);
      }
      case 'call':
        return this.call(expr, names, guards);
      case 'macro': {
        const target = this.type(expr.target, names, guards);
        if (!target) return undefined;
        if (target.kind !== 'list') return this.wrong(expr, `${expr.macro}() is a macro of a list`, target);
        if (Object.hasOwn(names, expr.variable)) return this.problem('rule-scope', expr.at, `${expr.variable} is already a name; give each item another name`);
        const body = this.type(expr.body, { ...names, [expr.variable]: target.of }, guards);
        if (!body) return undefined;
        if (expr.macro === 'map') return { kind: 'list', of: body };
        if (body.kind !== 'bool') return this.wrong(expr, `the condition of ${expr.macro}() must be a bool`, body);
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

  private binary(expr: Expr & { kind: 'binary' }, names: Readonly<Record<string, CelType>>, guards: ReadonlySet<string>): CelType | undefined {
    if (expr.op === '&&' || expr.op === '||') {
      const left = this.type(expr.left, names, guards);
      // The right side can read what the left side shows present: has(x) && …, !has(x) || ….
      const right = this.type(expr.right, names, new Set([...guards, ...facts(expr.left, expr.op === '&&')]));
      if (!left || !right) return undefined;
      return left.kind === 'bool' && right.kind === 'bool' ? BOOL : this.wrong(expr, `${expr.op} takes two bools`, left, right);
    }
    const left = this.type(expr.left, names, guards);
    const right = this.type(expr.right, names, guards);
    if (!left || !right) return undefined;
    switch (expr.op) {
      case '==':
      case '!=':
        return same(left, right) || (isNumber(left) && isNumber(right)) ? BOOL : this.wrong(expr, `${expr.op} compares two values of one type`, left, right);
      case '<':
      case '<=':
      case '>':
      case '>=': {
        const ordered = (isNumber(left) && isNumber(right)) || (same(left, right) && ['string', 'timestamp', 'duration'].includes(left.kind));
        return ordered ? BOOL : this.wrong(expr, `${expr.op} compares two numbers, strings, timestamps or durations`, left, right);
      }
      case 'in':
        if (right.kind === 'list' && (same(left, right.of) || (isNumber(left) && isNumber(right.of)))) return BOOL;
        if (right.kind === 'object' && left.kind === 'string') return BOOL;
        return this.wrong(expr, 'in takes a value and a list of that type, or a name and an object', left, right);
      case '+':
        if (same(left, right) && ['int', 'double', 'string', 'list', 'duration'].includes(left.kind)) return left;
        if (left.kind === 'timestamp' && right.kind === 'duration') return TIMESTAMP;
        if (left.kind === 'duration' && right.kind === 'timestamp') return TIMESTAMP;
        return this.wrong(expr, '+ adds two ints, two doubles, two strings, two lists, two durations, or a timestamp and a duration', left, right);
      case '-':
        if (same(left, right) && ['int', 'double', 'duration'].includes(left.kind)) return left;
        if (left.kind === 'timestamp' && right.kind === 'duration') return TIMESTAMP;
        if (left.kind === 'timestamp' && right.kind === 'timestamp') return DURATION;
        return this.wrong(expr, '- takes two ints, two doubles, two durations, a timestamp and a duration, or two timestamps', left, right);
      case '*':
      case '/':
        return same(left, right) && isNumber(left) ? left : this.wrong(expr, `${expr.op} takes two ints or two doubles`, left, right);
      case '%':
        return left.kind === 'int' && right.kind === 'int' ? INT : this.wrong(expr, '% takes two ints', left, right);
    }
  }

  private call(expr: Expr & { kind: 'call' }, names: Readonly<Record<string, CelType>>, guards: ReadonlySet<string>): CelType | undefined {
    if (expr.fn === 'has') {
      const select = expr.args[0] as Expr & { kind: 'select' };
      const type = this.select(select, names, guards, true);
      if (type) this.types.set(select, type);
      return type ? BOOL : undefined;
    }
    const target = expr.target ?? expr.args[0]!;
    const value = this.type(target, names, guards);
    if (!value) return undefined;
    switch (expr.fn) {
      case 'size':
        return value.kind === 'string' || value.kind === 'list' ? INT : this.wrong(expr, 'size() takes a string or a list', value);
      case 'sum':
        return value.kind === 'list' && isNumber(value.of) ? value.of : this.wrong(expr, 'sum() takes a list of ints or doubles', value);
      case 'matches': {
        const pattern = this.type(expr.args[0]!, names, guards);
        if (!pattern) return undefined;
        return value.kind === 'string' && pattern.kind === 'string' ? BOOL : this.wrong(expr, 'matches() takes a string and a regular expression', value, pattern);
      }
      case 'startsWith':
      case 'endsWith':
      case 'contains': {
        const part = this.type(expr.args[0]!, names, guards);
        if (!part) return undefined;
        return value.kind === 'string' && part.kind === 'string' ? BOOL : this.wrong(expr, `${expr.fn}() takes two strings`, value, part);
      }
      case 'split': {
        const separator = this.type(expr.args[0]!, names, guards);
        if (!separator) return undefined;
        return value.kind === 'string' && separator.kind === 'string' ? { kind: 'list', of: STRING } : this.wrong(expr, 'split() takes two strings', value, separator);
      }
      case 'lowerAscii':
      case 'upperAscii':
        return value.kind === 'string' ? STRING : this.wrong(expr, `${expr.fn}() takes a string`, value);
      case 'int':
        return ['int', 'double', 'string'].includes(value.kind) ? INT : this.wrong(expr, 'int() takes an int, a double or a string', value);
      case 'double':
        return ['int', 'double', 'string'].includes(value.kind) ? DOUBLE : this.wrong(expr, 'double() takes an int, a double or a string', value);
      case 'string':
        return ['int', 'double', 'string', 'bool'].includes(value.kind) ? STRING : this.wrong(expr, 'string() takes an int, a double, a string or a bool', value);
      case 'timestamp':
        return value.kind === 'string' ? TIMESTAMP : this.wrong(expr, 'timestamp() takes a string', value);
      case 'duration': {
        // A literal, so that the duration is known: diff and SQL read it.
        const arg = expr.args[0]!;
        if (arg.kind !== 'string') return this.problem('rule-type', expr.at, `duration() takes a literal string, such as duration('2h')`);
        if (!/^(\d+(\.\d+)?(h|m|s|ms|us|ns))+$/.test(arg.value)) {
          return this.problem('rule-type', expr.at, `'${arg.value}' is not a duration; write hours, minutes or seconds, such as '2h', '30m' or '1h30m'`);
        }
        return DURATION;
      }
    }
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
