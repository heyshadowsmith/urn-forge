import * as v from 'valibot';
import { addDays, isCalendarDate } from './exact.js';
import { definePrimitive, type BoundaryCase, type ConstraintSpec } from './types.js';

const bound: ConstraintSpec<string> = {
  schema: v.pipe(v.string('must be a date such as 2026-01-31'), v.check((value: string) => isCalendarDate(value), 'must be a real calendar day, YYYY-MM-DD')),
  aspect: 'range',
};

/**
 * A calendar day, `YYYY-MM-DD`, with no time and no time zone (primitives plan, step 8). Days
 * are discrete, so the bounds are inclusive only. The value is a string; in this form, text
 * order is date order.
 */
export const date = definePrimitive({
  name: 'date',
  constraints: { min: bound, max: bound },
  coherence: ({ min, max }) =>
    min !== undefined && max !== undefined && min > max ? [{ constraint: 'max', message: `min (${min}) is after max (${max}), so no value is valid` }] : [],
  parseCell: (cell) => cell,
  boundaries: ({ min, max }) => {
    const is = (day: string) => (value: unknown) => value === day;
    const cases: BoundaryCase[] = [];
    if (min !== undefined) {
      cases.push({ label: `value at min ${min}`, covers: is(min) });
      cases.push({ label: `day before min (${addDays(min, -1)})`, covers: is(addDays(min, -1)) });
    }
    if (max !== undefined) {
      cases.push({ label: `value at max ${max}`, covers: is(max) });
      cases.push({ label: `day after max (${addDays(max, 1)})`, covers: is(addDays(max, 1)) });
    }
    return cases;
  },
});
