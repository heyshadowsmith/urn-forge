#!/usr/bin/env node
// Gate 5 for this repository (lifecycle plan, step 5): `urn-forge diff` for each domain, from
// its manifest at a git ref (the base of a pull request) to the manifest in the working tree.
//
//   node scripts/diff-base.mjs <git ref>      for example HEAD^1 in CI, origin/main locally
//
// A domain whose manifest does not exist at the ref is new, so it has nothing to compare.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ref = process.argv[2];
if (!ref) {
  console.error('usage: node scripts/diff-base.mjs <git ref>');
  process.exit(2);
}
const pkg = fileURLToPath(new URL('..', import.meta.url));
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: pkg, encoding: 'utf8' }).trim();

/** Each domain: its config, and its manifest, relative to the package. */
const DOMAINS = [
  ['example/urn-forge.config.ts', 'tests/fixtures/math/domain.manifest.yaml'],
  ['self/urn-forge.config.ts', 'self/domain.manifest.yaml'],
  ['insurance/urn-forge.config.ts', 'insurance/domain.manifest.yaml'],
  ['tutorial/1-first-domain/urn-forge.config.ts', 'tutorial/1-first-domain/domain.manifest.yaml'],
  ['tutorial/2-declared-errors/urn-forge.config.ts', 'tutorial/2-declared-errors/domain.manifest.yaml'],
  ['tutorial/3-strict-coverage/urn-forge.config.ts', 'tutorial/3-strict-coverage/domain.manifest.yaml'],
];

const temp = mkdtempSync(join(tmpdir(), 'urn-forge-diff-'));
let failed = 0;
try {
  for (const [config, manifest] of DOMAINS) {
    const atRef = spawnSync('git', ['show', `${ref}:${relative(root, join(pkg, manifest)).split('\\').join('/')}`], { cwd: root, encoding: 'utf8' });
    console.log(`\n${manifest}`);
    if (atRef.status !== 0) {
      console.log(`new at ${ref}: nothing to compare`);
      continue;
    }
    const old = join(temp, `${manifest.replaceAll('/', '_')}`);
    writeFileSync(old, atRef.stdout);
    const run = spawnSync(process.execPath, ['bin/urn-forge.js', 'diff', old, manifest, '--config', config], { cwd: pkg, stdio: 'inherit' });
    if (run.status !== 0) failed += 1;
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
if (failed > 0) {
  console.error(`\n${failed} domain(s) have a breaking change: declare a new URN and deprecate the old one`);
  process.exit(1);
}
