/**
 * `urn-forge/exact`: exact arithmetic on decimals and calendar days, for a core.
 *
 * A `decimal` value is a string, so that no binary float changes it, and a `date` is a
 * `YYYY-MM-DD` string. A core that calculates with them needs exact operations: these. They
 * use the same rules as the generated schemas and the rule language (src/primitives/exact.ts),
 * so a total that the core calculates compares in the same way as a rule over it.
 *
 * Each function takes plain values (a branded value is also one) and returns a plain value. The
 * core returns it, and the shell parses and brands it (spec §7.2). Gate 2 allows this import in a
 * core: it makes no branded value. The module imports nothing else.
 */
import { addDays as addDaysTo, compareDecimal as compare, epochDay as epochDayOf, fractionDigits, scaled, unscaled } from './primitives/exact.js';

/** How a result with more digits than its scale is rounded. */
export type Rounding = 'half-up' | 'half-even' | 'floor' | 'ceil';

/** n / d rounded by `mode`; d is not 0. */
function divide(n: bigint, d: bigint, mode: Rounding): bigint {
  if (d < 0n) [n, d] = [-n, -d];
  const floor = n >= 0n ? n / d : -((-n + d - 1n) / d);
  const rest = n - floor * d; // 0 ≤ rest < d
  if (rest === 0n) return floor;
  switch (mode) {
    case 'floor':
      return floor;
    case 'ceil':
      return floor + 1n;
    case 'half-up':
      // Half away from zero.
      return 2n * rest > d || (2n * rest === d && n > 0n) ? floor + 1n : floor;
    case 'half-even':
      return 2n * rest > d || (2n * rest === d && floor % 2n !== 0n) ? floor + 1n : floor;
  }
}

/** -1, 0 or 1: `"1.10"` equals `"1.1"`. */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  return compare(a, b) as -1 | 0 | 1;
}

/** a + b, exactly, with the digits after the point of the longer one: `addDecimal("0.1", "0.2")` is `"0.3"`. */
export function addDecimal(a: string, b: string): string {
  const scale = Math.max(fractionDigits(a), fractionDigits(b));
  return unscaled(scaled(a, scale) + scaled(b, scale), scale);
}

/** a − b, exactly. */
export function subtractDecimal(a: string, b: string): string {
  const scale = Math.max(fractionDigits(a), fractionDigits(b));
  return unscaled(scaled(a, scale) - scaled(b, scale), scale);
}

/** The sum of the values, exactly; `"0"` for none. */
export function sumDecimal(values: readonly string[]): string {
  return values.reduce(addDecimal, '0');
}

/** a × b, exactly: the digits after the point are those of a and b together. */
export function multiplyDecimal(a: string, b: string): string {
  return unscaled(scaled(a, fractionDigits(a)) * scaled(b, fractionDigits(b)), fractionDigits(a) + fractionDigits(b));
}

/** a ÷ b with `scale` digits after the point, rounded by `rounding`. Throws a RangeError if b is 0. */
export function divideDecimal(a: string, b: string, scale: number, rounding: Rounding): string {
  const [fa, fb] = [fractionDigits(a), fractionDigits(b)];
  const denominator = scaled(b, fb) * 10n ** BigInt(fa);
  if (denominator === 0n) throw new RangeError(`divideDecimal: division of ${a} by ${b}`);
  return unscaled(divide(scaled(a, fa) * 10n ** BigInt(fb + scale), denominator, rounding), scale);
}

/** The value with `scale` digits after the point, rounded by `rounding`: `roundDecimal("12.525", 2, "half-up")` is `"12.53"`. */
export function roundDecimal(value: string, scale: number, rounding: Rounding): string {
  const digits = Math.max(scale, fractionDigits(value));
  return unscaled(divide(scaled(value, digits), 10n ** BigInt(digits - scale), rounding), scale);
}

/** The days from `1970-01-01` to a calendar date: exact, with no time zone. */
export function epochDay(date: string): number {
  return epochDayOf(date);
}

/** The day `days` after the date (before it, if `days` is negative): `addDays("2028-02-28", 1)` is `"2028-02-29"`. */
export function addDays(date: string, days: number): string {
  return addDaysTo(date, days);
}

/** The days from `from` to `to`: negative if `to` is before `from`. As `to - from` in a rule. */
export function daysBetween(from: string, to: string): number {
  return epochDayOf(to) - epochDayOf(from);
}
