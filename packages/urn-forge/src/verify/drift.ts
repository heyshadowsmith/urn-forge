/**
 * Gate 4: drift (spec §8).
 *
 * Compiles the manifest into a fresh temp directory with the same writer `compile` uses,
 * then byte-compares every file against the committed copy under `--out`. Also fails on a
 * committed `*.generated.*` file that the compile no longer produces (a file with no source).
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { GeneratedArtifact } from '../plugins/plugin.interface.js';
import { isGenerated, generatedPath, listGeneratedFiles, writeGeneratedFiles } from '../write.js';
import type { Diagnostic } from '../diagnostics.js';
import { displayPath, type Gate, type GateOutcome } from './types.js';

export interface DriftOptions {
  readonly cwd: string;
  readonly outDir: string;
  /** The fresh compile's files (from the engine). */
  readonly files: readonly GeneratedArtifact[];
}

function firstDifferentLine(expected: string, actual: string): number {
  const a = expected.split('\n');
  const b = actual.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i + 1;
  return 1;
}


export async function checkDrift(options: DriftOptions): Promise<GateOutcome> {
  const show = (path: string) => displayPath(options.cwd, path, relative);
  const problems: Diagnostic[] = [];
  const temp = await mkdtemp(join(tmpdir(), 'urn-forge-drift-'));
  try {
    await writeGeneratedFiles(temp, options.files);
    for (const file of options.files) {
      const fresh = await readFile(generatedPath(temp, file.relativePath));
      const committedPath = generatedPath(options.outDir, file.relativePath);
      const committed = await readFile(committedPath).catch(() => undefined);
      if (!committed) {
        problems.push({
          code: 'generated-missing',
          severity: 'error',
          file: show(committedPath),
          message: 'missing; run `urn-forge compile`',
        });
      } else if (!fresh.equals(committed)) {
        const line = firstDifferentLine(fresh.toString('utf8'), committed.toString('utf8'));
        problems.push({
          code: 'generated-differs',
          severity: 'error',
          file: show(committedPath),
          location: { line, column: 1 },
          message: 'differs from a fresh compile (hand-edited or stale); run `urn-forge compile`',
        });
      }
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }

  const produced = new Set(options.files.map((f) => f.relativePath));
  for (const orphan of (await listGeneratedFiles(options.outDir)).filter((p) => !produced.has(p))) {
    const path = generatedPath(options.outDir, orphan);
    // compile removes an orphan only if urn-forge wrote it (removeOrphanFiles in src/write.ts).
    const ours = isGenerated(await readFile(path, 'utf8').catch(() => ''));
    problems.push({
      code: 'generated-orphan',
      severity: 'error',
      file: show(path),
      message: ours
        ? 'generated file has no source in the current compile; run `urn-forge compile`, which removes it'
        : 'generated file has no source in the current compile, and urn-forge did not write it (no urn-forge header); rename or delete it',
    });
  }

  return {
    summary: `${options.files.length} generated file(s) compared byte for byte against ${show(options.outDir)}`,
    problems,
  };
}

export const driftGate: Gate = { number: 4, name: 'drift', run: checkDrift };
