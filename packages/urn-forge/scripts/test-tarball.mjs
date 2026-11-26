#!/usr/bin/env node
// The path a person takes outside this repository: pack urn-forge, install the tarball in a new
// project, run `urn-forge init`, then compile, verify and the scenarios. Each step must succeed.
// Then a wrong core must fail the scenarios, and a hand edit of a generated file must fail verify,
// so a green run is not an accident.
//
// Run with `npm run test:tarball`. It needs the npm registry for urn-forge's dependencies.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'urn-forge-tarball-'));
const project = join(work, 'my-domain');
let failed = false;

/** Runs a command; gives its exit code and its output (stdout and stderr together). */
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
  expect('urn-forge init', init.code === 0 && init.output.includes('next: npm install, then npx urn-forge compile, then npx urn-forge verify'));
  expect('init installs the Claude Code skill', readFileSync(join(project, '.claude/skills/urn-forge/SKILL.md'), 'utf8').startsWith('---\nname: urn-forge\n'));
  expect('package.json is an ES module package', JSON.parse(readFileSync(join(project, 'package.json'), 'utf8')).type === 'module');

  expect('compile', run('npm', ['run', 'compile'], project).code === 0);
  const verify = run('npm', ['run', 'verify'], project);
  expect('verify passes with no warning', verify.code === 0 && verify.output.includes('verify passed (gates 1, 2, 3, 4)'));

  const features = run('npm', ['run', 'test:features'], project);
  expect('every scenario passes', features.code === 0 && features.output.includes('11 scenarios (11 passed)'));

  // A changed rule in the core: the harness must catch it.
  const corePath = join(project, 'src/core.ts');
  writeFileSync(corePath, readFileSync(corePath, 'utf8').replace('total_cents / people.length', 'total_cents / people.length + 1'));
  const broken = run('npm', ['run', 'test:features'], project);
  expect('a wrong core fails the scenarios', broken.code !== 0 && broken.output.includes('ContractViolation: shares_add_up of split: The shares do not add up to the total'));

  // A hand edit of a generated file: verify must fail at gate 4.
  const generated = join(project, 'src/generated/domain.generated.ts');
  writeFileSync(generated, `${readFileSync(generated, 'utf8')}// edited\n`);
  const drift = run('npm', ['run', 'verify'], project);
  expect('a hand-edited generated file fails gate 4', drift.code !== 0 && drift.output.includes('the generated file is not current'));

  // The tutorial snapshots start from init and change the manifest, the config, the core and
  // the feature. Their end state must pass in a project made from the tarball.
  const shipping = join(work, 'my-shipping');
  execFileSync('mkdir', [shipping]);
  run('npm', ['init', '-y'], shipping);
  run('npm', ['install', '--no-audit', '--no-fund', tarball], shipping);
  expect('tutorial: urn-forge init', run('npx', ['urn-forge', 'init', '--namespace', 'demo', '--domain', 'shipping'], shipping).code === 0);
  rmSync(join(shipping, 'features/split.feature'));
  const tutorial = join(packageDir, 'tutorial/3-edges');
  for (const file of ['domain.manifest.yaml', 'urn-forge.config.ts', 'src/core.ts']) cpSync(join(tutorial, file), join(shipping, file));
  for (const file of readdirSync(join(tutorial, 'features')).filter((f) => f.endsWith('.feature'))) cpSync(join(tutorial, 'features', file), join(shipping, 'features', file));
  expect('tutorial: compile', run('npx', ['urn-forge', 'compile'], shipping).code === 0);
  const tutorialVerify = run('npx', ['urn-forge', 'verify'], shipping);
  expect('tutorial: verify passes with no warning', tutorialVerify.code === 0 && tutorialVerify.output.includes('verify passed (gates 1, 2, 3, 4)'));
  const tutorialFeatures = run('npx', ['cucumber-js'], shipping);
  expect('tutorial: every scenario passes', tutorialFeatures.code === 0 && /\d+ scenarios \(\d+ passed\)/.test(tutorialFeatures.output));
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(failed ? '\ntarball test failed' : '\ntarball test passed');
process.exitCode = failed ? 1 : 0;
