/**
 * Shared by the number primitives: their constraints, coherence, cell
 * parsing and boundary cases.
 *
 * - Range: `min` and `max` (inclusive) on every number kind; `exclusiveMin` and
 *   `exclusiveMax` only on a continuous kind (`float`), because on `integer` an exclusive
 *   bound is always an inclusive one a step further.
 * - Step: `multipleOf`, on `integer` only.
 * - Exclusion: `notIn`, a list of values that are not allowed.
 */
import * as v from 'valibot';
import type { BoundaryCase, CoherenceProblem, ConstraintSpec, ExclusiveGroup } from './types.js';

const NUMBER_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$|^[+-]?Infinity$|^NaN$/;

/** A list of distinct values of `schema`, for `notIn`. */
function notIn(schema: v.GenericSchema<unknown, number>): ConstraintSpec<number[]> {
  return {
    schema: v.pipe(
      v.array(schema),
      v.minLength(1, 'must list at least one value'),
      v.check((values) => new Set(values).size === values.length, 'must not list a value more than once'),
    ),
    aspect: 'exclusion',
  };
}

const INTEGER = v.pipe(v.number(), v.safeInteger());
const FLOAT = v.pipe(v.number(), v.finite());

export const integerConstraints = {
  min: { schema: INTEGER, aspect: 'range' },
  max: { schema: INTEGER, aspect: 'range' },
  multipleOf: { schema: v.pipe(INTEGER, v.minValue(1, 'must be 1 or more')), aspect: 'step' },
  notIn: notIn(INTEGER),
} as const satisfies Record<string, ConstraintSpec>;

export const floatConstraints = {
  min: { schema: FLOAT, aspect: 'range' },
  max: { schema: FLOAT, aspect: 'range' },
  exclusiveMin: { schema: FLOAT, aspect: 'range' },
  exclusiveMax: { schema: FLOAT, aspect: 'range' },
  notIn: notIn(FLOAT),
} as const satisfies Record<string, ConstraintSpec>;

/** On a primitive with exclusive bounds: at most one bound on each side. */
export const BOUND_GROUPS: readonly ExclusiveGroup[] = [
  { keys: ['min', 'exclusiveMin'], what: 'a lower bound' },
  { keys: ['max', 'exclusiveMax'], what: 'an upper bound' },
];

export interface NumberConstraints {
  readonly min?: number;
  readonly max?: number;
  readonly exclusiveMin?: number;
  readonly exclusiveMax?: number;
  readonly multipleOf?: number;
  readonly notIn?: readonly number[];
}

/** At most this many integers are listed to find out whether `notIn` excludes all of them. */
const ENUMERATION_LIMIT = 100_000;

/** Pass 7. Conflicting bounds (two on one side) are reported before this runs. */
export function numberCoherence(step: 'integer' | 'float') {
  return (c: NumberConstraints): CoherenceProblem[] => {
    const lower = c.min !== undefined ? { name: 'min', value: c.min, open: false } : c.exclusiveMin !== undefined ? { name: 'exclusiveMin', value: c.exclusiveMin, open: true } : undefined;
    const upper = c.max !== undefined ? { name: 'max', value: c.max, open: false } : c.exclusiveMax !== undefined ? { name: 'exclusiveMax', value: c.exclusiveMax, open: true } : undefined;
    if (lower && upper) {
      if (lower.value > upper.value) {
        return [{ constraint: upper.name, message: `${lower.name} (${lower.value}) is greater than ${upper.name} (${upper.value}), so no value is valid` }];
      }
      if (lower.value === upper.value && (lower.open || upper.open)) {
        return [{ constraint: upper.name, message: `${lower.name} and ${upper.name} are both ${lower.value}, and one of them excludes it, so no value is valid` }];
      }
    }
    const excluded = new Set(c.notIn ?? []);
    if (step === 'float') {
      if (lower && upper && lower.value === upper.value && excluded.has(lower.value)) {
        return [{ constraint: 'notIn', message: `min and max are both ${lower.value} and notIn lists it, so no value is valid` }];
      }
      return [];
    }
    // integer: the allowed values between the bounds, when there are few enough to list.
    const n = c.multipleOf ?? 1;
    if (c.min === undefined || c.max === undefined) return [];
    const first = Math.ceil(c.min / n) * n;
    if (first > c.max) {
      return [{ constraint: 'multipleOf', message: `no multiple of ${n} is between min (${c.min}) and max (${c.max}), so no value is valid` }];
    }
    if (excluded.size === 0 || (c.max - first) / n >= ENUMERATION_LIMIT) return [];
    for (let value = first; value <= c.max; value += n) if (!excluded.has(value)) return [];
    return [{ constraint: 'notIn', message: `notIn lists every value that min, max${c.multipleOf ? ' and multipleOf' : ''} allow, so no value is valid` }];
  };
}

const isNumber = (value: unknown): value is number => typeof value === 'number';
/** Equal by `===`, so `0` and `-0` both cover a bound of `0`, as the schema treats them. */
const is = (n: number) => (value: unknown) => isNumber(value) && value === n;

/**
 * Boundary cases. An `integer` bound needs the value at it and the value one step
 * beyond; a `float` has no step, so it needs the value at the bound and any value beyond it.
 * An exclusive bound needs the bound itself (refused) and a value inside. `multipleOf` needs
 * a multiple and a value that is not one; `notIn` needs each excluded value.
 */
export function numberBoundaries(step: 'integer' | 'float') {
  return (c: NumberConstraints): BoundaryCase[] => {
    const cases: BoundaryCase[] = [];
    if (c.min !== undefined) {
      const min = c.min;
      cases.push({ label: `value at min ${min}`, covers: is(min) });
      cases.push(
        step === 'integer'
          ? { label: `value at min − 1 (${min - 1})`, covers: is(min - 1) }
          : { label: `value below min ${min}`, covers: (value) => isNumber(value) && value < min },
      );
    }
    if (c.exclusiveMin !== undefined) {
      const bound = c.exclusiveMin;
      cases.push({ label: `value at exclusiveMin ${bound}`, covers: is(bound) });
      cases.push({ label: `value above exclusiveMin ${bound}`, covers: (value) => isNumber(value) && value > bound });
    }
    if (c.max !== undefined) {
      const max = c.max;
      cases.push({ label: `value at max ${max}`, covers: is(max) });
      cases.push(
        step === 'integer'
          ? { label: `value at max + 1 (${max + 1})`, covers: is(max + 1) }
          : { label: `value above max ${max}`, covers: (value) => isNumber(value) && value > max },
      );
    }
    if (c.exclusiveMax !== undefined) {
      const bound = c.exclusiveMax;
      cases.push({ label: `value at exclusiveMax ${bound}`, covers: is(bound) });
      cases.push({ label: `value below exclusiveMax ${bound}`, covers: (value) => isNumber(value) && value < bound });
    }
    if (c.multipleOf !== undefined) {
      const n = c.multipleOf;
      cases.push({ label: `multiple of ${n} (multipleOf)`, covers: (value) => isNumber(value) && Number.isInteger(value) && value % n === 0 });
      cases.push({ label: `value that is not a multiple of ${n}`, covers: (value) => isNumber(value) && Number.isInteger(value) && value % n !== 0 });
    }
    for (const excluded of c.notIn ?? []) cases.push({ label: `value ${excluded} (notIn)`, covers: is(excluded) });
    return cases;
  };
}

/** A number literal becomes a number; any other text stays a string, for the schema to reject. */
export function parseNumberCell(cell: string): unknown {
  return NUMBER_LITERAL.test(cell) ? Number(cell) : cell;
}
