/**
 * The determinism contract (spec §6): the same manifest, config and urn-forge version give
 * byte-identical output on any machine, in any locale and time zone. This compiles every
 * passing fixture in a child process with an unusual locale (Turkish, where case mapping
 * and collation differ) and time zone (UTC+12:45), and compares against `expected/`. CI
 * also runs the whole suite under the same settings.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const FIXTURES = root('tests/fixtures');
const ENV = { ...process.env, TZ: 'Pacific/Chatham', LC_ALL: 'tr_TR.UTF-8', LANG: 'tr_TR.UTF-8' };

const passing = readdirSync(FIXTURES).filter((name) => existsSync(join(FIXTURES, name, 'expected', 'ir.json')));
const out = mkdtempSync(join(tmpdir(), 'urn-forge-determinism-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('determinism under another locale and time zone', () => {
  it('the child process really uses them', () => {
    const run = spawnSync(process.execPath, ['-e', 'console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)'], {
      env: ENV,
      encoding: 'utf8',
    });
    expect(run.stdout.trim()).toBe('Pacific/Chatham');
  });

  it.each(passing)('compiles fixture %s to its expected bytes', (name) => {
    const run = spawnSync(
      process.execPath,
      [
        root('bin/urn-forge.js'),
        'compile',
        // A fixture's own config chooses its plugins; the flags below override its paths.
        ...(existsSync(join(FIXTURES, name, 'urn-forge.config.ts')) ? ['--config', join(FIXTURES, name, 'urn-forge.config.ts')] : []),
        '--manifest',
        join(FIXTURES, name, 'domain.manifest.yaml'),
        '--out',
        join(out, name),
      ],
      { env: ENV, encoding: 'utf8' },
    );
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    for (const file of readdirSync(join(out, name))) {
      expect(readFileSync(join(out, name, file)).equals(readFileSync(join(FIXTURES, name, 'expected', file))), file).toBe(true);
    }
  });
});
