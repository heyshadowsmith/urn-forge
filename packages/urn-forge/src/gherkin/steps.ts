/**
 * Generic, domain-independent Cucumber steps (mvp-plan.md, build step 8).
 *
 *   When I run the operation with:          one header row of input field names + one data row
 *   Then the output is:                     one header row of output field names + one data row
 *   Then the input is rejected on "<field>"
 *
 * The operation is the feature's (or scenario's) `@urn:…:operation:…` tag. Table cells are
 * coerced by the field's primitive (from the generated `DispatchMap`, read through the
 * primitive registry in src/primitives/) before the generated
 * `executeOperation` parses them, so `10` reaches a `float` field as a number and `abc`
 * stays a string for the schema to reject. An empty cell means the key is absent.
 *
 * The project wires in its own generated runtime and core from a support file:
 *
 *   registerOperationSteps({
 *     dispatch: DispatchMap,
 *     execute: (urn, payload) => executeOperation(urn, payload, core),
 *   });
 */
import { Before, Then, When, type DataTable } from '@cucumber/cucumber';
import { parseCell, type Primitive } from '../primitives/index.js';
import { STEP_PHRASES } from './phrases.js';

// Structural views of the generated runtime, so this library does not depend on any one domain.

export type { Primitive };

export interface FieldInfoLike {
  readonly urn: string;
  readonly primitive: Primitive;
  readonly required: boolean;
}

export type FieldsLike = Readonly<Record<string, FieldInfoLike>>;

export interface OperationContractLike {
  readonly input: { readonly fields: FieldsLike };
  readonly output: { readonly fields: FieldsLike };
}

export interface BoundaryIssueLike {
  readonly path: string;
  readonly fieldUrn?: string;
  readonly message: string;
}

export interface DomainErrorLike {
  readonly urn: string;
  readonly message: string;
  readonly fields: unknown;
}

export type ExecuteResultLike =
  | { readonly ok: true; readonly output: unknown }
  | { readonly ok: false; readonly kind: 'DomainError'; readonly error: DomainErrorLike }
  | { readonly ok: false; readonly kind: string; readonly issues: readonly BoundaryIssueLike[] };

export interface OperationStepsOptions {
  readonly dispatch: Readonly<Record<string, OperationContractLike>>;
  readonly execute: (urn: string, payload: unknown) => ExecuteResultLike;
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without Cucumber)
// ---------------------------------------------------------------------------

const OPERATION_TAG = /^@(urn:[a-z][a-z0-9_]*:[a-z][a-z0-9_]*:[a-z][a-z0-9_]*:operation:[a-z][a-z0-9_]*)$/;

/** The one operation URN among a scenario's tags (feature tags included). */
export function operationUrnFromTags(tags: readonly string[]): string {
  const urns = [...new Set(tags.flatMap((tag) => OPERATION_TAG.exec(tag)?.[1] ?? []))];
  if (urns.length === 1) return urns[0]!;
  throw new Error(
    urns.length === 0
      ? 'no @urn:<namespace>:<domain>:<context>:operation:<identifier> tag on this scenario or its feature'
      : `more than one operation tag on this scenario: ${urns.join(', ')}`,
  );
}

/**
 * Converts a table cell to the JS value the field's schema expects, using the field's
 * primitive descriptor; `undefined` means absent.
 */
export function coerceCell(cell: string, field: FieldInfoLike): unknown {
  if (cell === '') return undefined;
  return parseCell(field.primitive, cell);
}

/** Reads a two-row table (headers + one data row) into an object, coercing each cell by its field. */
export function tableToObject(
  rows: readonly (readonly string[])[],
  fields: FieldsLike,
  side: 'input' | 'output',
  urn: string,
): Record<string, unknown> {
  if (rows.length !== 2) {
    throw new Error(`expected a header row and exactly one data row, got ${rows.length} row(s)`);
  }
  const [headers, values] = rows as [readonly string[], readonly string[]];
  const object: Record<string, unknown> = {};
  headers.forEach((header, i) => {
    const field = Object.hasOwn(fields, header) ? fields[header] : undefined;
    if (!field) {
      throw new Error(
        `"${header}" is not a field of the ${side} of ${urn} (fields: ${Object.keys(fields).join(', ')})`,
      );
    }
    const value = coerceCell(values[i] ?? '', field);
    if (value !== undefined) object[header] = value;
  });
  return object;
}

