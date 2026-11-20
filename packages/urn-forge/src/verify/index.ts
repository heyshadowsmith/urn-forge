/**
 * `urn-forge verify` (spec §8), MVP gates: 1 completeness, 3 Gherkin tags + headers, 4 drift.
 * Gates 2 (lint profile) and 5 (compatibility) are cut from the MVP.
 */
import { readFile } from 'node:fs/promises';
import { hasErrors, type Diagnostic } from '../diagnostics.js';
import { compile } from '../engine.js';
import { checkCompleteness } from './completeness.js';
import { checkDrift } from './drift.js';
import { checkGherkin } from './gherkin.js';
import type { GateResult } from './types.js';

export interface VerifyOptions {
  readonly cwd: string;
  readonly manifestPath: string;
  readonly outDir: string;
  readonly corePath: string;
  readonly featuresDir: string;
  readonly tsconfigPath: string;
}

export interface VerifyResult {
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

  const compiled = compile(source);
  if (!compiled.ir || hasErrors(compiled.diagnostics)) {
    return { ok: false, diagnostics: compiled.diagnostics, gates: [] };
  }

  const gates: GateResult[] = [
    checkCompleteness(options),
    await checkGherkin({ cwd: options.cwd, featuresDir: options.featuresDir, ir: compiled.ir }),
    await checkDrift({ cwd: options.cwd, outDir: options.outDir, files: compiled.files }),
  ];
  return { ok: gates.every((g) => g.ok), diagnostics: compiled.diagnostics, gates };
}
