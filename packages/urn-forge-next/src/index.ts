/**
 * urn-forge-next: the redesigned manifest of definitions, rules and operations. It is built next to
 * urn-forge and takes its place at the switch.
 */
import { compileManifest } from './compile.js';
import type { Diagnostic } from './diagnostics.js';
import type { Model } from './model.js';

export type { Diagnostic, Path } from './diagnostics.js';
export type { BaseType, RuleUse } from './manifest.js';
export type { Definition, Model, Rule } from './model.js';
export { standard } from './rules.js';
export { parseRule, CelSyntaxError, type Expr } from './cel/parse.js';
export { print } from './cel/print.js';
export { checkRule, type CelType, type Scope, type PropertyType, type RuleProblem } from './cel/check.js';

export { compileManifest, generate, fingerprint, GENERATED_FILE, type Compiled } from './compile.js';
export type { Failure } from './generate/runtime.js';

/** Reads a manifest: the model when it has no error, and every diagnostic. */
export function loadManifest(text: string): { readonly model: Model | undefined; readonly diagnostics: readonly Diagnostic[] } {
  const { model, diagnostics } = compileManifest(text);
  return { model, diagnostics };
}
