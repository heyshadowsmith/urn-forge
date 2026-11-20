/** Writes generated files to disk. Shared by `compile` and gate 4 (drift), so both write identical bytes. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { GeneratedArtifact } from './plugins/plugin.interface.js';

export interface WrittenFile {
  readonly path: string;
  readonly changed: boolean;
}

/** Absolute path of a generated file under `outDir` (relative paths are POSIX). */
export function generatedPath(outDir: string, relativePath: string): string {
  return join(outDir, ...relativePath.split('/'));
}

/** Writes each file as UTF-8 (no BOM), skipping files whose content is already identical. */
export async function writeGeneratedFiles(
  outDir: string,
  files: readonly GeneratedArtifact[],
): Promise<WrittenFile[]> {
  const written: WrittenFile[] = [];
  for (const file of files) {
    const path = generatedPath(outDir, file.relativePath);
    const current = await readFile(path, 'utf8').catch(() => undefined);
    if (current === file.content) {
      written.push({ path, changed: false });
      continue;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.content, 'utf8');
    written.push({ path, changed: true });
  }
  return written;
}
