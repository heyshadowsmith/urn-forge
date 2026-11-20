/**
 * The gate framework and the feature index (foundations plan, phase 5), and gate 3's
 * required-column check (spec §8 "missing required fields fail").
 */
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, verifyPassedLine } from '../src/cli.js';
import { compile } from '../src/engine.js';
import { indexFeatureSource, indexFeatures } from '../src/verify/feature-index.js';
import { checkGherkin } from '../src/verify/gherkin.js';
import { GATES } from '../src/verify/index.js';
import type { Gate, GateContext } from '../src/verify/types.js';

const repo = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const mathSource = readFileSync(repo('tests/fixtures/math/domain.manifest.yaml'), 'utf8');
const SAFE_DIVIDE = '@urn:demo:math:arithmetic:operation:safe_divide';
const COMPUTE_AREA = '@urn:demo:math:geometry:operation:compute_area';

const FEATURE = `@${'wip'}
Feature: Index

  Background:
    Given nothing

  ${SAFE_DIVIDE}
  Scenario Outline: Outline
    When I run the operation with:
      | dividend   | divisor   |
      | <dividend> | <divisor> |

    @fast
    Examples:
      | dividend | divisor |
      | 10       | 2       |
      | 9        | 3       |

  Rule: circles
    ${COMPUTE_AREA}
    Scenario: In a rule
      When I run the operation with:
        | radius |
        | 1      |
`;

