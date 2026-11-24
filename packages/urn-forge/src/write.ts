/** Writes generated files, and removes the generated files that compile no longer makes. */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GeneratedFile } from './generate/code.js';

/** A file that urn-forge generates: `*.generated.ts` or `*.generated.sql`. */
export const isGenerated = (name: string): boolean => /\.generated\.(ts|sql)$/.test(name);

export async function listGenerated(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter(isGenerated).sort();
  } catch {
    return [];
  }
}

/** Writes each file whose content changed. Gives a line for each file: wrote, unchanged or removed. */
export async function writeGenerated(dir: string, files: readonly GeneratedFile[]): Promise<{ readonly status: 'wrote' | 'unchanged' | 'removed'; readonly path: string }[]> {
  await mkdir(dir, { recursive: true });
  const lines: { status: 'wrote' | 'unchanged' | 'removed'; path: string }[] = [];
  for (const file of files) {
    const path = join(dir, file.path);
    const current = await readFile(path, 'utf8').catch(() => undefined);
    if (current === file.content) lines.push({ status: 'unchanged', path });
    else {
      await writeFile(path, file.content);
      lines.push({ status: 'wrote', path });
    }
  }
  const made = new Set(files.map((f) => f.path));
  for (const name of await listGenerated(dir)) {
    if (made.has(name)) continue;
    await rm(join(dir, name));
    lines.push({ status: 'removed', path: join(dir, name) });
  }
  return lines;
}
