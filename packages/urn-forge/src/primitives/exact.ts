/**
 * Exact decimals and calendar days, for the `decimal`, `date` and `timestamp` descriptors
 * (pass 1, pass 7 and boundary coverage). The generated schemas carry their own copy of the
 * same rules (VALIBOT_HELPERS in src/plugins/valibot-helpers.ts); a test makes sure that
 * the two agree on many values.
 */

/** A decimal as it crosses the boundary: digits, an optional fraction, no exponent, no `+`. */
export const DECIMAL = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/u;

export function isDecimal(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL.test(value);
}

/** The number of digits after the point. */
export function fractionDigits(value: string): number {
  const point = value.indexOf('.');
  return point < 0 ? 0 : value.length - point - 1;
}

/** The value times 10^scale, as an integer. `scale` must be at least `fractionDigits(value)`. */
export function scaled(value: string, scale: number): bigint {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const point = unsigned.indexOf('.');
  const whole = point < 0 ? unsigned : unsigned.slice(0, point);
  const fraction = point < 0 ? '' : unsigned.slice(point + 1);
  const digits = BigInt(whole + fraction.padEnd(scale, '0'));
  return negative ? -digits : digits;
}

/** -1, 0 or 1. `"1.10"` and `"1.1"` are equal; so are `"-0"` and `"0"`. */
export function compareDecimal(a: string, b: string): number {
  const scale = Math.max(fractionDigits(a), fractionDigits(b));
  const x = scaled(a, scale);
  const y = scaled(b, scale);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The integer `n` divided by 10^scale, written as a decimal with exactly `scale` digits after the point. */
export function unscaled(n: bigint, scale: number): string {
  const negative = n < 0n;
  const digits = (negative ? -n : n).toString().padStart(scale + 1, '0');
  const text = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative ? `-${text}` : text;
}

/** The value at `scale` digits, rounded up (`ceil`) or down: the nearest value a `scale` allows. */
export function toScale(value: string, scale: number, round: 'ceil' | 'floor'): bigint {
  const digits = Math.max(scale, fractionDigits(value));
  const exact = scaled(value, digits);
  const unit = 10n ** BigInt(digits - scale);
  const quotient = exact / unit;
  const rest = exact % unit;
  if (rest === 0n) return quotient;
  // BigInt division truncates toward zero.
  if (round === 'floor') return exact < 0n ? quotient - 1n : quotient;
  return exact > 0n ? quotient + 1n : quotient;
}

/** `YYYY-MM-DD` that names a real day of the proleptic Gregorian calendar. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The day `days` after (or before) a calendar date. */
export function addDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day + days);
  const y = date.getUTCFullYear();
  return `${String(y).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** The days from 1970-01-01 to a calendar date (date arithmetic plan): exact, with no time zone. */
export function epochDay(value: string): number {
  const date = new Date(0);
  date.setUTCFullYear(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
  return date.getTime() / 86_400_000;
}

/** ISO 8601 in UTC: `YYYY-MM-DDTHH:MM:SSZ`, with an optional fraction of 1 to 3 digits. */
export function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?Z$/u.exec(value);
  return match !== null && isCalendarDate(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4]) < 60;
}

/** Milliseconds since the epoch: timestamps compare as instants, so `…:00Z` equals `…:00.000Z`. */
export function instant(value: string): number {
  return Date.parse(value);
}
