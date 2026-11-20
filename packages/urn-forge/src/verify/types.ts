/** Shared shapes for `urn-forge verify` gates (spec §8). */
import type { Diagnostic } from '../diagnostics.js';

export interface GateResult {
  readonly gate: 1 | 3 | 4;
  readonly name: string;
  readonly ok: boolean;
  /** One line describing what was checked, printed whether or not the gate passed. */
  readonly summary: string;
  /** Every problem the gate found, each with its `file` set. */
  readonly problems: readonly Diagnostic[];
}

/** Paths are printed relative to this directory with forward slashes. */
export function displayPath(cwd: string, path: string, relative: (from: string, to: string) => string): string {
  return relative(cwd, path).split('\\').join('/') || '.';
}
