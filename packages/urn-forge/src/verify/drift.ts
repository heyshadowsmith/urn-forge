/**
 * Gate 4: drift (spec §8).
 *
 * Compiles the manifest into a fresh temp directory with the same writer `compile` uses,
 * then byte-compares every file against the committed copy under `--out`. Also fails on a
 * committed `*.generated.*` file that the compile no longer produces (a file with no source).
 */
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { GeneratedArtifact } from '../plugins/plugin.interface.js';
import { generatedPath, writeGeneratedFiles } from '../write.js';
import { displayPath, type GateResult } from './types.js';

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

async function committedGeneratedFiles(outDir: string): Promise<string[]> {
  const entries = await readdir(outDir, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isFile() && /\.generated\./.test(e.name))
    .map((e) => relative(outDir, join(e.parentPath, e.name)).split('\\').join('/'))
    .sort();
}

export async function checkDrift(options: DriftOptions): Promise<GateResult> {
  const show = (path: string) => displayPath(options.cwd, path, relative);
  const problems: string[] = [];
  const temp = await mkdtemp(join(tmpdir(), 'urn-forge-drift-'));
  try {
    await writeGeneratedFiles(temp, options.files);
    for (const file of options.files) {
      const fresh = await readFile(generatedPath(temp, file.relativePath));
      const committedPath = generatedPath(options.outDir, file.relativePath);
      const committed = await readFile(committedPath).catch(() => undefined);
      if (!committed) {
        problems.push(`${show(committedPath)}  missing; run \`urn-forge compile\``);
      } else if (!fresh.equals(committed)) {
        const line = firstDifferentLine(fresh.toString('utf8'), committed.toString('utf8'));
        problems.push(`${show(committedPath)}:${line}  differs from a fresh compile (hand-edited or stale); run \`urn-forge compile\``);
      }
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }

  const produced = new Set(options.files.map((f) => f.relativePath));
  for (const orphan of (await committedGeneratedFiles(options.outDir)).filter((p) => !produced.has(p))) {
    problems.push(`${show(generatedPath(options.outDir, orphan))}  generated file has no source in the current compile; delete it`);
  }

  return {
    gate: 4,
    name: 'drift',
    ok: problems.length === 0,
    summary: `${options.files.length} generated file(s) compared byte for byte against ${show(options.outDir)}`,
    problems,
  };
}
