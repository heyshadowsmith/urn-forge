/**
 * The counts of the conformance tests of cel-spec: in scope, passed, known gaps, and out of scope by
 * reason. With --write, it writes tests/conformance/known-gaps.txt from the tests that fail now.
 */
import { writeFileSync } from 'node:fs';
import { REASONS, runAll } from '../tests/conformance/runner.js';

const outcomes = runAll();
const count = (test: (o: (typeof outcomes)[number]) => boolean): number => outcomes.filter(test).length;
const files = [...new Set(outcomes.map((o) => o.id.split('/')[0]!))];

console.log('file            in scope   pass   gaps   out');
for (const file of files) {
  const of = (o: (typeof outcomes)[number]): boolean => o.id.startsWith(`${file}/`);
  const pass = count((o) => of(o) && o.result === 'pass');
  const fail = count((o) => of(o) && o.result === 'fail');
  console.log(`${file.padEnd(16)}${String(pass + fail).padStart(8)}${String(pass).padStart(7)}${String(fail).padStart(7)}${String(count((o) => of(o) && o.result === 'out')).padStart(6)}`);
}
const pass = count((o) => o.result === 'pass');
const fail = count((o) => o.result === 'fail');
console.log(`${'total'.padEnd(16)}${String(pass + fail).padStart(8)}${String(pass).padStart(7)}${String(fail).padStart(7)}${String(count((o) => o.result === 'out')).padStart(6)}`);
console.log('\nout of scope, by reason');
for (const [reason, text] of Object.entries(REASONS)) {
  const n = count((o) => o.result === 'out' && o.reason === reason);
  if (n > 0) console.log(`  ${text.padEnd(24)}${n}`);
}

if (process.argv.includes('--write')) {
  const gaps = outcomes.filter((o) => o.result === 'fail').map((o) => o.id);
  const header = '# The conformance tests of cel-spec in scope that urn-forge does not pass yet. Each step removes lines.\n';
  writeFileSync(new URL('../tests/conformance/known-gaps.txt', import.meta.url), header + gaps.map((id) => `${id}\n`).join(''));
  console.log(`\nwrote ${gaps.length} known gap(s)`);
}
