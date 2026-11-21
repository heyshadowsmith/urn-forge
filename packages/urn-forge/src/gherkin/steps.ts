/**
 * Generic, domain-independent Cucumber steps (mvp-plan.md, build step 8).
 *
 *   When I run the operation with:          one header row of input field names + one data row
 *   Then the output is:                     one header row of output field names + one data row
 *   Then the input is rejected on "<field>"
 *   Then the operation fails with "<error URN>"
 *   Then the operation fails with "<error URN>":   one header row of error field names + one data row
 *
 * The operation is the feature's (or scenario's) `@urn:…:operation:…` tag. Table cells are
 * coerced by the field's primitive (from the generated `DispatchMap`, read through the
 * primitive registry in src/primitives/) before the generated
 * `executeOperation` parses them, so `10` reaches a `float` field as a number and `abc`
 * stays a string for the schema to reject. An empty cell means the key is absent: in an
 * input table it is not sent, and in an output or error table the key must be absent from
 * the result. `""` is the empty string.
 *
 * The project wires in its own generated runtime and core from a support file:
 *
 *   registerOperationSteps({
 *     dispatch: DispatchMap,
 *     execute: (urn, payload) => executeOperation(urn, payload, core),
 *   });
 */
import { Before, Then, When, type DataTable } from '@cucumber/cucumber';
import { parseCell, parseListCell, type Primitive } from '../primitives/index.js';
import { STEP_PHRASES } from './phrases.js';

// Structural views of the generated runtime, so this library does not depend on any one domain.

export type { Primitive };

export interface FieldInfoLike {
  readonly urn: string;
  readonly primitive: Primitive;
  readonly required: boolean;
  /** A list: the cell is `[a, b, c]`. */
  readonly many?: boolean;
}

export type FieldsLike = Readonly<Record<string, FieldInfoLike>>;

export interface OperationContractLike {
  readonly input: { readonly fields: FieldsLike; readonly invariants?: readonly { readonly urn: string }[] };
  readonly output: { readonly fields: FieldsLike };
  /** The operation's declared errors, keyed by error URN. */
  readonly errors: Readonly<Record<string, { readonly fields: FieldsLike }>>;
}

export interface BoundaryIssueLike {
  readonly path: string;
  readonly fieldUrn?: string;
  readonly invariantUrn?: string;
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
  return field.many ? parseListCell(field.primitive, cell) : parseCell(field.primitive, cell);
}

/**
 * Reads a two-row table (headers + one data row) into an object, coercing each cell by its
 * field. `urn` is the operation for `input` and `output`, and the error for `error`.
 *
 * An empty input cell leaves the key out, so the payload does not send it. An empty output
 * or error cell keeps the key with the value `undefined`, so the assertion makes sure that
 * the key is absent. It never skips the column.
 */
export function tableToObject(
  rows: readonly (readonly string[])[],
  fields: FieldsLike,
  side: 'input' | 'output' | 'error',
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
        `"${header}" is not a field of ${side === 'error' ? urn : `the ${side} of ${urn}`} (fields: ${Object.keys(fields).join(', ')})`,
      );
    }
    const value = coerceCell(values[i] ?? '', field);
    if (value !== undefined || side !== 'input') object[header] = value;
  });
  return object;
}

function sameValue(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.length === expected.length && actual.every((item, i) => sameValue(item, expected[i]));
  }
  return actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
}

