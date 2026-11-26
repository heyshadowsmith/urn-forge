/**
 * The target of the plan of URNs, strict coverage and several domains: each part has a URN, built from
 * the header; a gap in the scenarios is always an error; and one config holds several domains, which
 * compile and verify in one run. Each test is it.fails until its step.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';
import { compileManifest } from '../src/compile.js';
import { classify } from '../src/diff/classify.js';

/** A test of the target that does not pass yet: it.fails until its step is built, then it. */
const target = { strict: it.fails, namespace: it.fails, urns: it.fails, domains: it.fails };

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
const BOOKING = join(FIXTURES, 'booking');
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function run(dir: string, argv: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: dir, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  return { code, out, err };
}

const edit = (path: string, change: (text: string) => string): void => writeFileSync(path, change(readFileSync(path, 'utf8')));

/** A copy of the booking fixture, next to it. */
function copy(): string {
  const dir = mkdtempSync(join(FIXTURES, '.domains-'));
  cpSync(BOOKING, dir, { recursive: true });
  dirs.push(dir);
  return dir;
}

/** Two copies of the booking fixture, `booking` and `second`, in folders of one project with one config. */
function twoDomains(config?: string): string {
  const dir = mkdtempSync(join(FIXTURES, '.domains-'));
  dirs.push(dir);
  for (const name of ['booking', 'second']) {
    mkdirSync(join(dir, name));
    for (const part of ['core.ts', 'domain.manifest.yaml', 'features']) cpSync(join(BOOKING, part), join(dir, name, part), { recursive: true });
  }
  edit(join(dir, 'second', 'domain.manifest.yaml'), (t) => t.replace('domain: booking', 'domain: second'));
  const domain = (name: string): string =>
    `{ manifest: '${name}/domain.manifest.yaml', out: '${name}/generated', core: '${name}/core.ts', features: '${name}/features', postgres: { tables: ['booking'] } }`;
  writeFileSync(
    join(dir, 'urn-forge.config.ts'),
    config ?? `import { defineConfig } from '../../../src/config.js';\n\nexport default defineConfig({\n  tsconfig: '../../../tsconfig.json',\n  domains: [${domain('booking')}, ${domain('second')}],\n});\n`,
  );
  return dir;
}

describe('always strict', () => {
  target.strict('refuses the coverage option', async () => {
    const dir = copy();
    const { code, err } = await run(dir, ['compile']);
    expect(code).toBe(1);
    expect(err.join('\n')).toMatch(/config-invalid {2}config\.coverage is removed: a gap in the scenarios is always an error/);
  });

  target.strict('fails a gap with no coverage option', async () => {
    const dir = copy();
    edit(join(dir, 'urn-forge.config.ts'), (t) => t.replace("  coverage: 'error',\n", ''));
    edit(join(dir, 'features', 'seat.feature'), (t) => t.replace(/^.*\| maxLength .*\n/m, ''));
    const { code, out } = await run(dir, ['verify']);
    expect(code).toBe(1);
    expect(out.join('\n')).toMatch(/features {2}error {2}uncovered-rule {2}no scenario breaks maxLength of note/);
  });
});

describe('the namespace', () => {
  target.namespace('is a URN namespace, with no underscore', () => {
    const text = readFileSync(join(BOOKING, 'domain.manifest.yaml'), 'utf8').replace('namespace: demo', 'namespace: my_shop');
    const compiled = compileManifest(text);
    expect(compiled.diagnostics).toContainEqual(expect.objectContaining({ code: 'manifest-shape', path: ['manifest', 'namespace'] }));
    expect(compileManifest(text.replace('my_shop', 'my-shop')).model).toBeDefined();
  });
});

describe('URNs', () => {
  target.urns('name the domain, each definition and each operation in the generated file, and each result', async () => {
    const generated = (await import('./fixtures/booking/generated/domain.generated.js')) as Record<string, unknown>;
    expect(generated['DOMAIN']).toBe('urn:demo:booking');
    expect((generated['Definitions'] as Record<string, { urn: string }>)['party_size']!.urn).toBe('urn:demo:booking:definition:party_size');
    expect((generated['Operations'] as Record<string, { urn: string }>)['seat_booking']!.urn).toBe('urn:demo:booking:operation:seat_booking');
    const { core } = (await import('./fixtures/booking/core.js')) as { core: unknown };
    const runOperation = generated['runOperation'] as (core: unknown, operation: string, input: unknown) => { domain: string };
    expect(runOperation(core, 'seat_booking', {}).domain).toBe('urn:demo:booking');
    const check = generated['check'] as (definition: string, value: unknown) => { domain: string };
    expect(check('party_size', 4).domain).toBe('urn:demo:booking');
  });

  target.urns('name the place of each change of diff', () => {
    const text = readFileSync(join(BOOKING, 'domain.manifest.yaml'), 'utf8');
    const side = (t: string) => {
      const compiled = compileManifest(t);
      return { model: compiled.model!, applications: compiled.applications };
    };
    const changes = classify(side(text), side(text.replace('      - maximum: 12', '      - maximum: 10')));
    expect(changes.map((c) => c.place)).toEqual(['urn:demo:booking:definition:party_size']);
  });
});

describe('several domains', () => {
  target.domains('compile and verify in one run, each with its URN', async () => {
    const dir = twoDomains();
    expect((await run(dir, ['compile'])).code).toBe(0);
    const verify = await run(dir, ['verify']);
    expect(verify.code).toBe(0);
    expect(verify.out).toEqual(expect.arrayContaining(['urn:demo:booking', 'urn:demo:second']));
    const json = JSON.parse((await run(dir, ['verify', '--format', 'json'])).out[0]!);
    expect(json.domains.map((d: { urn: string }) => d.urn)).toEqual(['urn:demo:booking', 'urn:demo:second']);
  });

  target.domains('fail a gap in the second domain, with its URN', async () => {
    const dir = twoDomains();
    expect((await run(dir, ['compile'])).code).toBe(0);
    edit(join(dir, 'second', 'features', 'seat.feature'), (t) => t.replace(/^.*\| maxLength .*\n/m, ''));
    const { code, out } = await run(dir, ['verify', '--format', 'json']);
    expect(code).toBe(1);
    expect(JSON.parse(out[0]!).problems).toContainEqual(expect.objectContaining({ code: 'uncovered-rule', domain: 'urn:demo:second' }));
  });

  target.domains('refuse two domains with the same out', async () => {
    const dir = twoDomains();
    edit(join(dir, 'urn-forge.config.ts'), (t) => t.replace("out: 'second/generated'", "out: 'booking/generated'"));
    const { code, err } = await run(dir, ['compile']);
    expect(code).toBe(1);
    expect(err.join('\n')).toMatch(/config-invalid {2}two domains write to booking\/generated/);
  });
});
