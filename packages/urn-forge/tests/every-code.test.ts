/**
 * Every diagnostic code has a case here that makes urn-forge report it.
 *
 * `PRODUCERS` is typed `Record<DiagnosticCode, …>`, so a new code in DIAGNOSTIC_CODES
 * without a case here fails `tsc` (CI's typecheck). A code that cannot be produced does not
 * belong in DIAGNOSTIC_CODES: make it an internal error instead. docs/reference/diagnostics.md
 * documents every code, and tests/diagnostics.test.ts keeps that list in step.
 */
import { readFileSync } from 'node:fs';
import { cp, mkdtemp, rm, symlink, writeFile, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';
import { loadConfig, pluginEntries } from '../src/config.js';
import { DIAGNOSTIC_CODES, type Diagnostic, type DiagnosticCode } from '../src/diagnostics.js';
import { diffManifests } from '../src/diff/index.js';
import { compile, DEFAULT_PLUGINS } from '../src/engine.js';
import { PLUGINS } from '../src/plugins/index.js';
import { indexFeatureSource } from '../src/verify/feature-index.js';
import { checkGherkin } from '../src/verify/gherkin.js';
import { verify, type VerifyOptions } from '../src/verify/index.js';
import type { GateContext } from '../src/verify/types.js';

const repo = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const source = (path: string) => readFileSync(repo(path), 'utf8');

const HEADER = 'manifest:\n  namespace: demo\n  domain: math\n  version: 1.0.0\n';
const manifest = (body: string) => compile(`${HEADER}${body}`).diagnostics;
const math = source('tests/fixtures/math/domain.manifest.yaml');
/** An invariant over a small policy entity, with this rule. */
const invariant = (rule: string) =>
  manifest(
    'p.field.effective_date: { primitive: date }\np.field.expiry_date: { primitive: date }\n' +
      'p.field.premium: { primitive: decimal }\np.field.deductible: { primitive: decimal }\n' +
      'p.entity.policy:\n  description: d\n  fields:\n    - ref: p.field.effective_date\n    - ref: p.field.expiry_date\n' +
      '    - ref: p.field.premium\n    - { ref: p.field.deductible, required: false }\n' +
      `p.invariant.rule:\n  description: d\n  on: p.entity.policy\n  rule: ${rule}\n  message: m\n`,
  );

// Gate 3, over the tutorial's shipping domain (an operation, a declared error, constrained fields).
const shipping = compile(source('tutorial/2-declared-errors/domain.manifest.yaml')).ir!;
const OPERATION = '@urn:demo:shipping:quote:operation:quote_shipping';
const ERROR = 'urn:demo:shipping:quote:error:too_heavy_for_express';
const RUN = '    When I run the operation with:\n      | weight_grams | zone |\n      | 800 | domestic |\n';
const gate3 = (feature: string, boundaryCoverage: 'warn' | 'error' = 'warn', ir = shipping): readonly Diagnostic[] =>
  checkGherkin({
    ir,
    features: { directory: 'features', features: [indexFeatureSource(feature, 'f.feature')!], problems: [] },
    boundaryCoverage,
  } as unknown as GateContext).problems;
const scenario = (steps: string, tags = OPERATION, comments = '') => `${comments}${tags}\nFeature: f\n  Scenario: s\n${steps}`;

// Invariants, over the insurance domain.
const insurance = compile(source('insurance/domain.manifest.yaml')).ir!;
const ISSUE = '@urn:acme:insurance:policy:operation:issue_policy';
const ISSUE_RUN =
  '    When I run the operation with:\n      | policy_id | effective_date | expiry_date | premium |\n' +
  '      | 123e4567-e89b-12d3-a456-426614174000 | 2026-01-01 | 2026-12-31 | 1.00 |\n';

// The tutorial's strict step 3 passes every check, so one change shows one code.
const strict = compile(source('tutorial/3-strict-coverage/domain.manifest.yaml')).ir!;
const strictFeature = source('tutorial/3-strict-coverage/features/quote_shipping.feature');

// Gates 1 and 4, and the CLI, over a copy of the tutorial's step 2.
let dir: string;
const at = (path: string) => join(dir, path);
const nodeModules = (() => {
  let d = createRequire(import.meta.url).resolve('valibot');
  while (basename(d) !== 'node_modules') d = dirname(d);
  return d;
})();
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'urn-forge-every-code-'));
  await cp(repo('tutorial/2-declared-errors'), dir, { recursive: true });
  await symlink(nodeModules, at('node_modules'), 'dir');
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
/** Runs verify on the copy, after `prepare`, then puts the copy back. */
async function project(options: Partial<VerifyOptions>, prepare?: () => Promise<void>, undo?: () => Promise<void>): Promise<readonly Diagnostic[]> {
  await prepare?.();
  try {
    const result = await verify({
      cwd: dir,
      manifestPath: at('domain.manifest.yaml'),
      outDir: at('src/generated'),
      corePath: at('src/core.ts'),
      featuresDir: at('features'),
      tsconfigPath: at('tsconfig.json'),
      ...options,
    });
    return [...result.diagnostics, ...result.gates.flatMap((g) => g.problems)];
  } finally {
    await undo?.();
  }
}
/** Verify with one shell file of this source (gate 2). */
const shell = (text: string) => project({ shellPaths: [at('shell.ts')] }, () => writeFile(at('shell.ts'), text), () => rm(at('shell.ts')));
const RUNTIME = 'src/generated/domain.runtime.generated.ts';
const runtime = () => source('tutorial/2-declared-errors/src/generated/domain.runtime.generated.ts');

