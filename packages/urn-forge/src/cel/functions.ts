/**
 * The functions and methods of the rule language: CEL's standard functions and its extensions, for
 * the types that a manifest has. Each overload gives the types that it takes and gives, and the
 * helper of the generated code that runs it. The parser, the type checker and the code generator
 * read this table, so a function is added in one place.
 */
import type { CelType } from './check.js';

/** A type in a signature: a type, `T` for any type, or a list of a pattern. */
export type Pattern =
  | { readonly kind: 'int' | 'double' | 'string' | 'bool' | 'timestamp' | 'duration' }
  | { readonly kind: 'list'; readonly of: Pattern }
  | { readonly kind: 'var' };

export interface Overload {
  /** The type of the target of a method; absent for a function. */
  readonly target?: Pattern;
  readonly args: readonly Pattern[];
  readonly result: Pattern;
  /** The helper of runtime.ts that runs it, given the target and the arguments, in that order. */
  readonly helper: string;
  /** The helper also takes the types of the target and the arguments, as a last argument: format() prints 2 and 2.0 apart. */
  readonly typed?: boolean;
}

const P = {
  int: { kind: 'int' },
  double: { kind: 'double' },
  string: { kind: 'string' },
  bool: { kind: 'bool' },
  timestamp: { kind: 'timestamp' },
  duration: { kind: 'duration' },
  T: { kind: 'var' },
} as const satisfies Record<string, Pattern>;
const list = (of: Pattern): Pattern => ({ kind: 'list', of });

const method = (target: Pattern, args: readonly Pattern[], result: Pattern, helper: string): Overload => ({ target, args, result, helper });
const fn = (args: readonly Pattern[], result: Pattern, helper: string): Overload => ({ args, result, helper });

/** The overloads of each name. A name with a dot, such as `math.greatest`, is a function of a namespace. */
export const FUNCTIONS: Readonly<Record<string, readonly Overload[]>> = {
  size: [fn([P.string], P.int, '$size'), fn([list(P.T)], P.int, '$size'), method(P.string, [], P.int, '$size'), method(list(P.T), [], P.int, '$size')],
  sum: [method(list(P.int), [], P.int, '$sum'), method(list(P.double), [], P.double, '$sum')],
  matches: [method(P.string, [P.string], P.bool, '$matches'), fn([P.string, P.string], P.bool, '$matches')],
  startsWith: [method(P.string, [P.string], P.bool, '$startsWith')],
  endsWith: [method(P.string, [P.string], P.bool, '$endsWith')],
  contains: [method(P.string, [P.string], P.bool, '$contains')],
  split: [method(P.string, [P.string], list(P.string), '$split'), method(P.string, [P.string, P.int], list(P.string), '$split')],
  charAt: [method(P.string, [P.int], P.string, '$charAt')],
  indexOf: [method(P.string, [P.string], P.int, '$indexOf'), method(P.string, [P.string, P.int], P.int, '$indexOf')],
  lastIndexOf: [method(P.string, [P.string], P.int, '$lastIndexOf'), method(P.string, [P.string, P.int], P.int, '$lastIndexOf')],
  replace: [method(P.string, [P.string, P.string], P.string, '$replace'), method(P.string, [P.string, P.string, P.int], P.string, '$replace')],
  substring: [method(P.string, [P.int], P.string, '$substring'), method(P.string, [P.int, P.int], P.string, '$substring')],
  trim: [method(P.string, [], P.string, '$trim')],
  join: [method(list(P.string), [], P.string, '$join'), method(list(P.string), [P.string], P.string, '$join')],
  reverse: [method(P.string, [], P.string, '$reverse')],
  format: [{ ...method(P.string, [list(P.T)], P.string, '$format'), typed: true }],
  'strings.quote': [fn([P.string], P.string, '$quote')],
  lowerAscii: [method(P.string, [], P.string, '$lowerAscii')],
  upperAscii: [method(P.string, [], P.string, '$upperAscii')],
  int: [fn([P.int], P.int, '$int'), fn([P.double], P.int, '$int'), fn([P.string], P.int, '$int'), fn([P.timestamp], P.int, '$intOfTimestamp')],
  double: [fn([P.double], P.double, '$double'), fn([P.int], P.double, '$double'), fn([P.string], P.double, '$double')],
  string: [
    fn([P.string], P.string, '$string'),
    fn([P.int], P.string, '$string'),
    fn([P.double], P.string, '$string'),
    fn([P.bool], P.string, '$string'),
  ],
  bool: [fn([P.bool], P.bool, '$bool'), fn([P.string], P.bool, '$bool')],
  timestamp: [fn([P.string], P.timestamp, '$timestamp'), fn([P.timestamp], P.timestamp, '$timestamp'), fn([P.int], P.timestamp, '$timestampOfInt')],
};

/** The numbers of arguments that a name takes, as a method or as a function. */
export function arities(name: string, asMethod: boolean): number[] {
  return [...new Set((FUNCTIONS[name] ?? []).filter((o) => (o.target !== undefined) === asMethod).map((o) => o.args.length))];
}

/** Whether a type fits a pattern, with `T` bound once. A type `any` (an empty list's item) fits each pattern. */
function fits(pattern: Pattern, type: CelType, bound: { T?: CelType }): boolean {
  if (type.kind === 'any') return true;
  if (pattern.kind === 'var') {
    if (bound.T === undefined || bound.T.kind === 'any') {
      bound.T = type;
      return true;
    }
    return sameType(bound.T, type);
  }
  if (pattern.kind === 'list') return type.kind === 'list' && fits(pattern.of, type.of, bound);
  return pattern.kind === type.kind;
}

function sameType(a: CelType, b: CelType): boolean {
  if (a.kind === 'any' || b.kind === 'any') return true;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'list') return sameType(a.of, (b as typeof a).of);
  if (a.kind === 'object') return a.name === (b as typeof a).name;
  return true;
}

function instance(pattern: Pattern, bound: { T?: CelType }): CelType {
  if (pattern.kind === 'var') return bound.T ?? { kind: 'any' };
  if (pattern.kind === 'list') return { kind: 'list', of: instance(pattern.of, bound) };
  return pattern;
}

/** The first overload that takes these types, and the type that it gives. */
export function resolve(name: string, target: CelType | undefined, args: readonly CelType[]): { readonly overload: Overload; readonly result: CelType } | undefined {
  for (const overload of FUNCTIONS[name] ?? []) {
    if ((overload.target === undefined) !== (target === undefined) || overload.args.length !== args.length) continue;
    const bound: { T?: CelType } = {};
    if (overload.target && !fits(overload.target, target!, bound)) continue;
    if (!overload.args.every((p, i) => fits(p, args[i]!, bound))) continue;
    return { overload, result: instance(overload.result, bound) };
  }
  return undefined;
}

/** The types that a name takes, for a message: `string.startsWith(string)`. */
export function signatures(name: string): string {
  const show = (p: Pattern): string => (p.kind === 'var' ? 'T' : p.kind === 'list' ? `list(${show(p.of)})` : p.kind);
  return (FUNCTIONS[name] ?? []).map((o) => `${o.target ? `${show(o.target)}.` : ''}${name}(${o.args.map(show).join(', ')})`).join(', ');
}
