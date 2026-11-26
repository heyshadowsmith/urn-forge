/**
 * The CLI on copies of the booking fixture: compile, then verify with each gate broken in turn.
 * The copies sit next to the fixture, so that their relative imports of src resolve.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { lineOf, main } from '../src/cli.js';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
const copies: string[] = [];
afterEach(() => {
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function copy(): string {
  const dir = mkdtempSync(join(FIXTURES, '.cli-'));
  cpSync(join(FIXTURES, 'booking'), dir, { recursive: true });
  copies.push(dir);
  return dir;
}

async function run(dir: string, argv: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: dir, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  return { code, out, err };
}

const edit = (path: string, change: (text: string) => string): void => writeFileSync(path, change(readFileSync(path, 'utf8')));

describe('compile', () => {
  it('writes nothing when the files are current', async () => {
    const dir = copy();
    const { code, out } = await run(dir, ['compile']);
    expect(code).toBe(0);
    expect(out).toEqual(['unchanged  generated/domain.generated.ts', 'unchanged  generated/schema.generated.sql', 'unchanged  generated/domain.store.generated.ts']);
  });

  it('reports a diagnostic at its line, and writes nothing', async () => {
    const dir = copy();
    edit(join(dir, 'domain.manifest.yaml'), (t) => t.replace('      - minimum: 1\n      - maximum: 12', '      - minimum: one\n      - maximum: 12'));
    const { code, err, out } = await run(dir, ['compile']);
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toContain('domain.manifest.yaml:23  error  rule-argument  minimum: "one" is not a number; bound is a number that a value is compared with');
  });

  it('reports a YAML error at its line', async () => {
    const dir = copy();
    edit(join(dir, 'domain.manifest.yaml'), (t) => t.replace('  invalid_state:\n', '  invalid_state:\n   bad: [\n'));
    const { err } = await run(dir, ['compile']);
    expect(err[0]).toMatch(/^domain\.manifest\.yaml:(\d+) {2}error {2}yaml-syntax {2}/);
    expect(Number(/:(\d+)/.exec(err[0]!)![1])).toBeGreaterThan(100);
  });

  it('removes a generated file that it no longer makes', async () => {
    const dir = copy();
    writeFileSync(join(dir, 'generated', 'old.generated.ts'), '');
    expect((await run(dir, ['compile'])).out).toEqual([
      'unchanged  generated/domain.generated.ts',
      'unchanged  generated/schema.generated.sql',
      'unchanged  generated/domain.store.generated.ts',
      'removed    generated/old.generated.ts',
    ]);
  });
});

describe('verify', () => {
  it('passes the booking fixture, with the warning of its deprecated note', async () => {
    const { code, out } = await run(copy(), ['verify']);
    expect(code).toBe(0);
    expect(out.at(-1)).toBe('verify passed with 1 warning(s) (gates 1, 2, 3, 4)');
  });

  it('gate 1: fails a core that does not satisfy DomainCore', async () => {
    const dir = copy();
    edit(join(dir, 'core.ts'), (t) => t.replace('} satisfies DomainCore;', '};'));
    const { code, out, err } = await run(dir, ['verify']);
    expect(code).toBe(1);
    expect(err.at(-1)).toBe('verify failed: gate 1');
    expect(out).toContain('    core.ts  error  core-not-satisfying  the core exports no value that satisfies DomainCore of the generated file: export const core = { … } satisfies DomainCore');
  });

  it('gate 2: fails a shell that calls the core without the harness', async () => {
    const dir = copy();
    writeFileSync(join(dir, 'shell.ts'), "import { core } from './core.js';\n\nexport const seated = core.seat_booking;\n");
    edit(join(dir, 'urn-forge.config.ts'), (t) => t.replace("  domains:", "  shell: ['shell.ts'],\n  domains:"));
    const { code, out } = await run(dir, ['verify']);
    expect(code).toBe(1);
    expect(out).toContain('    shell.ts:3  error  direct-call  core.seat_booking runs the core without the harness; call runOperation(core, …), which checks the input and the answer');
  });

  it('gate 2: fails a shell that takes a function out of the core', async () => {
    const dir = copy();
    writeFileSync(join(dir, 'shell.ts'), "import { core } from './core.js';\n\nexport const { seat_booking } = core;\n");
    edit(join(dir, 'urn-forge.config.ts'), (t) => t.replace("  domains:", "  shell: ['shell.ts'],\n  domains:"));
    expect((await run(dir, ['verify'])).out.some((l) => l.includes('shell.ts:3  error  direct-call  { seat_booking } = core takes a function of the core without the harness'))).toBe(true);
  });

  it('counts the warnings of the manifest', async () => {
    const dir = copy();
    edit(join(dir, 'domain.manifest.yaml'), (t) => t.replace('    deprecated: true\n', '    deprecated: true\n').replace('  phone:\n    description: The phone number of a guest\n', '  phone:\n    description: The phone number of a guest\n    deprecated: true\n'));
    await run(dir, ['compile']);
    const { out } = await run(dir, ['verify']);
    expect(out.at(-1)).toBe('verify passed with 2 warning(s) (gates 1, 2, 3, 4)');
  });

  it('gate 2: fails a suppressed type check', async () => {
    const dir = copy();
    edit(join(dir, 'core.ts'), (t) => `// @ts-nocheck\n${t}`);
    expect((await run(dir, ['verify'])).out).toContain('    core.ts:1  error  suppressed-check  @ts-nocheck can hide a broken contract; fix the type error');
  });

  it('gate 3: fails a gap', async () => {
    const dir = copy();
    edit(join(dir, 'features', 'seat.feature'), (t) => t.replace(/^.*\| maxLength .*\n/m, ''));
    const { out, err } = await run(dir, ['verify']);
    expect(err.at(-1)).toBe('verify failed: gate 3');
    expect(out.some((l) => l.includes('error  uncovered-rule  no scenario breaks maxLength of note'))).toBe(true);
  });

  it('gate 4: fails a generated file that is not current', async () => {
    const dir = copy();
    edit(join(dir, 'generated', 'domain.generated.ts'), (t) => t.replace('Must be at least', 'Must be at minimum'));
    const { out, err } = await run(dir, ['verify']);
    expect(err.at(-1)).toBe('verify failed: gate 4');
    expect(out.find((l) => l.includes('error  drift'))).toMatch(/^ {4}generated\/domain\.generated\.ts:\d+ {2}error {2}drift {2}the generated file is not current; run urn-forge compile$/);
  });
});

describe('diff', () => {
  it('passes a manifest against itself', async () => {
    const dir = copy();
    expect((await run(dir, ['diff', 'domain.manifest.yaml', 'domain.manifest.yaml'])).out).toEqual(['diff passed: 0 change(s), 0 breaking, 0.1.0 → 0.1.0']);
  });

  it('fails a breaking change within one major version, and passes it across a new one', async () => {
    const dir = copy();
    const manifest = join(dir, 'domain.manifest.yaml');
    edit(manifest, (t) => t.replace('version: 0.1.0', 'version: 1.0.0'));
    cpSync(manifest, join(dir, 'old.yaml'));
    edit(manifest, (t) => t.replace('version: 1.0.0', 'version: 1.1.0').replace('      - maximum: 12', '      - maximum: 10'));
    const minor = await run(dir, ['diff', 'old.yaml', 'domain.manifest.yaml']);
    expect(minor.code).toBe(1);
    expect(minor.out).toEqual(['breaking    urn:demo:booking:definition:party_size  maximum is now 10, not 12: it accepts less']);
    expect(minor.err).toEqual(['diff failed: 1 change(s), 1 breaking, 1.0.0 → 1.1.0: 1.0.0 → 1.1.0 keeps the major version 1; a breaking change needs a new major version']);
    edit(manifest, (t) => t.replace('version: 1.1.0', 'version: 2.0.0'));
    expect((await run(dir, ['diff', 'old.yaml', 'domain.manifest.yaml'])).out.at(-1)).toBe('diff passed: 1 change(s), 1 breaking, 1.0.0 → 2.0.0: allowed, as 2.0.0 is a new major version');
  });
});

describe('the command line', () => {
  it('reports a config option that does not exist', async () => {
    const dir = copy();
    edit(join(dir, 'urn-forge.config.ts'), (t) => t.replace("  domains:", "  plugins: [],\n  domains:") );
    expect((await run(dir, ['compile'])).err).toEqual([
      'urn-forge.config.ts  error  config-invalid  config.plugins is not an option; the options are tsconfig, shell, domains',
      '  fix: Change the config to use only the options of defineConfig, with the types that the message names.',
    ]);
  });

  it('gives the usage for an unknown command, with exit code 2', async () => {
    const { code, err } = await run(copy(), ['build']);
    expect(code).toBe(2);
    expect(err[0]).toMatch(/^unknown command "build"/);
  });

  it('finds the line of a path, or of the nearest part of it that exists', () => {
    const text = 'a:\n  b:\n    c: 1\n  d: 2\n';
    expect(lineOf(text, ['a', 'b', 'c'])).toBe(3);
    expect(lineOf(text, ['a', 'd', 'missing'])).toBe(4);
  });
});