describe('feature index', () => {
  const feature = indexFeatureSource(FEATURE, 'f.feature')!;

  it('lists each scenario with its tags in scope, background steps first', () => {
    expect(feature.scenarios.map((s) => [s.name, s.tags.map((t) => t.name), s.steps.map((st) => [st.text, st.background])])).toEqual([
      ['Outline', ['@wip', SAFE_DIVIDE], [['nothing', true], ['I run the operation with:', false]]],
      ['In a rule', ['@wip', COMPUTE_AREA], [['nothing', true], ['I run the operation with:', false]]],
    ]);
  });

  it('keeps tables with cell positions, and Examples values by row', () => {
    const [outline] = feature.scenarios;
    expect(outline!.steps[1]!.table!.header).toEqual([
      { value: 'dividend', location: { line: 10, column: 9 } },
      { value: 'divisor', location: { line: 10, column: 22 } },
    ]);
    expect(outline!.examples).toEqual([
      expect.objectContaining({
        tags: [{ name: '@fast', location: { line: 13, column: 5 } }],
        table: expect.objectContaining({ rows: [['10', '2'], ['9', '3']] }),
      }),
    ]);
  });

  it('lists every tag written in the file once', () => {
    expect(feature.declaredTags.map((t) => t.name)).toEqual(['@wip', SAFE_DIVIDE, '@fast', COMPUTE_AREA]);
  });

  it('reports an unreadable directory and a file it cannot parse', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'urn-forge-index-'));
    try {
      await writeFile(join(dir, 'bad.feature'), 'this is not gherkin\n');
      const index = await indexFeatures(dir, dir);
      expect(index.problems).toEqual([expect.objectContaining({ code: 'feature-parse-error', file: 'bad.feature' })]);
      expect((await indexFeatures(join(dir, 'missing'), dir)).problems).toEqual([
        expect.objectContaining({ code: 'features-unreadable', file: 'missing' }),
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('gate 3: required input columns', () => {
  const ir = compile(mathSource).ir!;
  const problems = (source: string) =>
    checkGherkin({
      ir,
      features: { directory: 'features', features: [indexFeatureSource(source, 'f.feature')!], problems: [] },
    } as unknown as GateContext).problems.filter((p) => p.code !== 'untagged-operation');

  it('fails when the input table has no column for a required field', () => {
    expect(problems(`${SAFE_DIVIDE}\nFeature: x\n  Scenario: y\n    When I run the operation with:\n      | dividend |\n      | 1        |\n`)).toEqual([
      expect.objectContaining({
        code: 'missing-column',
        urn: SAFE_DIVIDE.slice(1),
        location: { line: 5, column: 7 },
        message: expect.stringContaining('required input field(s) "divisor"'),
      }),
    ]);
  });

  it('accepts an empty cell as the way to send a missing value', () => {
    expect(problems(`${SAFE_DIVIDE}\nFeature: x\n  Scenario: y\n    When I run the operation with:\n      | dividend | divisor |\n      | 1        |         |\n`)).toEqual([]);
  });

  it('does not require output columns, or columns in other steps', () => {
    const source = `${SAFE_DIVIDE}\nFeature: x\n  Scenario: y\n    When I run the operation with:\n      | dividend | divisor |\n      | 1 | 2 |\n    Then the output is:\n      | quotient |\n      | 0.5 |\n`;
    expect(problems(source)).toEqual([]);
  });
});

describe('gate 3: tables of the fails-with step', () => {
  const ir = compile(readFileSync(repo('tests/fixtures/shop/domain.manifest.yaml'), 'utf8')).ir!;
  const PRICE = '@urn:demo:shop:order:operation:price_line';
  const problems = (then: string) =>
    checkGherkin({
      ir,
      features: {
        directory: 'features',
        features: [
          indexFeatureSource(
            `${PRICE}\nFeature: x\n  Scenario: y\n    When I run the operation with:\n      | sku | quantity | unit_cost | terms_accepted |\n      | ABC-1234 | 1 | 1 | true |\n${then}`,
            'f.feature',
          )!,
        ],
        problems: [],
      },
    } as unknown as GateContext).problems;

  it('checks the headers against the fields of the named error, not the operation', () => {
    expect(problems('    Then the operation fails with "urn:demo:shop:order:error:price_unavailable":\n      | sku |\n      | ABC-1234 |\n')).toEqual([]);
    expect(problems('    Then the operation fails with "urn:demo:shop:order:error:price_unavailable":\n      | total |\n      | 1 |\n')).toEqual([
      expect.objectContaining({ code: 'unknown-header', message: expect.stringContaining('is not a field key of the error urn:demo:shop:order:error:price_unavailable (allowed: sku)') }),
    ]);
  });
});

describe('gate framework', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'urn-forge-gates-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('runs gates 1, 3 and 4 in order', () => {
    expect(GATES.map((g) => [g.number, g.name])).toEqual([
      [1, 'completeness'],
      [3, 'gherkin'],
      [4, 'drift'],
    ]);
  });

  it('passes a gate whose problems are only warnings, and counts them', async () => {
    const { verify } = await import('../src/verify/index.js');
    await writeFile(join(dir, 'm.yaml'), mathSource);
    const warner: Gate = {
      number: 2,
      name: 'lint',
      run: () => ({ summary: 'stub', problems: [{ code: 'type-error', severity: 'warning', file: 'x.ts', message: 'only a warning' }] }),
    };
    const result = await verify({
      cwd: dir,
      manifestPath: join(dir, 'm.yaml'),
      outDir: dir,
      corePath: join(dir, 'core.ts'),
      featuresDir: dir,
      tsconfigPath: join(dir, 'tsconfig.json'),
      gates: [warner],
    });
    expect(result).toMatchObject({ ok: true, gates: [{ gate: 2, name: 'lint', ok: true }] });
  });

  it('CLI: the passing line names the gates that ran, and counts warnings', async () => {
    const out: string[] = [];
    const io = { cwd: repo(''), stdout: (l: string) => out.push(l), stderr: () => undefined };
    expect(await main(['verify', '--config', 'example/urn-forge.config.ts'], io)).toBe(0);
    expect(out.at(-1)).toBe('verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)');
    expect(verifyPassedLine([1, 3, 4], 2)).toBe('verify passed with 2 warning(s) (gates 1, 3, 4; gates 2 and 5 are not in the MVP)');
  });
});