function sameValue(actual: unknown, expected: unknown): boolean {
  return actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
}

function describeFailure(result: Extract<ExecuteResultLike, { ok: false }>): string {
  if ('error' in result) return `DomainError ${result.error.urn} (${result.error.message})`;
  const issues = result.issues.map((i) => `${i.path || '(payload)'}: ${i.message}`).join('; ');
  return `${result.kind}${issues ? ` (${issues})` : ''}`;
}

/** Checks every expected column against the output; columns not in the table are not checked. */
export function assertOutput(result: ExecuteResultLike, expected: Record<string, unknown>, urn: string): void {
  if (!result.ok) throw new Error(`${urn} did not succeed: ${describeFailure(result)}`);
  const output = (result.output ?? {}) as Record<string, unknown>;
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => !sameValue(output[key], value))
    .map(([key, value]) => `${key}: expected ${String(value)}, got ${String(output[key])}`);
  if (mismatches.length > 0) throw new Error(`${urn} output differs: ${mismatches.join('; ')}`);
}

/** Checks the input was rejected at the boundary with an issue on the named field. */
export function assertRejectedOn(result: ExecuteResultLike, fieldName: string, fields: FieldsLike, urn: string): void {
  const field = Object.hasOwn(fields, fieldName) ? fields[fieldName] : undefined;
  if (!field) {
    throw new Error(`"${fieldName}" is not a field of the input of ${urn} (fields: ${Object.keys(fields).join(', ')})`);
  }
  if (result.ok) throw new Error(`${urn} accepted the input; expected it to be rejected on "${fieldName}"`);
  if (result.kind !== 'InputRejected') {
    throw new Error(`${urn} failed with ${describeFailure(result)}; expected InputRejected on "${fieldName}"`);
  }
  if (!result.issues.some((issue) => issue.fieldUrn === field.urn)) {
    throw new Error(`${urn} rejected the input, but not on "${fieldName}": ${describeFailure(result)}`);
  }
}

// ---------------------------------------------------------------------------
// Cucumber registration
// ---------------------------------------------------------------------------

interface ScenarioState {
  tags: readonly string[];
  urn?: string;
  result?: ExecuteResultLike;
}

interface StepsWorld {
  urnForge?: ScenarioState;
}

function state(world: StepsWorld): ScenarioState {
  if (!world.urnForge) throw new Error('urn-forge steps: scenario state missing (Before hook did not run)');
  return world.urnForge;
}

export function registerOperationSteps(options: OperationStepsOptions): void {
  const contract = (urn: string): OperationContractLike => {
    const found = Object.hasOwn(options.dispatch, urn) ? options.dispatch[urn] : undefined;
    if (!found) throw new Error(`${urn} is not an operation of this domain`);
    return found;
  };
  const lastRun = (world: StepsWorld): { urn: string; result: ExecuteResultLike } => {
    const s = state(world);
    if (s.urn === undefined || s.result === undefined) {
      throw new Error('no operation has run yet; start with "When I run the operation with:"');
    }
    return { urn: s.urn, result: s.result };
  };

  Before(function (this: StepsWorld, { pickle }) {
    this.urnForge = { tags: pickle.tags.map((tag) => tag.name) };
  });

  When(STEP_PHRASES.run, function (this: StepsWorld, table: DataTable) {
    const s = state(this);
    const urn = operationUrnFromTags(s.tags);
    const payload = tableToObject(table.raw(), contract(urn).input.fields, 'input', urn);
    s.urn = urn;
    s.result = options.execute(urn, payload);
  });

  Then(STEP_PHRASES.output, function (this: StepsWorld, table: DataTable) {
    const { urn, result } = lastRun(this);
    assertOutput(result, tableToObject(table.raw(), contract(urn).output.fields, 'output', urn), urn);
  });

  Then(STEP_PHRASES.rejected, function (this: StepsWorld, fieldName: string) {
    const { urn, result } = lastRun(this);
    assertRejectedOn(result, fieldName, contract(urn).input.fields, urn);
  });
}
