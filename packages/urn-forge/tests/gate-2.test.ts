/**
 * Gate 2, boundary discipline (gate 2 plan). Each directory under tests/gate-2/ is one rule,
 * on a copy of the insurance domain: code added to its core, and maybe a shell file.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdtemp, rm, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';
import { loadConfig } from '../src/config.js';
import { boundaryGate } from '../src/verify/boundary.js';
import { completenessGate } from '../src/verify/completeness.js';
import { verify } from '../src/verify/index.js';
import type { Gate } from '../src/verify/types.js';

const pkg = fileURLToPath(new URL('..', import.meta.url));
const CASES = join(pkg, 'tests', 'gate-2');
const cases = readdirSync(CASES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
/** The gates to run: gate 1, which must pass, and gate 2. */
export const GATES_UNDER_TEST: Gate[] = [completenessGate, boundaryGate];

const temps: string[] = [];
afterAll(async () => {
  for (const dir of temps) await rm(dir, { recursive: true, force: true });
});

/** A copy of insurance with the case applied, inside the package so that valibot resolves. */
async function project(name: string): Promise<{ dir: string; shell: string[] }> {
  const dir = await mkdtemp(join(pkg, '.gate-2-'));
  temps.push(dir);
  for (const file of ['domain.manifest.yaml', 'core.ts', 'generated', 'features']) await cp(join(pkg, 'insurance', file), join(dir, file), { recursive: true });
  const append = join(CASES, name, 'core-append.ts');
  if (existsSync(append)) await appendFile(join(dir, 'core.ts'), `\n${readFileSync(append, 'utf8')}`);
  const shellSource = join(CASES, name, 'shell.ts');
  if (!existsSync(shellSource)) return { dir, shell: [] };
  await writeFile(join(dir, 'shell.ts'), readFileSync(shellSource, 'utf8'));
  return { dir, shell: [join(dir, 'shell.ts')] };
}

describe.each(cases)('gate 2 case %s', (name) => {
  it('gives exactly its expected codes', async () => {
    const { dir, shell } = await project(name);
    const result = await verify({
      cwd: dir,
      manifestPath: join(dir, 'domain.manifest.yaml'),
      outDir: join(dir, 'generated'),
      corePath: join(dir, 'core.ts'),
      featuresDir: join(dir, 'features'),
      tsconfigPath: join(pkg, 'tsconfig.json'),
      shellPaths: shell,
      gates: GATES_UNDER_TEST,
    });
    const problems = result.gates.flatMap((g) => g.problems);
    expect(result.gates.find((g) => g.gate === 1)?.problems, 'gate 1').toEqual([]);
    const expected = readFileSync(join(CASES, name, 'expected.txt'), 'utf8').trim();
    expect(problems.map((p) => p.code).join('\n'), problems.map((p) => `${p.file}:${p.location?.line}  ${p.code}  ${p.message}`).join('\n')).toBe(GATES_UNDER_TEST.length > 1 ? expected : '');
  }, 60_000);
});

describe('the shell setting', () => {
  it('reads shell paths from the config, relative to it, and checks them', async () => {
    const { dir } = await project('clean');
    await writeFile(join(dir, 'shell.ts'), "import type { PolicyLimit } from './generated/domain.schemas.generated';\nexport const forged = '9' as PolicyLimit;\n");
    await writeFile(join(dir, 'urn-forge.config.ts'), "export default { manifest: './domain.manifest.yaml', out: './generated', core: './core.ts', features: './features', tsconfig: '../tsconfig.json', shell: ['./shell.ts'] };\n");
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(['verify', '--config', join(dir, 'urn-forge.config.ts')], { cwd: dir, stdout: (l) => out.push(l), stderr: (l) => err.push(l) });
    expect(code).toBe(1);
    expect(out).toContain('gate 2  boundary      FAIL  1 core file(s), 1 shell file(s): 1 problem(s)');
    expect(out).toContain("    shell.ts:2:23  error  brand-assertion  '9' as PolicyLimit asserts the branded type PolicyLimit; only a generated parser makes a branded value");
  }, 60_000);

  it('refuses an empty shell path', async () => {
    const { dir } = await project('clean');
    await writeFile(join(dir, 'urn-forge.config.ts'), "export default { shell: [''] };\n");
    const result = await loadConfig(join(dir, 'urn-forge.config.ts'), 'urn-forge.config.ts', dir);
    expect(result.ok ? [] : result.diagnostics.map((d) => d.message)).toEqual(['config.shell[0]: must not be empty']);
  });
});

describe('found while the docs were written', () => {
  it('reports an any in an object property once, and a suppression only in a comment', async () => {
    const { dir } = await project('clean');
    await appendFile(
      join(dir, 'core.ts'),
      "\nexport const texts = ['// @ts-ignore is text here, not a comment'];\nexport function premiumBox(raw: string): { premium: PolicyPremium } {\n  return { premium: JSON.parse(raw) };\n}\n",
    );
    const result = await verify({
      cwd: dir,
      manifestPath: join(dir, 'domain.manifest.yaml'),
      outDir: join(dir, 'generated'),
      corePath: join(dir, 'core.ts'),
      featuresDir: join(dir, 'features'),
      tsconfigPath: join(pkg, 'tsconfig.json'),
      gates: GATES_UNDER_TEST,
    });
    expect(result.gates.flatMap((g) => g.problems).map((p) => p.code)).toEqual(['brand-from-any']);
  }, 60_000);
});
