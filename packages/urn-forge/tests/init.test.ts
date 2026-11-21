/**
 * `urn-forge init`: a new project that compiles, verifies with no warning and passes its
 * scenarios at once. The copy links this repository's node_modules, which also holds
 * urn-forge itself (an npm workspace), as an installed package would.
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, type CliIo } from '../src/cli.js';

const nodeModules = (() => {
  let d = createRequire(import.meta.url).resolve('valibot');
  while (basename(d) !== 'node_modules') d = dirname(d);
  return d;
})();

let dir: string;
let out: string[];
let err: string[];
let io: CliIo;
const at = (path: string) => join(dir, path);
const read = (path: string) => readFile(at(path), 'utf8');
const json = async (path: string) => JSON.parse(await read(path)) as Record<string, unknown>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'urn-forge-init-'));
  out = [];
  err = [];
  io = { cwd: dir, stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
  await symlink(nodeModules, at('node_modules'), 'dir');
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const STARTER = [
  'cucumber.json',
  'domain.manifest.yaml',
  'features/split.feature',
  'features/support/steps.ts',
  'register-tsx.mjs',
  'src/core.ts',
  'tsconfig.json',
  'urn-forge.config.ts',
];

describe('urn-forge init', () => {
  it('makes a project that compiles, verifies with no warning, and passes its scenarios', async () => {
    expect(await main(['init'], io)).toBe(0);
    expect(err).toEqual([]);
    expect(out).toEqual([
      ...STARTER.map((path) => `wrote      ${path}`),
      'wrote      package.json',
      'wrote      src/generated/domain.runtime.generated.ts',
      'wrote      src/generated/domain.schemas.generated.ts',
      expect.stringMatching(/^fingerprint sha256:[0-9a-f]{64}$/),
      'next: npm run verify, then npm run test:features',
    ]);
    expect(await json('package.json')).toEqual({
      name: basename(dir).toLowerCase(),
      private: true,
      type: 'module',
      scripts: { compile: 'urn-forge compile', verify: 'urn-forge verify', 'test:features': 'cucumber-js' },
    });

    out = [];
    expect(await main(['verify'], io)).toBe(0);
    expect(out.at(-1)).toBe('verify passed (gates 1, 2, 3, 4; gate 5 is urn-forge diff)');

    const cucumber = spawnSync(join(nodeModules, '.bin/cucumber-js'), [], { cwd: dir, encoding: 'utf8' });
    expect(cucumber.stdout + cucumber.stderr).toContain('9 scenarios (9 passed)');
    expect(cucumber.status).toBe(0);
  });

  it('uses --namespace and --domain in the manifest and in every URN', async () => {
    expect(await main(['init', '--namespace', 'acme', '--domain', 'billing'], io)).toBe(0);
    expect(await read('domain.manifest.yaml')).toContain('  namespace: acme\n  domain: billing\n');
    expect(await read('src/core.ts')).toContain("'urn:acme:billing:bill:operation:split'");
    expect(await read('features/split.feature')).toMatch(/^@urn:acme:billing:bill:operation:split\n/);
    for (const path of STARTER) expect(await read(path), path).not.toContain('{{');
  });

  it('refuses a namespace or domain that is not a URN segment', async () => {
    expect(await main(['init', '--namespace', 'Acme'], io)).toBe(2);
    expect(err[0]).toBe('urn-forge: --namespace "Acme" must be lowercase snake_case that starts with a letter (max 63 characters)');
    expect(await main(['init', '--domain', '1x'], io)).toBe(2);
  });

  it('writes nothing if a starter file already exists', async () => {
    await writeFile(at('domain.manifest.yaml'), 'mine\n');
    expect(await main(['init'], io)).toBe(1);
    expect(err).toEqual(['urn-forge: init writes no file, because these files exist: domain.manifest.yaml']);
    expect(await read('domain.manifest.yaml')).toBe('mine\n');
    expect(await read('src/core.ts').catch(() => 'absent')).toBe('absent');
  });

  it('adds type and scripts to an existing package.json, and keeps what is there', async () => {
    await writeFile(
      at('package.json'),
      JSON.stringify({ name: 'mine', version: '1.0.0', scripts: { test: 'vitest', verify: 'my-verify' }, dependencies: { 'urn-forge': 'file:x.tgz' } }, null, 2),
    );
    expect(await main(['init'], io)).toBe(0);
    expect(out).toContain('updated    package.json');
    expect(await json('package.json')).toEqual({
      name: 'mine',
      version: '1.0.0',
      scripts: { test: 'vitest', verify: 'my-verify', compile: 'urn-forge compile', 'test:features': 'cucumber-js' },
      dependencies: { 'urn-forge': 'file:x.tgz' },
      type: 'module',
    });
  });

  it('refuses a CommonJS package, and writes nothing', async () => {
    await writeFile(at('package.json'), JSON.stringify({ name: 'mine', type: 'commonjs' }));
    expect(await main(['init'], io)).toBe(1);
    expect(err).toEqual([
      'urn-forge: init needs an ES module package, but package.json has "type": "commonjs"; the generated code and the steps use import',
    ]);
    expect(await read('src/core.ts').catch(() => 'absent')).toBe('absent');
  });
});

describe('the tutorials (docs/tutorials)', () => {
  // A reader starts each tutorial from `urn-forge init` and keeps the starter's tsconfig and
  // support file, so the copies that CI runs must be the same files.
  const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const tutorial of ['1-first-domain', '2-declared-errors', '3-strict-coverage']) {
    it(`${tutorial} keeps the starter's tsconfig.json and features/support/steps.ts`, async () => {
      for (const file of ['tsconfig.json', 'features/support/steps.ts']) {
        expect(await read(`tutorial/${tutorial}/${file}`), file).toBe(await read(`templates/starter/${file}`));
      }
    });
  }
});
