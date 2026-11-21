/**
 * `urn-forge verify` (spec §8): compiles the manifest, builds the gate context once, then
 * runs each registered gate. Gates 2 (lint profile) and 5 (compatibility) are not built yet.
 */
import { readFile } from 'node:fs/promises';
import { hasErrors, relativePaths, type Diagnostic } from '../diagnostics.js';
import { compile, type PluginEntry } from '../engine.js';
import { hasSunsetDates, liveIr } from '../ir/lifecycle.js';
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
  /** The plugins `compile` runs (gate 4 compares against their output). Default: `DEFAULT_PLUGINS` (Valibot and FCIS). */
  readonly plugins?: readonly PluginEntry[];
  /** Gate 3's coverage mode. Default: `warn`. */
  readonly boundaryCoverage?: 'warn' | 'error';
  /** The gates to run. Default: `GATES`. */
  readonly gates?: readonly Gate[];
  /** The day that pass 8 compares sunset dates with (YYYY-MM-DD). */
  readonly referenceDate?: string;
}

export interface VerifyResult {
  /** No manifest error and no gate with an error. Warnings do not fail it. */
  readonly ok: boolean;
  /** Manifest problems; when any is an error, no gate runs. */
  readonly diagnostics: readonly Diagnostic[];
  readonly gates: readonly GateResult[];
  /** False when the manifest has a sunset date and no reference date was given, so pass 8 did not compare it. */
  readonly sunsetDatesChecked: boolean;
}

export async function verify(options: VerifyOptions): Promise<VerifyResult> {
  let source: string;
  try {
    source = await readFile(options.manifestPath, 'utf8');
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        { code: 'manifest-unreadable', severity: 'error', message: `cannot read manifest: ${relativePaths((error as Error).message, options.cwd)}` },
      ],
      gates: [],
      sunsetDatesChecked: true,
    };
  }

  const compiled = compile(source, options.plugins, options.referenceDate === undefined ? {} : { referenceDate: options.referenceDate });
  const sunsetDatesChecked = options.referenceDate !== undefined || !compiled.ir || !hasSunsetDates(compiled.ir);
  if (!compiled.ir || hasErrors(compiled.diagnostics)) {
    return { ok: false, diagnostics: compiled.diagnostics, gates: [], sunsetDatesChecked };
  }

  const context = {
    cwd: options.cwd,
    // The gates check the live IR: a sunset atom needs no handler and no scenario.
    ir: liveIr(compiled.ir),
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
  return { ok: gates.every((g) => g.ok), diagnostics: compiled.diagnostics, gates, sunsetDatesChecked };
}
