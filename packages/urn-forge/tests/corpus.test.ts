/** The checker and the score of the contract corpus (scripts/corpus.ts, contracts/). */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkCorpus, main, score } from '../scripts/corpus.js';

const CONFIG = 'minimum: 50\nholes:\n  A1: Rules over lists\n  B1: Either-or shapes\n';
const MANIFEST = 'manifest:\n  namespace: demo\n  domain: pay\n  version: 1.0.0\ndefinitions:\n  amount:\n    description: An amount\n    type: integer\n';

let roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

/** A corpus with one contract, `pay`, whose promises are `promises` (YAML under `promises:`). */
function corpus(promises: string, { config = CONFIG, manifest = MANIFEST as string | null } = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'urn-forge-corpus-'));
  roots.push(root);
  writeFileSync(join(root, 'corpus.yaml'), config);
  mkdirSync(join(root, 'pay'));
  writeFileSync(join(root, 'pay', 'promises.yaml'), `contract: pay\ndescription: Payments\npromises:\n${promises}`);
  if (manifest !== null) writeFileSync(join(root, 'pay', 'domain.manifest.yaml'), manifest);
  return root;
}

const DECLARED = '  P01:\n    promise: An amount is an integer\n    status: declared\n    by: [definitions.amount]\n';
const NOT_DECLARABLE = '  P02:\n    promise: The total is the sum of the lines\n    status: not-declarable\n    hole: A1\n';

describe('the corpus checker', () => {
  it('accepts a valid corpus, and scores declared ÷ all', () => {
    const report = checkCorpus(corpus(DECLARED + NOT_DECLARABLE));
    expect(report.problems).toEqual([]);
    expect(score(report.promises)).toBe(50);
  });

  it('counts a workaround as 0', () => {
    const workaround = '  P03:\n    promise: A card payment has a card number\n    status: workaround\n    by: [definitions.amount]\n    hole: B1\n';
    const report = checkCorpus(corpus(DECLARED + workaround + NOT_DECLARABLE));
    expect(report.problems).toEqual([]);
    expect(score(report.promises)).toBe(33.3);
  });

  it.each([
    ['a promise with no status', '  P01:\n    promise: An amount is an integer\n', 'pay.P01: has no status'],
    ['a status that does not exist', '  P01:\n    promise: An amount\n    status: done\n', 'pay.P01: status "done" is not one of declared, workaround, not-declarable'],
    ['a declared promise with no by', '  P01:\n    promise: An amount\n    status: declared\n', 'pay.P01: a declared promise needs by, the parts that state it'],
    ['a part that the manifest does not have', '  P01:\n    promise: An amount\n    status: declared\n    by: [definitions.total]\n', 'pay.P01: definitions.total is not a part or a header key of pay/domain.manifest.yaml'],
    ['a not-declarable promise with no hole', '  P01:\n    promise: A total\n    status: not-declarable\n', 'pay.P01: a not-declarable promise needs hole, the hole of the roadmap that would declare it'],
    ['a workaround with no hole', '  P01:\n    promise: A card\n    status: workaround\n    by: [definitions.amount]\n', 'pay.P01: a workaround promise needs hole, the hole of the roadmap that would declare it'],
    ['a hole that corpus.yaml does not list', '  P01:\n    promise: A total\n    status: not-declarable\n    hole: Z9\n', 'pay.P01: hole Z9 is not in corpus.yaml'],
    ['a declared promise with a hole', DECLARED + '    hole: A1\n', 'pay.P01: a declared promise has no hole'],
    ['a not-declarable promise with by', '  P01:\n    promise: A total\n    status: not-declarable\n    hole: A1\n    by: [definitions.amount]\n', 'pay.P01: a not-declarable promise has no by'],
    ['an ID that is not P and digits', '  X1:\n    promise: An amount\n    status: not-declarable\n    hole: A1\n', 'pay.X1: an ID is P and two or more digits'],
    ['a promise with no text', '  P01:\n    status: declared\n', 'pay.P01: needs promise, one sentence'],
  ])('refuses %s', (_, promises, problem) => {
    expect(checkCorpus(corpus(promises)).problems).toContain(problem);
  });

  it('accepts a key of the header as manifest.<key>, for a rule of the whole contract', () => {
    const header = '  P01:\n    promise: Nothing is removed\n    status: declared\n    by: [manifest.version]\n';
    expect(checkCorpus(corpus(header)).problems).toEqual([]);
    expect(checkCorpus(corpus(header.replace('manifest.version', 'manifest.compatibility'))).problems).toEqual([
      'pay.P01: manifest.compatibility is not a part or a header key of pay/domain.manifest.yaml',
    ]);
  });

  it('refuses by when the contract has no manifest', () => {
    expect(checkCorpus(corpus(DECLARED, { manifest: null })).problems).toContain('pay.P01: by names parts, but pay has no domain.manifest.yaml');
  });

  it('accepts promises with no manifest yet when none names a part', () => {
    expect(checkCorpus(corpus(NOT_DECLARABLE, { manifest: null })).problems).toEqual([]);
  });

  it('refuses an ID used two times, as YAML that is not valid', () => {
    expect(checkCorpus(corpus(DECLARED + DECLARED)).problems).toEqual(['pay/promises.yaml: not valid YAML: Map keys must be unique at line 8, column 3:']);
  });

  it('refuses a promise with a colon that is not quoted', () => {
    expect(checkCorpus(corpus('  P01:\n    promise: A payment moves: pending to captured\n')).problems[0]).toMatch(/^pay\/promises.yaml: not valid YAML: /);
  });

  it('refuses a minimum that is not a percent', () => {
    expect(checkCorpus(corpus(DECLARED, { config: 'minimum: 150\nholes:\n  A1: x\n' })).problems).toContain('corpus.yaml: minimum must be a number from 0 to 100');
  });
});

describe('the corpus command', () => {
  it('prints the score, the count by hole and each contract, and passes at the minimum', () => {
    const lines: string[] = [];
    expect(main(corpus(DECLARED + NOT_DECLARABLE), (l) => lines.push(l))).toBe(0);
    expect(lines).toEqual([
      'contract corpus: 1 of 2 promises declared (50.0%), minimum 50.0%',
      '  workaround      0',
      '  not declarable  1',
      '  by hole: A1 1',
      '  pay              1 of  2 declared',
    ]);
  });

  it('fails below the minimum', () => {
    const lines: string[] = [];
    expect(main(corpus(NOT_DECLARABLE), (l) => lines.push(l))).toBe(1);
    expect(lines.at(-1)).toBe('error: the score 0.0% is below the minimum 50.0% of corpus.yaml');
  });

  it('fails on a problem, and prints it', () => {
    const lines: string[] = [];
    expect(main(corpus('  P01:\n    promise: An amount\n'), (l) => lines.push(l))).toBe(1);
    expect(lines).toContain('error: pay.P01: has no status');
  });
});
