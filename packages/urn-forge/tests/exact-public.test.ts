/** urn-forge/exact: exact decimals and days for a core. */
import { describe, expect, it } from 'vitest';
import { addDays, addDecimal, compareDecimal, daysBetween, divideDecimal, epochDay, multiplyDecimal, roundDecimal, subtractDecimal, sumDecimal, type Rounding } from 'urn-forge/exact';

describe('decimals', () => {
  it('add, subtract and sum with no float error', () => {
    expect(addDecimal('0.1', '0.2')).toBe('0.3');
    expect(addDecimal('1.5', '2')).toBe('3.5');
    expect(subtractDecimal('1', '1.01')).toBe('-0.01');
    expect(sumDecimal(['19.99', '0.01', '120.50'])).toBe('140.50');
    expect(sumDecimal([])).toBe('0');
    expect(compareDecimal('1.10', '1.1')).toBe(0);
    expect(compareDecimal('-0.5', '0')).toBe(-1);
  });

  it('multiply exactly, then round to a scale', () => {
    expect(multiplyDecimal('25.05', '0.5')).toBe('12.525');
    expect(multiplyDecimal('-1.5', '1.5')).toBe('-2.25');
    const round = (value: string, mode: Rounding) => roundDecimal(value, 2, mode);
    expect(['half-up', 'half-even', 'floor', 'ceil'].map((m) => round('12.525', m as Rounding))).toEqual(['12.53', '12.52', '12.52', '12.53']);
    expect(['half-up', 'half-even', 'floor', 'ceil'].map((m) => round('-12.525', m as Rounding))).toEqual(['-12.53', '-12.52', '-12.53', '-12.52']);
    expect(round('12.535', 'half-even')).toBe('12.54');
    expect(round('7', 'floor')).toBe('7.00');
    expect(roundDecimal('0.004', 2, 'half-up')).toBe('0.00');
  });

  it('divide to a scale with the rounding asked for, and refuse 0', () => {
    expect(divideDecimal('10', '3', 2, 'floor')).toBe('3.33');
    expect(divideDecimal('20', '3', 2, 'half-up')).toBe('6.67');
    expect(divideDecimal('-20', '3', 2, 'half-up')).toBe('-6.67');
    expect(divideDecimal('1.5', '0.25', 0, 'floor')).toBe('6');
    expect(() => divideDecimal('1', '0.00', 2, 'floor')).toThrow(RangeError);
  });

  it('agrees with exact fractions on many values', () => {
    // A seeded generator, so a failure can be run again.
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    const decimal = () => `${next() % 2 ? '-' : ''}${next() % 100000}.${String(next() % 1000).padStart(3, '0')}`;
    const asFraction = (s: string): [bigint, bigint] => [BigInt(s.replace('.', '')), 1000n];
    for (let i = 0; i < 500; i++) {
      const [a, b] = [decimal(), decimal()];
      const [na, da] = asFraction(a);
      const [nb, db] = asFraction(b);
      // floor((a / b) * 100) with exact integers, as the reference.
      if (nb === 0n) continue;
      let [n, d] = [na * db * 100n, da * nb];
      if (d < 0n) [n, d] = [-n, -d];
      const floor = n >= 0n ? n / d : -((-n + d - 1n) / d);
      expect(compareDecimal(divideDecimal(a, b, 2, 'floor'), `${floor < 0n ? '-' : ''}${(floor < 0n ? -floor : floor) / 100n}.${String((floor < 0n ? -floor : floor) % 100n).padStart(2, '0')}`), `${a} / ${b}`).toBe(0);
      expect(compareDecimal(addDecimal(a, b), String((Number(na) + Number(nb)) / 1000))).toBe(0);
    }
  });
});

describe('days', () => {
  it('count days with no time zone, across 29 February', () => {
    expect(epochDay('1970-01-01')).toBe(0);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2027-03-01', '2028-03-01')).toBe(366);
    expect(daysBetween('2026-01-10', '2026-01-01')).toBe(-9);
  });
});
