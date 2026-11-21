/** Formula cells (formula cells plan): long values for strict coverage, written as =repeat(…). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { indexFeatureSource } from '../src/verify/feature-index.js';
import { checkGherkin } from '../src/verify/gherkin.js';
import type { GateContext } from '../src/verify/types.js';

const ir = compile(readFileSync(new URL('./fixtures/formula-cells/domain.manifest.yaml', import.meta.url), 'utf8')).ir!;
const LINE = '{ category: travel, amount: 10.00 }';

/** The feature of the target: each long value of the third blind trial is a formula cell. */
export const FEATURE = `@urn:demo:expenses:claim:operation:submit
Feature: Long values

  Scenario Outline: Too many lines, a long note or a long reason
    When I run the operation with:
      | lines   | reason   |
      | <lines> | <reason> |
    Then the input is rejected on "<field>"

    Examples:
      | lines                                                   | reason               | field  |
      | =repeat(21, ${LINE})                                     | ok                   | lines  |
      | [{ category: travel, amount: 1.00, note: =repeat(201, "x") }] | ok              | lines  |
      | [${LINE}]                                                | =repeat(301, "x")    | reason |
`;

const gaps = (feature: string) =>
  checkGherkin({ ir, features: { directory: 'features', features: [indexFeatureSource(feature, 'f.feature')!], problems: [] }, boundaryCoverage: 'error' } as unknown as GateContext).problems.filter(
    (p) => p.code === 'uncovered-boundary' || p.code === 'invalid-cell',
  );

describe('gate 3 reads formula cells', () => {
  it('counts =repeat(21, …) as 21 items, and =repeat(201, "x") and =repeat(301, "x") as long texts', () => {
    const messages = gaps(FEATURE).map((p) => p.message);
    expect(messages.filter((m) => /above maxItems|above maxLength/u.test(m))).toEqual([]);
    expect(gaps(FEATURE).filter((p) => p.code === 'invalid-cell')).toEqual([]);
  });
});

describe('the forms of a formula', async () => {
  const { readCell, CellSyntaxError } = await import('../src/gherkin/cells.js');
  const text = { primitive: 'string' as const };
  const perils = { primitive: 'enum' as const, many: true };
  const line = { entity: 'line', fields: { category: { primitive: 'enum' as const }, note: { primitive: 'string' as const } } };
  const lines = { ...line, many: true };

  it('makes text, lists, and values inside a list or an object', () => {
    expect(readCell('=repeat(3, "ab")', text)).toBe('ababab');
    expect(readCell('="a@" + repeat(3, "b") + ".io"', text)).toBe('a@bbb.io');
    expect(readCell('="=x"', text)).toBe('=x');
    expect([...(readCell('=repeat(201, "é")', text) as string)].length).toBe(201);
    expect(readCell('=repeat(0, "x")', text)).toBe('');
    expect(readCell('=repeat(2, fire)', perils)).toEqual(['fire', 'fire']);
    expect(readCell('=[fire] + repeat(2, flood)', perils)).toEqual(['fire', 'flood', 'flood']);
    expect(readCell('=repeat(2, { category: travel })', lines)).toEqual([{ category: 'travel' }, { category: 'travel' }]);
    expect(readCell('[{ category: other, note: =repeat(3, "n") }]', lines)).toEqual([{ category: 'other', note: 'nnn' }]);
    expect(readCell('={ category: meals }', line)).toEqual({ category: 'meals' });
    // A number from text: a formula is read by the primitive, as a plain cell is.
    expect(readCell('="1" + repeat(2, "0")', { primitive: 'integer' })).toBe(100);
  });

  it('refuses each malformed formula with its column', () => {
    const problem = (cell: string, shape: Parameters<typeof readCell>[1] = text) => {
      try {
        readCell(cell, shape);
      } catch (error) {
        if (error instanceof CellSyntaxError) return error.message;
        throw error;
      }
      return 'no problem';
    };
    expect(problem('=x')).toBe('a formula is repeat(n, value), a quoted text, a list or an object, joined with "+"; to write a text that starts with "=", write ="=…" (at column 2 of the cell)');
    expect(problem('=repeat(3, "a"')).toBe('expected ")" at the end of repeat (at column 15 of the cell)');
    expect(problem('=repeat(20000, "a")')).toBe('repeat needs a count from 0 to 10000 (at column 9 of the cell)');
    expect(problem('=repeat(-1, "a")')).toBe('repeat needs a count from 0 to 10000 (at column 9 of the cell)');
    expect(problem('=repeat(3 "a")')).toBe('expected "," after the count of repeat (at column 11 of the cell)');
    expect(problem('=repeat(2, [a])')).toBe('a formula for a single value joins texts; a list or an object is not text (at column 2 of the cell)');
    expect(problem('="a" + repeat(2, fire)', perils)).toBe('a formula for a list joins lists and repeat(n, item) (at column 2 of the cell)');
    expect(problem('=repeat(2, { note: =repeat(2, "x") })', lines)).toBe('a formula cannot hold another formula (at column 20 of the cell)');
    expect(problem('=repeat(10000, "abcdefghijklmnopqrstuvwxyz") + repeat(10000, "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz")')).toBe(
      'a formula makes at most 1000000 characters (at column 48 of the cell)',
    );
  });

  it('gate 3 reports a malformed formula as invalid-cell', () => {
    const feature = FEATURE.replace('=repeat(21, ', '=repeat(21 ');
    expect(gaps(feature).filter((p) => p.code === 'invalid-cell').map((p) => p.message)).toEqual([expect.stringContaining('lines: expected "," after the count of repeat')]);
  });
});

describe('each long value is refused at the boundary', async () => {
  const runtime = await import('./fixtures/formula-cells/expected/domain.runtime.generated.js');
  const { tableToObject } = await import('../src/gherkin/steps.js');
  const SUBMIT = 'urn:demo:expenses:claim:operation:submit';
  const core = { [SUBMIT]: (claim: never) => runtime.ok(claim) } as never;
  const rows = FEATURE.split('Examples:')[1]!.trim().split('\n').slice(1).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  it.each(rows)('%s', (lines, reason, field) => {
    const input = tableToObject([['lines', 'reason'], [lines!, reason!]], runtime.DispatchMap[SUBMIT].input.fields as never, 'input', SUBMIT);
    const result = runtime.executeOperation(SUBMIT, input, core);
    expect(result).toMatchObject({ ok: false, kind: 'InputRejected', issues: [expect.objectContaining({ path: expect.stringMatching(new RegExp(`^${field}`)) })] });
  });
});
