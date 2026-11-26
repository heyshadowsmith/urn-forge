/**
 * The target of the plan of coding agents as the primary user: a problem has a stable code and a fix;
 * the commands give JSON; the package holds a complete reference and a JSON Schema of the manifest;
 * init writes the instructions of a project; and gate 5 fails a contract that gets weaker with no
 * version bump. Each test is it.fails until its step.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';
import { compileManifest } from '../src/compile.js';
import { contractGate } from '../src/verify/contract.js';

/** A test of the target that does not pass yet: it.fails until its step is built, then it. */
const target = { fixes: it, json: it, reference: it, schema: it, init: it, base: it };

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
const ROOT = join(PACKAGE, '../..');
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function copy(): string {
  const dir = mkdtempSync(join(FIXTURES, '.agents-'));
  cpSync(join(FIXTURES, 'booking'), dir, { recursive: true });
  dirs.push(dir);
  return dir;
}

async function run(dir: string, argv: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: dir, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  return { code, out, err };
}

const edit = (path: string, change: (text: string) => string): void => writeFileSync(path, change(readFileSync(path, 'utf8')));

/** Each code that the source can give, from the places that make a problem. */
function sourceCodes(): Set<string> {
  const codes = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.ts')) {
        const text = readFileSync(path, 'utf8');
        for (const m of text.matchAll(/(?:code: |\.(?:error|warning)\(\s*|problem\()'([a-z]+(?:-[a-z]+)*)'/g)) codes.add(m[1]!);
      }
    }
  };
  walk(join(PACKAGE, 'src'));
  return codes;
}

describe('the codes', () => {
  target.fixes('give each code that the source can give a fix', async () => {
    const { CODES } = (await import('../src/codes.js')) as { CODES: Record<string, { fix: string }> };
    const codes = sourceCodes();
    expect(codes.size).toBeGreaterThan(25);
    for (const code of codes) expect(CODES[code]?.fix, code).toMatch(/\S/);
  });
});

describe('--format json', () => {
  target.json('gives verify as one object, with a code and a fix for each problem', async () => {
    const dir = copy();
    edit(join(dir, 'features', 'seat.feature'), (t) => t.replace(/^.*\| maxLength .*\n/m, ''));
    const { code, out, err } = await run(dir, ['verify', '--format', 'json']);
    expect(code).toBe(1);
    expect(err).toEqual([]);
    expect(out).toHaveLength(1);
    const result = JSON.parse(out[0]!);
    expect(result.ok).toBe(false);
    expect(result.problems).toContainEqual(expect.objectContaining({ code: 'uncovered-rule', severity: 'error', fix: expect.stringMatching(/scenario/) }));
  });

  target.json('gives compile and diff as one object', async () => {
    const dir = copy();
    const compile = await run(dir, ['compile', '--format', 'json']);
    expect(compile.out).toHaveLength(1);
    expect(JSON.parse(compile.out[0]!)).toMatchObject({ ok: true, files: expect.arrayContaining([expect.objectContaining({ status: 'unchanged', path: 'generated/domain.generated.ts' })]) });
    const diff = await run(dir, ['diff', 'domain.manifest.yaml', 'domain.manifest.yaml', '--format', 'json']);
    expect(diff.out).toHaveLength(1);
    expect(JSON.parse(diff.out[0]!)).toMatchObject({ ok: true, changes: [] });
  });
});

describe('the reference in the package', () => {
  target.reference('names each standard rule, CEL function, step and code', async () => {
    const reference = readFileSync(join(PACKAGE, 'AGENTS.md'), 'utf8');
    const standard = parse(readFileSync(join(PACKAGE, 'src/standard.manifest.yaml'), 'utf8')) as { rules: Record<string, unknown> };
    for (const rule of Object.keys(standard.rules)) expect(reference, rule).toContain(`\`${rule}\``);
    // Each function of the table, each macro, and the special forms: as `name` or `name(…)`, also after a dot.
    const { FUNCTIONS } = await import('../src/cel/functions.js');
    const names = [...Object.keys(FUNCTIONS), 'has', 'duration', 'all', 'exists', 'exists_one', 'existsOne', 'map', 'filter', 'transformList', 'cel.bind'];
    for (const fn of names) expect(reference, fn).toMatch(new RegExp(`[\`.]${fn.replace('.', '\\.')}[\`(]`));
    for (const step of ['I run "', 'I check a "', 'the output is "', 'the input is rejected by "', 'the value is rejected by "', 'the value is accepted']) expect(reference, step).toContain(step);
    for (const code of sourceCodes()) expect(reference, code).toContain(`\`${code}\``);
    const { CODES } = await import('../src/codes.js');
    for (const [code, { fix }] of Object.entries(CODES)) expect(reference, code).toContain(`| \`${code}\` | ${fix.replaceAll('|', '\\|')} |`);
    const pkg = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as { files: string[] };
    expect(pkg.files).toContain('AGENTS.md');
  });
});

