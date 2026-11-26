/**
 * The helpers of the generated code. The generator copies this file into each generated file, with
 * no `export` and with no import: the generated file imports Valibot itself, as `v`.
 */
import * as v from 'valibot';

/** A rule that a value breaks: the definition and the rule, the place of the value, and the failure message of the rule. */
export interface Failure {
  /** The definition whose rule broke, or the operation, for a rule of an operation or an output. */
  readonly definition: string;
  readonly rule: string;
  /** The place of the value: `party_size`, `contact.email`, `dishes[0].amount`, or '' for the whole value. */
  readonly path: string;
  /** The failure message of the rule, with its arguments in place. */
  readonly failure_message: string;
}

/** A rule that cannot give a result, such as timestamp() of a text that is not a time. The rule breaks. */
export class RuleError extends Error {}

export function $isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** CEL's ==: the same value, item by item and property by property. */
export function $eq(a: unknown, b: unknown): boolean {
  // Not by identity for a list or an object: a list that holds NaN is not equal to itself.
  if (a === b && (typeof a !== 'object' || a === null)) return true;
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

/** CEL's l[i]: the item at i, from 0. An index out of the list is an error. */
export function $index(list: unknown, i: number): unknown {
  if (!Array.isArray(list) || !Number.isInteger(i) || i < 0 || i >= list.length) throw new RuleError(`the index ${i} is out of the list`);
  return list[i];
}

/** A string, or an error that breaks the rule. */
function $str(value: unknown, fn: string): string {
  if (typeof value !== 'string') throw new RuleError(`${fn}() of a value that is not a string`);
  return value;
}

/** CEL's startsWith(). */
export function $startsWith(text: unknown, part: unknown): boolean {
  return $str(text, 'startsWith').startsWith($str(part, 'startsWith'));
}

/** CEL's endsWith(). */
export function $endsWith(text: unknown, part: unknown): boolean {
  return $str(text, 'endsWith').endsWith($str(part, 'endsWith'));
}

/** CEL's contains(). */
export function $contains(text: unknown, part: unknown): boolean {
  return $str(text, 'contains').includes($str(part, 'contains'));
}

/** The strings extension's split(): the parts of a text between the separators, at most `limit` parts. An empty separator gives each character. */
export function $split(text: unknown, separator: unknown, limit = -1): string[] {
  if (typeof text !== 'string' || typeof separator !== 'string') throw new RuleError('split() of a value that is not a string');
  if (limit === 0) return [];
  const parts = separator === '' ? [...text] : text.split(separator);
  if (limit < 0 || parts.length <= limit) return parts;
  return [...parts.slice(0, limit - 1), parts.slice(limit - 1).join(separator)];
}

/** The characters of a string: CEL counts code points, not the units of a JavaScript string. */
function $chars(text: unknown, fn: string): string[] {
  return [...$str(text, fn)];
}

/** The strings extension's charAt(): the character at a position, or '' at the end. */
export function $charAt(text: unknown, i: number): string {
  const chars = $chars(text, 'charAt');
  if (i < 0 || i > chars.length) throw new RuleError(`the index ${i} is out of the string`);
  return chars[i] ?? '';
}

/** The position, in characters, of a part of a string at or after `from`, or -1. */
export function $indexOf(text: unknown, part: unknown, from = 0): number {
  const chars = $chars(text, 'indexOf');
  const target = $chars(part, 'indexOf');
  if (from < 0 || from > chars.length) throw new RuleError(`the index ${from} is out of the string`);
  for (let i = from; i + target.length <= chars.length; i++) if (target.every((c, j) => chars[i + j] === c)) return i;
  return -1;
}

/** The last position, in characters, of a part of a string at or before `from`, or -1. */
export function $lastIndexOf(text: unknown, part: unknown, from?: number): number {
  const chars = $chars(text, 'lastIndexOf');
  const target = $chars(part, 'lastIndexOf');
  const start = from ?? chars.length;
  if (start < 0 || start > chars.length) throw new RuleError(`the index ${start} is out of the string`);
  for (let i = Math.min(start, chars.length - target.length); i >= 0; i--) if (target.every((c, j) => chars[i + j] === c)) return i;
  return -1;
}

/** The strings extension's replace(): each part, or the first `limit` parts; a negative limit is each. */
export function $replace(text: unknown, part: unknown, by: unknown, limit = -1): string {
  const pieces = $str(text, 'replace').split($str(part, 'replace'));
  if (limit < 0 || limit >= pieces.length - 1) return pieces.join($str(by, 'replace'));
  return pieces.slice(0, limit + 1).join(by as string) + (part as string) + pieces.slice(limit + 1).join(part as string);
}

/** The strings extension's substring(): the characters from `start` up to `end`, not included. */
export function $substring(text: unknown, start: number, end?: number): string {
  const chars = $chars(text, 'substring');
  const stop = end ?? chars.length;
  if (start < 0 || stop > chars.length || start > stop) throw new RuleError(`the range ${start} to ${stop} is out of the string`);
  return chars.slice(start, stop).join('');
}

/** The strings extension's trim(): the white space of Unicode at each end. */
export function $trim(text: unknown): string {
  return $str(text, 'trim').replace(/^[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g, '');
}

/** The strings extension's join() of a list of strings. */
export function $join(list: unknown, separator = ''): string {
  if (!Array.isArray(list) || list.some((s) => typeof s !== 'string')) throw new RuleError('join() of a value that is not a list of strings');
  return list.join(separator);
}

/** The strings extension's reverse() of a string: its characters, last first. */
export function $reverse(text: unknown): string {
  return $chars(text, 'reverse').reverse().join('');
}

/** The strings extension's strings.quote(): the string as a CEL literal in double quotes. */
export function $quote(text: unknown): string {
  const ESC: Record<string, string> = { '\x07': '\\a', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\v': '\\v', '\\': '\\\\', '"': '\\"' };
  return `"${[...$str(text, 'quote')].map((c) => ESC[c] ?? c).join('')}"`;
}

/** A type of the checker, as the generated code receives it. */
type $Type = { readonly kind: string; readonly of?: $Type };

/** CEL's text of a value, as string() and format("%s") give it. */
function $show(value: unknown, type: $Type | undefined): string {
  switch (type?.kind) {
    case 'list':
      return `[${(value as unknown[]).map((v) => $show(v, type.of)).join(', ')}]`;
    case 'double':
      return $showDouble(value as number);
    case 'timestamp':
      return new Date(value as number).toISOString().replace('.000Z', 'Z');
    case 'duration':
      return `${(value as number) / 1000}s`;
    default:
      return String(value);
  }
}

/** A double as CEL shows it: NaN, Infinity, -Infinity, or the shortest text of the number. */
function $showDouble(n: number): string {
  if (Number.isNaN(n)) return 'NaN';
  if (!Number.isFinite(n)) return n > 0 ? 'Infinity' : '-Infinity';
  return String(n);
}

/**
 * A decimal text rounded to `digits` decimals, half to even, as CEL's format() rounds. The text must
 * have more decimals than `digits`, exactly: toFixed and toExponential give the exact decimal value.
 */
function $roundEven(text: string, digits: number): string {
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.') as [string, string?];
  const kept = whole + fraction.slice(0, digits);
  const rest = fraction.slice(digits);
  const half = rest[0] === '5' && /^50*$/.test(rest);
  const up = rest[0] !== undefined && (rest[0] > '5' || (rest[0] === '5' && !half) || (half && Number(kept.at(-1)) % 2 === 1));
  let digitsText = kept;
  if (up) {
    const chars = [...kept];
    let i = chars.length - 1;
    while (i >= 0 && chars[i] === '9') chars[i--] = '0';
    if (i < 0) chars.unshift('1');
    else chars[i] = String(Number(chars[i]) + 1);
    digitsText = chars.join('');
  }
  const cut = digitsText.length - digits;
  const result = digits === 0 ? digitsText : `${digitsText.slice(0, cut)}.${digitsText.slice(cut)}`;
  return negative && /[1-9]/.test(result) ? `-${result}` : negative ? `-${result}` : result;
}

/** The strings extension's format(): %s, %d, %f, %e, %b, %o, %x, %X and %%, with a precision for %f and %e. */
export function $format(template: unknown, values: unknown, types: readonly $Type[]): string {
  const list = values as unknown[];
  const itemType = types[1]?.of;
  let next = 0;
  return $str(template, 'format').replace(/%(?:\.(\d+))?([a-zA-Z%])?/g, (whole, precision: string | undefined, verb: string | undefined) => {
    if (verb === '%' && precision === undefined) return '%';
    if (verb === undefined) throw new RuleError('a format clause has no verb');
    if (next >= list.length) throw new RuleError(`index ${next} out of range`);
    const value = list[next++];
    const kind = itemType?.kind === 'any' ? typeof value : itemType?.kind;
    const number = (): number => {
      if (typeof value !== 'number') throw new RuleError(`%${verb} takes a number`);
      return value;
    };
    const special = (n: number): string | undefined => (Number.isNaN(n) ? 'NaN' : !Number.isFinite(n) ? (n > 0 ? 'Infinity' : '-Infinity') : undefined);
    switch (verb) {
      case 's':
        return $show(value, itemType);
      case 'd': {
        if (kind !== 'int' && kind !== 'double') throw new RuleError('%d takes an int');
        const n = number();
        const text = special(n);
        if (text !== undefined) return text;
        if (kind !== 'int') throw new RuleError('%d takes an int');
        return String(n);
      }
      case 'f':
      case 'e': {
        if (kind !== 'int' && kind !== 'double') throw new RuleError(`%${verb} takes a number`);
        const n = number();
        const digits = precision === undefined ? 6 : Number(precision);
        const text = special(n);
        if (text !== undefined) return text;
        if (verb === 'f') return $roundEven(n.toFixed(Math.min(100, digits + 40)), digits);
        const exact = n.toExponential(Math.min(100, digits + 40));
        let [mantissa, exponent] = exact.split('e') as [string, string];
        mantissa = $roundEven(mantissa, digits);
        if (/^-?10\./.test(mantissa) || mantissa.replace('-', '') === '10') {
          // 9.99… rounded up to 10: one more power of 10.
          mantissa = $roundEven((Number(mantissa) / 10).toFixed(Math.min(100, digits + 40)), digits);
          exponent = String(Number(exponent) + 1);
        }
        const e = Number(exponent);
        return `${mantissa}e${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
      }
      case 'b':
        if (kind === 'bool') return value ? '1' : '0';
        if (kind !== 'int') throw new RuleError('%b takes an int or a bool');
        return number().toString(2);
      case 'o':
        if (kind !== 'int') throw new RuleError('%o takes an int');
        return number().toString(8);
      case 'x':
      case 'X': {
        let text: string;
        if (kind === 'int') text = number().toString(16);
        else if (kind === 'string') text = [...new TextEncoder().encode(value as string)].map((b) => b.toString(16).padStart(2, '0')).join('');
        else throw new RuleError(`%${verb} takes an int or a string`);
        return verb === 'X' ? text.toUpperCase() : text;
      }
      default:
        throw new RuleError(`the format clause ${whole} is not known`);
    }
  });
}

/** The strings extension's lowerAscii(): only the letters A to Z change. */
export function $lowerAscii(text: unknown): string {
  return $str(text, 'lowerAscii').replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** The strings extension's upperAscii(): only the letters a to z change. */
export function $upperAscii(text: unknown): string {
  return $str(text, 'upperAscii').replace(/[a-z]/g, (c) => c.toUpperCase());
}

/** CEL's int(): a double toward 0, or a string of an integer. Any other string is an error. */
export function $int(value: unknown): number {
  if (typeof value === 'string' && !/^[+-]?\d+$/.test(value)) throw new RuleError(`${JSON.stringify(value)} is not an integer`);
  const n = Math.trunc(Number(value));
  if (typeof value === 'boolean' || !Number.isSafeInteger(n)) throw new RuleError(`${JSON.stringify(value)} is not an integer`);
  return n;
}

/** CEL's double(): an int, or a string of a number. Any other string is an error. */
export function $double(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(value)) return Number(value);
  // As in CEL: NaN, Inf and Infinity, in any case.
  const special = typeof value === 'string' ? /^([+-]?)(inf|infinity|nan)$/i.exec(value) : null;
  if (special) return special[2]!.toLowerCase() === 'nan' ? NaN : special[1] === '-' ? -Infinity : Infinity;
  throw new RuleError(`${JSON.stringify(value)} is not a number`);
}

/** An int of CEL: a result outside ±(2^53 - 1) is an error, as a 64-bit overflow is in CEL. */
export function $int53(n: number): number {
  if (!Number.isSafeInteger(n)) throw new RuleError('the int is out of range');
  return n;
}

/** CEL's bool() of a bool, or of a string: 1, t, true, TRUE, True, 0, f, false, FALSE or False. */
export function $bool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (['1', 't', 'true', 'TRUE', 'True'].includes(value as string)) return true;
  if (['0', 'f', 'false', 'FALSE', 'False'].includes(value as string)) return false;
  throw new RuleError(`${JSON.stringify(value)} is not a bool`);
}

/** CEL's int() of a timestamp: its seconds since 1970, toward 0. */
export function $intOfTimestamp(ms: number): number {
  return Math.trunc(ms / 1000);
}

/** CEL's timestamp() of an int: that many seconds since 1970. */
export function $timestampOfInt(seconds: number): number {
  return $timestampInRange(seconds * 1000);
}

/** A timestamp of CEL is from the year 1 to the year 9999. */
export function $timestampInRange(ms: number): number {
  if (!(ms >= -62135596800000 && ms <= 253402300799999)) throw new RuleError('the timestamp is out of range');
  return ms;
}

/** CEL's &&: false if either side is false, even when the other side is an error. */
export function $and(left: () => unknown, right: () => unknown): boolean {
  let error: unknown;
  try {
    if (left() === false) return false;
  } catch (e) {
    if (!(e instanceof RuleError || e instanceof TypeError)) throw e;
    error = e;
  }
  const r = right();
  if (r === false) return false;
  if (error !== undefined) throw error;
  return r as boolean;
}

/** CEL's ||: true if either side is true, even when the other side is an error. */
export function $or(left: () => unknown, right: () => unknown): boolean {
  let error: unknown;
  try {
    if (left() === true) return true;
  } catch (e) {
    if (!(e instanceof RuleError || e instanceof TypeError)) throw e;
    error = e;
  }
  const r = right();
  if (r === true) return true;
  if (error !== undefined) throw error;
  return r as boolean;
}

/** CEL's all(): false if one item gives false, even when another gives an error. */
export function $all(list: readonly unknown[], test: (item: any, index: number) => unknown): boolean {
  let error: unknown;
  for (const [index, item] of list.entries()) {
    try {
      if (test(item, index) === false) return false;
    } catch (e) {
      if (!(e instanceof RuleError || e instanceof TypeError)) throw e;
      error ??= e;
    }
  }
  if (error !== undefined) throw error;
  return true;
}

/** CEL's exists(): true if one item gives true, even when another gives an error. */
export function $exists(list: readonly unknown[], test: (item: any, index: number) => unknown): boolean {
  let error: unknown;
  for (const [index, item] of list.entries()) {
    try {
      if (test(item, index) === true) return true;
    } catch (e) {
      if (!(e instanceof RuleError || e instanceof TypeError)) throw e;
      error ??= e;
    }
  }
  if (error !== undefined) throw error;
  return false;
}

/** CEL's string() of an int, a double, a string or a bool. */
export function $string(value: unknown): string {
  if (['number', 'string', 'boolean'].includes(typeof value)) return String(value);
  throw new RuleError('string() of a value that is not an int, a double, a string or a bool');
}

/** The math extension's math.greatest() of one or more numbers. */
export function $greatest(...values: number[]): number {
  return $greatestOf(values);
}

/** The math extension's math.greatest() of a list: an empty list is an error. */
export function $greatestOf(values: readonly number[]): number {
  if (values.length === 0) throw new RuleError('math.greatest() of an empty list');
  return values.reduce((a, b) => (b > a ? b : a));
}

/** The math extension's math.least() of one or more numbers. */
export function $least(...values: number[]): number {
  return $leastOf(values);
}

/** The math extension's math.least() of a list: an empty list is an error. */
export function $leastOf(values: readonly number[]): number {
  if (values.length === 0) throw new RuleError('math.least() of an empty list');
  return values.reduce((a, b) => (b < a ? b : a));
}

/** The math extension's math.ceil(). */
export function $ceil(x: number): number {
  return Math.ceil(x);
}

/** The math extension's math.floor(). */
export function $floor(x: number): number {
  return Math.floor(x);
}

/** The math extension's math.round(): half away from 0, not up as Math.round. */
export function $round(x: number): number {
  return Number.isFinite(x) ? Math.sign(x) * Math.round(Math.abs(x)) : x;
}

/** The math extension's math.trunc(): toward 0. */
export function $trunc(x: number): number {
  return Math.trunc(x);
}

/** The math extension's math.abs(). */
export function $abs(x: number): number {
  return Math.abs(x);
}

/** The math extension's math.sign(): -1, 0 or 1. */
export function $sign(x: number): number {
  return Number.isNaN(x) ? x : x > 0 ? 1 : x < 0 ? -1 : 0;
}

/** The math extension's math.isNaN(). */
export function $isNaN(x: number): boolean {
  return Number.isNaN(x);
}

/** The math extension's math.isInf(). */
export function $isInf(x: number): boolean {
  return x === Infinity || x === -Infinity;
}

/** The math extension's math.isFinite(). */
export function $isFinite(x: number): boolean {
  return Number.isFinite(x);
}

/** An int of 64 bits as a BigInt, and back: the bit functions of CEL work on 64 bits, not on the 32 of JavaScript. */
function $bits(f: (...xs: bigint[]) => bigint, ...xs: number[]): number {
  return $int53(Number(BigInt.asIntN(64, f(...xs.map(BigInt)))));
}

/** The math extension's math.bitAnd(). */
export function $bitAnd(a: number, b: number): number {
  return $bits((x, y) => x & y, a, b);
}

/** The math extension's math.bitOr(). */
export function $bitOr(a: number, b: number): number {
  return $bits((x, y) => x | y, a, b);
}

/** The math extension's math.bitXor(). */
export function $bitXor(a: number, b: number): number {
  return $bits((x, y) => x ^ y, a, b);
}

/** The math extension's math.bitNot(). */
export function $bitNot(a: number): number {
  return $bits((x) => ~x, a);
}

/** The math extension's math.bitShiftLeft(): a shift of 64 or more gives 0; a negative shift is an error. */
export function $bitShiftLeft(a: number, n: number): number {
  if (n < 0) throw new RuleError('a negative shift');
  return n >= 64 ? 0 : $bits((x, y) => x << y, a, n);
}

/** The math extension's math.bitShiftRight(): a logical shift, of the 64 bits; a negative shift is an error. */
export function $bitShiftRight(a: number, n: number): number {
  if (n < 0) throw new RuleError('a negative shift');
  return n >= 64 ? 0 : $bits((x, y) => BigInt.asUintN(64, x) >> y, a, n);
}

/** CEL's order of two values of one type: numbers, strings, bools, timestamps or durations. */
function $compare(a: any, b: any): number {
  if (typeof a !== typeof b) throw new RuleError('values of two types have no order');
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The lists extension's sort(): the items in order. */
export function $sort(list: readonly unknown[]): unknown[] {
  return [...list].sort($compare);
}

/** The lists extension's sortBy(): the items in the order of their keys; items with the same key keep their order. */
export function $sortBy(list: readonly unknown[], key: (item: any, index: number) => unknown): unknown[] {
  const keyed = list.map((item, i) => ({ item, key: key(item, i) }));
  return keyed.sort((a, b) => $compare(a.key, b.key)).map((k) => k.item);
}

/** The lists extension's slice(): the items from `start` up to `end`, not included. */
export function $slice(list: readonly unknown[], start: number, end: number): unknown[] {
  if (start < 0 || end < 0 || start > end || end > list.length) throw new RuleError(`the range ${start} to ${end} is out of the list`);
  return list.slice(start, end);
}

/** The lists extension's flatten(): the items of each list inside, to a depth. */
export function $flatten(list: readonly unknown[], depth = 1): unknown[] {
  if (depth < 0) throw new RuleError('a negative depth');
  return (list as unknown[]).flat(depth);
}

/** The lists extension's distinct(): each item once, in the order of its first place. */
export function $distinct(list: readonly unknown[]): unknown[] {
  const kept: unknown[] = [];
  for (const item of list) if (!kept.some((k) => $eq(k, item))) kept.push(item);
  return kept;
}

/** The lists extension's reverse() of a list. */
export function $reverseList(list: readonly unknown[]): unknown[] {
  return [...list].reverse();
}

/** The lists extension's lists.range(n): 0 to n - 1. */
export function $range(n: number): number[] {
  if (n < 0) throw new RuleError('lists.range() of a negative number');
  if (n > 1_000_000) throw new RuleError('lists.range() of more than 1000000 items');
  return Array.from({ length: n }, (_, i) => i);
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
  if (typeof text === 'number') return text;
  const match = typeof text === 'string' ? RFC3339.exec(text) : null;
  if (!match) throw new RuleError(`${JSON.stringify(text)} is not a time`);
  const [, y, mo, d, h, mi, s] = match.map(Number) as number[];
  const date = new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!, s!));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo! - 1 || date.getUTCDate() !== d || h! > 23 || mi! > 59 || s! > 59) {
    throw new RuleError(`${JSON.stringify(text)} is not a time`);
  }
  const ms = Date.parse(text as string);
  if (Number.isNaN(ms)) throw new RuleError(`${JSON.stringify(text)} is not a time`);
  return $timestampInRange(ms);
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

/** A rule in the pipe of a schema: a Valibot check whose requirement keeps the definition and the rule's name. */
export function $rule(definition: string, rule: string, message: string, test: (value: any) => boolean) {
  return v.check<any, string>(Object.assign((value: unknown) => $holds(() => test(value)), { definition, rule }), message);
}

/** What the failures need of a definition: its base type, its root, and the parts of a list or an object. */
export interface Shape {
  readonly base: string;
  readonly root: string;
  readonly items?: string;
  readonly properties?: readonly string[];
}

const TYPE_MESSAGES: Readonly<Record<string, string>> = {
  string: 'Must be a string',
  integer: 'Must be an integer',
  number: 'Must be a number',
  boolean: 'Must be true or false',
  array: 'Must be a list',
  object: 'Must be an object',
};

/**
 * Checks a value with the schema of a definition, and adds a failure for each rule it breaks: the
 * rule of a check by its name, a value of the wrong type as `type`, a property that the object does
 * not have as `properties`, and missing properties as one `required` of the object.
 */
export function $validate(
  schema: v.GenericSchema,
  definition: string,
  value: unknown,
  path: string,
  failures: Failure[],
  shapes: Readonly<Record<string, Shape>>,
  required: Readonly<Record<string, string>>,
): boolean {
  const result = v.safeParse(schema, value);
  if (result.success) return true;
  const found: Failure[] = [];
  const seen = new Set<string>();
  for (const issue of result.issues) {
    // The place of the issue, and the definition of each step: a key is a property, which is a definition of its own name.
    let place = path;
    let current = definition;
    const steps = issue.path ?? [];
    let owner = current;
    let ownerPlace = place;
    for (const step of steps) {
      owner = current;
      ownerPlace = place;
      const key = step.key;
      if (typeof key === 'number') {
        place = $item(place, key);
        current = shapes[shapes[current]?.root ?? current]?.items ?? current;
      } else {
        place = $at(place, String(key));
        current = String(key);
      }
    }
    const requirement = (issue as { requirement?: unknown }).requirement as { definition?: string; rule?: string } | undefined;
    let failure: Failure;
    if (issue.type === 'check' && requirement?.rule) {
      failure = { definition: requirement.definition!, rule: requirement.rule, path: place, failure_message: issue.message };
    } else if ((issue.type === 'strict_object' || issue.type === 'object') && issue.expected === 'never') {
      const root = shapes[owner]?.root ?? owner;
      failure = { definition: root, rule: 'properties', path: place, failure_message: `Must be one of the properties of ${root}: ${(shapes[root]?.properties ?? []).join(', ')}` };
    } else if ((issue.type === 'strict_object' || issue.type === 'object') && issue.received === 'undefined' && steps.length > 0) {
      const root = shapes[owner]?.root ?? owner;
      failure = { definition: root, rule: 'required', path: ownerPlace, failure_message: required[root] ?? `Must have ${current}` };
    } else {
      const base = shapes[current]?.base ?? 'object';
      failure = { definition: shapes[current]?.root ?? current, rule: 'type', path: place, failure_message: TYPE_MESSAGES[base] ?? 'Must be a value of its type' };
    }
    const key = `${failure.definition} ${failure.rule} ${failure.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(failure);
  }
  // A rule of an object or a list reads its parts: it counts only when no part of it broke.
  const inside = (outer: string, inner: string): boolean =>
    inner !== outer && (outer === path ? inner.length > outer.length : inner.startsWith(`${outer}.`) || inner.startsWith(`${outer}[`));
  const structural = new Set(['type', 'properties', 'required']);
  failures.push(...found.filter((f) => structural.has(f.rule) || !found.some((g) => inside(f.path, g.path))));
  return false;
}
