/**
 * How a change moves a set of valid values: the new set is
 * equal to the old one, smaller (narrower), larger (wider), or neither.
 *
 * The MECE model gives each constraint one aspect, so each aspect has one comparison: a bound
 * moves, a set grows or shrinks, a step divides or multiplies, a pattern changes. A change
 * that this module cannot compare (a new regex, a new rule) is "neither": breaking for
 * every use, which is safe, not exact.
 */
import type { ListRule } from '../ir/types.js';
import { compareDecimal, instant } from '../primitives/exact.js';
import type { ConstraintsOf, ConstraintValue, Primitive } from '../primitives/index.js';

export type Relation = 'equal' | 'narrower' | 'wider' | 'neither';

/** The relation of several independent changes together. */
export function combine(relations: readonly Relation[]): Relation {
  const moved = new Set(relations.filter((r) => r !== 'equal'));
  if (moved.size === 0) return 'equal';
  if (moved.size === 1) return [...moved][0]!;
  return 'neither';
}

type Compare<T> = (a: T, b: T) => number;

/** One bound: no value is no bound. */
interface Bound<T> {
  readonly value?: T | undefined;
  readonly open?: boolean | undefined;
}

/** A lower bound: no bound is -∞; at one value, an open bound is narrower. */
function lower<T>(cmp: Compare<T>, old: Bound<T>, now: Bound<T>): Relation {
  if (old.value === undefined && now.value === undefined) return 'equal';
  if (old.value === undefined) return 'narrower';
  if (now.value === undefined) return 'wider';
  const c = cmp(now.value, old.value);
  if (c > 0) return 'narrower';
  if (c < 0) return 'wider';
  if (!!now.open === !!old.open) return 'equal';
  return now.open ? 'narrower' : 'wider';
}

/** An upper bound: the mirror of `lower`. */
function upper<T>(cmp: Compare<T>, old: Bound<T>, now: Bound<T>): Relation {
  return lower((a: T, b: T) => cmp(b, a), old, now);
}

/** Bounds of a primitive with min, max, and maybe exclusive bounds. */
function range<T>(cmp: Compare<T>, old: Record<string, unknown>, now: Record<string, unknown>): Relation[] {
  const low = (c: Record<string, unknown>) => (c['exclusiveMin'] !== undefined ? { value: c['exclusiveMin'] as T, open: true } : { value: c['min'] as T | undefined });
  const high = (c: Record<string, unknown>) => (c['exclusiveMax'] !== undefined ? { value: c['exclusiveMax'] as T, open: true } : { value: c['max'] as T | undefined });
  return [lower(cmp, low(old), low(now)), upper(cmp, high(old), high(now))];
}

/** A set of values that the field excludes (`notIn`): more excluded is narrower. */
function excluded<T>(same: (a: T, b: T) => boolean, old: readonly T[] | undefined, now: readonly T[] | undefined): Relation {
  return included(same, now ?? [], old ?? []);
}

/** A set of values that the field allows (enum `values`): fewer allowed is narrower. */
function included<T>(same: (a: T, b: T) => boolean, old: readonly T[], now: readonly T[]): Relation {
  const oldHasAll = now.every((x) => old.some((y) => same(x, y)));
  const nowHasAll = old.every((x) => now.some((y) => same(x, y)));
  if (oldHasAll && nowHasAll) return 'equal';
  if (oldHasAll) return 'narrower';
  if (nowHasAll) return 'wider';
  return 'neither';
}

/** A shape (`regex`, `format`, `mustBe`): adding one narrows, removing one widens, changing one is neither. */
function shape(old: ConstraintValue | undefined, now: ConstraintValue | undefined): Relation {
  if (old === now) return 'equal';
  if (old === undefined) return 'narrower';
  if (now === undefined) return 'wider';
  return 'neither';
}

const byNumber: Compare<number> = (a, b) => a - b;
const byText: Compare<string> = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byInstant: Compare<string> = (a, b) => instant(a) - instant(b);

type ConstraintRelation<P extends Primitive> = (old: ConstraintsOf<P>, now: ConstraintsOf<P>) => Relation[];

/** Every primitive. A primitive added to the registry without an entry here fails `tsc`. */
const RELATIONS: { readonly [P in Primitive]: ConstraintRelation<P> } = {
  boolean: (o, n) => [shape(o.mustBe, n.mustBe)],
  enum: (o, n) => [included((a, b) => a === b, o.values ?? [], n.values ?? [])],
  date: (o, n) => range(byText, o, n),
  timestamp: (o, n) => range(byInstant, o, n),
  decimal: (o, n) => [
    ...range(compareDecimal, o, n),
    // No scale is any number of digits after the point.
    lower((a: number, b: number) => b - a, { value: o.scale }, { value: n.scale }),
    excluded((a: string, b: string) => compareDecimal(a, b) === 0, o.notIn, n.notIn),
  ],
  float: (o, n) => [...range(byNumber, o, n), excluded((a: number, b: number) => a === b, o.notIn, n.notIn)],
  integer: (o, n) => {
    // A step m allows the multiples of m: a multiple of the old step is narrower, a divisor wider.
    const [a, b] = [o.multipleOf ?? 1, n.multipleOf ?? 1];
    const step: Relation = a === b ? 'equal' : b % a === 0 ? 'narrower' : a % b === 0 ? 'wider' : 'neither';
    return [...range(byNumber, o, n), step, excluded((x: number, y: number) => x === y, o.notIn, n.notIn)];
  },
  string: (o, n) => [
    lower(byNumber, { value: o.minLength }, { value: n.minLength }),
    upper(byNumber, { value: o.maxLength }, { value: n.maxLength }),
    shape(o.regex, n.regex),
    shape(o.format, n.format),
  ],
};

/** The relation of a field's new constraints to its old ones, on one primitive. */
export function constraintRelation(primitive: Primitive, old: Readonly<Record<string, ConstraintValue>>, now: Readonly<Record<string, ConstraintValue>>): Relation {
  const relate = RELATIONS[primitive] as ConstraintRelation<Primitive>;
  return combine(relate(old as ConstraintsOf<Primitive>, now as ConstraintsOf<Primitive>));
}

/** The relation of a list rule to the old one: its count, and whether an item may repeat. */
export function listRelation(old: ListRule, now: ListRule): Relation {
  return combine([
    lower(byNumber, { value: old.minItems }, { value: now.minItems }),
    upper(byNumber, { value: old.maxItems }, { value: now.maxItems }),
    shape(old.unique ? true : undefined, now.unique ? true : undefined),
  ]);
}
