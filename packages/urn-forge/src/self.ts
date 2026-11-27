/**
 * urn-forge's own decisions, through its own harness. Each operation of self/ (urn-forge's contract
 * of itself) runs with runOperation, so each real run of compile, verify and diff checks urn-forge's
 * answers against its contract, as urn-forge checks a user's core. The shell of urn-forge calls a
 * declared decision only here: tests/self.test.ts fails when it calls the function directly.
 */
import { core } from '../self/core.js';
import { check, runOperation, type DefinitionName, type OperationName } from '../self/generated/domain.generated.js';

/** urn-forge broke its own contract: a bug of urn-forge, not of the user's project. */
export class InternalContractError extends Error {
  readonly code = 'internal-contract';
}

/** The first rule of a definition of self/ that a value of urn-forge breaks, as the message of internal-contract; undefined when it keeps each rule. */
export function brokenBy(definition: DefinitionName, value: unknown): string | undefined {
  const result = check(definition, value);
  if (result.ok) return undefined;
  const failure = result.failures[0]!;
  return `urn-forge broke its own contract: ${failure.rule} of ${failure.definition}${failure.path ? ` at ${failure.path}` : ''}: ${failure.failure_message}; the value was ${JSON.stringify(value)}`;
}

type Input<N extends OperationName> = Parameters<(typeof core)[N]>[0];
type Answered<N extends OperationName> = ReturnType<(typeof core)[N]>;

/** Runs a decision of urn-forge through the harness of self/, and gives its answer. */
export function decide<N extends OperationName>(operation: N, input: Input<N>): Answered<N> {
  const result = runOperation(core, operation, input);
  if (result.ok) return { output: result.output, value: result.value } as unknown as Answered<N>;
  const failure = result.failures[0]!;
  throw new InternalContractError(
    `urn-forge broke its own contract: ${result.kind} of ${operation}, ${failure.rule} of ${failure.definition}${failure.path ? ` at ${failure.path}` : ''}: ${failure.failure_message}; the input was ${JSON.stringify(input)}`,
  );
}
