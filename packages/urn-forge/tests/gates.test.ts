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
    } as unknown as GateContext).problems.filter((p) => p.code !== 'untagged-operation' && p.code !== 'uncovered-boundary');

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
    } as unknown as GateContext).problems.filter((p) => p.code !== 'uncovered-error' && p.code !== 'uncovered-boundary');

  it('checks the headers against the fields of the named error, not the operation', () => {
    expect(problems('    Then the operation fails with "urn:demo:shop:order:error:price_unavailable":\n      | sku |\n      | ABC-1234 |\n')).toEqual([]);
    expect(problems('    Then the operation fails with "urn:demo:shop:order:error:price_unavailable":\n      | total |\n      | 1 |\n')).toEqual([
      expect.objectContaining({ code: 'unknown-header', message: expect.stringContaining('is not a field key of the error urn:demo:shop:order:error:price_unavailable (allowed: sku)') }),
    ]);
  });
});

describe('gate 3: declared errors', () => {
  const ir = compile(readFileSync(repo('tests/fixtures/shop/domain.manifest.yaml'), 'utf8')).ir!;
  const PRICE = '@urn:demo:shop:order:operation:price_line';
  const UNAVAILABLE = 'urn:demo:shop:order:error:price_unavailable';
  const OFFLINE = 'urn:demo:shop:order:error:pricing_offline';
  const rawOutcome = (...thens: string[]) =>
    checkGherkin({
      ir,
      features: {
        directory: 'features',
        features: [
          indexFeatureSource(
            `${PRICE}\nFeature: x\n` +
              thens
                .map((then, i) => `  Scenario: s${i}\n    When I run the operation with:\n      | sku | quantity | unit_cost | terms_accepted |\n      | ABC-1234 | 1 | 1 | true |\n    ${then}\n`)
                .join(''),
            'f.feature',
          )!,
        ],
        problems: [],
      },
    } as unknown as GateContext);
  /** These tests are about declared errors, not boundaries. */
  const outcome = (...thens: string[]) => {
    const result = rawOutcome(...thens);
    return { ...result, problems: result.problems.filter((p) => p.code !== 'uncovered-boundary') };
  };

  it('counts both forms of the step, and passes with no warning when every error is expected', () => {
    const { problems, summary } = outcome(`Then the operation fails with "${UNAVAILABLE}"`, `Then the operation fails with "${OFFLINE}":\n      | kind |\n      | ${OFFLINE} |`);
    expect(problems.filter((p) => p.code !== 'unknown-header')).toEqual([]);
    expect(summary).toBe('1 feature(s), 2 scenario(s), 1/1 operations tagged, 2/2 errors expected');
  });

  it('warns for each declared error that no scenario expects', () => {
    const { problems, summary } = outcome(`Then the operation fails with "${UNAVAILABLE}"`);
    expect(problems).toEqual([
      expect.objectContaining({ code: 'uncovered-error', severity: 'warning', urn: OFFLINE, file: 'features' }),
    ]);
    expect(summary).toContain('1/2 errors expected');
  });

  it('fails a scenario that expects an error its operation does not declare, at the step', () => {
    const { problems } = outcome(`Then the operation fails with "urn:demo:shop:order:error:sold_out"`, `Then the operation fails with "${UNAVAILABLE}"`, `Then the operation fails with "${OFFLINE}"`);
    expect(problems).toEqual([
      expect.objectContaining({
        code: 'undeclared-error',
        severity: 'error',
        location: { line: 7, column: 5 },
        message: `"urn:demo:shop:order:error:sold_out" is not a declared error of urn:demo:shop:order:operation:price_line (errors: ${UNAVAILABLE}, ${OFFLINE})`,
      }),
    ]);
  });
});

describe('gate 3: boundary coverage', () => {
  const coverage = async (manifest: string, featuresDir: string) => {
    const ir = compile(readFileSync(repo(manifest), 'utf8')).ir!;
    const features = await indexFeatures(repo(featuresDir), repo(''));
    return checkGherkin({ ir, features } as unknown as GateContext)
      .problems.filter((p) => p.code === 'uncovered-boundary')
      .map((p) => [p.severity, p.urn!.split(':').at(-1), p.message.replace(/^\S+ in the input of \S+:operation:/, '')]);
  };

  it('reports exactly the target: nothing for the math example', async () => {
    expect(await coverage('tests/fixtures/math/domain.manifest.yaml', 'example/features')).toEqual([]);
  });

  it('reports exactly the target: six gaps in self/', async () => {
    const regex = 'has no invalid value for regex [a-z][a-z0-9_]{0,62}';
    expect(await coverage('self/domain.manifest.yaml', 'self/features')).toEqual([
      ['warning', 'short_key', 'parse_short_key has no value of length 1 (minLength), no value of length 0 (below minLength)'],
      ['warning', 'identifier', `to_brand_identifier ${regex}`],
      ['warning', 'namespace', `to_urn ${regex}`],
      ['warning', 'domain', `to_urn ${regex}`],
      ['warning', 'context', `to_urn ${regex}`],
      ['warning', 'identifier', `to_urn ${regex}`],
    ]);
  });

  it('counts values per operation, through Outline placeholders', () => {
    const ir = compile(readFileSync(repo('tests/fixtures/shop/domain.manifest.yaml'), 'utf8')).ir!;
    const PRICE = '@urn:demo:shop:order:operation:price_line';
    const gaps = (rows: string) =>
      checkGherkin({
        ir,
        features: {
          directory: 'features',
          features: [indexFeatureSource(`${PRICE}\nFeature: x\n  Scenario Outline: y\n    When I run the operation with:\n      | quantity |\n      | <q> |\n    Examples:\n      | q |\n${rows}`, 'f.feature')!],
          problems: [],
        },
      } as unknown as GateContext).problems.filter((p) => p.code === 'uncovered-boundary' && p.urn!.endsWith(':quantity'));
    // quantity: integer, min 1, max 99, notEqual 13.
    expect(gaps(['0', '1', '99', '100', '13'].map((q) => `      | ${q} |\n`).join(''))).toEqual([]);
    expect(gaps(['1', '99', '13'].map((q) => `      | ${q} |\n`).join(''))[0]?.message).toMatch(/has no value at min − 1 \(0\), no value at max \+ 1 \(100\)$/);
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
