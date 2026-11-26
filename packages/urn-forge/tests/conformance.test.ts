/**
 * The ratchet of the rule language: each conformance test of cel-spec in scope passes, or is a known
 * gap. A test that fails and is not in known-gaps.txt fails CI, and so does a known gap that passes.
 * Write the list again with npm run conformance -- --write.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { runAll, type Outcome } from './conformance/runner.js';

const GAPS = new URL('./conformance/known-gaps.txt', import.meta.url);

describe('the conformance tests of cel-spec', () => {
  let outcomes: Outcome[];
  let gaps: Set<string>;
  beforeAll(() => {
    outcomes = runAll();
    gaps = new Set(readFileSync(GAPS, 'utf8').split('\n').filter((line) => line !== '' && !line.startsWith('#')));
  });

  it('fails only where a gap is known', () => {
    const fails = outcomes.filter((o) => o.result === 'fail' && !gaps.has(o.id));
    expect(fails.map((o) => `${o.id}: ${o.result === 'fail' ? o.why : ''}`)).toEqual([]);
  });

  it('knows no gap that passes, or that is not a test in scope', () => {
    const failing = new Set(outcomes.filter((o) => o.result === 'fail').map((o) => o.id));
    expect([...gaps].filter((id) => !failing.has(id))).toEqual([]);
  });
});
