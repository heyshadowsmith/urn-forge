/**
 * `urn-forge verify` against a throwaway copy of the example, including the three seeded
 * failures from mvp-plan.md's "Done" table. The copy symlinks the installed node_modules so
 * gate 1 can resolve valibot and @types/node.
 */
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';
import { formatDiagnostic } from '../src/diagnostics.js';
import { verify, type VerifyResult } from '../src/verify/index.js';

const repo = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

/** The node_modules that holds this package's dependencies (hoisted to the monorepo root by npm workspaces). */
const nodeModules = (() => {
  let dir = createRequire(import.meta.url).resolve('valibot');
  while (basename(dir) !== 'node_modules') {
    if (dirname(dir) === dir) throw new Error('could not locate node_modules from valibot');
    dir = dirname(dir);
  }
  return dir;
})();

let dir: string;
const at = (path: string) => join(dir, path);

async function edit(path: string, from: string | RegExp, to: string): Promise<void> {
  const before = await readFile(at(path), 'utf8');
  const after = before.replace(from, to);
  expect(after, `edit of ${path} did not apply`).not.toBe(before);
  await writeFile(at(path), after);
}

function run(): Promise<VerifyResult> {
  return verify({
    cwd: dir,
    manifestPath: at('domain.manifest.yaml'),
    outDir: at('example/generated'),
    corePath: at('example/core.ts'),
    featuresDir: at('example/features'),
    tsconfigPath: at('tsconfig.json'),
    // As example/urn-forge.config.ts sets it: every example feature is strict.
    boundaryCoverage: 'error',
  });
}

