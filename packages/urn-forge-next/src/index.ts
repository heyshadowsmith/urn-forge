/**
 * urn-forge-next: the redesigned manifest of definitions, rules and operations. It is built next to
 * urn-forge and takes its place at the switch.
 */
import { Diagnostics } from './diagnostics.js';
import { readManifest } from './manifest.js';
import { buildModel, type Model } from './model.js';

export type { Diagnostic, Path } from './diagnostics.js';
export type { BaseType, RuleUse } from './manifest.js';
export type { Definition, Model } from './model.js';

/** Reads a manifest: the model when it has no error, and every diagnostic. */
export function loadManifest(text: string): { readonly model: Model | undefined; readonly diagnostics: readonly import('./diagnostics.js').Diagnostic[] } {
  const diagnostics = new Diagnostics();
  const decl = readManifest(text, diagnostics);
  const model = decl ? buildModel(decl, diagnostics) : undefined;
  return { model: diagnostics.hasErrors ? undefined : model, diagnostics: diagnostics.list };
}
