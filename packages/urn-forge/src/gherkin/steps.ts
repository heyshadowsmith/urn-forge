/**
 * Generic, domain-independent Cucumber steps (mvp-plan.md, build step 8).
 *
 *   When I run the operation with:          one header row of input field names + one data row
 *   Then the output is:                     one header row of output field names + one data row
 *   Then the input is rejected on "<field>"
 *   Then the operation fails with "<error URN>"
 *   Then the operation fails with "<error URN>":   one header row of error field names + one data row
 *   Then the operation emits "<event URN>"
 *   Then the operation emits "<event URN>":        one header row of event field names + one data row
 *   Then the operation emits no event
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
import { type Primitive } from '../primitives/index.js';
import { readCell } from './cells.js';
import { STEP_PHRASES } from './phrases.js';

// Structural views of the generated runtime, so this library does not depend on any one domain.

export type { Primitive };

export interface FieldInfoLike {
  readonly urn: string;
  readonly primitive: Primitive;
  readonly required: boolean;
  /** A list: the cell is `[a, b, c]`. */
  readonly many?: boolean;
  /** A link: the entity whose key the value is. */
  readonly link?: string;
}

/** A property that holds an embedded entity: the cell is `{ name: value, … }`. */
export interface EmbeddedInfoLike {
  readonly entity: string;
  readonly required: boolean;
  readonly many?: boolean;
  readonly fields: Readonly<Record<string, PropertyInfoLike>>;
}

export type PropertyInfoLike = FieldInfoLike | EmbeddedInfoLike;

export type FieldsLike = Readonly<Record<string, PropertyInfoLike>>;

export interface OperationContractLike {
  readonly input: { readonly fields: FieldsLike; readonly invariants?: readonly { readonly urn: string }[] };
  readonly output: { readonly fields: FieldsLike };
  /** The operation's declared errors, keyed by error URN, each with the event it records as, if any. */
  readonly errors: Readonly<Record<string, { readonly fields: FieldsLike; readonly recordAs?: { readonly urn: string; readonly fields: FieldsLike } }>>;
  /** The operation's events, keyed by event URN. */
  readonly events?: Readonly<Record<string, { readonly fields: FieldsLike }>>;
}

export interface EmittedEventLike {
  readonly urn: string;
  readonly fields: unknown;
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
  /** The event that records the refusal, when the error has recordAs. */
  readonly record?: EmittedEventLike;
}

export type ExecuteResultLike =
  | { readonly ok: true; readonly output: unknown; readonly events?: readonly EmittedEventLike[] }
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
export function coerceCell(cell: string, field: PropertyInfoLike): unknown {
  if (cell === '') return undefined;
  return readCell(cell, field);
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
  side: 'input' | 'output' | 'error' | 'event',
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
        `"${header}" is not a field of ${side === 'error' || side === 'event' ? urn : `the ${side} of ${urn}`} (fields: ${Object.keys(fields).join(', ')})`,
      );
    }
    const value = coerceCell(values[i] ?? '', field);
    if (value !== undefined || side !== 'input') object[header] = value;
  });
  return object;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function sameValue(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.length === expected.length && actual.every((item, i) => sameValue(item, expected[i]));
  }
  if (isObject(actual) && isObject(expected)) {
    // An embedded object: the properties the table gives, and no other property.
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    return [...keys].every((key) => sameValue(actual[key], expected[key]));
  }
  return actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
}

