import type { Code } from '../codes.js';
import { decide } from '../self.js';

/** A problem that a gate finds in a project: a file, an optional line, and a message. */
export interface GateProblem {
  readonly code: Code;
  readonly severity: 'error' | 'warning';
  readonly file: string;
  readonly line?: number;
  readonly message: string;
}

/** The gates, in order: gate 1 is completeness. */
export const GATES = ['completeness', 'boundary', 'gherkin', 'drift', 'contract'] as const;

/** A gate passes when no problem of it is an error. A warning does not fail it, and a failing gate names its problem. */
export function gatePasses(problems: readonly Pick<GateProblem, 'severity'>[]): boolean {
  return !problems.some((p) => p.severity === 'error');
}

/**
 * The rules that gate 3 reports as uncovered-rule: each rule of a definition that no scenario breaks,
 * once, in the order of the manifest. A rule is its definition and its name with a space: `party_size minimum`.
 */
export function uncoveredRules(applied: readonly string[], broken: readonly string[]): string[] {
  return [...new Set(applied)].filter((rule) => !broken.includes(rule));
}

/** The outcome of a gate, with its pass from its problems. */
export function gateOutcome(gate: 1 | 2 | 3 | 4 | 5, summary: string, problems: readonly GateProblem[]): GateOutcome {
  const verdict = decide('judge_gate', { gate_number: gate, gate_problems: problems.map((p) => ({ code: p.code, severity: p.severity })) });
  return { gate, name: verdict.value.gate_name, pass: verdict.output === 'gate_passed', summary, problems };
}

/** The outcome of a gate: whether it passes, a one-line summary, and its problems. */
export interface GateOutcome {
  readonly gate: number;
  readonly name: string;
  readonly pass: boolean;
  readonly summary: string;
  readonly problems: readonly GateProblem[];
}