describe('the schema of the manifest', () => {
  target.schema('accepts each manifest of the fixtures, the domains and the contracts, and refuses an unknown key', () => {
    const schema = JSON.parse(readFileSync(join(PACKAGE, 'manifest.schema.json'), 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true }).compile(schema);
    // The standard set is not a manifest of a project: its rules have the camelCase names of JSON Schema.
    const manifests = execFileSync('git', ['ls-files', '*.manifest.yaml'], { cwd: ROOT, encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter((file) => !file.endsWith('src/standard.manifest.yaml'));
    expect(manifests.length).toBeGreaterThan(8);
    for (const file of manifests) {
      // The starter's template has the placeholders of init.
      const text = readFileSync(join(ROOT, file), 'utf8').replaceAll('{{namespace}}', 'app').replaceAll('{{domain}}', 'starter');
      const ok = validate(parse(text));
      expect(ok ? [] : validate.errors, file).toEqual([]);
    }
    const booking = parse(readFileSync(join(FIXTURES, 'booking/domain.manifest.yaml'), 'utf8')) as { definitions: Record<string, Record<string, unknown>> };
    booking.definitions['party_size']!['minimum'] = 1;
    expect(validate(booking)).toBe(false);
    const shape = (definition: object): boolean => validate({ manifest: { namespace: 'ab', domain: 'b', version: '0.1.0' }, definitions: { x: definition } });
    expect(shape({ description: 'X', type: 'object', properties: [] })).toBe(true);
    expect(shape({ description: 'X', type: 'object' })).toBe(false);
    expect(shape({ description: 'X', type: 'string', items: 'y' })).toBe(false);
    expect(shape({ description: 'X', type: 'string', rules: [{ minLength: 1, maxLength: 2 }] })).toBe(false);
    const pkg = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as { files: string[] };
    expect(pkg.files).toContain('manifest.schema.json');
  });
});

describe('init', () => {
  target.init('writes AGENTS.md and the schema line, and no CLAUDE.md', async () => {
    const dir = mkdtempSync(join(PACKAGE, '.agents-init-'));
    dirs.push(dir);
    expect((await run(dir, ['init'])).code).toBe(0);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toContain('node_modules/urn-forge/AGENTS.md');
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false);
    expect(readFileSync(join(dir, 'domain.manifest.yaml'), 'utf8')).toMatch(/^# yaml-language-server: \$schema=/);
  });

  it('keeps an AGENTS.md that exists', async () => {
    const dir = mkdtempSync(join(PACKAGE, '.agents-init-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'AGENTS.md'), 'Our own instructions\n');
    const { code, out } = await run(dir, ['init']);
    expect(code).toBe(0);
    expect(out).toContain('kept       AGENTS.md (it exists: point it at node_modules/urn-forge/AGENTS.md)');
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toBe('Our own instructions\n');
    expect(existsSync(join(dir, 'domain.manifest.yaml'))).toBe(true);
  });
});

describe('gate 5', () => {
  /** A copy of the booking fixture in a git repository of its own, with one commit; or in a folder of it. */
  function repository(folder = false): string {
    const root = copy();
    const dir = folder ? join(root, 'project') : root;
    if (folder) {
      for (const entry of readdirSync(root)) if (entry !== 'project') cpSync(join(root, entry), join(dir, entry), { recursive: true });
      for (const entry of readdirSync(root)) if (entry !== 'project') rmSync(join(root, entry), { recursive: true });
      // One folder deeper: the tsconfig and the imports of src are one more ../ away.
      edit(join(dir, 'urn-forge.config.ts'), (t) => t.replaceAll('../../../', '../../../../'));
    }
    const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    git('-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-q', '--allow-empty', '-m', 'empty');
    git('add', '.');
    git('-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'base');
    return dir;
  }

  const weaken = (dir: string): void => {
    edit(join(dir, 'domain.manifest.yaml'), (t) => t.replace('      - minimum: 1\n      - maximum: 12', '      - minimum: 1'));
    edit(join(dir, 'features', 'seat.feature'), (t) => t.replace(/^.*\| maximum .*\n/m, ''));
    execFileSync(process.execPath, [join(PACKAGE, 'bin/urn-forge.js'), 'compile'], { cwd: dir });
  };

  target.base('fails a removed rule, and passes with a version bump', async () => {
    const dir = repository();
    expect(existsSync(join(dir, '.git'))).toBe(true);
    weaken(dir);
    const weaker = await run(dir, ['verify', '--base', 'HEAD']);
    expect(weaker.code).toBe(1);
    expect(weaker.out.join('\n')).toMatch(/gate 5 {2}contract +FAIL/);
    expect(weaker.out.join('\n')).toContain('the rule maximum is removed');
    edit(join(dir, 'domain.manifest.yaml'), (t) => t.replace('version: 0.1.0', 'version: 0.2.0'));
    execFileSync(process.execPath, [join(PACKAGE, 'bin/urn-forge.js'), 'compile'], { cwd: dir });
    const bumped = await run(dir, ['verify', '--base', 'HEAD']);
    expect(bumped.out.join('\n')).toMatch(/gate 5 {2}contract +PASS/);
  });

  target.base('fails a removed scenario', async () => {
    const dir = repository();
    edit(join(dir, 'features', 'seat.feature'), (t) => t.replace(/Scenario: /, 'Scenario: Renamed '));
    const result = await run(dir, ['verify', '--base', 'HEAD', '--format', 'json']);
    const json = JSON.parse(result.out[0]!);
    expect(json.problems).toContainEqual(expect.objectContaining({ code: 'removed-scenario' }));
  });

  it('reads the base of a project in a folder of the repository', async () => {
    const dir = repository(true);
    edit(join(dir, 'features', 'seat.feature'), (t) => t.replace(/Scenario: /, 'Scenario: Renamed '));
    const result = await run(dir, ['verify', '--base', 'HEAD', '--format', 'json']);
    const json = JSON.parse(result.out[0]!);
    expect(json.gates.at(-1)).toMatchObject({ gate: 5, pass: false });
    expect(json.problems).toContainEqual(expect.objectContaining({ code: 'removed-scenario', file: 'features/seat.feature' }));
  });
});

describe('gate 5, without git', () => {
  const side = (text: string) => {
    const compiled = compileManifest(text);
    return { model: compiled.model!, applications: compiled.applications };
  };
  const booking = readFileSync(join(FIXTURES, 'booking/domain.manifest.yaml'), 'utf8');
  const gate = (next: string) =>
    contractGate({ base: 'main', old: { side: side(booking), features: [] }, next: { side: side(next), features: [] }, at: () => ({ file: 'domain.manifest.yaml' }) });

  it('passes the same contract', () => {
    expect(gate(booking)).toMatchObject({ gate: 5, pass: true, problems: [] });
  });

  it('fails a removed output and a required rule that lists fewer properties', () => {
    const next = booking.replace(/\n      - invalid_state:.*\n(?: {8}- .*\n)*/, '\n').replace('      - required: [reference, state]\n', '      - required: [reference]\n');
    const outcome = gate(next);
    expect(outcome.pass).toBe(false);
    expect(outcome.problems.map((p) => p.code).sort()).toEqual(['removed-output', 'wider-rule']);
  });

  it('allows a weaker contract with a new major version, as warnings', () => {
    const next = booking.replace('      - maximum: 12\n', '').replace('version: 0.1.0', 'version: 1.0.0');
    const outcome = gate(next);
    expect(outcome.pass).toBe(true);
    expect(outcome.problems).toEqual([expect.objectContaining({ code: 'removed-rule', severity: 'warning' })]);
  });
});

describe('the guardrails', () => {
  it('give each agent the edges and when to stop, in the starter AGENTS.md', () => {
    const text = readFileSync(join(PACKAGE, 'templates/starter/AGENTS.md'), 'utf8');
    expect(text).toMatch(/edge of each rule/);
    expect(text).toMatch(/## Stop and ask a person/);
    for (const when of ['remove or weaken a rule', 'new `version`', 'cannot be written in the rule language']) expect(text, when).toContain(when);
  });

  it('never tell the agent to change the version on its own', async () => {
    const { CODES } = await import('../src/codes.js');
    for (const [code, { fix }] of Object.entries(CODES)) {
      expect(fix, code).not.toMatch(/\bbump\b/i);
      if (/version/.test(fix)) expect(fix, code).toMatch(/ask a person/);
    }
  });
});
