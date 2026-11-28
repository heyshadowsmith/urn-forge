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

export { GATES, gatePasses, uncoveredRules } from './gate-rules.js';

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
