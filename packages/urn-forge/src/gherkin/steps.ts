/**
 * Generic, domain-independent Cucumber steps.
 *
 *   When I run the operation with:          one header row of input field names + one data row
 *   Then the output is:                     one header row of output field names + one data row
 *   Then the input is rejected on "<field>"
 *   Then the operation fails with "<error URN>"
 *   Then the operation fails with "<error URN>":   one header row of error field names + one data row
 *   Then the operation emits "<event URN>"
 *   Then the operation emits "<event URN>":        one header row of event field names + one data row
 *   Then the operation emits no event
 *   Then the operation is not due
 *   Then the operation emits no "<event URN>"
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
import { Before, Given, Then, When, type DataTable } from '@cucumber/cucumber';
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
  /** The record that the operation changes, when it changes one. */
  readonly changes?: { readonly entity: { readonly urn: string; readonly fields: FieldsLike } };
  /** The record that the operation reads, when it reads one. */
  readonly reads?: { readonly entity: { readonly urn: string; readonly fields: FieldsLike } };
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
  | { readonly ok: false; readonly kind: 'DomainError'; readonly error: DomainErrorLike; readonly issues?: readonly BoundaryIssueLike[] }
  | { readonly ok: false; readonly kind: string; readonly issues: readonly BoundaryIssueLike[] };

export interface OperationStepsOptions {
  readonly dispatch: Readonly<Record<string, OperationContractLike>>;
  /**
   * Runs one operation. `options.current` is the record of `Given the current <entity> is:`;
   * a domain with `changes` passes it on: `executeOperation(urn, payload, core, options)`.
   */
  readonly execute: (
    urn: string,
    payload: unknown,
    options: { readonly current?: unknown; readonly caller?: unknown; readonly now?: string; readonly repeat?: { readonly output: unknown } | { readonly conflict: true } },
  ) => ExecuteResultLike;
  /** The caller entity of a domain with a caller (the generated CallerContract), for `Given the caller is:`. */
  readonly caller?: { readonly urn: string; readonly fields: FieldsLike };
  /**
   * For a domain with idempotency: the generated idempotencyOf. The steps then keep the answers of a
   * scenario with the rules of runOnce, and give a repeat to execute as \`repeat\`.
   */
  readonly idempotency?: {
    readonly idempotencyOf: (
      urn: string,
      payload: unknown,
      options: { readonly caller?: unknown },
    ) => { readonly scope: string; readonly key: string; readonly body: string; readonly windowMs: number; readonly refusesOtherBody: boolean } | undefined;
  };
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
  side: 'input' | 'output' | 'error' | 'event' | 'current record' | 'caller',
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
  // Two UTC timestamps are equal when they are the same instant: 19:00:00Z is 19:00:00.000Z.
  if (typeof actual === 'string' && typeof expected === 'string' && UTC_TIMESTAMP.test(actual) && UTC_TIMESTAMP.test(expected)) {
    return Date.parse(actual) === Date.parse(expected);
  }
  return actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
}

/** A UTC timestamp, as a timestamp field holds it. */
const UTC_TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]+)?)?Z$/;

/** A text longer than this is shown shortened, and so is a list with more items. */
const SHOWN_CHARACTERS = 60;
const SHOWN_ITEMS = 10;

/** A value for a message: a long text shows its first 40 characters and its length; a long list its first 3 items and its length. */
function show(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length > SHOWN_ITEMS) return `[${value.slice(0, 3).map(show).join(', ')}, …(${value.length} items)]`;
    return `[${value.map(show).join(', ')}]`;
  }
  if (isObject(value)) return `{ ${Object.entries(value).map(([k, v]) => `${k}: ${show(v)}`).join(', ')} }`;
  if (value === undefined) return 'absent';
  const text = String(value);
  const characters = [...text];
  return characters.length > SHOWN_CHARACTERS ? `${characters.slice(0, 40).join('')}…(${characters.length} characters)` : text;
}

/** Where two long texts first differ, when a shortened message would hide it. */
function firstDifference(expected: unknown, actual: unknown): string {
  if (typeof expected !== 'string' || typeof actual !== 'string') return '';
  const [e, a] = [[...expected], [...actual]];
  if (e.length <= SHOWN_CHARACTERS && a.length <= SHOWN_CHARACTERS) return '';
  let at = 0;
  while (at < e.length && at < a.length && e[at] === a[at]) at += 1;
  return ` (first difference at character ${at + 1})`;
}

/** One `key: expected …, got …` entry for each expected key whose value differs; `undefined` expects the key to be absent. */
function differences(actual: Record<string, unknown>, expected: Record<string, unknown>): string[] {
  return Object.entries(expected)
    .filter(([key, value]) => !sameValue(actual[key], value))
    .map(([key, value]) => `${key}: expected ${show(value)}, got ${show(actual[key])}${firstDifference(value, actual[key])}`);
}

