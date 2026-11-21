/**
 * The classifier of `urn-forge diff` (lifecycle plan, step 3). Each directory under
 * tests/diff/ is one rule: an old and a new manifest, and the class of each change.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classify } from '../src/diff/classify.js';
import { constraintRelation, listRelation } from '../src/diff/relation.js';
import { main } from '../src/cli.js';
import { compile } from '../src/engine.js';
import { toUrn } from '../src/naming.js';
import type { Urn } from '../src/ir/types.js';

const CASES = fileURLToPath(new URL('./diff', import.meta.url));
const cases = readdirSync(CASES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

describe.each(cases)('diff case %s', (name) => {
  const read = (file: string) => readFileSync(join(CASES, name, file), 'utf8');
  it('reports the expected class for each changed URN', () => {
    const [old, now] = [compile(read('old.yaml')).ir!, compile(read('new.yaml')).ir!];
    const tablesFile = join(CASES, name, 'tables.json');
    const tables = existsSync(tablesFile)
      ? (JSON.parse(read('tables.json')) as string[]).map((key) => {
          const [context, kind, identifier] = key.split('.') as [string, string, string];
          return toUrn({ namespace: old.meta.namespace, domain: old.meta.domain, context, kind, identifier }) as Urn;
        })
      : [];
    const changes = classify(old, now, { tables });
    const got = changes.map((c) => `${c.class} ${c.urn}`).sort();
    const expected = read('expected.txt').trim().split('\n').sort();
    expect(got, changes.map((c) => `${c.class} ${c.urn}: ${c.message}`).join('\n')).toEqual(expected);
  });
});

describe('the relation of two sets of constraints', () => {
  it.each([
    ['decimal', { min: '0.01' }, { exclusiveMin: '0.01' }, 'narrower'],
    ['decimal', { exclusiveMin: '0' }, { min: '0' }, 'wider'],
    ['decimal', { scale: 2 }, { scale: 3 }, 'wider'],
    ['decimal', {}, { scale: 2 }, 'narrower'],
    ['decimal', { notIn: ['13.00'] }, { notIn: ['13', '14'] }, 'narrower'],
    ['integer', { multipleOf: 4 }, { multipleOf: 6 }, 'neither'],
    ['integer', { min: 1, max: 9 }, { min: 0, max: 8 }, 'neither'],
    ['timestamp', { max: '2026-01-01T00:00:00Z' }, { max: '2026-01-01T00:00:00.000Z' }, 'equal'],
    ['date', { min: '2026-01-01' }, { min: '2025-12-31' }, 'wider'],
    ['enum', { values: ['a', 'b'] }, { values: ['b', 'a'] }, 'equal'],
    ['boolean', { mustBe: true }, { mustBe: false }, 'neither'],
    ['string', { format: 'uuid' }, {}, 'wider'],
  ] as const)('%s %j → %j is %s', (primitive, old, now, relation) => {
    expect(constraintRelation(primitive, old as never, now as never)).toBe(relation);
  });

  it('compares a list rule by its count and uniqueness', () => {
    expect(listRelation({ minItems: 1 }, { minItems: 1, unique: true })).toBe('narrower');
    expect(listRelation({ maxItems: 3 }, { maxItems: 5 })).toBe('wider');
  });
});

describe('the diff command', () => {
  const CASE = (name: string, file: string) => `tests/diff/${name}/${file}`;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: fileURLToPath(new URL('..', import.meta.url)), stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l) });
  const run = async (args: string[]) => {
    out = [];
    err = [];
    return main(['diff', ...args, '--config', 'tests/diff/no-config.ts'], io());
  };

  it('passes, and prints each change, when no change is breaking', async () => {
    expect(await run([CASE('deprecated', 'old.yaml'), CASE('deprecated', 'new.yaml')])).toBe(0);
    expect(out).toEqual(['lifecycle   urn:demo:shop:order:field:spare  status active → deprecated', 'diff passed: 0 breaking, 0 compatible, 1 lifecycle change(s)']);
  });

  it('fails on a breaking change to a live URN', async () => {
    expect(await run([CASE('input-tightened', 'old.yaml'), CASE('input-tightened', 'new.yaml')])).toBe(1);
    expect(out).toEqual(['breaking    urn:demo:shop:order:field:qty  max 10 → 5 narrows a value that callers send, which breaks callers that send it']);
    expect(err).toEqual(['diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)']);
  });

  it('passes with a warning while the old manifest is experimental', async () => {
    expect(await run([CASE('experimental', 'old.yaml'), CASE('experimental', 'new.yaml')])).toBe(0);
    expect(out.at(-1)).toBe('diff passed: 1 breaking, 0 compatible, 0 lifecycle change(s); the breaking changes are warnings, because tests/diff/experimental/old.yaml is experimental');
  });

  it('writes JSON lines: a change for each compatible or lifecycle change, a diagnostic for each breaking one', async () => {
    expect(await run([CASE('error-added', 'old.yaml'), CASE('error-added', 'new.yaml'), '--format', 'json'])).toBe(1);
    expect(out.map((l) => JSON.parse(l))).toEqual([
      { type: 'change', class: 'compatible', urn: 'urn:demo:shop:order:error:closed', message: 'is new' },
      {
        type: 'diagnostic',
        severity: 'error',
        code: 'breaking-change',
        file: 'tests/diff/error-added/new.yaml',
        urn: 'urn:demo:shop:order:operation:place',
        message: 'urn:demo:shop:order:operation:place: the new declared error urn:demo:shop:order:error:closed widens a value that callers receive, which breaks callers that receive it',
      },
      { type: 'result', ok: false, breaking: 1, compatible: 1, lifecycle: 0 },
    ]);
  });

  it('reads the Postgres tables from the config, for the Stored use', async () => {
    out = [];
    expect(await main(['diff', CASE('stored-tightened', 'old.yaml'), CASE('stored-tightened', 'new.yaml'), '--config', 'tests/diff/stored-tightened/urn-forge.config.ts'], io())).toBe(1);
    expect(out[0]).toBe('breaking    urn:demo:shop:order:field:spare  min none → 5 narrows a value that the database stores, which breaks rows already stored');
  });

  it('reports a manifest that it cannot read, and a call without two manifests', async () => {
    expect(await run([CASE('deprecated', 'old.yaml'), 'tests/diff/nope.yaml'])).toBe(1);
    expect(err[0]).toMatch(/^tests\/diff\/nope\.yaml {2}error {2}manifest-unreadable {2}cannot read manifest: ENOENT/u);
    expect(await run([CASE('deprecated', 'old.yaml')])).toBe(2);
    expect(err[0]).toMatch(/^diff needs two manifests: <old manifest> <new manifest>/u);
  });
});
