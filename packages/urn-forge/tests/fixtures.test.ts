/**
 * The fixture harness (foundations plan, phase 6). Each directory under tests/fixtures/ is
 * one fixture: a `domain.manifest.yaml` and an `expected/` directory holding exactly what
 * `compile` produces for it.
 *
 *   - A manifest that compiles: `expected/ir.json` (the canonical IR, pretty-printed) and
 *     every generated file, byte for byte, header and fingerprint included.
 *   - A manifest that does not: `expected/diagnostics.json`, and nothing else.
 *
 * To add a fixture, add its manifest and run `npx vitest run tests/fixtures.test.ts -u` to
 * write `expected/`, then run it again without `-u` (the first run cannot yet see the files
 * it writes). Review the files: any later change to them is a change to urn-forge's output.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { canonicalJson } from '../src/ir/canonical.js';

const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url));
const fixtures = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

/** Pretty-printed canonical JSON: sorted keys, readable diffs. */
const pretty = (value: unknown) => `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;

const expectedFiles = (name: string): string[] => {
  try {
    return readdirSync(join(FIXTURES, name, 'expected')).sort();
  } catch {
    return [];
  }
};

describe.each(fixtures)('fixture %s', (name) => {
  const expected = (file: string) => join(FIXTURES, name, 'expected', file);
  const result = compile(readFileSync(join(FIXTURES, name, 'domain.manifest.yaml'), 'utf8'));
  const errors = result.diagnostics.some((d) => d.severity === 'error');

  if (errors) {
    it('fails with the expected diagnostics, and writes nothing', async () => {
      expect(result.files).toEqual([]);
      await expect(pretty(result.diagnostics)).toMatchFileSnapshot(expected('diagnostics.json'));
      expect(expectedFiles(name)).toEqual(['diagnostics.json']);
    });
  } else {
    it('compiles without diagnostics to the expected IR and files', async () => {
      expect(result.diagnostics).toEqual([]);
      await expect(pretty(result.ir)).toMatchFileSnapshot(expected('ir.json'));
      for (const file of result.files) await expect(file.content).toMatchFileSnapshot(expected(file.relativePath));
      expect(expectedFiles(name)).toEqual(['ir.json', ...result.files.map((f) => f.relativePath)].sort());
    });
  }
});

it('has at least one passing and one failing fixture', () => {
  const failing = fixtures.filter((name) => expectedFiles(name).includes('diagnostics.json'));
  expect(failing.length).toBeGreaterThan(0);
  expect(fixtures.length).toBeGreaterThan(failing.length);
});
