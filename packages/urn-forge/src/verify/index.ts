/**
 * `urn-forge verify` (spec §8): compiles the manifest, builds the gate context once, then
 * runs each registered gate. Gates 2 (lint profile) and 5 (compatibility) are not built yet.
 */
import { readFile } from 'node:fs/promises';
import { hasErrors, type Diagnostic } from '../diagnostics.js';
import { compile, type PluginEntry } from '../engine.js';
import { completenessGate } from './completeness.js';
import { driftGate } from './drift.js';
import { indexFeatures } from './feature-index.js';
import { gherkinGate } from './gherkin.js';
import type { Gate, GateResult } from './types.js';

/** The gates `verify` runs, in order. */
export const GATES: readonly Gate[] = [completenessGate, gherkinGate, driftGate];

export interface VerifyOptions {
  readonly cwd: string;
  readonly manifestPath: string;
  readonly outDir: string;
  readonly corePath: string;
  readonly featuresDir: string;
  readonly tsconfigPath: string;
  /** The plugins `compile` runs (gate 4 compares against their output). Default: every plugin. */
  readonly plugins?: readonly PluginEntry[];
  /** Gate 3's coverage mode. Default: `warn`. */
  readonly boundaryCoverage?: 'warn' | 'error';
  /** The gates to run. Default: `GATES`. */
  readonly gates?: readonly Gate[];
}

export interface VerifyResult {
  /** No manifest error and no gate with an error. Warnings do not fail it. */
  readonly ok: boolean;
  /** Manifest problems; when any is an error, no gate runs. */
  readonly diagnostics: readonly Diagnostic[];
  readonly gates: readonly GateResult[];
}

export async function verify(options: VerifyOptions): Promise<VerifyResult> {
  let source: string;
  try {
    source = await readFile(options.manifestPath, 'utf8');
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        { code: 'manifest-unreadable', severity: 'error', message: `cannot read manifest: ${(error as Error).message}` },
      ],
      gates: [],
    };
  }

  const compiled = compile(source, options.plugins);
  if (!compiled.ir || hasErrors(compiled.diagnostics)) {
    return { ok: false, diagnostics: compiled.diagnostics, gates: [] };
  }

  const context = {
    cwd: options.cwd,
    ir: compiled.ir,
    files: compiled.files,
    outDir: options.outDir,
    corePath: options.corePath,
    tsconfigPath: options.tsconfigPath,
    featuresDir: options.featuresDir,
    features: await indexFeatures(options.featuresDir, options.cwd),
    boundaryCoverage: options.boundaryCoverage ?? 'warn',
  };
  const gates: GateResult[] = [];
  for (const gate of options.gates ?? GATES) {
    const outcome = await gate.run(context);
    gates.push({ gate: gate.number, name: gate.name, ok: !hasErrors(outcome.problems), ...outcome });
  }
  return { ok: gates.every((g) => g.ok), diagnostics: compiled.diagnostics, gates };
}
