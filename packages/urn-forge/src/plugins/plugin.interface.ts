/**
 * Codegen plugin contract (spec §7).
 *
 * A plugin is a pure function of `(ir, config)`: no clock, no randomness, no
 * environment reads. It returns file contents; the engine (step 7) adds the
 * `@generated` + fingerprint header and writes the files.
 */
import type * as v from 'valibot';
import type { UniversalIR, Urn } from '../ir/types.js';

export interface GeneratedArtifact {
  /** POSIX path, relative to `--out`. */
  readonly relativePath: string;
  /** File body without the generated header; `\n` line endings, one trailing newline. */
  readonly content: string;
}

export interface PluginDiagnostic {
  readonly severity: 'error' | 'warning';
  readonly urn?: Urn;
  readonly message: string;
}

export interface PluginOutput {
  readonly artifacts: readonly GeneratedArtifact[];
  readonly diagnostics: readonly PluginDiagnostic[];
}

export interface CodegenPlugin<C = unknown> {
  readonly name: string;
  /** Feeds the fingerprint, so a generator change shows up as drift. */
  readonly version: string;
  readonly configSchema: v.GenericSchema<C>;
  emit(ir: UniversalIR, config: C): PluginOutput;
}

/** Renders a number as a TypeScript literal, keeping `-0` distinct from `0`. */
export function numberLiteral(value: number): string {
  if (!Number.isFinite(value)) throw new TypeError(`cannot render non-finite number ${value}`);
  return Object.is(value, -0) ? '-0' : String(value);
}

/** Records keyed by URN in the IR are already sorted; this keeps call sites explicit about it. */
export function valuesInUrnOrder<T>(record: Readonly<Record<Urn, T>>): T[] {
  return Object.values(record) as T[];
}
