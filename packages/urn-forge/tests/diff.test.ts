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
