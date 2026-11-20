/** Shared by the numeric primitives: their constraints, coherence and cell parsing. */
import * as v from 'valibot';
import type { CoherenceProblem, ConstraintSpec } from './types.js';

const NUMBER_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$|^[+-]?Infinity$|^NaN$/;

/** `min`, `max` and `notEqual`, each a value of `schema`. */
export function numericConstraints(schema: v.GenericSchema<unknown, number>) {
  const spec: ConstraintSpec<number> = { schema };
  return { min: spec, max: spec, notEqual: spec } as const;
}

export function numericCoherence(c: { readonly min?: number; readonly max?: number; readonly notEqual?: number }): CoherenceProblem[] {
  if (c.min === undefined || c.max === undefined) return [];
  if (c.min > c.max) return [{ constraint: 'max', message: `min (${c.min}) is greater than max (${c.max}), so no value is valid` }];
  if (c.min === c.max && c.notEqual === c.min) {
    return [{ constraint: 'notEqual', message: `min and max are both ${c.min} and notEqual is ${c.notEqual}, so no value is valid` }];
  }
  return [];
}

/** A number literal becomes a number; any other text stays a string, for the schema to reject. */
export function parseNumberCell(cell: string): unknown {
  return NUMBER_LITERAL.test(cell) ? Number(cell) : cell;
}
