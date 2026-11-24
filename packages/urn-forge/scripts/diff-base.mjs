#!/usr/bin/env node
// `urn-forge diff` for each domain of this package, from its manifest at a git ref (the base of a
// pull request) to the manifest in the working tree.
//
//   node scripts/diff-base.mjs <git ref> [--report]      for example HEAD^1 in CI, origin/main locally
//
// With --report, a breaking change is printed but does not fail the script: this repository's
// domains are test domains, which change on purpose. A domain whose manifest does not exist at the
// ref is new, so it has nothing to compare.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ref = process.argv[2];
const report = process.argv.includes('--report');
if (!ref || ref.startsWith('--')) {
  console.error('usage: node scripts/diff-base.mjs <git ref> [--report]');
  process.exit(2);
}
const pkg = fileURLToPath(new URL('..', import.meta.url));
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: pkg, encoding: 'utf8' }).trim();

/** The manifest of each domain, relative to the package. */
const DOMAINS = [
  'example/domain.manifest.yaml',
  'self/domain.manifest.yaml',
  'insurance/domain.manifest.yaml',
  'tutorial/1-first-domain/domain.manifest.yaml',
  'tutorial/2-declared-errors/domain.manifest.yaml',
  'tutorial/3-strict-coverage/domain.manifest.yaml',
];

const temp = mkdtempSync(join(tmpdir(), 'urn-forge-diff-'));
let failed = 0;
try {
  for (const manifest of DOMAINS) {
    const atRef = spawnSync('git', ['show', `${ref}:${relative(root, join(pkg, manifest)).split('\\').join('/')}`], { cwd: root, encoding: 'utf8' });
    console.log(`\n${manifest}`);
    if (atRef.status !== 0) {
      console.log(`new at ${ref}: nothing to compare`);
      continue;
    }
    // A manifest of urn-forge 0.1 has a top-level key for each part (`booking.field.reference`), not
    // the sections of this version: it cannot be compared.
    if (!/^definitions:/m.test(atRef.stdout) && !/^operations:/m.test(atRef.stdout)) {
      console.log(`the manifest at ${ref} is written for urn-forge 0.1: nothing to compare`);
      continue;
    }
    const old = join(temp, manifest.replaceAll('/', '_'));
    writeFileSync(old, atRef.stdout);
    const run = spawnSync(process.execPath, ['bin/urn-forge.js', 'diff', old, manifest], { cwd: pkg, stdio: 'inherit' });
    if (run.status !== 0) failed += 1;
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
if (failed > 0) {
  console.error(`\n${failed} domain(s) have a breaking change that the version does not allow`);
  if (report) console.error('(--report: printed, not a failure)');
  else process.exit(1);
}
