/**
 * The starter of init: in a new directory, it compiles, verifies with no warning, and its scenarios
 * pass. The directory is inside the package, so that it finds the dependencies of the workspace;
 * `urn-forge` resolves to this package through a link.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, expect, it } from 'vitest';
import { main } from '../src/cli.js';

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const dir = mkdtempSync(join(PACKAGE, '.starter-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(argv: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  return main(argv, { cwd: dir, stdout: (t) => out.push(t), stderr: (t) => err.push(t) }).then((code) => ({ code, out, err }));
}

it('init writes a project that compiles, verifies with no warning, and passes its scenarios', async () => {
  const init = await run(['init', '--namespace', 'acme', '--domain', 'bills']);
  expect(init.err).toEqual([]);
  expect(init.code).toBe(0);
  expect(readFileSync(join(dir, 'domain.manifest.yaml'), 'utf8')).toContain('namespace: acme');
  expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))).toMatchObject({ type: 'module', scripts: { compile: 'urn-forge compile' } });

  mkdirSync(join(dir, 'node_modules'));
  symlinkSync(PACKAGE, join(dir, 'node_modules', 'urn-forge'), 'dir');

  const compile = await run(['compile']);
  expect(compile.err).toEqual([]);
  expect(compile.out).toEqual(['wrote      src/generated/domain.generated.ts']);

  const verify = await run(['verify']);
  expect(verify.err).toEqual([]);
  expect(verify.out.at(-1)).toBe('verify passed (gates 1, 2, 3, 4)');

  const cucumber = execFileSync(process.execPath, [join(PACKAGE, '../../node_modules/@cucumber/cucumber/bin/cucumber.js'), '--format', 'summary'], { cwd: dir, encoding: 'utf8' });
  expect(cucumber).toMatch(/^11 scenarios \(11 passed\)$/m);

  expect((await run(['init'])).err[0]).toMatch(/^init writes no file: these exist already: /);
}, 60_000);