/** Gate number → its problems rendered as text, for the gates that failed. */
function failures(result: VerifyResult): Record<number, readonly string[]> {
  return Object.fromEntries(
    result.gates.filter((g) => !g.ok).map((g) => [g.gate, g.problems.map((p) => formatDiagnostic(p))]),
  );
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'urn-forge-verify-'));
  await cp(repo('example'), at('example'), { recursive: true });
  await cp(repo('tests/fixtures/math/domain.manifest.yaml'), at('domain.manifest.yaml'));
  await cp(repo('tsconfig.json'), at('tsconfig.json'));
  await symlink(nodeModules, at('node_modules'), 'dir');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('urn-forge verify', () => {
  it('passes on the clean example', async () => {
    const result = await run();
    expect(failures(result)).toEqual({});
    expect(result.ok).toBe(true);
    expect(result.gates.map((g) => [g.gate, g.ok])).toEqual([[1, true], [3, true], [4, true]]);
  });

  it('Done #1: deleting the safe_divide handler fails gate 1 only', async () => {
    await edit('example/core.ts', /\n {2}'urn:demo:math:arithmetic:operation:safe_divide':\n.*\n/, '\n');
    const result = await run();
    expect(Object.keys(failures(result))).toEqual(['1']);
    expect(failures(result)[1]!.join('\n')).toMatch(
      /^example\/core\.ts:\d+:\d+ {2}error {2}type-error {2}TS1360: [\s\S]*'urn:demo:math:arithmetic:operation:safe_divide'' is missing/,
    );
  });

  it('Done #2: renaming the divisor column to denominator fails gate 3 only', async () => {
    await edit('example/features/safe_divide.feature', '| dividend   | divisor   |', '| dividend   | denominator |');
    const result = await run();
    expect(failures(result)).toEqual({
      3: [
        'example/features/safe_divide.feature:7:22  error  unknown-header  table header "denominator" is not a field key of the input or ' +
          'output of urn:demo:math:arithmetic:operation:safe_divide (allowed: dividend, divisor, quotient)',
        'example/features/safe_divide.feature:7:7  error  missing-column  the table of "I run the operation with:" has no column for ' +
          'required input field(s) "divisor" of urn:demo:math:arithmetic:operation:safe_divide; to test a missing value, keep the ' +
          'column and leave the cell empty',
      ],
    });
  });

  it('Done #3: hand-editing domain.schemas.generated.ts fails gate 4 only', async () => {
    await edit('example/generated/domain.schemas.generated.ts', 'v.notValue(0)', 'v.notValue(1)');
    const result = await run();
    expect(failures(result)).toEqual({
      4: [
        'example/generated/domain.schemas.generated.ts:21:1  error  generated-differs  differs from a fresh compile (hand-edited or stale); ' +
          'run `urn-forge compile`',
      ],
    });
  });

  describe('gate 1', () => {
    it('fails when the satisfies clause is removed', async () => {
      await edit('example/core.ts', '} satisfies DomainCoreImplementation;', '};');
      const problems = failures(await run())[1]!;
      expect(problems.at(-1)).toContain('example/core.ts  error  missing-satisfies  no export uses `satisfies DomainCoreImplementation`');
    });

    it('fails when the core satisfies a look-alike interface instead of the generated one', async () => {
      await writeFile(
        at('example/core.ts'),
        [
          'interface DomainCoreImplementation { readonly [urn: string]: (input: never) => unknown }',
          'export const core = {} satisfies DomainCoreImplementation;',
          '',
        ].join('\n'),
      );
      const problems = failures(await run())[1]!;
      expect(problems).toEqual([expect.stringContaining('no export uses `satisfies DomainCoreImplementation` from example/generated/domain.runtime.generated.ts')]);
    });

    it('accepts a default export and a namespace-qualified type', async () => {
      await writeFile(
        at('example/core.ts'),
        [
          "import * as rt from './generated/domain.runtime.generated';",
          'export default {',
          "  'urn:demo:math:geometry:operation:compute_area': ({ radius }) => rt.ok({ area: Math.PI * radius ** 2 }),",
          "  'urn:demo:math:arithmetic:operation:safe_divide': ({ dividend, divisor }) => rt.ok({ quotient: dividend / divisor }),",
          '} satisfies rt.DomainCoreImplementation;',
          '',
        ].join('\n'),
      );
      const gate1 = (await run()).gates.find((g) => g.gate === 1)!;
      expect(gate1).toMatchObject({ ok: true, summary: expect.stringContaining('`default` satisfies') });
    });
  });

  describe('gate 3', () => {
    it('fails on a tag that does not resolve', async () => {
      await edit('example/features/safe_divide.feature', '@urn:demo:math:arithmetic:operation:safe_divide', '@urn:demo:math:arithmetic:operation:safe_divid');
      expect(failures(await run())[3]).toEqual([
        'example/features/safe_divide.feature:2:1  error  unresolved-tag  tag @urn:demo:math:arithmetic:operation:safe_divid does not resolve to a URN in the manifest',
        'example/features  error  untagged-operation  operation urn:demo:math:arithmetic:operation:safe_divide has no feature or scenario tagged @urn:demo:math:arithmetic:operation:safe_divide',
      ]);
    });

    it('fails when an operation has no feature', async () => {
      await rm(at('example/features/compute_area.feature'));
      expect(failures(await run())[3]).toEqual([
        'example/features  error  untagged-operation  operation urn:demo:math:geometry:operation:compute_area has no feature or scenario tagged @urn:demo:math:geometry:operation:compute_area',
      ]);
    });

    it('checks Examples headers and allows output fields', async () => {
      await edit('example/features/safe_divide.feature', '| dividend | divisor | quotient |', '| dividend | divisor | ratio    |');
      expect(failures(await run())[3]).toEqual([
        expect.stringMatching(/^example\/features\/safe_divide\.feature:14:\d+ {2}error {2}unknown-header {2}table header "ratio" is not a field key/),
      ]);
    });

    it('checks headers under a scenario-level tag and in a Rule', async () => {
      await writeFile(
        at('example/features/extra.feature'),
        [
          'Feature: Extra',
          '  Rule: circles',
          '    @urn:demo:math:geometry:operation:compute_area',
          '    Scenario: wrong column',
          '      When I run the operation with:',
          '        | diameter |',
          '        | 2        |',
          '',
        ].join('\n'),
      );
      expect(failures(await run())[3]).toEqual([
        expect.stringMatching(/^example\/features\/extra\.feature:6:11 {2}error {2}unknown-header {2}table header "diameter"/),
        expect.stringMatching(/^example\/features\/extra\.feature:6:9 {2}error {2}missing-column {2}.*"radius"/),
      ]);
    });
  });

  describe('gate 4', () => {
    it('fails on a missing generated file and on one with no source', async () => {
      await rm(at('example/generated/domain.runtime.generated.ts'));
      await writeFile(at('example/generated/old.generated.ts'), 'export {};\n');
      expect(failures(await run())[4]).toEqual([
        'example/generated/domain.runtime.generated.ts  error  generated-missing  missing; run `urn-forge compile`',
        'example/generated/old.generated.ts  error  generated-orphan  generated file has no source in the current compile; delete it',
      ]);
    });
  });

  it('runs no gate when the manifest does not compile', async () => {
    await edit('domain.manifest.yaml', 'notEqual: 0', 'notEqual: zero');
    const result = await run();
    expect(result.ok).toBe(false);
    expect(result.gates).toEqual([]);
    expect(result.diagnostics).toEqual([expect.objectContaining({ message: expect.stringContaining('arithmetic.field.divisor.notEqual') })]);
  });

  it('CLI: prints one line per gate and exits 0, or 1 on failure', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const io = { cwd: dir, stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l) };
    const args = ['verify', '--config', 'example/urn-forge.config.ts', '--manifest', 'domain.manifest.yaml', '--out', 'example/generated', '--core', 'example/core.ts', '--features', 'example/features'];
    expect(await main(args, io)).toBe(0);
    expect(out.map((l) => l.slice(0, 26))).toEqual([
      'gate 1  completeness  PASS',
      'gate 3  gherkin       PASS',
      'gate 4  drift         PASS',
      'verify passed (gates 1, 3,',
    ]);

    out.length = 0;
    await edit('example/generated/domain.schemas.generated.ts', 'v.notValue(0)', 'v.notValue(1)');
    expect(await main(args, io)).toBe(1);
    expect(err).toEqual(['verify failed: gate 4']);
  });
});
