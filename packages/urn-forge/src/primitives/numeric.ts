/** Shared by the numeric primitives: their constraints, coherence and cell parsing. */
import * as v from 'valibot';
import type { BoundaryCase, CoherenceProblem, ConstraintSpec } from './types.js';

const NUMBER_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$|^[+-]?Infinity$|^NaN$/;

/** `min`, `max` and `notEqual`, each a value of `schema`. */
export function numericConstraints(schema: v.GenericSchema<unknown, number>) {
  const range: ConstraintSpec<number> = { schema, aspect: 'range' };
  return { min: range, max: range, notEqual: { schema, aspect: 'exclusion' } } as const;
}

export function numericCoherence(c: { readonly min?: number; readonly max?: number; readonly notEqual?: number }): CoherenceProblem[] {
  if (c.min === undefined || c.max === undefined) return [];
  if (c.min > c.max) return [{ constraint: 'max', message: `min (${c.min}) is greater than max (${c.max}), so no value is valid` }];
  if (c.min === c.max && c.notEqual === c.min) {
    return [{ constraint: 'notEqual', message: `min and max are both ${c.min} and notEqual is ${c.notEqual}, so no value is valid` }];
  }
  return [];
}

type NumericConstraints = { readonly min?: number; readonly max?: number; readonly notEqual?: number };

const isNumber = (value: unknown): value is number => typeof value === 'number';
/** Equal by `===`, so `0` and `-0` both cover a bound of `0`, as the schema treats them. */
const is = (n: number) => (value: unknown) => isNumber(value) && value === n;

/**
 * Boundary cases for `min`, `max` and `notEqual` (spec §8). An `integer` bound needs the value
 * at it and the value one step beyond; a `float` has no step, so it needs the value at the
 * bound and any value beyond it. `notEqual` needs the excluded value.
 */
export function numericBoundaries(step: 'integer' | 'float') {
  return (c: NumericConstraints): BoundaryCase[] => {
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
    if (c.max !== undefined) {
      const max = c.max;
      cases.push({ label: `value at max ${max}`, covers: is(max) });
      cases.push(
        step === 'integer'
          ? { label: `value at max + 1 (${max + 1})`, covers: is(max + 1) }
          : { label: `value above max ${max}`, covers: (value) => isNumber(value) && value > max },
      );
    }
    if (c.notEqual !== undefined) cases.push({ label: `value equal to notEqual ${c.notEqual}`, covers: is(c.notEqual) });
    return cases;
  };
}

/** A number literal becomes a number; any other text stays a string, for the schema to reject. */
export function parseNumberCell(cell: string): unknown {
  return NUMBER_LITERAL.test(cell) ? Number(cell) : cell;
}
