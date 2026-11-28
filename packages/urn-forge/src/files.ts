/**
 * The files under a path, for the gates: a file, or each file in a folder and its subfolders that a test
 * keeps. Symlinked folders are followed, each folder once, so that a cycle of links ends. A path that
 * does not exist gives no file: the caller reports it as missing-input.
 */
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function filesUnder(path: string, keep: (name: string) => boolean, seen: Set<string> = new Set()): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [resolve(path)];
  const real = realpathSync(path);
  if (seen.has(real)) return [];
  seen.add(real);
  return readdirSync(path).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const full = join(path, name);
    // A broken link has no target: skip it.
    if (!existsSync(full)) return [];
    return statSync(full).isDirectory() ? filesUnder(full, keep, seen) : keep(name) ? [resolve(full)] : [];
  });
}