const PRODUCERS: Record<DiagnosticCode, () => readonly Diagnostic[] | Promise<readonly Diagnostic[]>> = {
  // Reading the config
  'config-unreadable': async () => {
    const loaded = await loadConfig(join(tmpdir(), 'urn-forge-no-such-config.ts'), 'x.ts');
    return loaded.ok ? [] : loaded.diagnostics;
  },
  'config-invalid': () => {
    const entries = pluginEntries([['nope' as 'valibot', {}]], 'x.ts');
    return entries.ok ? [] : entries.diagnostics;
  },
  // Reading the manifest
  'manifest-unreadable': async () => {
    const err: Diagnostic[] = [];
    await main(['compile', '--manifest', 'nope.yaml', '--format', 'json'], {
      cwd: dir,
      stdout: (line) => {
        const parsed = JSON.parse(line) as { type: string } & Diagnostic;
        if (parsed.type === 'diagnostic') err.push(parsed);
      },
      stderr: () => undefined,
    });
    return err;
  },
  'yaml-syntax': () => manifest('a.field.b: [\n'),
  'duplicate-key': () => manifest('a.field.b: { primitive: float }\na.field.b: { primitive: float }\n'),
  // Pass 1
  'not-a-mapping': () => compile('- a\n').diagnostics,
  'missing-header': () => compile('a.field.b: { primitive: float }\n').diagnostics,
  'invalid-key': () => manifest('Bad Key: { primitive: float }\n'),
  'unknown-kind': () => manifest('a.widget.b: {}\n'),
  'unknown-primitive': () => manifest('a.field.b: { primitive: money }\n'),
  'constraint-not-allowed': () => manifest('a.field.b: { primitive: boolean, min: 1 }\n'),
  'unknown-property': () => manifest('a.field.b: { primitive: float, colour: red }\n'),
  'missing-property': () => manifest('a.entity.e: { fields: [] }\n'),
  'invalid-value': () => manifest('a.field.b: { primitive: integer, min: many }\n'),
  // Pass 3
  'duplicate-brand': () => manifest('a.field.b_c: { primitive: float }\na_b.field.c: { primitive: float }\n'),
  'duplicate-property': () =>
    manifest('a.field.x: { primitive: float }\nb.field.x: { primitive: float }\na.entity.e:\n  description: d\n  fields:\n    - ref: a.field.x\n    - ref: b.field.x\n'),
  'duplicate-ref': () => manifest('a.field.x: { primitive: float }\na.entity.e:\n  description: d\n  fields:\n    - ref: a.field.x\n    - ref: a.field.x\n'),
  'reserved-property': () => manifest('a.field.kind: { primitive: string }\na.error.e:\n  description: d\n  category: precondition\n  retryable: false\n  message: m\n  fields:\n    - ref: a.field.kind\n'),
  'invalid-lifecycle': () => manifest('a.field.x: { primitive: float, supersededBy: a.field.y }\na.field.y: { primitive: float }\n'),
  // Pass 4
  'unresolved-ref': () => manifest('a.entity.e:\n  description: d\n  fields:\n    - ref: a.field.nope\n'),
  'wrong-ref-kind': () => manifest('a.field.x: { primitive: float }\na.entity.e:\n  description: d\n  fields:\n    - link: a.field.x\n'),
  'invalid-entity-key': () => manifest('a.field.x: { primitive: float }\na.field.y: { primitive: float }\na.entity.e:\n  description: d\n  key: a.field.y\n  fields:\n    - ref: a.field.x\n'),
  'missing-key': () => manifest('a.field.x: { primitive: float }\na.entity.e:\n  description: d\n  fields:\n    - ref: a.field.x\na.entity.f:\n  description: d\n  fields:\n    - link: a.entity.e\n'),
  'embedding-cycle': () => manifest('a.field.x: { primitive: float }\na.entity.e:\n  description: d\n  fields:\n    - ref: a.field.x\n    - ref: a.entity.f\na.entity.f:\n  description: d\n  fields:\n    - ref: a.entity.e\n'),
  'invalid-cell': () => gate3(scenario('    When I run the operation with:\n      | policy_id | holder | effective_date | expiry_date | premium | coverages |\n      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01 | 2026-12-31 | 1.00 | [{ peril: fire, limit: 1 } |\n', ISSUE), 'warn', insurance),
  // Pass 8
  'deprecated-ref': () => manifest('a.field.x: { primitive: float, status: deprecated }\na.entity.e:\n  description: d\n  fields:\n    - ref: a.field.x\n'),
  'sunset-ref': () => manifest('a.field.x: { primitive: float, status: sunset }\na.entity.e:\n  description: d\n  fields:\n    - ref: a.field.x\n'),
  // Pass 6
  'invalid-record-as': () =>
    manifest('a.field.x: { primitive: float }\na.field.y: { primitive: float }\na.event.seen:\n  description: d\n  fields:\n    - ref: a.field.x\n    - ref: a.field.y\n' +
      'a.error.e:\n  description: d\n  category: precondition\n  retryable: false\n  message: m\n  fields:\n    - ref: a.field.x\n  recordAs: a.event.seen\n'),
  'unknown-placeholder': () => manifest('a.error.e:\n  description: d\n  category: precondition\n  retryable: false\n  message: no {thing}\n'),
  // Pass 6: invariant rules
  'rule-syntax': () => invariant('expiry_date >'),
  'unknown-rule-field': () => invariant('expiry > effective_date'),
  'rule-type': () => invariant('premium > effective_date'),
  'unguarded-field': () => invariant('deductible < premium'),
  // Pass 7
  'conflicting-constraints': () => manifest('a.field.b: { primitive: float, min: 0, exclusiveMin: 0 }\n'),
  'incoherent-constraints': () => manifest('a.field.b: { primitive: integer, min: 5, max: 1 }\n'),
  // Plugins
  'plugin-config': () => compile(math, [{ ...DEFAULT_PLUGINS[0]!, config: { bogus: 1 } }, DEFAULT_PLUGINS[1]!]).diagnostics,
  'unsupported-construct': () =>
    compile(math, [{ plugin: { ...PLUGINS.valibot, supports: { ...PLUGINS.valibot.supports, kinds: ['field', 'entity'] } }, config: {} }]).diagnostics,
  'export-collision': () => compile(`${math}geometry.field.radius_input: { primitive: float }\n`).diagnostics,
  'output-conflict': () => compile(math, [DEFAULT_PLUGINS[0]!, { plugin: { ...PLUGINS.valibot, name: 'copy' }, config: {} }]).diagnostics,
  'missing-plugin': () => compile(math, [{ plugin: PLUGINS.fcis, config: {} }]).diagnostics,
  'unenforced-in-sql': () =>
    compile(`${HEADER}a.field.site: { primitive: string, format: uri }\na.entity.e:\n  description: d\n  key: a.field.site\n  fields:\n    - ref: a.field.site\n`, [
      { plugin: PLUGINS.postgres, config: { tables: ['a.entity.e'] } },
    ]).diagnostics,
  'invalid-sql-name': () =>
    compile(`${HEADER}a.field.${'x'.repeat(60)}: { primitive: string }\na.entity.e:\n  description: d\n  key: a.field.${'x'.repeat(60)}\n  fields:\n    - ref: a.field.${'x'.repeat(60)}\n`, [
      { plugin: PLUGINS.postgres, config: { tables: ['a.entity.e'] } },
    ]).diagnostics,
  // urn-forge diff
  'breaking-change': () => {
    const result = diffManifests(`${HEADER}a.field.x: { primitive: integer, max: 10 }\na.entity.e:\n  description: d\n  fields:\n    - ref: a.field.x\na.operation.o:\n  description: d\n  input: a.entity.e\n  output: a.entity.e\n`,
      `${HEADER}a.field.x: { primitive: integer, max: 5 }\na.entity.e:\n  description: d\n  fields:\n    - ref: a.field.x\na.operation.o:\n  description: d\n  input: a.entity.e\n  output: a.entity.e\n`);
    return result.ok ? result.breaking : result.diagnostics;
  },
  // Gate 1
  'tsconfig-unreadable': () => project({ tsconfigPath: at('nope.json') }),
  'core-not-found': () => project({ corePath: at('nope.ts') }),
  'type-error': () => project({ corePath: at('broken.ts') }, () => writeFile(at('broken.ts'), "const n: number = 'one';\nexport { n };\n")),
  'missing-satisfies': () => project({ corePath: at('broken.ts') }, () => writeFile(at('broken.ts'), 'export const core = {};\n')),
  // Gate 2
  'brand-assertion': () => shell("import type { ParcelWeightGrams } from './src/generated/domain.schemas.generated';\nexport const w = 1 as ParcelWeightGrams;\n"),
  'brand-from-any': () => shell("import type { ParcelWeightGrams } from './src/generated/domain.schemas.generated';\nexport const w: ParcelWeightGrams = JSON.parse('1');\n"),
  'suppressed-check': () => shell('// @ts-ignore\nexport const n: number = 1;\n'),
  'core-parser-import': () =>
    project({ corePath: at('parser.ts') }, () => writeFile(at('parser.ts'), "import { ParcelWeightGramsSchema } from './src/generated/domain.schemas.generated';\nexport const s = ParcelWeightGramsSchema;\n"), () => rm(at('parser.ts'))),
  // Gate 3
  'features-unreadable': () => project({ featuresDir: at('nope') }),
  'feature-parse-error': () => project({}, () => writeFile(at('features/bad.feature'), 'Feature: x\n  Scenario: y\n    Given a\n      | a |\n      | b | c |\n'), () => rm(at('features/bad.feature'))),
  'unresolved-tag': () => gate3(scenario(RUN, '@urn:demo:shipping:quote:operation:nope')),
  'untagged-operation': () => gate3(scenario(RUN, '@wip')),
  'ambiguous-tag': () => gate3(scenario(RUN, `${OPERATION} @urn:demo:shipping:parcel:entity:parcel`)),
  'unknown-header': () => gate3(scenario('    When I run the operation with:\n      | weight_grams | zone | colour |\n      | 1 | domestic | red |\n')),
  'missing-column': () => gate3(scenario('    When I run the operation with:\n      | weight_grams |\n      | 1 |\n')),
  'undeclared-error': () => gate3(scenario(`${RUN}    Then the operation fails with "urn:demo:shipping:quote:error:nope"\n`)),
  'uncovered-error': () => gate3(scenario(RUN)),
  'undeclared-invariant': () =>
    gate3(scenario(`${ISSUE_RUN}    Then the input is rejected by "urn:acme:insurance:policy:invariant:cancellation_within_term"\n`, ISSUE), 'warn', insurance),
  'uncovered-invariant': () => gate3(scenario(ISSUE_RUN, ISSUE), 'warn', insurance),
  'undeclared-event': () =>
    gate3(scenario(`${ISSUE_RUN}    Then the operation emits "urn:acme:insurance:policy:event:policy_cancelled"\n`, ISSUE), 'warn', insurance),
  'uncovered-event': () => gate3(scenario(ISSUE_RUN, ISSUE), 'warn', insurance),
  'uncovered-boundary': () => gate3(scenario(RUN)),
  'ratchet-ready': () => gate3(strictFeature, 'warn', strict),
  'waived-boundary': () => gate3(scenario(RUN, OPERATION, '# urn-forge:waive urn:demo:shipping:parcel:field:zone the sample has no bad zone\n')),
  'invalid-waiver': () => gate3(scenario(RUN, OPERATION, '# urn-forge:waive nonsense\n')),
  'unknown-waiver': () => gate3(scenario(RUN, OPERATION, '# urn-forge:waive urn:demo:shipping:quote:field:price_cents not an input\n')),
  'unused-waiver': () => gate3(`# urn-forge:waive urn:demo:shipping:parcel:field:zone every case is here\n${strictFeature}`, 'warn', strict),
  // Gate 4
  'generated-missing': () => project({}, () => rm(at(RUNTIME)), () => writeFile(at(RUNTIME), runtime())),
  'generated-differs': () => project({}, () => appendFile(at(RUNTIME), '// edited\n'), () => writeFile(at(RUNTIME), runtime())),
  'generated-orphan': () => project({}, () => writeFile(at('src/generated/old.generated.ts'), '\n'), () => rm(at('src/generated/old.generated.ts'))),
};

describe('every diagnostic code', () => {
  it('has exactly one producer for each code', () => {
    expect(Object.keys(PRODUCERS).sort()).toEqual(Object.keys(DIAGNOSTIC_CODES).sort());
  });

  it('starts from a copy that verify passes, so each case shows its own code', async () => {
    const problems = await project({});
    expect(problems.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it.each(Object.keys(PRODUCERS) as DiagnosticCode[])('%s', async (code) => {
    const produced = await PRODUCERS[code]();
    expect(produced.map((d) => d.code), JSON.stringify(produced.map((d) => [d.code, d.message]))).toContain(code);
  });
});
