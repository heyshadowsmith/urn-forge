/**
 * The real binary, bin/urn-forge.js, in a child process: its exit code, its stdout and its stderr, each
 * checked apart. The in-process tests call main() with a fake output; these tests also cover the bin
 * itself (tsx, the exit code, the handling of a closed or full stdout), which is where a crash shows.
 *
 * The findings of the plan "output that an agent can trust" (planning/cli-trust-plan.md) are it.fails
 * until their step. The copies sit next to the fixture, so that their relative imports of src resolve.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/** A finding of the plan that is not fixed yet: it.fails until its step, then it. */
const finding = { D1: it, A1: it, D3: it, A11: it, D2: it, D4: it };

const BIN = fileURLToPath(new URL('../bin/urn-forge.js', import.meta.url));
const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function copy(): string {
  const dir = mkdtempSync(join(FIXTURES, '.bin-'));
  cpSync(join(FIXTURES, 'booking'), dir, { recursive: true });
  dirs.push(dir);
  return dir;
}

function empty(): string {
  const dir = mkdtempSync(join(FIXTURES, '.bin-'));
  dirs.push(dir);
  return dir;
}

/** Runs the binary: its exit code, and its stdout and stderr apart. */
function bin(cwd: string, args: readonly string[]): { code: number | null; out: string; err: string } {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** Runs the binary through sh, for a pipe or a redirect of its stdout. */
function sh(cwd: string, command: string): { code: number | null; out: string; err: string } {
  const r = spawnSync('sh', ['-c', command.replace('$BIN', `"${process.execPath}" "${BIN}"`)], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** The one JSON object that --format json writes, or a failure that says what stdout was. */
function oneObject(out: string): Record<string, unknown> {
  const lines = out.split('\n').filter((l) => l !== '');
  expect(lines, `stdout: ${out}`).toHaveLength(1);
  return JSON.parse(lines[0]!) as Record<string, unknown>;
}

const noStack = (text: string): void => expect(text).not.toMatch(/\n\s+at /);

describe('the binary', () => {
  it('prints its version on stdout, and exits 0', () => {
    expect(bin(empty(), ['--version'])).toEqual({ code: 0, out: `${VERSION}\n`, err: '' });
  });

  it('prints its usage on stdout for --help, and exits 0', () => {
    const r = bin(empty(), ['--help']);
    expect([r.code, r.err]).toEqual([0, '']);
    expect(r.out).toMatch(/^urn-forge /);
  });

  it('refuses an unknown command on stderr, with exit 2', () => {
    const r = bin(empty(), ['build']);
    expect([r.code, r.out]).toEqual([2, '']);
    expect(r.err).toMatch(/^unknown command "build"/);
  });

  it('refuses an unknown option, with exit 2', () => {
    const r = bin(copy(), ['compile', '--bogus']);
    expect([r.code, r.out]).toEqual([2, '']);
    expect(r.err).toMatch(/Unknown option '--bogus'/);
  });

  it('compiles, verifies and diffs the fixture, with exit 0', () => {
    const dir = copy();
    const compile = bin(dir, ['compile']);
    // The fixture uses a deprecated definition, which compile reports on stderr as a warning.
    expect(compile.code).toBe(0);
    expect(compile.err).toMatch(/^domain\.manifest\.yaml:\d+  warning  deprecated-use /);
    expect(compile.out).toMatch(/unchanged +generated\/domain\.generated\.ts/);
    const verify = bin(dir, ['verify']);
    expect(verify.code).toBe(0);
    noStack(verify.err);
    expect(verify.out).toMatch(/^verify passed/m);
    expect(bin(dir, ['diff', 'domain.manifest.yaml', 'domain.manifest.yaml']).code).toBe(0);
  });

  it('writes one JSON object on stdout with --format json, and nothing on stderr', () => {
    const r = bin(copy(), ['verify', '--format', 'json']);
    expect([r.code, r.err]).toEqual([0, '']);
    expect(oneObject(r.out)).toMatchObject({ ok: true, problems: [{ code: 'deprecated-use', severity: 'warning' }] });
    const usage = bin(copy(), ['compile', '--format', 'json', '--bogus']);
    expect([usage.code, usage.err]).toEqual([2, '']);
    expect(oneObject(usage.out)).toMatchObject({ ok: false, problems: [{ code: 'usage' }] });
  });

  it('stops quietly when the reader of its output stops early', () => {
    const r = sh(empty(), '$BIN --help | head -1');
    expect([r.code, r.err]).toEqual([0, '']);
    expect(r.out).toMatch(/^urn-forge /);
  });
});

describe('the findings of the plan', () => {
  finding.D1('fails verify when a shell path does not exist', () => {
    const dir = copy();
    writeFileSync(join(dir, 'urn-forge.config.ts'), readFileSync(join(dir, 'urn-forge.config.ts'), 'utf8').replace('  domains:', "  shell: ['no-such-shell.ts'],\n  domains:"));
    const r = bin(dir, ['verify']);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/missing-input/);
  });

  finding.D1('fails verify when the features path does not exist, or is not a .feature file', () => {
    const dir = copy();
    const missing = bin(dir, ['verify', '--features', 'no-such-folder']);
    expect(missing.code).toBe(1);
    expect(missing.out).toMatch(/error  missing-input  the features path does not exist/);
    const notFeature = bin(dir, ['verify', '--features', 'core.ts']);
    expect(notFeature.code).toBe(1);
    expect(notFeature.out).toMatch(/error  missing-input  the features path is a file, and not a \.feature file/);
  });

  finding.D1('follows a symlinked shell folder, so gate 2 checks its files', () => {
    const dir = copy();
    mkdirSync(join(dir, 'real-shell'));
    writeFileSync(join(dir, 'real-shell', 'shell.ts'), "import { core } from '../core.js';\n\nexport const seated = core.seat_booking;\n");
    mkdirSync(join(dir, 'outer'));
    symlinkSync('../real-shell', join(dir, 'outer', 'inner'));
    writeFileSync(join(dir, 'urn-forge.config.ts'), readFileSync(join(dir, 'urn-forge.config.ts'), 'utf8').replace('  domains:', "  shell: ['outer'],\n  domains:"));
    const r = bin(dir, ['verify']);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/error  direct-call  /);
  });

  finding.A1('refuses a flag of another command, with exit 2', () => {
    const r = bin(copy(), ['compile', '--base', 'main']);
    expect([r.code, r.out]).toEqual([2, '']);
    expect(r.err).toMatch(/^--base is not an option of compile; it is an option of verify/);
    const init = bin(empty(), ['init', '--config', 'x.ts']);
    expect([init.code, init.out]).toEqual([2, '']);
    expect(init.err).toMatch(/^--config is not an option of init; it is an option of compile and verify/);
    const json = bin(copy(), ['verify', '--format', 'json', '--namespace', 'zz']);
    expect(json.code).toBe(2);
    expect(oneObject(json.out)).toMatchObject({ ok: false, problems: [{ code: 'usage', message: '--namespace is not an option of verify; it is an option of init' }] });
  });

  finding.D3('reports a filesystem error as one JSON object, with exit 1 and no stack', () => {
    const dir = copy();
    writeFileSync(join(dir, 'a-file'), '');
    const r = bin(dir, ['compile', '--format', 'json', '--out', 'a-file/x']);
    expect([r.code, r.err]).toEqual([1, '']);
    const report = oneObject(r.out) as { ok: boolean; problems: { code: string; file?: string; message: string }[] };
    expect(report.ok).toBe(false);
    expect(report.problems).toContainEqual(expect.objectContaining({ code: 'io-error', file: 'a-file/x', message: 'mkdir failed: ENOTDIR' }));
    const text = bin(dir, ['compile', '--out', 'a-file/x']);
    expect(text.code).toBe(1);
    noStack(text.err);
  });

  finding.A11('reports a full stdout in one line on stderr, with exit 1 and no stack', () => {
    const r = sh(empty(), '$BIN --help > /dev/full');
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/^urn-forge: cannot write the output: /);
    noStack(r.err);
  });

  finding.D2('refuses two domains whose out folders are one folder through a symlink', () => {
    const dir = copy();
    cpSync(join(dir, 'domain.manifest.yaml'), join(dir, 'second.manifest.yaml'));
    writeFileSync(join(dir, 'second.manifest.yaml'), readFileSync(join(dir, 'second.manifest.yaml'), 'utf8').replace(/domain: booking/, 'domain: booking_two'));
    cpSync(join(dir, 'features'), join(dir, 'features2'), { recursive: true });
    mkdirSync(join(dir, 'gen'));
    symlinkSync('gen', join(dir, 'genlink'));
    writeFileSync(
      join(dir, 'urn-forge.config.ts'),
      "import { defineConfig } from 'urn-forge/config';\nexport default defineConfig({ domains: [{ manifest: 'domain.manifest.yaml', out: 'gen', core: 'core.ts' }, { manifest: 'second.manifest.yaml', out: 'genlink', core: 'core.ts', features: 'features2' }] });\n",
    );
    const r = bin(dir, ['compile']);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/config-invalid  two domains write/);
  });

  finding.D4('writes no file when package.json is not a JSON object', () => {
    const dir = empty();
    writeFileSync(join(dir, 'package.json'), '[1, 2]');
    const r = bin(dir, ['init']);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/^init writes no file: package\.json must be a JSON object/);
    expect(existsSync(join(dir, 'domain.manifest.yaml'))).toBe(false);
    writeFileSync(join(dir, 'package.json'), '{ "name": "x", }');
    const invalid = bin(dir, ['init']);
    expect(invalid.code).toBe(1);
    expect(invalid.err).toMatch(/^init writes no file: package\.json is not valid JSON: /);
    noStack(invalid.err);
    expect(existsSync(join(dir, 'domain.manifest.yaml'))).toBe(false);
  });
});
