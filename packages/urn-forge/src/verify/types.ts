import type { Code } from '../codes.js';

/** A problem that a gate finds in a project: a file, an optional line, and a message. */
export interface GateProblem {
  readonly code: Code;
  readonly severity: 'error' | 'warning';
  readonly file: string;
  readonly line?: number;
  readonly message: string;
}

/** The outcome of a gate: whether it passes, a one-line summary, and its problems. */
export interface GateOutcome {
  readonly gate: number;
  readonly name: string;
  readonly pass: boolean;
  readonly summary: string;
  readonly problems: readonly GateProblem[];
}
