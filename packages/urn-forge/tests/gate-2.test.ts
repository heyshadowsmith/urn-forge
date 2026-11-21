/**
 * Gate 2, boundary discipline (gate 2 plan). Each directory under tests/gate-2/ is one rule,
 * on a copy of the insurance domain: code added to its core, and maybe a shell file.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdtemp, rm, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { completenessGate } from '../src/verify/completeness.js';
import { verify } from '../src/verify/index.js';
import type { Gate } from '../src/verify/types.js';

const pkg = fileURLToPath(new URL('..', import.meta.url));
const CASES = join(pkg, 'tests', 'gate-2');
const cases = readdirSync(CASES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
/** The gates to run: gate 1, and gate 2 once it exists. */
export const GATES_UNDER_TEST: Gate[] = [completenessGate];

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
    } as never);
    const problems = result.gates.flatMap((g) => g.problems);
    expect(result.gates.find((g) => g.gate === 1)?.problems, 'gate 1').toEqual([]);
    const expected = readFileSync(join(CASES, name, 'expected.txt'), 'utf8').trim();
    expect(problems.map((p) => p.code).join('\n'), problems.map((p) => `${p.file}:${p.location?.line}  ${p.code}  ${p.message}`).join('\n')).toBe(GATES_UNDER_TEST.length > 1 ? expected : '');
  }, 60_000);
});
