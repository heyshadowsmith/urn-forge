/**
 * urn-forge-next: the redesigned manifest of definitions, rules and operations. It is built next to
 * urn-forge and takes its place at the switch.
 */

/** A problem in a manifest: a code, its place as a path of keys, and a message. */
export interface Diagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/** Reads a manifest: the model when it has no error, and every diagnostic. */
export function loadManifest(_text: string): { readonly model: unknown; readonly diagnostics: readonly Diagnostic[] } {
  throw new Error('loadManifest is not built yet');
}