function show(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(show).join(', ')}]`;
  return value === undefined ? 'absent' : String(value);
}

/** One `key: expected …, got …` entry for each expected key whose value differs; `undefined` expects the key to be absent. */
function differences(actual: Record<string, unknown>, expected: Record<string, unknown>): string[] {
  return Object.entries(expected)
    .filter(([key, value]) => !sameValue(actual[key], value))
    .map(([key, value]) => `${key}: expected ${show(value)}, got ${show(actual[key])}`);
}

function describeFailure(result: Extract<ExecuteResultLike, { ok: false }>): string {
  if ('error' in result) return `DomainError ${result.error.urn} (${result.error.message})`;
  const issues = result.issues.map((i) => `${i.path || '(payload)'}: ${i.message}`).join('; ');
  return `${result.kind}${issues ? ` (${issues})` : ''}`;
}

/**
 * Checks every expected column against the output; an `undefined` expected value means the
 * key must be absent. Columns not in the table are not checked.
 */
export function assertOutput(result: ExecuteResultLike, expected: Record<string, unknown>, urn: string): void {
  if (!result.ok) throw new Error(`${urn} did not succeed: ${describeFailure(result)}`);
  const mismatches = differences((result.output ?? {}) as Record<string, unknown>, expected);
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

/** Checks the input was rejected at the boundary because the invariant `invariantUrn` does not hold. */
export function assertRejectedBy(result: ExecuteResultLike, invariantUrn: string, urn: string): void {
  if (result.ok) throw new Error(`${urn} accepted the input; expected it to be rejected by ${invariantUrn}`);
  if (result.kind !== 'InputRejected') {
    throw new Error(`${urn} failed with ${describeFailure(result)}; expected InputRejected by ${invariantUrn}`);
  }
  if (!result.issues.some((issue) => issue.invariantUrn === invariantUrn)) {
    throw new Error(`${urn} rejected the input, but not by ${invariantUrn}: ${describeFailure(result)}`);
  }
}

/**
 * Checks the operation refused with the declared error `errorUrn`, and, when `expected` is
 * given, that the error's fields equal it (`undefined` means absent). Columns not in the
 * table are not checked.
 */
export function assertFailsWith(
  result: ExecuteResultLike,
  errorUrn: string,
  urn: string,
  expected?: Record<string, unknown>,
): void {
  if (result.ok) throw new Error(`${urn} succeeded; expected it to fail with ${errorUrn}`);
  if (!('error' in result)) {
    throw new Error(`${urn} failed with ${describeFailure(result)}; expected the declared error ${errorUrn}`);
  }
  if (result.error.urn !== errorUrn) {
    throw new Error(`${urn} failed with ${result.error.urn} (${result.error.message}); expected ${errorUrn}`);
  }
  if (!expected) return;
  const mismatches = differences((result.error.fields ?? {}) as Record<string, unknown>, expected);
  if (mismatches.length > 0) throw new Error(`${errorUrn} fields differ: ${mismatches.join('; ')}`);
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
  const declaredError = (urn: string, errorUrn: string): { readonly fields: FieldsLike } => {
    const { errors } = contract(urn);
    const found = Object.hasOwn(errors, errorUrn) ? errors[errorUrn] : undefined;
    if (!found) {
      const declared = Object.keys(errors);
      throw new Error(`${errorUrn} is not a declared error of ${urn} (errors: ${declared.length > 0 ? declared.join(', ') : 'none'})`);
    }
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

  Then(STEP_PHRASES.rejectedBy, function (this: StepsWorld, invariantUrn: string) {
    const { urn, result } = lastRun(this);
    const invariants = (contract(urn).input.invariants ?? []).map((i) => i.urn);
    if (!invariants.includes(invariantUrn)) {
      throw new Error(`${invariantUrn} is not an invariant of the input of ${urn} (invariants: ${invariants.length > 0 ? invariants.join(', ') : 'none'})`);
    }
    assertRejectedBy(result, invariantUrn, urn);
  });

  Then(STEP_PHRASES.failsWith, function (this: StepsWorld, errorUrn: string) {
    const { urn, result } = lastRun(this);
    declaredError(urn, errorUrn);
    assertFailsWith(result, errorUrn, urn);
  });

  Then(STEP_PHRASES.failsWithFields, function (this: StepsWorld, errorUrn: string, table: DataTable) {
    const { urn, result } = lastRun(this);
    const expected = tableToObject(table.raw(), declaredError(urn, errorUrn).fields, 'error', errorUrn);
    assertFailsWith(result, errorUrn, urn, expected);
  });
}
