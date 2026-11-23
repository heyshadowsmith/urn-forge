import * as v from 'valibot';
import { BOUND_GROUPS } from './numeric.js';
import { instant, isUtcTimestamp } from './exact.js';
import { definePrimitive, type BoundaryCase, type ConstraintSpec } from './types.js';

const bound: ConstraintSpec<string> = {
  schema: v.pipe(
    v.string('must be a timestamp in quotes, such as "2026-01-31T09:30:00Z"'),
    v.check((value: string) => isUtcTimestamp(value), 'must be ISO 8601 in UTC: YYYY-MM-DDTHH:MM:SSZ, with an optional fraction of up to 3 digits'),
  ),
  aspect: 'range',
};

/**
 * An instant: ISO 8601 in UTC with `Z`. Values compare as instants,
 * so `…:00Z` equals `…:00.000Z`. No constraint can mean "now": that would make `verify`
 * depend on the clock.
 */
export const timestamp = definePrimitive({
  name: 'timestamp',
  constraints: {
    min: bound,
    max: bound,
    exclusiveMin: bound,
    exclusiveMax: bound,
    /** Exactly this many digits after the second, 0 to 3. Without it, 0 to 3 digits. */
    precision: { schema: v.pipe(v.number(), v.integer('must be 0, 1, 2 or 3'), v.minValue(0, 'must be 0, 1, 2 or 3'), v.maxValue(3, 'must be 0, 1, 2 or 3')), aspect: 'shape' } as ConstraintSpec<number>,
  },
  exclusive: BOUND_GROUPS,
  coherence: (c) => {
    const lower = c.min !== undefined ? { name: 'min', value: c.min, open: false } : c.exclusiveMin !== undefined ? { name: 'exclusiveMin', value: c.exclusiveMin, open: true } : undefined;
    const upper = c.max !== undefined ? { name: 'max', value: c.max, open: false } : c.exclusiveMax !== undefined ? { name: 'exclusiveMax', value: c.exclusiveMax, open: true } : undefined;
    if (!lower || !upper) return [];
    const [from, to] = [instant(lower.value), instant(upper.value)];
    if (from > to) return [{ constraint: upper.name, message: `${lower.name} (${lower.value}) is after ${upper.name} (${upper.value}), so no value is valid` }];
    if (from === to && (lower.open || upper.open)) {
      return [{ constraint: upper.name, message: `${lower.name} and ${upper.name} are the same instant, and one of them excludes it, so no value is valid` }];
    }
    return [];
  },
  parseCell: (cell) => cell,
  boundaries: (c) => {
    const compare = (value: unknown, bound: string) => (isUtcTimestamp(value) ? Math.sign(instant(value) - instant(bound)) : undefined);
    const at = (bound: string) => (value: unknown) => compare(value, bound) === 0;
    const beyond = (bound: string, side: -1 | 1) => (value: unknown) => compare(value, bound) === side;
    const cases: BoundaryCase[] = [];
    if (c.min !== undefined) cases.push({ label: `value at min ${c.min}`, covers: at(c.min) }, { label: `value before min ${c.min}`, covers: beyond(c.min, -1) });
    if (c.exclusiveMin !== undefined) {
      cases.push({ label: `value at exclusiveMin ${c.exclusiveMin}`, covers: at(c.exclusiveMin) }, { label: `value after exclusiveMin ${c.exclusiveMin}`, covers: beyond(c.exclusiveMin, 1) });
    }
    if (c.max !== undefined) cases.push({ label: `value at max ${c.max}`, covers: at(c.max) }, { label: `value after max ${c.max}`, covers: beyond(c.max, 1) });
    if (c.exclusiveMax !== undefined) {
      cases.push({ label: `value at exclusiveMax ${c.exclusiveMax}`, covers: at(c.exclusiveMax) }, { label: `value before exclusiveMax ${c.exclusiveMax}`, covers: beyond(c.exclusiveMax, -1) });
    }
    if (c.precision !== undefined) {
      const digits = (value: unknown) => (isUtcTimestamp(value) ? (/\.([0-9]+)Z$/u.exec(value)?.[1]?.length ?? 0) : undefined);
      cases.push({ label: `value with other than ${c.precision} digits after the second`, covers: (value) => digits(value) !== undefined && digits(value) !== c.precision });
    }
    return cases;
  },
});
