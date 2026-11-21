#!/usr/bin/env node
// The path a person takes outside this repository: pack urn-forge, install the tarball in a
// new project, run `urn-forge init`, then compile, verify and the scenarios. Each step must
// succeed and show what the README promises. Then a hand edit must fail verify, so a green
// run is not an accident.
//
// Run with `npm run test:tarball`. It needs the npm registry for urn-forge's dependencies.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'urn-forge-tarball-'));
const project = join(work, 'my-domain');
let failed = false;

/** Runs a command; returns its exit code and its output (stdout and stderr together). */
function run(command, args, cwd) {
  console.log(`\n$ ${[command, ...args].join(' ')}`);
  try {
    const output = execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(output);
    return { code: 0, output };
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    process.stdout.write(output);
    return { code: error.status ?? 1, output };
  }
}

function expect(label, condition) {
  console.log(`${condition ? 'ok  ' : 'FAIL'}  ${label}`);
  if (!condition) failed = true;
}

try {
  const packed = run('npm', ['pack', '--pack-destination', work], packageDir);
  const tarball = join(work, packed.output.trim().split('\n').at(-1));
  expect('npm pack makes a tarball', packed.code === 0 && tarball.endsWith('.tgz'));

  execFileSync('mkdir', [project]);
  expect('npm init', run('npm', ['init', '-y'], project).code === 0);
  expect('npm install <tarball>', run('npm', ['install', '--no-audit', '--no-fund', tarball], project).code === 0);

  const init = run('npx', ['urn-forge', 'init', '--namespace', 'acme', '--domain', 'billing'], project);
  expect('urn-forge init', init.code === 0 && init.output.includes('next: npm run verify, then npm run test:features'));
  expect('package.json is an ES module package', JSON.parse(readFileSync(join(project, 'package.json'), 'utf8')).type === 'module');

  const verify = run('npm', ['run', 'verify'], project);
  expect('verify passes with no warning', verify.code === 0 && verify.output.includes('verify passed (gates 1, 3, 4;'));

  const features = run('npm', ['run', 'test:features'], project);
  expect('every scenario passes', features.code === 0 && features.output.includes('7 scenarios (7 passed)'));

  // A changed rule in the core: the scenarios must catch it.
  const corePath = join(project, 'src/core.ts');
  writeFileSync(corePath, readFileSync(corePath, 'utf8').replace('total_cents / people', 'total_cents / people + 1'));
  const broken = run('npm', ['run', 'test:features'], project);
  expect('a wrong core fails the scenarios', broken.code !== 0 && broken.output.includes('share_cents: expected 250, got 251'));

  // A hand edit of a generated file: verify must fail at gate 4.
  const runtime = join(project, 'src/generated/domain.runtime.generated.ts');
  writeFileSync(runtime, `${readFileSync(runtime, 'utf8')}// edited\n`);
  const drift = run('npm', ['run', 'verify'], project);
  expect('a hand-edited generated file fails gate 4', drift.code !== 0 && drift.output.includes('generated-differs'));
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(failed ? '\ntarball test failed' : '\ntarball test passed');
process.exitCode = failed ? 1 : 0;
