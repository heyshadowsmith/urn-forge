import * as v from 'valibot';
import { BOUND_GROUPS } from './numeric.js';
import { DECIMAL, compareDecimal, fractionDigits, isDecimal, toScale, unscaled } from './exact.js';
import { definePrimitive, type BoundaryCase, type CoherenceProblem, type ConstraintSpec } from './types.js';

/** A decimal literal in the manifest. A YAML number is a binary float, so it must be quoted. */
const literal = v.pipe(
  v.string('must be a decimal in quotes, such as "0.01": a YAML number is not exact'),
  v.regex(DECIMAL, 'must be a decimal such as "12.50": digits, an optional point and fraction, no exponent'),
);
const bound: ConstraintSpec<string> = { schema: literal, aspect: 'range' };

/** At most this many values at the scale are listed to find out whether `notIn` excludes all of them. */
const ENUMERATION_LIMIT = 100_000n;

/**
 * An exact fraction, such as money (primitives plan, step 7). The value is a string in both
 * the shell and the core, so no binary float ever holds it; the core converts it with any
 * decimal library it likes. `scale` is the most digits after the point, the step of the kind.
 */
export const decimal = definePrimitive({
  name: 'decimal',
  constraints: {
    min: bound,
    max: bound,
    exclusiveMin: bound,
    exclusiveMax: bound,
    scale: { schema: v.pipe(v.number(), v.safeInteger(), v.minValue(0)), aspect: 'step' },
    notIn: {
      schema: v.pipe(
        v.array(literal),
        v.minLength(1, 'must list at least one value'),
        v.check((values) => values.every((a, i) => values.findIndex((b) => compareDecimal(a, b) === 0) === i), 'must not list a value more than once'),
      ),
      aspect: 'exclusion',
    },
  },
  exclusive: BOUND_GROUPS,
  coherence: (c) => {
    const lower = c.min !== undefined ? { name: 'min', value: c.min, open: false } : c.exclusiveMin !== undefined ? { name: 'exclusiveMin', value: c.exclusiveMin, open: true } : undefined;
    const upper = c.max !== undefined ? { name: 'max', value: c.max, open: false } : c.exclusiveMax !== undefined ? { name: 'exclusiveMax', value: c.exclusiveMax, open: true } : undefined;
    const problems: CoherenceProblem[] = [];
    if (lower && upper) {
      const order = compareDecimal(lower.value, upper.value);
      if (order > 0) return [{ constraint: upper.name, message: `${lower.name} (${lower.value}) is greater than ${upper.name} (${upper.value}), so no value is valid` }];
      if (order === 0 && (lower.open || upper.open)) {
        return [{ constraint: upper.name, message: `${lower.name} and ${upper.name} are both ${lower.value}, and one of them excludes it, so no value is valid` }];
      }
      if (order === 0 && (c.notIn ?? []).some((value) => compareDecimal(value, lower.value) === 0)) {
        return [{ constraint: 'notIn', message: `min and max are both ${lower.value} and notIn lists it, so no value is valid` }];
      }
    }
    if (c.scale !== undefined && lower && upper) {
      // The smallest and largest values with `scale` digits that the bounds allow.
      let first = toScale(lower.value, c.scale, 'ceil');
      if (lower.open && compareDecimal(unscaled(first, c.scale), lower.value) === 0) first += 1n;
      let last = toScale(upper.value, c.scale, 'floor');
      if (upper.open && compareDecimal(unscaled(last, c.scale), upper.value) === 0) last -= 1n;
      if (first > last) {
        problems.push({ constraint: 'scale', message: `no value with at most ${c.scale} digit(s) after the point is between ${lower.name} (${lower.value}) and ${upper.name} (${upper.value}), so no value is valid` });
      } else if (c.notIn && last - first < ENUMERATION_LIMIT) {
        const excluded = c.notIn;
        let allowed = false;
        for (let n = first; n <= last && !allowed; n += 1n) {
          const value = unscaled(n, c.scale);
          allowed = !excluded.some((e) => compareDecimal(e, value) === 0);
        }
        if (!allowed) problems.push({ constraint: 'notIn', message: 'notIn lists every value that the bounds and scale allow, so no value is valid' });
      }
    }
    return problems;
  },
  // The cell as written: a decimal stays a string, so its digits stay exact.
  parseCell: (cell) => cell,
  boundaries: (c) => {
    const at = (bound: string) => (value: unknown) => isDecimal(value) && compareDecimal(value, bound) === 0;
    const beyond = (bound: string, side: -1 | 1) => (value: unknown) => isDecimal(value) && compareDecimal(value, bound) === side;
    /** One step outside a bound at the scale, when the bound has at most `scale` digits. */
    const step = (bound: string, side: -1 | 1): string | undefined =>
      c.scale !== undefined && fractionDigits(bound) <= c.scale ? unscaled(toScale(bound, c.scale, 'floor') + BigInt(side), c.scale) : undefined;
    const cases: BoundaryCase[] = [];
    if (c.min !== undefined) {
      const below = step(c.min, -1);
      cases.push({ label: `value at min ${c.min}`, covers: at(c.min) });
      cases.push(below === undefined ? { label: `value below min ${c.min}`, covers: beyond(c.min, -1) } : { label: `value one step below min (${below})`, covers: at(below) });
    }
    if (c.exclusiveMin !== undefined) {
      cases.push({ label: `value at exclusiveMin ${c.exclusiveMin}`, covers: at(c.exclusiveMin) });
      cases.push({ label: `value above exclusiveMin ${c.exclusiveMin}`, covers: beyond(c.exclusiveMin, 1) });
    }
    if (c.max !== undefined) {
      const above = step(c.max, 1);
      cases.push({ label: `value at max ${c.max}`, covers: at(c.max) });
      cases.push(above === undefined ? { label: `value above max ${c.max}`, covers: beyond(c.max, 1) } : { label: `value one step above max (${above})`, covers: at(above) });
    }
    if (c.exclusiveMax !== undefined) {
      cases.push({ label: `value at exclusiveMax ${c.exclusiveMax}`, covers: at(c.exclusiveMax) });
      cases.push({ label: `value below exclusiveMax ${c.exclusiveMax}`, covers: beyond(c.exclusiveMax, -1) });
    }
    if (c.scale !== undefined) {
      const scale = c.scale;
      cases.push({ label: `value with ${scale} digit(s) after the point (scale)`, covers: (value) => isDecimal(value) && fractionDigits(value) === scale });
      cases.push({ label: `value with ${scale + 1} digits after the point (above scale)`, covers: (value) => isDecimal(value) && fractionDigits(value) === scale + 1 });
    }
    for (const excluded of c.notIn ?? []) cases.push({ label: `value ${excluded} (notIn)`, covers: at(excluded) });
    return cases;
  },
});
