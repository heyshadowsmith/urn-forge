/**
 * `urn-forge diff <old> <new>` (spec §3, gate 5; lifecycle plan, step 4): compiles both
 * manifests and classifies each change. A breaking change to a live URN is the diagnostic
 * `breaking-change`: an error, or a warning while the old manifest is experimental.
 */
import type { Diagnostic } from '../diagnostics.js';
import { buildIrFromSource } from '../ir/build.js';
import type { UniversalIR, Urn } from '../ir/types.js';
import { toUrn } from '../naming.js';
import { classify, type Change } from './classify.js';

export type { Change, ChangeClass } from './classify.js';
export { classify, usesOf } from './classify.js';

export interface DiffOptions {
  /** The short keys of the Postgres plugin's tables (its `tables` config): their values are stored. */
  readonly tables?: readonly string[];
}

export type DiffResult =
  | { readonly ok: true; readonly changes: readonly Change[]; readonly breaking: readonly Diagnostic[]; readonly experimental: boolean }
  | { readonly ok: false; readonly which: 'old' | 'new'; readonly diagnostics: readonly Diagnostic[] };

/** The IR of one manifest, or its diagnostics. Pass 8 runs without a date: a sunset date is not a change. */
function irOf(source: string): { ir: UniversalIR } | { diagnostics: Diagnostic[] } {
  const built = buildIrFromSource(source);
  if (built.success) return { ir: built.ir };
  return {
    diagnostics: built.issues.map(({ code, urn, message, location }) => ({
      code,
      severity: 'error' as const,
      message,
      ...(urn === undefined ? {} : { urn }),
      ...(location === undefined ? {} : { location }),
    })),
  };
}

export function diffManifests(oldSource: string, newSource: string, options: DiffOptions = {}): DiffResult {
  const old = irOf(oldSource);
  if ('diagnostics' in old) return { ok: false, which: 'old', diagnostics: old.diagnostics };
  const now = irOf(newSource);
  if ('diagnostics' in now) return { ok: false, which: 'new', diagnostics: now.diagnostics };

  const tables = (options.tables ?? []).map((key) => {
    const [context = '', kind = '', identifier = ''] = key.split('.');
    return toUrn({ namespace: old.ir.meta.namespace, domain: old.ir.meta.domain, context, kind, identifier }) as Urn;
  });
  const changes = classify(old.ir, now.ir, { tables });
  // While the old manifest is experimental, a breaking change is a warning (spec §3).
  const experimental = old.ir.meta.stability === 'experimental';
  const breaking = changes
    .filter((c) => c.class === 'breaking')
    .map((c): Diagnostic => ({ code: 'breaking-change', severity: experimental ? 'warning' : 'error', urn: c.urn, message: `${c.urn}: ${c.message}` }));
  return { ok: true, changes, breaking, experimental };
}
