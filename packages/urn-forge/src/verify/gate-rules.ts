/**
 * The pure rules of the gates: their names, when a gate passes, and which rules gate 3 reports. No
 * import, so that urn-forge's own harness (self/) reads them without loading a gate.
 */

/** The gates, in order: gate 1 is completeness. */
export const GATES = ['completeness', 'boundary', 'gherkin', 'drift', 'contract'] as const;

/** A gate passes when no problem of it is an error. A warning does not fail it, and a failing gate names its problem. */
export function gatePasses(problems: readonly { readonly severity: 'error' | 'warning' }[]): boolean {
  return !problems.some((p) => p.severity === 'error');
}

/**
 * The rules that gate 3 reports as uncovered-rule: each rule of a definition that no scenario breaks,
 * once, in the order of the manifest. A rule is its definition and its name with a space: `party_size minimum`.
 */
export function uncoveredRules(applied: readonly string[], broken: readonly string[]): string[] {
  return [...new Set(applied)].filter((rule) => !broken.includes(rule));
}

