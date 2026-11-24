/**
 * The Gherkin steps of every domain. They read the definitions and the operations from the generated
 * file, so each step works for any manifest:
 *
 *   When I run "seat_booking" with:          a table: the input
 *   When I check a "booking" with:            a table: a value of a definition
 *   Then the output is "booking"              the answer of the core is that output
 *   Then the output is "booking":             … and has the values of the table
 *   Then the input is rejected by "minimum" of "party_size"
 *   Then the value is rejected by "minimum" of "party_size"
 *   Then the value is accepted
 *
 * In features/support/steps.ts:
 *
 *   import { registerSteps } from 'urn-forge/cucumber';
 *   import { core } from '../../src/core';
 *   import { check, Definitions, Operations, runOperation } from '../../src/generated/domain.generated';
 *   registerSteps({ Definitions, Operations, check, run: (operation, input) => runOperation(core, operation, input) });
 */
import { Before, Then, When, type DataTable } from '@cucumber/cucumber';
import type { Failure } from '../generate/runtime.js';
import { tableValue, type DefinitionsTable } from './cells.js';

/** The step texts, which gate 3 reads too. */
export const STEPS = {
  run: /^I run "([^"]+)" with:$/,
  check: /^I check an? "([^"]+)" with:$/,
  output: /^the output is "([^"]+)"$/,
  outputWith: /^the output is "([^"]+)":$/,
  inputRejected: /^the input is rejected by "([^"]+)" of "([^"]+)"$/,
  valueRejected: /^the value is rejected by "([^"]+)" of "([^"]+)"$/,
  accepted: /^the value is accepted$/,
} as const;

type Result =
  | { readonly ok: true; readonly output?: string; readonly value: unknown }
  | { readonly ok: false; readonly kind?: string; readonly failures: readonly Failure[] };

export interface StepOptions {
  readonly Definitions: DefinitionsTable;
  readonly Operations: Readonly<Record<string, { readonly input: string; readonly outputs: readonly string[] }>>;
  readonly check: (definition: never, value: unknown) => Result;
  readonly run: (operation: never, input: unknown) => Result;
}

function show(failures: readonly Failure[]): string {
  return failures.map((f) => `${f.rule} of ${f.definition}${f.path ? ` at ${f.path}` : ''}: ${f.message}`).join('; ');
}

/** Registers the steps for a domain. Call it once, in the support code. */
export function registerSteps(options: StepOptions): void {
  let last: { readonly step: 'run' | 'check'; readonly name: string; readonly result: Result } | undefined;
  Before(() => {
    last = undefined;
  });
  const need = (step: 'run' | 'check'): NonNullable<typeof last> => {
    if (!last || last.step !== step) throw new Error(step === 'run' ? 'run an operation first: When I run "<operation>" with:' : 'check a value first: When I check a "<definition>" with:');
    return last;
  };

  When(STEPS.run, (operation: string, table: DataTable) => {
    const contract = options.Operations[operation];
    if (!contract) throw new Error(`${operation} is not an operation; the operations are ${Object.keys(options.Operations).join(', ')}`);
    const input = tableValue(table.raw(), contract.input, options.Definitions);
    last = { step: 'run', name: operation, result: options.run(operation as never, input) };
  });

  When(STEPS.check, (definition: string, table: DataTable) => {
    if (!options.Definitions[definition]) throw new Error(`${definition} is not a definition`);
    const value = tableValue(table.raw(), definition, options.Definitions);
    last = { step: 'check', name: definition, result: options.check(definition as never, value) };
  });

  const output = (object: string, table: DataTable | undefined): void => {
    const { name, result } = need('run');
    if (!result.ok) throw new Error(`${name} did not answer: ${result.kind ?? 'refused'}: ${show(result.failures)}`);
    if (result.output !== object) throw new Error(`${name} answered ${result.output}, not ${object}`);
    if (!table) return;
    const expected = tableValue(table.raw(), object, options.Definitions);
    const actual = result.value as Record<string, unknown>;
    for (const [key, value] of Object.entries(expected)) {
      if (JSON.stringify(actual[key]) !== JSON.stringify(value)) {
        throw new Error(`${object}.${key} is ${JSON.stringify(actual[key])}, not ${JSON.stringify(value)}`);
      }
    }
  };
  // Two steps: Cucumber passes a callback as the last parameter of a step that has no table.
  Then(STEPS.output, (object: string) => output(object, undefined));
  Then(STEPS.outputWith, (object: string, table: DataTable) => output(object, table));

  const rejected = (step: 'run' | 'check', rule: string, definition: string): void => {
    const { name, result } = need(step);
    if (result.ok) throw new Error(`${name} accepted the ${step === 'run' ? 'input' : 'value'}; expected it to break ${rule} of ${definition}`);
    if (step === 'run' && result.kind !== 'InputRejected') throw new Error(`${name} gave ${result.kind}, not InputRejected: ${show(result.failures)}`);
    if (!result.failures.some((f) => f.rule === rule && f.definition === definition)) {
      throw new Error(`the ${step === 'run' ? 'input' : 'value'} does not break ${rule} of ${definition}; it breaks ${show(result.failures)}`);
    }
  };
  Then(STEPS.inputRejected, (rule: string, definition: string) => rejected('run', rule, definition));
  Then(STEPS.valueRejected, (rule: string, definition: string) => rejected('check', rule, definition));

  Then(STEPS.accepted, () => {
    const { name, result } = need('check');
    if (!result.ok) throw new Error(`${name} rejected the value: ${show(result.failures)}`);
  });
}
