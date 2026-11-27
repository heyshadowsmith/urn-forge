/**
 * The helpers of the generated code. The generator copies the helpers that a file uses into it, with
 * no `export`: the generated file has no import.
 */

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
// The item of a list has the type that the checker gave it, so the generated code reads it as any, as a property.
export function $index(list: unknown, i: number): any {
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

/** The strings extension's substring(): the characters from `start` up to `end`, not included. */
export function $substring(text: unknown, start: number, end?: number): string {
  const chars = $chars(text, 'substring');
  const stop = end ?? chars.length;
  if (start < 0 || stop > chars.length || start > stop) throw new RuleError(`the range ${start} to ${stop} is out of the string`);
  return chars.slice(start, stop).join('');
}

/** The strings extension's join() of a list of strings. */
export function $join(list: unknown, separator = ''): string {
  if (!Array.isArray(list) || list.some((s) => typeof s !== 'string')) throw new RuleError('join() of a value that is not a list of strings');
  return list.join(separator);
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
    case 'timestamp': {
      const d = new Date(value as number);
      const year = d.getUTCFullYear();
      // toISOString writes a year of 4 digits from 0 to 9999.
      return d.toISOString().replace(/^[+-]?\d+/, String(year).padStart(4, '0')).replace('.000Z', 'Z');
    }
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

/** A duration of CEL is at most about 10000 years either way. */
export function $durationInRange(ms: number): number {
  if (!(Math.abs(ms) <= 315_576_000_000_000)) throw new RuleError('the duration is out of range');
  return ms;
}

/** The parts of a time in a time zone: an IANA name such as 'Europe/Paris', or an offset such as '+02:00' or '02:00'. */
function $local(ms: number, zone?: unknown): { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number } {
  let shifted = ms;
  if (zone !== undefined && typeof zone !== 'string') throw new RuleError('a time zone is a string');
  const offset = zone === undefined ? undefined : /^([+-])?(\d{2}):(\d{2})$/.exec(zone);
  if (zone === undefined || offset) {
    if (offset) shifted += (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3])) * 60_000;
    const d = new Date(shifted);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(), weekday: d.getUTCDay() };
  }
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: zone as string, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', era: 'short' }).formatToParts(new Date(ms));
  } catch {
    throw new RuleError(`${JSON.stringify(zone)} is not a time zone`);
  }
  const part = (type: string): number => Number(parts.find((p) => p.type === type)!.value);
  const era = parts.find((p) => p.type === 'era')!.value;
  const year = era.startsWith('B') ? 1 - part('year') : part('year');
  const local = new Date(0);
  local.setUTCFullYear(year, part('month') - 1, part('day'));
  return { year, month: part('month') - 1, day: part('day'), hour: part('hour'), minute: part('minute'), second: part('second'), weekday: local.getUTCDay() };
}

/** CEL's getFullYear(): the year, in UTC or in a time zone. */
export function $getFullYear(ms: number, zone?: unknown): number {
  return $local(ms, zone).year;
}

/** CEL's getMonth(): the month, from 0 for January. */
export function $getMonth(ms: number, zone?: unknown): number {
  return $local(ms, zone).month;
}

/** CEL's getDate(): the day of the month, from 1. */
export function $getDate(ms: number, zone?: unknown): number {
  return $local(ms, zone).day;
}

/** CEL's getDayOfMonth(): the day of the month, from 0. */
export function $getDayOfMonth(ms: number, zone?: unknown): number {
  return $local(ms, zone).day - 1;
}

/** CEL's getDayOfWeek(): the day of the week, from 0 for Sunday. */
export function $getDayOfWeek(ms: number, zone?: unknown): number {
  return $local(ms, zone).weekday;
}

/** CEL's getDayOfYear(): the day of the year, from 0. */
export function $getDayOfYear(ms: number, zone?: unknown): number {
  const { year, month, day } = $local(ms, zone);
  const start = new Date(0);
  start.setUTCFullYear(year, 0, 1);
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}

/** CEL's getHours() of a timestamp. */
export function $getHours(ms: number, zone?: unknown): number {
  return $local(ms, zone).hour;
}

/** CEL's getMinutes() of a timestamp. */
export function $getMinutes(ms: number, zone?: unknown): number {
  return $local(ms, zone).minute;
}

/** CEL's getSeconds() of a timestamp. */
export function $getSeconds(ms: number, zone?: unknown): number {
  return $local(ms, zone).second;
}

/** CEL's getMilliseconds() of a timestamp: the same in each time zone. */
export function $getMilliseconds(ms: number, zone?: unknown): number {
  $local(ms, zone);
  return ((ms % 1000) + 1000) % 1000;
}

/** CEL's getHours() of a duration: its whole hours. */
export function $durationHours(ms: number): number {
  return Math.trunc(ms / 3_600_000);
}

/** CEL's getMinutes() of a duration: its whole minutes. */
export function $durationMinutes(ms: number): number {
  return Math.trunc(ms / 60_000);
}

/** CEL's getSeconds() of a duration: its whole seconds. */
export function $durationSeconds(ms: number): number {
  return Math.trunc(ms / 1000);
}

/** CEL's getMilliseconds() of a duration: the milliseconds after its whole seconds. */
export function $durationMilliseconds(ms: number): number {
  return Math.trunc(ms % 1000);
}

/** CEL's string() of a value, with its type: a timestamp in RFC 3339, a duration in seconds. */
export function $stringOf(value: unknown, types: readonly $Type[]): string {
  return $show(value, types[0]);
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

/** The lists extension's flatten(): the items of each list inside, to a depth. */
export function $flatten(list: readonly unknown[], depth = 1): unknown[] {
  if (depth < 0) throw new RuleError('a negative depth');
  return (list as unknown[]).flat(depth);
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
  // Not Date.UTC, which reads the years 0 to 99 as 1900 to 1999.
  const date = new Date(0);
  date.setUTCFullYear(y!, mo! - 1, d!);
  date.setUTCHours(h!, mi!, s!);
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

