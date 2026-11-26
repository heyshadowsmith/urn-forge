/**
 * The durations of the rule language: a literal such as '1h30m' as milliseconds, and CEL's range of a
 * duration, about 10000 years either way.
 */

/** CEL's longest duration: 315576000000 seconds. */
export const MAX_DURATION_MS = 315_576_000_000_000;

/** The milliseconds of a CEL duration literal, such as '1h30m' or '-2s'. */
export function durationMs(text: string): number {
  const UNITS: Readonly<Record<string, number>> = { h: 3_600_000, m: 60_000, s: 1000, ms: 1, us: 0.001, ns: 0.000001 };
  let total = 0;
  for (const [, amount, unit] of text.matchAll(/(\d+(?:\.\d+)?)(ms|us|ns|h|m|s)/g)) total += Number(amount) * UNITS[unit!]!;
  return text.startsWith('-') ? -total : total;
}
