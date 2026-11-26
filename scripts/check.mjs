#!/usr/bin/env node
// Every check that CI runs, in one command, so that a person or an agent can run them all before a
// pull request:
//
//   npm run check                       all checks
//   npm run check -- --base origin/main also diff and gate 5 against a git ref
//   npm run check -- --quick            leave out the tarball test and the docs build
//
// Each check runs even when one before it fails, so that one failure does not hide another. The
// script exits with 1 when any check fails, and lists the failed checks at the end.
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = join(root, 'packages/urn-forge');
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const baseAt = args.indexOf('--base');
const base = baseAt >= 0 ? args[baseAt + 1] : undefined;
if (baseAt >= 0 && (!base || base.startsWith('--'))) {
  console.error('usage: npm run check -- [--base <git ref>] [--quick]');
  process.exit(2);
}
const ci = process.env.GITHUB_ACTIONS === 'true';
const contracts = readdirSync(join(root, 'contracts'))
  .filter((name) => statSync(join(root, 'contracts', name)).isDirectory())
  .sort();

/** The checks, in order: a name, a command, and the folder to run it in. */
const checks = [
  ['tests', 'npm', ['test'], root],
  ['typecheck', 'npm', ['run', 'typecheck'], root],
  ['verify example', 'npm', ['run', '-s', 'verify:example'], pkg],
  ['scenarios example', 'npx', ['cucumber-js'], pkg],
  ['verify self', 'npm', ['run', '-s', 'verify:self'], pkg],
  ['scenarios self', 'npx', ['cucumber-js', '--profile', 'self'], pkg],
  ['verify insurance', 'npm', ['run', '-s', 'verify:insurance'], pkg],
  ['scenarios insurance', 'npm', ['run', '-s', 'test:features:insurance'], pkg],
  ['verify tutorial', 'npm', ['run', '-s', 'verify:tutorial'], pkg],
  ['scenarios tutorial', 'npm', ['run', '-s', 'test:features:tutorial'], pkg],
  ...contracts.flatMap((name) => [
    [`verify contract ${name}`, 'node', ['packages/urn-forge/bin/urn-forge.js', 'verify', '--config', `contracts/${name}/urn-forge.config.ts`, ...(base ? ['--base', base] : [])], root],
    [
      `scenarios contract ${name}`,
      'npx',
      ['cucumber-js', '--import', '../../packages/urn-forge/src/gherkin/register-tsx.mjs', '--import', 'features/support/**/*.ts', 'features/**/*.feature'],
      join(root, 'contracts', name),
    ],
  ]),
  ['corpus score', 'npm', ['run', '-s', 'corpus'], root],
  // The domains here are test domains, which change on purpose: diff is a report, not a failure.
  ...(base ? [['diff against the base (report)', 'npm', ['run', '-s', 'diff:base', '--', base, '--report'], pkg]] : []),
  ...(quick ? [] : [['tarball', 'npm', ['run', '-s', 'test:tarball'], root], ['docs build', 'npm', ['run', '-s', 'docs:build'], root]]),
];

const failed = [];
for (const [name, command, commandArgs, cwd] of checks) {
  console.log(ci ? `::group::${name}` : `\n=== ${name}`);
  const run = spawnSync(command, commandArgs, { cwd, stdio: 'inherit' });
  if (ci) console.log('::endgroup::');
  if (run.status !== 0) {
    failed.push(name);
    console.log(ci ? `::error::${name} failed` : `--- ${name} failed`);
  }
}
console.log(`\n${checks.length - failed.length} of ${checks.length} checks passed`);
if (failed.length > 0) {
  console.log(`failed: ${failed.join(', ')}`);
  process.exit(1);
}
