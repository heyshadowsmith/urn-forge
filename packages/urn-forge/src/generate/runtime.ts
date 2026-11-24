/**
 * The helpers of the generated code. The generator copies this file into each generated file, with
 * no `export`, so that the generated code has no import. It must not import anything.
 */

/** A rule that a value breaks: the definition and the rule, the place of the value, and the message. */
export interface Failure {
  /** The definition whose rule broke, or the operation, for a rule of an operation or an output. */
  readonly definition: string;
  readonly rule: string;
  /** The place of the value: `party_size`, `contact.email`, `dishes[0].amount`, or '' for the whole value. */
  readonly path: string;
  readonly message: string;
}

/** A rule that cannot give a result, such as timestamp() of a text that is not a time. The rule breaks. */
export class RuleError extends Error {}

export function $isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** CEL's ==: the same value, item by item and property by property. */
export function $eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => $eq(item, b[i]));
  if ($isObject(a) && $isObject(b)) {
    const keys = Object.keys(a).filter((k) => a[k] !== undefined);
    const other = Object.keys(b).filter((k) => b[k] !== undefined);
    return keys.length === other.length && keys.every((k) => $eq(a[k], b[k]));
  }
  return false;
}

/** CEL's in: an item of a list, or a property of an object. */
export function $in(value: unknown, container: unknown): boolean {
  if (Array.isArray(container)) return container.some((item) => $eq(item, value));
  return $isObject(container) && typeof value === 'string' && Object.hasOwn(container, value) && container[value] !== undefined;
}

/** CEL's size(): the code points of a string, or the items of a list. */
export function $size(value: unknown): number {
  if (typeof value === 'string') return [...value].length;
  if (Array.isArray(value)) return value.length;
  throw new RuleError('size() of a value that is not a string or a list');
}

/** The total of a list of numbers. */
export function $sum(list: unknown): number {
  if (!Array.isArray(list)) throw new RuleError('sum() of a value that is not a list');
  return list.reduce((total: number, item: number) => total + item, 0);
}

/** CEL's / of two ints: toward 0. A division by 0 is an error. */
export function $divInt(a: number, b: number): number {
  if (b === 0) throw new RuleError('division by 0');
  return Math.trunc(a / b);
}

/** CEL's % of two ints. A division by 0 is an error. */
export function $mod(a: number, b: number): number {
  if (b === 0) throw new RuleError('modulus by 0');
  return a % b;
}

const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/** CEL's timestamp(): a time of RFC 3339, as milliseconds since 1970 in UTC. Any other text is an error. */
export function $timestamp(text: unknown): number {
  const match = typeof text === 'string' ? RFC3339.exec(text) : null;
  if (!match) throw new RuleError(`${JSON.stringify(text)} is not a time`);
  const [, y, mo, d, h, mi, s] = match.map(Number) as number[];
  const date = new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!, s!));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo! - 1 || date.getUTCDate() !== d || h! > 23 || mi! > 59 || s! > 59) {
    throw new RuleError(`${JSON.stringify(text)} is not a time`);
  }
  const ms = Date.parse(text as string);
  if (Number.isNaN(ms)) throw new RuleError(`${JSON.stringify(text)} is not a time`);
  return ms;
}

const PATTERNS = new Map<string, RegExp>();

/** CEL's matches(): the regular expression matches a part of the text. */
export function $matches(text: unknown, pattern: unknown): boolean {
  if (typeof text !== 'string' || typeof pattern !== 'string') throw new RuleError('matches() of a value that is not a string');
  let regex = PATTERNS.get(pattern);
  if (!regex) {
    try {
      regex = new RegExp(pattern, 'u');
    } catch {
      throw new RuleError(`${JSON.stringify(pattern)} is not a regular expression`);
    }
    PATTERNS.set(pattern, regex);
  }
  return regex.test(text);
}

/** CEL's + of two lists, or of two strings or numbers. */
export function $add(a: unknown, b: unknown): unknown {
  if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
  return (a as number) + (b as number);
}

/** The place of a property: `contact.email`. */
export function $at(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}

/** The place of an item: `dishes[0]`. */
export function $item(path: string, index: number): string {
  return `${path}[${index}]`;
}

/** A rule's result: false, or an error, breaks it. */
export function $holds(rule: () => boolean): boolean {
  try {
    return rule() === true;
  } catch (error) {
    if (error instanceof RuleError || error instanceof TypeError) return false;
    throw error;
  }
}
