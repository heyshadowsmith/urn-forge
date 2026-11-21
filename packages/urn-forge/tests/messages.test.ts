/**
 * Messages a person reads when something is wrong with their project, not with their domain:
 * every one is complete (no first line only), names files relative to the working directory
 * (the same on every machine), and says what is wrong. Each test reproduces a finding from
 * the documentation audit.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';
import { compile, DEFAULT_PLUGINS } from '../src/engine.js';

const repo = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

const nodeModules = (() => {
  let dir = createRequire(import.meta.url).resolve('valibot');
  while (basename(dir) !== 'node_modules') dir = dirname(dir);
  return dir;
})();

let dir: string;
const at = (path: string) => join(dir, path);

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'urn-forge-messages-'));
  await cp(repo('tutorial/1-first-domain'), dir, { recursive: true });
  await cp(repo('tsconfig.json'), at('tsconfig.base.json'));
  await writeFile(at('tsconfig.json'), JSON.stringify({ extends: './tsconfig.base.json', include: ['.'] }));
  const config = await readFile(at('urn-forge.config.ts'), 'utf8');
  await writeFile(at('urn-forge.config.ts'), config.replace("'../../tsconfig.json'", "'./tsconfig.json'"));
  await symlink(nodeModules, at('node_modules'), 'dir');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function run(...args: string[]): Promise<{ code: number; out: string[]; err: string[]; all: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(args, { cwd: dir, stdout: (l) => out.push(l), stderr: (l) => err.push(l) });
  return { code, out, err, all: [...out, ...err].join('\n') };
}

describe('messages', () => {
  it('starts from a project that passes', async () => {
    expect((await run('verify')).code).toBe(0);
  });

  it('gives the whole config load error, with relative paths', async () => {
    await writeFile(at('urn-forge.config.ts'), 'export default {\n  manifest: ,\n};\n');
    // Through bin/, as a person runs it: under Vitest, Vite (not tsx) would load the config.
    const { status, stdout, stderr } = spawnSync('node', [repo('bin/urn-forge.js'), 'verify'], { cwd: dir, encoding: 'utf8' });
    const all = stdout + stderr;
    expect(status).toBe(1);
    expect(all).toContain('config-unreadable');
    // The first line alone ("Transform failed with 1 error:") does not say what is wrong.
    expect(all).toMatch(/urn-forge\.config\.ts:2:\d+: ERROR: /);
    expect(all).not.toContain(dir);
  });

  it('gives one feature-parse-error for each parser error, at its line and column', async () => {
    await writeFile(at('features/bad.feature'), 'Feature: x\n  Scenario: y\n    Given a\n      | a |\n    garbage line\n    more garbage\n');
    const { all } = await run('verify');
    const lines = all.split('\n').filter((l) => l.includes('feature-parse-error'));
    expect(lines).toEqual([
      expect.stringMatching(/^ {4}features\/bad\.feature:5:5 {2}error {2}feature-parse-error {2}expected: #EOF, .*, got 'garbage line'$/),
      expect.stringMatching(/^ {4}features\/bad\.feature:6:5 {2}error {2}feature-parse-error {2}expected: #EOF, .*, got 'more garbage'$/),
    ]);
  });

  it('says the manifest cannot be read, not that it does not compile, with a relative path', async () => {
    await rm(at('domain.manifest.yaml'));
    for (const command of ['verify', 'compile']) {
      const { code, all, err } = await run(command);
      expect(code).toBe(1);
      expect(all).toContain("manifest-unreadable  cannot read manifest: ENOENT: no such file or directory, open 'domain.manifest.yaml'");
      expect(all).not.toContain(dir);
      if (command === 'verify') expect(err.at(-1)).toBe('verify failed: the manifest cannot be read');
    }
  });

  it('names the features directory relative to the working directory', async () => {
    await rm(at('features'), { recursive: true });
    const { all } = await run('verify');
    expect(all).toContain("features-unreadable  cannot read features: ENOENT: no such file or directory, scandir 'features'");
    expect(all).not.toContain(dir);
  });

  it('names the tsconfig relative to the working directory', async () => {
    await rm(at('tsconfig.json'));
    const { all } = await run('verify');
    expect(all).toContain("tsconfig-unreadable  Cannot read file 'tsconfig.json'.");
    expect(all).not.toContain(dir);
  });

  it('says that a field has no primitive', async () => {
    const manifest = await readFile(at('domain.manifest.yaml'), 'utf8');
    const without = manifest.replace(/(parcel\.field\.zone:\n)\s+primitive: enum\n/, '$1');
    expect(without).not.toBe(manifest);
    await writeFile(at('domain.manifest.yaml'), without);
    const { all } = await run('compile');
    expect(all).toContain(
      'unknown-primitive  parcel.field.zone.primitive: a field must have a primitive (MVP primitives: boolean, date, decimal, enum, float, integer, string, timestamp)',
    );
  });
});

describe('plugin-config messages', () => {
  it('name the key of the config that is wrong', () => {
    const manifest = `manifest:\n  namespace: demo\n  domain: math\n  version: 1.0.0\ngeometry.field.radius:\n  primitive: float\n`;
    const plugins = [
      { ...DEFAULT_PLUGINS[0]!, config: { bogus: 1 } },
      { ...DEFAULT_PLUGINS[1]!, config: 'yes' },
    ];
    expect(compile(manifest, plugins).diagnostics.map((d) => d.message)).toEqual([
      'plugin valibot config: unknown option "bogus"',
      'plugin fcis config: Invalid type: Expected Object but received "yes"',
    ]);
  });
});

describe('bin/urn-forge.js', () => {
  it('stops quietly when its output is closed early, as with | head', () => {
    // `true` exits before the CLI writes, so every write meets a closed pipe.
    const { stdout, stderr } = spawnSync(
      'bash',
      ['-c', 'node bin/urn-forge.js verify --config tutorial/1-first-domain/urn-forge.config.ts | true; echo "exit ${PIPESTATUS[0]}"'],
      { cwd: repo(''), encoding: 'utf8' },
    );
    expect(stderr).not.toContain('EPIPE');
    expect(stdout.trim()).toBe('exit 0');
  });
});