function describeFailure(result: Extract<ExecuteResultLike, { ok: false }>): string {
  if ('error' in result) {
    const issues = (result.issues ?? []).map((i) => `${i.path || '(payload)'}: ${i.message}`).join('; ');
    return `DomainError ${result.error.urn} (${result.error.message}${issues ? `; ${issues}` : ''})`;
  }
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

/** The issues of an input that did not parse: of InputRejected, or of the declared error of rejects, which carries them. */
function rejectionIssues(result: Extract<ExecuteResultLike, { ok: false }>): readonly BoundaryIssueLike[] | undefined {
  if (result.kind === 'InputRejected' && 'issues' in result) return result.issues;
  return result.kind === 'DomainError' && 'error' in result ? result.issues : undefined;
}

/** Checks the input was rejected at the boundary with an issue on the named field. */
export function assertRejectedOn(result: ExecuteResultLike, fieldName: string, fields: FieldsLike, urn: string): void {
  const field = Object.hasOwn(fields, fieldName) ? fields[fieldName] : undefined;
  if (!field) {
    throw new Error(`"${fieldName}" is not a field of the input of ${urn} (fields: ${Object.keys(fields).join(', ')})`);
  }
  if (result.ok) throw new Error(`${urn} accepted the input; expected it to be rejected on "${fieldName}"`);
  const issues = rejectionIssues(result);
  if (!issues) {
    throw new Error(`${urn} failed with ${describeFailure(result)}; expected InputRejected on "${fieldName}"`);
  }
  // The property is the head of the issue's path, also when the issue is inside it (`coverages.1.limit`).
  if (!issues.some((issue) => issue.path.split('.')[0] === fieldName)) {
    throw new Error(`${urn} rejected the input, but not on "${fieldName}": ${describeFailure(result)}`);
  }
}

/** Checks the input was rejected at the boundary because the invariant `invariantUrn` does not hold. */
export function assertRejectedBy(result: ExecuteResultLike, invariantUrn: string, urn: string): void {
  if (result.ok) throw new Error(`${urn} accepted the input; expected it to be rejected by ${invariantUrn}`);
  const issues = rejectionIssues(result);
  if (!issues) {
    throw new Error(`${urn} failed with ${describeFailure(result)}; expected InputRejected by ${invariantUrn}`);
  }
  if (!issues.some((issue) => issue.invariantUrn === invariantUrn)) {
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
 * error, which never has events. Any other failure is not "no event".
 */
export function assertEmitsNone(result: ExecuteResultLike, urn: string): void {
  if (!result.ok && 'error' in result) return;
  if (!result.ok) throw new Error(`${urn} failed with ${describeFailure(result)}; expected it to emit no event`);
  const events = result.events ?? [];
  if (events.length > 0) throw new Error(`${urn} emitted ${events.map((e) => e.urn).join(', ')}; expected no event`);
}

/** Checks that a timed change refused a call for a record that is not due (a ContractViolation that says so). */
export function assertNotDue(result: ExecuteResultLike, urn: string): void {
  const issues = !result.ok && 'issues' in result ? result.issues : [];
  if (result.ok || !('kind' in result) || result.kind !== 'ContractViolation' || !issues.some((issue) => issue.message.includes('is not due for this record'))) {
    throw new Error(`${urn} ${result.ok ? 'succeeded' : `failed with ${describeFailure(result)}`}; expected it to be not due for this record`);
  }
}

/** Checks the operation succeeded without the event \`eventUrn\`: the other side of an event that it emits only when a rule holds. */
export function assertEmitsNoneOf(result: ExecuteResultLike, eventUrn: string, urn: string): void {
  if (!result.ok) throw new Error(`${urn} did not succeed: ${describeFailure(result)}; expected a success without ${eventUrn}`);
  const count = (result.events ?? []).filter((event) => event.urn === eventUrn).length;
  if (count > 0) throw new Error(`${urn} emitted ${eventUrn}; expected a success without it`);
}

// ---------------------------------------------------------------------------
// Cucumber registration
// ---------------------------------------------------------------------------

interface ScenarioState {
  tags: readonly string[];
  /** The record of `Given the current <entity> is:`, as the shell would load it. */
  current?: unknown;
  /** The caller of `Given the caller is:`, as the shell would authenticate them. */
  caller?: unknown;
  /** The time of `Given the time is "<timestamp>"`, as the shell's clock would give it. */
  now?: string;
  /** The answers of the idempotent calls of the scenario, by operation, owners and key, as runOnce keeps them. */
  answers?: Map<string, { readonly body: string; readonly output: unknown; readonly at: number }>;
  /** The output of the first run of the scenario that succeeded. */
  firstOutput?: { readonly value: unknown };
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

  Given(STEP_PHRASES.time, function (this: StepsWorld, now: string) {
    state(this).now = now;
  });

  Given(STEP_PHRASES.caller, function (this: StepsWorld, table: DataTable) {
    const s = state(this);
    if (!options.caller) throw new Error('"the caller is:" needs the caller entity: pass caller: CallerContract to registerOperationSteps');
    s.caller = tableToObject(table.raw(), options.caller.fields, 'caller', options.caller.urn);
  });

  Given(STEP_PHRASES.current, function (this: StepsWorld, word: string, table: DataTable) {
    const s = state(this);
    const urn = operationUrnFromTags(s.tags);
    const change = contract(urn).changes ?? contract(urn).reads;
    if (!change) throw new Error(`${urn} changes no record, so "the current ${word} is:" has nothing to give`);
    const identifier = change.entity.urn.split(':').at(-1);
    if (word !== identifier) throw new Error(`${urn} changes a record of ${change.entity.urn}: write "the current ${identifier} is:"`);
    s.current = tableToObject(table.raw(), change.entity.fields, 'current record', change.entity.urn);
  });

  Given(STEP_PHRASES.noCurrent, function (this: StepsWorld, word: string) {
    const s = state(this);
    const urn = operationUrnFromTags(s.tags);
    const change = contract(urn).changes ?? contract(urn).reads;
    if (!change) throw new Error(`${urn} changes no record, so "there is no current ${word}" has nothing to say`);
    const identifier = change.entity.urn.split(':').at(-1);
    if (word !== identifier) throw new Error(`${urn} changes a record of ${change.entity.urn}: write "there is no current ${identifier}"`);
    // The shell found no record: it passes null, and the runtime answers the declared missing error.
    s.current = null;
  });

  /** One run, with the rules of runOnce when the domain has idempotency: a repeat in the window returns the first answer. */
  const run = (s: ScenarioState, table: DataTable) => {
    const urn = operationUrnFromTags(s.tags);
    const payload = tableToObject(table.raw(), contract(urn).input.fields, 'input', urn);
    const execute = (repeat?: { readonly output: unknown } | { readonly conflict: true }) =>
      options.execute(urn, payload, {
        ...(s.current === undefined ? {} : { current: s.current }),
        ...(s.caller === undefined ? {} : { caller: s.caller }),
        ...(s.now === undefined ? {} : { now: s.now }),
        ...(repeat === undefined ? {} : { repeat }),
      });
    s.urn = urn;
    const call = options.idempotency?.idempotencyOf(urn, payload, { caller: s.caller });
    const at = s.now === undefined ? 0 : Date.parse(s.now);
    const id = call && JSON.stringify([urn, call.scope, call.key]);
    const found = id === undefined ? undefined : s.answers?.get(id);
    if (call && found && at < found.at + call.windowMs) {
      // A repeat: the runtime answers it once the caller may call, as runOnce gives it.
      s.result = execute(found.body !== call.body && call.refusesOtherBody ? { conflict: true } : { output: found.output });
    } else {
      s.result = execute();
      if (call && id !== undefined && s.result.ok) (s.answers ??= new Map()).set(id, { body: call.body, output: s.result.output, at });
    }
    if (s.result.ok) s.firstOutput ??= { value: s.result.output };
  };

  When(STEP_PHRASES.run, function (this: StepsWorld, table: DataTable) {
    run(state(this), table);
  });

  When(STEP_PHRASES.runAgain, function (this: StepsWorld, table: DataTable) {
    const s = state(this);
    if (s.urn === undefined) throw new Error('"I run the operation again with:" repeats a call; start with "When I run the operation with:"');
    if (!options.idempotency) throw new Error('"I run the operation again with:" needs the idempotency helper: pass idempotency: { idempotencyOf } to registerOperationSteps');
    run(s, table);
  });

  Then(STEP_PHRASES.firstAnswer, function (this: StepsWorld) {
    const s = state(this);
    const { urn, result } = lastRun(this);
    if (!s.firstOutput) throw new Error('no run of the scenario succeeded, so there is no first answer');
    assertOutput(result, s.firstOutput.value as Record<string, unknown>, urn);
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

  Then(STEP_PHRASES.notDue, function (this: StepsWorld) {
    const { urn, result } = lastRun(this);
    assertNotDue(result, urn);
  });

  Then(STEP_PHRASES.emitsNone, function (this: StepsWorld) {
    const { urn, result } = lastRun(this);
    assertEmitsNone(result, urn);
  });

  Then(STEP_PHRASES.emitsNoneOf, function (this: StepsWorld, eventUrn: string) {
    const { urn, result } = lastRun(this);
    declaredEvent(urn, eventUrn);
    assertEmitsNoneOf(result, eventUrn, urn);
  });
}