function show(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(show).join(', ')}]`;
  if (isObject(value)) return `{ ${Object.entries(value).map(([k, v]) => `${k}: ${show(v)}`).join(', ')} }`;
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
  // The property is the head of the issue's path, also when the issue is inside it (`coverages.1.limit`).
  if (!result.issues.some((issue) => issue.path.split('.')[0] === fieldName)) {
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

/**
 * Checks the operation succeeded and returned the event `eventUrn`; when `expected` is given,
 * one event of that URN must have those fields (`undefined` means absent). Columns not in the
 * table are not checked, and neither are the count and the order of the events.
 */
export function assertEmits(result: ExecuteResultLike, eventUrn: string, urn: string, expected?: Record<string, unknown>): void {
  if (!result.ok) throw new Error(`${urn} did not succeed: ${describeFailure(result)}; expected it to emit ${eventUrn}`);
  const events = result.events ?? [];
  const named = events.filter((event) => event.urn === eventUrn);
  if (named.length === 0) {
    throw new Error(`${urn} did not emit ${eventUrn} (emitted: ${events.length > 0 ? events.map((e) => e.urn).join(', ') : 'nothing'})`);
  }
  if (!expected) return;
  const mismatches = named.map((event) => differences((event.fields ?? {}) as Record<string, unknown>, expected));
  if (mismatches.every((m) => m.length > 0)) {
    throw new Error(`${eventUrn} fields differ: ${mismatches.map((m) => m.join('; ')).join(' | ')}`);
  }
}

/**
 * Checks the operation refused with a declared error whose record is the event `eventUrn`; when
 * `expected` is given, the record's fields must equal it (`undefined` means absent). Columns not
 * in the table are not checked.
 */
export function assertRecordedAs(result: ExecuteResultLike, eventUrn: string, urn: string, expected?: Record<string, unknown>): void {
  if (result.ok) throw new Error(`${urn} succeeded; expected a refusal recorded as ${eventUrn}`);
  if (!('error' in result)) throw new Error(`${urn} failed with ${describeFailure(result)}; expected a declared error recorded as ${eventUrn}`);
  const record = result.error.record;
  if (record?.urn !== eventUrn) {
    throw new Error(`${urn} failed with ${result.error.urn}, which ${record ? `is recorded as ${record.urn}` : 'has no record'}; expected it to be recorded as ${eventUrn}`);
  }
  if (!expected) return;
  const mismatches = differences((record.fields ?? {}) as Record<string, unknown>, expected);
  if (mismatches.length > 0) throw new Error(`${eventUrn} fields differ: ${mismatches.join('; ')}`);
}

/**
 * Checks the operation returned no event: it succeeded with none, or refused with a declared
 * error, which never has events (spec §4.5). Any other failure is not "no event".
 */
export function assertEmitsNone(result: ExecuteResultLike, urn: string): void {
  if (!result.ok && 'error' in result) return;
  if (!result.ok) throw new Error(`${urn} failed with ${describeFailure(result)}; expected it to emit no event`);
  const events = result.events ?? [];
  if (events.length > 0) throw new Error(`${urn} emitted ${events.map((e) => e.urn).join(', ')}; expected no event`);
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
  const declaredEvent = (urn: string, eventUrn: string): { readonly fields: FieldsLike } => {
    const events = contract(urn).events ?? {};
    const found = Object.hasOwn(events, eventUrn) ? events[eventUrn] : undefined;
    if (!found) {
      const declared = Object.keys(events);
      throw new Error(`${eventUrn} is not an event of ${urn} (emits: ${declared.length > 0 ? declared.join(', ') : 'none'})`);
    }
    return found;
  };
  /** The fields of the event that a declared error of the operation records as. */
  const recordedEvent = (urn: string, eventUrn: string): { readonly fields: FieldsLike } => {
    const records = Object.values(contract(urn).errors).flatMap((error) => (error.recordAs ? [error.recordAs] : []));
    const found = records.find((record) => record.urn === eventUrn);
    if (!found) {
      throw new Error(`${eventUrn} records no declared error of ${urn} (records: ${records.length > 0 ? [...new Set(records.map((r) => r.urn))].join(', ') : 'none'})`);
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

  Then(STEP_PHRASES.emits, function (this: StepsWorld, eventUrn: string) {
    const { urn, result } = lastRun(this);
    declaredEvent(urn, eventUrn);
    assertEmits(result, eventUrn, urn);
  });

  Then(STEP_PHRASES.emitsWithFields, function (this: StepsWorld, eventUrn: string, table: DataTable) {
    const { urn, result } = lastRun(this);
    const expected = tableToObject(table.raw(), declaredEvent(urn, eventUrn).fields, 'event', eventUrn);
    assertEmits(result, eventUrn, urn, expected);
  });

  Then(STEP_PHRASES.recordedAs, function (this: StepsWorld, eventUrn: string) {
    const { urn, result } = lastRun(this);
    recordedEvent(urn, eventUrn);
    assertRecordedAs(result, eventUrn, urn);
  });

  Then(STEP_PHRASES.recordedAsWithFields, function (this: StepsWorld, eventUrn: string, table: DataTable) {
    const { urn, result } = lastRun(this);
    const expected = tableToObject(table.raw(), recordedEvent(urn, eventUrn).fields, 'event', eventUrn);
    assertRecordedAs(result, eventUrn, urn, expected);
  });

  Then(STEP_PHRASES.emitsNone, function (this: StepsWorld) {
    const { urn, result } = lastRun(this);
    assertEmitsNone(result, urn);
  });
}
