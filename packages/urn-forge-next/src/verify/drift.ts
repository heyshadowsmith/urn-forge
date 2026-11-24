/**
 * Gate 4: drift. The generated files are the files that compile gives now, byte for byte, and there
 * is no generated file that compile no longer makes.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GeneratedFile } from '../generate/code.js';
import { listGenerated } from '../write.js';
import type { GateOutcome, GateProblem } from './types.js';

function firstDifferentLine(a: string, b: string): number {
  const x = a.split('\n');
  const y = b.split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return i + 1;
  return 1;
}

export async function driftGate(outDir: string, files: readonly GeneratedFile[], show: (path: string) => string): Promise<GateOutcome> {
  const problems: GateProblem[] = [];
  for (const file of files) {
    const path = join(outDir, file.path);
    const committed = await readFile(path, 'utf8').catch(() => undefined);
    if (committed === undefined) problems.push({ code: 'drift', severity: 'error', file: show(path), message: 'the generated file does not exist; run urn-forge compile' });
    else if (committed !== file.content) {
      problems.push({ code: 'drift', severity: 'error', file: show(path), line: firstDifferentLine(committed, file.content), message: 'the generated file is not current; run urn-forge compile' });
    }
  }
  const made = new Set(files.map((f) => f.path));
  for (const name of await listGenerated(outDir)) {
    if (!made.has(name)) problems.push({ code: 'drift', severity: 'error', file: show(join(outDir, name)), message: 'compile no longer makes this file; run urn-forge compile, which removes it' });
  }
  return { gate: 4, name: 'drift', pass: problems.length === 0, summary: `${files.length} generated file(s) compared byte for byte against ${show(outDir)}`, problems };
}
