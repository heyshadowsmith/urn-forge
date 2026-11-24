/**
 * The helpers of the generated code. The generator copies this file into each generated file, with
 * no `export` and with no import: the generated file imports Valibot itself, as `v`.
 */
import * as v from 'valibot';

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
      failure = { definition: requirement.definition!, rule: requirement.rule, path: place, message: issue.message };
    } else if ((issue.type === 'strict_object' || issue.type === 'object') && issue.expected === 'never') {
      const root = shapes[owner]?.root ?? owner;
      failure = { definition: root, rule: 'properties', path: place, message: `Must be one of the properties of ${root}: ${(shapes[root]?.properties ?? []).join(', ')}` };
    } else if ((issue.type === 'strict_object' || issue.type === 'object') && issue.received === 'undefined' && steps.length > 0) {
      const root = shapes[owner]?.root ?? owner;
      failure = { definition: root, rule: 'required', path: ownerPlace, message: required[root] ?? `Must have ${current}` };
    } else {
      const base = shapes[current]?.base ?? 'object';
      failure = { definition: shapes[current]?.root ?? current, rule: 'type', path: place, message: TYPE_MESSAGES[base] ?? 'Must be a value of its type' };
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
