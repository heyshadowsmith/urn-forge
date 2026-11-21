/**
 * The generated helpers (src/plugins/valibot-helpers.ts) and the descriptors' rules
 * (src/primitives/exact.ts) are two copies of one set of rules. These tests run the helper
 * text and compare it with the descriptors on many values, and both with a reference.
 */
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { addDays, compareDecimal, epochDay, fractionDigits, isCalendarDate, isUtcTimestamp } from '../src/primitives/exact.js';
import { VALIBOT_HELPERS } from '../src/plugins/valibot-helpers.js';

const source = `${Object.values(VALIBOT_HELPERS).join('\n\n')}\nreturn { compareDecimal, decimalFraction, epochDay, isCalendarDate, isUtcTimestamp, DECIMAL };`;
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const generated = new Function(js)() as {
  compareDecimal(a: string, b: string): number;
  decimalFraction(value: string): number;
  epochDay(value: string): number;
  isCalendarDate(value: string): boolean;
  isUtcTimestamp(value: string): boolean;
};

/** A seeded generator, so a failure can be run again. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

function decimalSample(next: () => number): string {
  const whole = String(Math.floor(next() * 10 ** Math.floor(next() * 7)));
  const fraction = next() < 0.6 ? `.${String(Math.floor(next() * 1e6)).padStart(6, '0').slice(0, 1 + Math.floor(next() * 6))}` : '';
  return `${next() < 0.4 ? '-' : ''}${whole}${fraction}`;
}

describe('exact decimals', () => {
  it('compare as the descriptors do, and as exact numbers do', () => {
    const next = random(42);
    for (let i = 0; i < 20_000; i++) {
      const [a, b] = [decimalSample(next), decimalSample(next)];
      const expected = Math.sign(Number(a) - Number(b)) || 0;
      expect(compareDecimal(a, b), `${a} vs ${b}`).toBe(expected);
      expect(generated.compareDecimal(a, b), `${a} vs ${b}`).toBe(expected);
      expect(generated.decimalFraction(a)).toBe(fractionDigits(a));
    }
  });

  it('treat equal values as equal, whatever their digits', () => {
    for (const [a, b] of [['1.10', '1.1'], ['-0', '0'], ['0.000', '0'], ['-1.50', '-1.5']] as const) {
      expect(compareDecimal(a, b)).toBe(0);
      expect(generated.compareDecimal(a, b)).toBe(0);
    }
    expect(generated.compareDecimal('123456789012345678901234.5', '123456789012345678901234.4')).toBe(1);
  });
});

describe('calendar days and instants', () => {
  it('agree on every day of 1999 to 2001, and on dates that do not exist', () => {
    const samples: string[] = [];
    for (let y = 1999; y <= 2001; y++) for (let m = 0; m <= 13; m++) for (let d = 0; d <= 32; d++) samples.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    samples.push('2024-02-29', '2100-02-29', '2000-02-29', '0001-01-01', '0050-06-15', '2026-1-1', 'x');
    for (const s of samples) expect(generated.isCalendarDate(s), s).toBe(isCalendarDate(s));
    expect(samples.filter((s) => isCalendarDate(s)).length).toBe(365 + 366 + 365 + 4);
  });

  it('count days the same way, one day at a time, from year 1 to year 9999', () => {
    expect(epochDay('1970-01-01')).toBe(0);
    expect(epochDay('2026-11-21')).toBe(Date.UTC(2026, 10, 21) / 86_400_000);
    // Each step of addDays is one day more; the two copies agree at every step.
    for (const start of ['0001-01-01', '1899-12-25', '1999-12-25', '2028-02-20', '2100-02-20', '9999-12-01']) {
      let day = start;
      for (let i = 0; i < 40 && isCalendarDate(day); i++, day = addDays(day, 1)) {
        expect(epochDay(day), day).toBe(epochDay(start) + i);
        expect(generated.epochDay(day), day).toBe(epochDay(day));
      }
    }
  });

  it('agree on timestamps', () => {
    for (const s of [
      '2026-01-31T09:30:00Z', '2026-01-31T09:30:00.1Z', '2026-01-31T09:30:00.123Z', '2026-01-31T09:30:00.1234Z',
      '2026-01-31T24:00:00Z', '2026-01-31T23:60:00Z', '2026-01-31T23:59:60Z', '2026-02-30T00:00:00Z',
      '2026-01-31T09:30:00+00:00', '2026-01-31 09:30:00Z', '2026-01-31T09:30Z',
    ]) {
      expect(generated.isUtcTimestamp(s), s).toBe(isUtcTimestamp(s));
    }
  });
});
