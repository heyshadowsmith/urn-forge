/**
 * The gate framework for `urn-forge verify` (spec §8; foundations plan, phase 5).
 *
 * A gate is a number, a name and a `run` that returns a summary and its problems. A gate
 * passes when none of its problems is an error, so a gate can report warnings and still
 * pass: boundary coverage needs that for its warn-then-ratchet adoption.
 */
import type { Diagnostic } from '../diagnostics.js';
import type { GeneratedArtifact } from '../plugins/plugin.interface.js';
import type { UniversalIR } from '../ir/types.js';
import type { FeatureIndex } from './feature-index.js';

/** The five gates of spec §8. */
export type GateNumber = 1 | 2 | 3 | 4 | 5;

/** What every gate may read. Built once per `verify`. */
export interface GateContext {
  readonly cwd: string;
  readonly ir: UniversalIR;
  /** The fresh compile's files. */
  readonly files: readonly GeneratedArtifact[];
  readonly outDir: string;
  readonly corePath: string;
  readonly tsconfigPath: string;
  readonly featuresDir: string;
  readonly features: FeatureIndex;
  /** Gate 3's coverage mode: whether coverage gaps outside strict features are warnings or errors. */
  readonly boundaryCoverage: 'warn' | 'error';
}

export interface GateOutcome {
  /** One line describing what was checked, printed whether or not the gate passed. */
  readonly summary: string;
  /** Every problem the gate found, each with its `file` set. Warnings do not fail the gate. */
  readonly problems: readonly Diagnostic[];
}

export interface Gate {
  readonly number: GateNumber;
  readonly name: string;
  run(context: GateContext): GateOutcome | Promise<GateOutcome>;
}

export interface GateResult extends GateOutcome {
  readonly gate: GateNumber;
  readonly name: string;
  /** No problem is an error. */
  readonly ok: boolean;
}

/** Paths are printed relative to this directory with forward slashes. */
export function displayPath(cwd: string, path: string, relative: (from: string, to: string) => string): string {
  return relative(cwd, path).split('\\').join('/') || '.';
}
