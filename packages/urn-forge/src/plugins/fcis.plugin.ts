/**
 * FCIS plugin → `domain.runtime.generated.ts`.
 *
 * - `Result`, `ok` and `fail`: every handler returns a `Result`.
 *   `fail(errorUrn, fields)` is typed by a generated map from error URN to its payload.
 * - One handler type per operation: branded input in, `Result<plain output, plain error
 *   payloads>` out. The core never mints brands (Gate 2), so handlers return `v.InferInput` shapes and the shell's parse does the branding,
 *   for output and errors alike.
 * - `DomainCoreImplementation` maps every operation URN to its handler type, so
 *   `satisfies DomainCoreImplementation` makes `tsc` reject missing or mistyped handlers.
 * - `DispatchMap` holds each operation's input, output and declared-error contracts: the
 *   schemas, per-property field metadata, and each error's category, retryable flag and
 *   parsed message.
 * - `executeOperation(urn, rawPayload, core)` parses input, calls the handler, then parses
 *   (and so brands) its output or its declared error, rendering the error's message.
 */
import * as v from 'valibot';
import type { IRChange, IREntity, IRError, IREvent, IRPropertyRef, MessagePart, UniversalIR, Urn } from '../ir/types.js';
import { ERROR_CATEGORIES, invariantsOf, valueField } from '../ir/types.js';
import { conditionName, handlerName, ruleName, schemaNames } from '../naming.js';
import { namesIn } from '../rules/index.js';
import { PRIMITIVE_NAMES } from '../primitives/index.js';
import { docComment, valuesInUrnOrder, type CodegenPlugin } from './plugin.interface.js';
import { VALIBOT_SCHEMAS_FILE } from './valibot.plugin.js';

export const FCIS_RUNTIME_FILE = 'domain.runtime.generated.ts';

const ConfigSchema = v.strictObject({});
export type FcisPluginConfig = v.InferOutput<typeof ConfigSchema>;

/** A single-quoted TypeScript string literal, escaped as JSON escapes (newlines included). */
const q = (text: string) => `'${JSON.stringify(text).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;

/** Static: the Result type and its helpers. `ErrorPayloads` (generated) comes just before. */
const RESULTS = `export interface Success<T, V = never> {
  readonly ok: true;
  readonly value: T;
  /** The events of the operation, in the order the handler gives them. */
  readonly events: readonly V[];
}

export interface Failure<E> {
  readonly ok: false;
  readonly error: E;
}

/** What every handler returns: its output and events, or one of its operation's declared errors. */
export type Result<T, E, V = never> = Success<T, V> | Failure<E>;

export type ErrorUrn = keyof ErrorPayloads;

/** An error's fields, as a handler passes them to \`fail\`: its payload without \`kind\`. */
export type ErrorFields<K extends ErrorUrn> = Omit<ErrorPayloads[K], 'kind'>;

export type EventUrn = keyof EventPayloads;

/** An event's fields, as a handler passes them to \`emit\`: its payload without \`kind\`. */
export type EventFields<K extends EventUrn> = Omit<EventPayloads[K], 'kind'>;

/** A successful result, with the events of the operation (none by default). */
export function ok<T, V = never>(value: T, events: readonly V[] = []): Success<T, V> {
  return { ok: true, value, events };
}

/** An event, by URN. The fields may be left out when the event has none. */
export function emit<K extends EventUrn>(
  kind: K,
  ...fields: {} extends EventFields<K> ? [fields?: EventFields<K>] : [fields: EventFields<K>]
): EventPayloads[K] {
  return { ...fields[0], kind } as EventPayloads[K];
}

/** A declared error, by URN. The fields may be left out when the error has none. */
export function fail<K extends ErrorUrn>(
  kind: K,
  ...fields: {} extends ErrorFields<K> ? [fields?: ErrorFields<K>] : [fields: ErrorFields<K>]
): Failure<ErrorPayloads[K]> {
  return { ok: false, error: { ...fields[0], kind } as ErrorPayloads[K] };
}`;

const PLAIN_SIGNATURES = `export function executeOperation<U extends OperationUrn>(
  urn: U,
  rawPayload: unknown,
  core: DomainCoreImplementation,
): ExecuteResult<U>;
export function executeOperation(urn: string, rawPayload: unknown, core: DomainCoreImplementation): ExecuteResult;
export function executeOperation(urn: string, rawPayload: unknown, core: DomainCoreImplementation): ExecuteResult {`;

const CHANGE_SIGNATURES = `/** For an operation that changes a record: the record as it is stored now, before the call. */
export interface ExecuteOptions {
  readonly current?: unknown;
}

export function executeOperation<U extends OperationUrn>(
  urn: U,
  rawPayload: unknown,
  core: DomainCoreImplementation,
  options?: ExecuteOptions,
): ExecuteResult<U>;
export function executeOperation(urn: string, rawPayload: unknown, core: DomainCoreImplementation, options?: ExecuteOptions): ExecuteResult;
export function executeOperation(urn: string, rawPayload: unknown, core: DomainCoreImplementation, options: ExecuteOptions = {}): ExecuteResult {`;

/** The options of a domain whose events have a delivery: the record of \`changes\`, when an operation has one, and the ids of events. */
const deliverySignatures = (changes: boolean) => `/** ${changes ? 'For an operation that changes a record: the record as it is stored now, before the call. ' : ''}For an event with a delivery: a new, unique id for each event. */
export interface ExecuteOptions {${changes ? '\n  readonly current?: unknown;' : ''}
  readonly newEventId?: () => string;
}

export function executeOperation<U extends OperationUrn>(
  urn: U,
  rawPayload: unknown,
  core: DomainCoreImplementation,
  options?: ExecuteOptions,
): ExecuteResult<U>;
export function executeOperation(urn: string, rawPayload: unknown, core: DomainCoreImplementation, options?: ExecuteOptions): ExecuteResult;
export function executeOperation(urn: string, rawPayload: unknown, core: DomainCoreImplementation, options: ExecuteOptions = {}): ExecuteResult {`;

/** The options of a domain with a caller or a read: the record, the caller, and the ids of events, as the domain uses them. */
const accessSignatures = (record: boolean, caller: boolean, delivery: boolean) => `/** What the shell knows of the call, besides the payload. */
export interface ExecuteOptions {${record ? `
  /** For an operation that changes or reads a record: the record as it is stored now, or null when there is none. */
  readonly current?: unknown;` : ''}${caller ? `
  /** Who calls, as the shell authenticated them. */
  readonly caller?: unknown;` : ''}${delivery ? `
  /** For an event with a delivery: a new, unique id for each event. */
  readonly newEventId?: () => string;` : ''}
}

export function executeOperation<U extends OperationUrn>(
  urn: U,
  rawPayload: unknown,
  core: DomainCoreImplementation,
  options?: ExecuteOptions,
): ExecuteResult<U>;
export function executeOperation(urn: string, rawPayload: unknown, core: DomainCoreImplementation, options?: ExecuteOptions): ExecuteResult;
export function executeOperation(urn: string, rawPayload: unknown, core: DomainCoreImplementation, options: ExecuteOptions = {}): ExecuteResult {`;

/**
 * The call in a domain with a caller or a read: the caller parses, the record parses (or is null
 * for \`missing\`), a caller that no rule of \`callers\` allows gets \`otherwise\`, then the state of
 * \`changes\` and the requires rules. The callers are checked before the state, so a caller who may
 * not call learns nothing of the record from another refusal.
 */
const accessCall = (changes: boolean, reads: boolean, caller: boolean, conditions: boolean) => `  // The caller, the record, who may call, then the state: the handler runs only when each holds.${changes ? `
  const change: ChangeContract | undefined = 'changes' in contract ? contract.changes : undefined;` : ''}${reads ? `
  const read: ReadContract | undefined = 'reads' in contract ? contract.reads : undefined;` : ''}
  const record = ${[...(changes ? ['change?.entity'] : []), ...(reads ? ['read?.entity'] : [])].join(' ?? ') || 'undefined'};
  const missing = ${[...(changes ? ['change?.missing'] : []), ...(reads ? ['read?.missing'] : [])].join(' ?? ') || 'undefined'};
  let current: Readonly<Record<string, unknown>> | undefined;
  let result: unknown;
  const fill = (errorUrn: string, known: Readonly<Record<string, unknown>>) => {
    const names = Object.keys(contract.errors[errorUrn]?.fields ?? {}).filter((name) => known[name] !== undefined);
    return { ok: false, error: { ...Object.fromEntries(names.map((name) => [name, known[name]])), kind: errorUrn } };
  };${caller ? `
  if (options.caller === undefined) return violation(\`\${urn} needs the caller, as the shell authenticated them: pass it as { caller }\`);
  const who = v.safeParse(CallerContract.schema, options.caller);
  if (!who.success) {
    const issues = boundaryIssues(who.issues, CallerContract).map((issue) => ({ ...issue, path: issue.path === '' ? 'caller' : \`caller.\${issue.path}\` }));
    return { ok: false, kind: 'ContractViolation', urn, issues };
  }
  const caller = who.output as Readonly<Record<string, unknown>>;` : ''}
  if (record) {
    if (options.current === undefined || (options.current === null && missing === undefined)) {
      const message = options.current === null ? 'the shell found no record, and the operation declares no missing error' : 'pass it as { current }';
      return { ok: false, kind: 'ContractViolation', urn, issues: [{ path: 'current', message: \`\${urn} \${'changes' in contract ? 'changes' : 'reads'} a record of \${record.urn}: \${message}\` }] };
    }
    if (options.current === null) {
      result = fill(missing!, input.output as Readonly<Record<string, unknown>>);
    } else {
      const stored = v.safeParse(record.schema, options.current);
      if (!stored.success) {
        const issues = boundaryIssues(stored.issues, record).map((issue) => ({ ...issue, path: issue.path === '' ? 'current' : \`current.\${issue.path}\` }));
        return { ok: false, kind: 'ContractViolation', urn, issues };
      }
      current = stored.output as Readonly<Record<string, unknown>>;
    }
  }${caller ? `
  // Who may call: any caller, or one for whom a rule holds. Else \`otherwise\`, filled from the caller, the record and the request.
  const callers = contract.callers;
  if (result === undefined && callers.allow !== 'any' && !callers.allow.some((rule) => (rule.check as (values: unknown) => boolean)({ input: input.output, current, caller }))) {
    result = fill(callers.otherwise!, { ...(input.output as object), ...current, ...caller });
  }` : ''}${changes ? `
  if (result === undefined && change && current && !change.from.includes(current[change.property] as string)) result = fill(change.otherwise, { ...(input.output as object), ...current });` : ''}${conditions ? REQUIRES : ''}
  result ??= handler(input.output, current);`;

const PLAIN_CALL = `  const result: unknown = handler(input.output);`;

const CHANGE_CALL = `  // An operation that changes a record: the record must parse, and its state must be one the
  // operation starts from. Else the runtime answers the declared error \`otherwise\`, filled from
  // the record and the request, and the handler does not run. With no record (\`current: null\`),
  // it answers the declared error \`missing\`, filled from the request.
  const change: ChangeContract | undefined = 'changes' in contract ? contract.changes : undefined;
  let current: Readonly<Record<string, unknown>> | undefined;
  let result: unknown;
  if (change) {
    const fill = (errorUrn: string, known: Readonly<Record<string, unknown>>) => {
      const names = Object.keys(contract.errors[errorUrn]?.fields ?? {}).filter((name) => known[name] !== undefined);
      return { ok: false, error: { ...Object.fromEntries(names.map((name) => [name, known[name]])), kind: errorUrn } };
    };
    if (options.current === undefined || (options.current === null && change.missing === undefined)) {
      const message = options.current === null ? 'the shell found no record, and the operation declares no missing error' : 'pass it as { current }';
      return { ok: false, kind: 'ContractViolation', urn, issues: [{ path: 'current', message: \`\${urn} changes a record of \${change.entity.urn}: \${message}\` }] };
    }
    if (options.current === null) {
      result = fill(change.missing!, input.output as Readonly<Record<string, unknown>>);
    } else {
      const stored = v.safeParse(change.entity.schema, options.current);
      if (!stored.success) {
        const issues = boundaryIssues(stored.issues, change.entity).map((issue) => ({ ...issue, path: issue.path === '' ? 'current' : \`current.\${issue.path}\` }));
        return { ok: false, kind: 'ContractViolation', urn, issues };
      }
      current = stored.output as Readonly<Record<string, unknown>>;
      if (!change.from.includes(current[change.property] as string)) result = fill(change.otherwise, { ...(input.output as object), ...current });
    }
  }
  result ??= handler(input.output, current);`;

const CHANGE_ANSWER = `
  // An answer that holds the state of the record: one of \`to\`, reached by a move (or the same
  // state without \`to\`). An answer that holds its key: the same key.
  if (change && current) {
    const answer = output.output as Readonly<Record<string, unknown>>;
    const before = current[change.property] as string;
    if (change.answerState !== undefined) {
      const after = answer[change.answerState] as string;
      const allowed = change.to === undefined ? after === before : change.to.includes(after) && (after === before || (change.moves[before] ?? []).includes(after));
      if (!allowed) {
        const expected =
          change.to === undefined
            ? \`the state stays "\${before}"\`
            : change.to.includes(after)
              ? \`"\${before}" cannot move to "\${after}"\`
              : \`the operation moves to \${change.to.map((state) => \`"\${state}"\`).join(' or ')}\`;
        return { ok: false, kind: 'ContractViolation', urn, issues: [{ path: change.answerState, message: \`the handler for \${urn} answered \${change.answerState} "\${String(after)}", but \${expected}\` }] };
      }
    }
    if (change.key !== undefined && change.answerKey !== undefined && answer[change.answerKey] !== current[change.key]) {
      return { ok: false, kind: 'ContractViolation', urn, issues: [{ path: change.answerKey, message: \`the handler for \${urn} answered \${change.answerKey} "\${String(answer[change.answerKey])}", but the record has "\${String(current[change.key])}"\` }] };
    }
  }`;

/** The requires rules: the first that does not hold answers its declared error, and the handler does not run. */
const REQUIRES = `
  // The requires rules, in order, after the state of \`changes\`: the first that does not hold
  // answers its declared error, filled from the request and the record, and the handler does not run.
  if (result === undefined) {
    for (const condition of ('requires' in contract ? contract.requires : undefined) ?? []) {
      if ((condition.check as (values: unknown) => boolean)({ input: input.output, current })) continue;
      // \`fill\` names the value of a property; the others come by name, the record's over the request's.
      const values: Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>> = { input: input.output as Readonly<Record<string, unknown>>, current };
      const byName: Readonly<Record<string, unknown>> = { ...(input.output as object), ...current };
      const valueOf = (name: string) => {
        const source = condition.fill?.[name];
        if (source === undefined) return byName[name];
        const [prefix, property] = source.split('.') as [string, string];
        return values[prefix]?.[property];
      };
      const names = Object.keys(contract.errors[condition.otherwise]?.fields ?? {}).filter((name) => valueOf(name) !== undefined);
      result = { ok: false, error: { ...Object.fromEntries(names.map((name) => [name, valueOf(name)])), kind: condition.otherwise } };
      break;
    }
  }`;

/** The ensures rules: the answer must keep each one, or the core has a bug. */
const ENSURES = `
  // The ensures rules: an answer that breaks one is a bug in the core.
  for (const condition of ('ensures' in contract ? contract.ensures : undefined) ?? []) {
    if (!(condition.check as (values: unknown) => boolean)({ input: input.output, current, output: output.output })) {
      return { ok: false, kind: 'ContractViolation', urn, issues: [{ path: '', message: \`the handler for \${urn} answered a value that breaks ensures: \${condition.text}\` }] };
    }
  }`;

/** The counts of events: exactly one where the \`when\` rule holds, and none where it does not. Then the ensures rules, which can read the event. */
const COUNTS = `
  // Each event of an item { event, when }: exactly one on a success where its rule holds, none where it does not.
  for (const rule of ('exactly' in contract ? contract.exactly : undefined) ?? []) {
    const holds = rule.when === undefined || (rule.when.check as (values: unknown) => boolean)({ input: input.output, current, output: output.output });
    const count = events.filter((event) => event.urn === rule.event).length;
    if (holds && count !== 1) return violation(\`\${urn} emitted \${count} \${rule.event}, but it emits exactly one\${rule.when ? \` when \${rule.when.text}\` : ''}\`);
    if (!holds && count > 0) return violation(\`\${urn} emitted \${rule.event}, but it emits it only when \${rule.when!.text}\`);
  }
  // The ensures rules: an answer that breaks one is a bug in the core. A rule that reads the event is
  // about the one event of the success: with none, which the counts above allow, it has nothing to check.
  for (const condition of ('ensures' in contract ? contract.ensures : undefined) ?? []) {
    if ('event' in condition && events.length === 0) continue;
    if ('event' in condition && events.length > 1) return violation(\`ensures \${condition.text} reads the event, but the handler for \${urn} emitted \${events.length} events\`);
    if (!(condition.check as (values: unknown) => boolean)({ input: input.output, current, output: output.output, event: events[0]?.fields })) {
      return { ok: false, kind: 'ContractViolation', urn, issues: [{ path: '', message: \`the handler for \${urn} answered a value that breaks ensures: \${condition.text}\` }] };
    }
  }`;

/** The parse of an event with a delivery: the id from the shell, and no sequence, which the outbox fills. */
const DELIVERY_PARSE = `
    const delivery = 'delivery' in declared ? declared.delivery : undefined;
    if (delivery && !options.newEventId) return violation(\`\${urn} emitted \${eventUrn}, whose delivery needs an event id: pass newEventId to executeOperation\`);
    const schema = delivery?.sequence === undefined ? declared.schema : v.omit(declared.schema as v.ObjectSchema<v.ObjectEntries, undefined>, [delivery.sequence]);
    const event = v.safeParse(schema, delivery ? { ...(candidate as object), [delivery.id]: options.newEventId!() } : candidate);`;

/** How the handler is called: plain, with the record of `changes`, and with the requires rules. Without conditions, the text is as before. */
function callSnippet(changes: boolean, conditions: boolean): string {
  if (!conditions) return changes ? CHANGE_CALL : PLAIN_CALL;
  const handlerCall = '\n  result ??= handler(input.output, current);';
  const head = changes
    ? CHANGE_CALL.slice(0, CHANGE_CALL.lastIndexOf(handlerCall))
    : `  // No operation of this domain changes a record.\n  const current = undefined as Readonly<Record<string, unknown>> | undefined;\n  let result: unknown;`;
  return `${head}${REQUIRES}${handlerCall}`;
}

/** The gatekeeper: the same for every manifest, plus the record of `changes` when an operation has one. */
const shell = (changes: boolean, conditions = false, counts = false, delivery = false, reads = false, caller = false) => `// Shell gatekeeper

export type OperationUrn = keyof DomainCoreImplementation;

export interface BoundaryIssue {
  /** Dot path into the payload, e.g. \`divisor\` or \`coverages.1.limit\`; empty for the payload as a whole. */
  readonly path: string;
  /** URN of the field the issue is about: the deepest declared field on the path, if any. */
  readonly fieldUrn?: string;
  /** URN of the invariant that does not hold, when the issue comes from one. */
  readonly invariantUrn?: string;
  readonly message: string;
}

type DeclaredErrors<U extends OperationUrn> = (typeof DispatchMap)[U]['errors'];
type DeclaredEvents<U extends OperationUrn> = (typeof DispatchMap)[U]['events'];

/** An event of operation \`U\`, parsed and branded (its fields include \`kind\`). */
export type EmittedEvent<U extends OperationUrn = OperationUrn> = U extends OperationUrn
  ? {
      readonly [K in keyof DeclaredEvents<U>]: {
        readonly urn: K;
        readonly fields: DeclaredEvents<U>[K] extends { readonly schema: infer S extends v.GenericSchema } ? ${delivery ? 'Omit<v.InferOutput<S>, SequenceOf<DeclaredEvents<U>[K]>>' : 'v.InferOutput<S>'} : never;
      };
    }[keyof DeclaredEvents<U>]
  : never;

${delivery ? `/** The property that the outbox fills, which an event has only once it is in the outbox. */
type SequenceOf<E> = E extends { readonly delivery: { readonly sequence: infer Q extends string } } ? Q : never;

` : ''}/** A declared error of operation \`U\`, parsed and branded, with its metadata and rendered message. */
export type DomainError<U extends OperationUrn = OperationUrn> = U extends OperationUrn
  ? {
      readonly [K in keyof DeclaredErrors<U>]: {
        readonly urn: K;
        readonly category: ErrorCategory;
        readonly retryable: boolean;
        readonly message: string;
        readonly fields: DeclaredErrors<U>[K] extends { readonly schema: infer S extends v.GenericSchema }
          ? v.InferOutput<S>
          : never;
        /** The event that records the error, for an audit trail, when the error names one (recordAs). */
        readonly record?: DeclaredErrors<U>[K] extends {
          readonly recordAs: { readonly urn: infer R; readonly schema: infer S extends v.GenericSchema };
        }
          ? { readonly urn: R; readonly fields: v.InferOutput<S> }
          : never;
      };
    }[keyof DeclaredErrors<U>]
  : never;

export type ExecuteResult<U extends OperationUrn = OperationUrn> =
  | {
      readonly ok: true;
      readonly urn: U;
      readonly output: v.InferOutput<(typeof DispatchMap)[U]['output']['schema']>;
      /** The events of the operation, parsed and branded, in the order the handler gave them. */
      readonly events: readonly EmittedEvent<U>[];
    }
  | {
      readonly ok: false;
      /** The operation refused, with one of its declared errors. */
      readonly kind: 'DomainError';
      readonly urn: U;
      readonly error: DomainError<U>;
    }
  | {
      readonly ok: false;
      /** The URN names no operation of this domain. */
      readonly kind: 'UnknownOperation';
      readonly urn: string;
      readonly issues: readonly BoundaryIssue[];
    }
  | {
      readonly ok: false;
      /** InputRejected: the caller sent a bad payload. ContractViolation: a bug in the core. */
      readonly kind: 'InputRejected' | 'ContractViolation';
      readonly urn: U;
      readonly issues: readonly BoundaryIssue[];
    };

function boundaryIssues(issues: readonly v.BaseIssue<unknown>[], contract: EntityContract): BoundaryIssue[] {
  return issues.map((issue) => {
    const path = v.getDotPath(issue) ?? '';
    // Walk the path through embedded entities to the deepest field it names; list indexes do not name one.
    let properties: Readonly<Record<string, PropertyInfo>> | undefined = contract.fields;
    let field: FieldInfo | undefined;
    for (const segment of path.split('.')) {
      if (/^[0-9]+$/.test(segment) || !properties) continue;
      const info: PropertyInfo | undefined = Object.hasOwn(properties, segment) ? properties[segment] : undefined;
      if (!info) break;
      if ('entity' in info) {
        properties = info.fields;
      } else {
        field = info;
        break;
      }
    }
    // A check issue keeps the function that failed; an invariant's rule is one such function.
    const requirement = (issue as { readonly requirement?: unknown }).requirement;
    const invariant = contract.invariants?.find((candidate) => candidate.rule === requirement);
    return {
      path,
      ...(field ? { fieldUrn: field.urn } : {}),
      ...(invariant ? { invariantUrn: invariant.urn } : {}),
      message: issue.message,
    };
  });
}

function isOperationUrn(urn: string): urn is OperationUrn {
  return Object.hasOwn(DispatchMap, urn);
}

function isResult(value: unknown): value is Result<unknown, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { readonly ok?: unknown };
  return (candidate.ok === true && 'value' in candidate) || (candidate.ok === false && 'error' in candidate);
}

/** Fills each \`{placeholder}\` from the parsed error. */
function renderMessage(parts: readonly MessagePart[], fields: unknown): string {
  const values = fields as Readonly<Record<string, unknown>>;
  return parts.map((part) => ('text' in part ? part.text : String(values[part.field]))).join('');
}

/**
 * Parses the input, calls the handler with branded input, then parses and brands its
 * output, or its error when the error is one the operation declares.
 */
${reads || caller ? accessSignatures(changes || reads, caller, delivery) : delivery ? deliverySignatures(changes) : changes ? CHANGE_SIGNATURES : PLAIN_SIGNATURES}
  if (!isOperationUrn(urn)) {
    return { ok: false, kind: 'UnknownOperation', urn, issues: [{ path: '', message: \`unknown operation \${urn}\` }] };
  }
  const contract: OperationContract = DispatchMap[urn];
  const violation = (message: string): ExecuteResult => ({ ok: false, kind: 'ContractViolation', urn, issues: [{ path: '', message }] });

  const input = v.safeParse(contract.input.schema, rawPayload);
  if (!input.success) {
    return { ok: false, kind: 'InputRejected', urn, issues: boundaryIssues(input.issues, contract.input) };
  }

  const handler: unknown = core[urn];
  if (typeof handler !== 'function') return violation(\`no handler for \${urn}\`);
${reads || caller ? accessCall(changes, reads, caller, conditions || counts) : callSnippet(changes, conditions || counts)}
  if (!isResult(result)) return violation(\`the handler for \${urn} did not return a Result; return ok(…) or fail(…)\`);

  // \`=== false\`, not \`!result.ok\`: without strictNullChecks, TypeScript narrows a union on
  // an equality test but not on a truthiness test, and the core's tsconfig may not be strict.
  if (result.ok === false) {
    const errorUrn = (result.error as { readonly kind?: unknown } | null | undefined)?.kind;
    const declared =
      typeof errorUrn === 'string' && Object.hasOwn(contract.errors, errorUrn) ? contract.errors[errorUrn] : undefined;
    if (!declared) return violation(\`\${urn} failed with \${String(errorUrn)}, which it does not declare\`);
    const error = v.safeParse(declared.schema, result.error);
    if (!error.success) {
      return { ok: false, kind: 'ContractViolation', urn, issues: boundaryIssues(error.issues, declared) };
    }
    // The recordAs event has the error's properties (pass 6), so the error's fields build it.
    let record: { readonly urn: string; readonly fields: unknown } | undefined;
    if (declared.recordAs) {
      const recorded = v.safeParse(declared.recordAs.schema, { ...(error.output as object), kind: declared.recordAs.urn });
      if (!recorded.success) {
        return { ok: false, kind: 'ContractViolation', urn, issues: boundaryIssues(recorded.issues, declared.recordAs) };
      }
      record = { urn: declared.recordAs.urn, fields: recorded.output };
    }
    return {
      ok: false,
      kind: 'DomainError',
      urn,
      error: {
        urn: errorUrn,
        category: declared.category,
        retryable: declared.retryable,
        message: renderMessage(declared.message, error.output),
        fields: error.output,
        ...(record ? { record } : {}),
      },
    } as ExecuteResult;
  }

  const output = v.safeParse(contract.output.schema, result.value);
  if (!output.success) {
    return { ok: false, kind: 'ContractViolation', urn, issues: boundaryIssues(output.issues, contract.output) };
  }${changes ? CHANGE_ANSWER : ''}${conditions && !counts ? ENSURES : ''}
  // Each event must be one the operation emits, and must parse.
  const emitted: unknown = (result as { readonly events?: unknown }).events ?? [];
  if (!Array.isArray(emitted)) return violation(\`the handler for \${urn} returned events that are not a list\`);
  const events: { readonly urn: string; readonly fields: unknown }[] = [];
  for (const candidate of emitted) {
    const eventUrn = (candidate as { readonly kind?: unknown } | null | undefined)?.kind;
    const declared = typeof eventUrn === 'string' && Object.hasOwn(contract.events, eventUrn) ? contract.events[eventUrn] : undefined;
    if (typeof eventUrn !== 'string' || !declared) return violation(\`\${urn} emitted \${String(eventUrn)}, which it does not emit\`);${delivery ? DELIVERY_PARSE : `
    const event = v.safeParse(declared.schema, candidate);`}
    if (!event.success) {
      return { ok: false, kind: 'ContractViolation', urn, issues: boundaryIssues(event.issues, declared) };
    }
    events.push({ urn: eventUrn, fields: event.output });
  }${counts ? COUNTS : ''}
  // The events were checked against the contract above; the cast goes through unknown, because a
  // domain with no events types them as never.
  return { ok: true, urn, output: output.output, events } as unknown as ExecuteResult;
}
`;

/**
 * One line per property: a field's (or a linked key's) FieldInfo, or for an embedded entity
 * its EmbeddedInfo with the nested properties, as deep as the entity goes.
 */
function fieldInfoLines(owner: Urn, refs: readonly IRPropertyRef[], ir: UniversalIR, indent: string): string[] {
  return refs.flatMap((ref) => {
    const count = `required: ${ref.required}${ref.many ? ', many: true' : ''}`;
    if ('entity' in ref) {
      const entity = ir.entities[ref.entity];
      if (!entity) throw new Error(`IR is not resolved: ${owner} embeds missing ${ref.entity}`);
      return [`${indent}${ref.name}: { entity: ${q(entity.urn)}, ${count}, fields: {`, ...fieldInfoLines(entity.urn, entity.fields, ir, `${indent}  `), `${indent}} },`];
    }
    const fieldUrn = valueField(ir, ref);
    const field = fieldUrn && ir.fields[fieldUrn];
    if (!field) throw new Error(`IR is not resolved: ${owner} has no field for property ${ref.name}`);
    const link = 'link' in ref ? `, link: ${q(ref.link)}` : '';
    return [`${indent}${ref.name}: { urn: ${q(field.urn)}, primitive: ${q(field.primitive)}, ${count}${link} },`];
  });
}

/** The invariants of an entity and of each entity it embeds, at any depth, each once. */
function invariantsWithin(ir: UniversalIR, entity: IREntity, seen = new Set<Urn>()): ReturnType<typeof invariantsOf> {
  if (seen.has(entity.urn)) return [];
  seen.add(entity.urn);
  return [
    ...invariantsOf(ir, entity.urn),
    ...entity.fields.flatMap((ref) => ('entity' in ref && ir.entities[ref.entity] ? invariantsWithin(ir, ir.entities[ref.entity]!, seen) : [])),
  ];
}

function entityContract(entity: IREntity, ir: UniversalIR, indent: string): string[] {
  const invariants = invariantsWithin(ir, entity);
  return [
    `${indent}schema: s.${schemaNames(entity.brandIdentifier).schema},`,
    `${indent}fields: {`,
    ...fieldInfoLines(entity.urn, entity.fields, ir, `${indent}  `),
    `${indent}},`,
    ...(invariants.length === 0
      ? []
      : [
          `${indent}invariants: [`,
          ...invariants.map((i) => `${indent}  { urn: ${q(i.urn)}, rule: s.${ruleName(i.brandIdentifier)} },`),
          `${indent}],`,
        ]),
  ];
}

function messageLiteral(parts: readonly MessagePart[]): string {
  return `[${parts.map((part) => ('text' in part ? `{ text: ${q(part.text)} }` : `{ field: ${q(part.field)} }`)).join(', ')}]`;
}

function errorContract(error: IRError, ir: UniversalIR, indent: string): string[] {
  const record = error.recordAs === undefined ? undefined : ir.events[error.recordAs];
  return [
    `${indent}${q(error.urn)}: {`,
    `${indent}  schema: s.${schemaNames(error.brandIdentifier).schema},`,
    `${indent}  category: ${q(error.category)},`,
    `${indent}  retryable: ${error.retryable},`,
    `${indent}  message: ${messageLiteral(error.message)},`,
    `${indent}  fields: {`,
    ...fieldInfoLines(error.urn, error.fields, ir, `${indent}    `),
    `${indent}  },`,
    ...(record ? [`${indent}  recordAs: {`, `${indent}    urn: ${q(record.urn)},`, ...eventLines(record, ir, `${indent}    `, false), `${indent}  },`] : []),
    `${indent}},`,
  ];
}

/** An event's schema and properties, as an entity's are. */
function eventLines(event: IREvent, ir: UniversalIR, indent: string, withDelivery = true): string[] {
  const delivery = withDelivery ? event.delivery : undefined;
  return [
    `${indent}schema: s.${schemaNames(event.brandIdentifier).schema},`,
    `${indent}fields: {`,
    ...fieldInfoLines(event.urn, event.fields, ir, `${indent}  `),
    `${indent}},`,
    ...(delivery
      ? [`${indent}delivery: { id: ${q(delivery.id)}, orderBy: [${delivery.orderBy.map(q).join(', ')}]${delivery.sequence === undefined ? '' : `, sequence: ${q(delivery.sequence)}`} },`]
      : []),
  ];
}

/** The `changes` entry of an operation in the dispatch map. */
function changeLines(change: IRChange, output: Urn, ir: UniversalIR, indent: string): string[] {
  const entity = ir.entities[change.entity];
  if (!entity) throw new Error(`IR is not resolved: missing entity ${change.entity}`);
  const nameOf = (owner: IREntity | undefined, fieldUrn: Urn | undefined) =>
    fieldUrn === undefined ? undefined : owner?.fields.find((ref) => 'field' in ref && ref.field === fieldUrn && !ref.many)?.name;
  const stateRef = entity.fields.find((ref) => ref.name === change.property);
  const stateField = stateRef && 'field' in stateRef ? ir.fields[stateRef.field] : undefined;
  const key = nameOf(entity, entity.key);
  // The answer is checked when it holds the state, or the key, of the record: the whole entity or a smaller shape.
  const answer = ir.entities[output];
  const answerState = nameOf(answer, stateField?.urn);
  const answerKey = key === undefined ? undefined : nameOf(answer, entity.key);
  const moves = Object.entries(stateField?.moves ?? {}).map(([from, targets]) => `${q(from)}: [${targets.map(q).join(', ')}]`);
  return [
    `${indent}changes: {`,
    `${indent}  entity: {`,
    `${indent}    urn: ${q(entity.urn)},`,
    ...entityContract(entity, ir, `${indent}    `),
    `${indent}  },`,
    `${indent}  property: ${q(change.property)},`,
    `${indent}  from: [${change.from.map(q).join(', ')}],`,
    ...(change.to === undefined ? [] : [`${indent}  to: [${change.to.map(q).join(', ')}],`]),
    `${indent}  moves: { ${moves.join(', ')} },`,
    `${indent}  otherwise: ${q(change.otherwise)},`,
    ...(change.missing === undefined ? [] : [`${indent}  missing: ${q(change.missing)},`]),
    ...(key === undefined ? [] : [`${indent}  key: ${q(key)},`]),
    ...(answerState === undefined ? [] : [`${indent}  answerState: ${q(answerState)},`]),
    ...(answerKey === undefined ? [] : [`${indent}  answerKey: ${q(answerKey)},`]),
    `${indent}},`,
  ];
}

export const fcisPlugin: CodegenPlugin<FcisPluginConfig> = {
  name: 'fcis',
  version: '0.2.0',
  configSchema: ConfigSchema,
  // Reads primitives only as names for FieldInfo, and no constraints.
  supports: { kinds: ['field', 'entity', 'invariant', 'operation', 'event', 'error'] },
  // The runtime imports the schema module.
  requires: ['valibot'],
  emit(ir) {
    const operations = valuesInUrnOrder(ir.operations);
    const errors = valuesInUrnOrder(ir.errors);
    const entity = (urn: Urn): IREntity => {
      const found = ir.entities[urn];
      if (!found) throw new Error(`IR is not resolved: missing entity ${urn}`);
      return found;
    };
    const error = (urn: Urn): IRError => {
      const found = ir.errors[urn];
      if (!found) throw new Error(`IR is not resolved: missing error ${urn}`);
      return found;
    };
    const schemasModule = `./${VALIBOT_SCHEMAS_FILE.replace(/\.ts$/, '.js')}`;

    const events = valuesInUrnOrder(ir.events);
    const event = (urn: Urn): IREvent => {
      const found = ir.events[urn];
      if (!found) throw new Error(`IR is not resolved: missing event ${urn}`);
      return found;
    };
    const anyCounts = operations.some((op) => op.exactly !== undefined);
    const anyDelivery = events.some((e) => e.delivery !== undefined);
    // An event as the core builds it: without the id and the sequence of its delivery, which the shell and the outbox fill.
    const coreEventType = (e: IREvent) => {
      const filled = e.delivery ? [e.delivery.id, ...(e.delivery.sequence === undefined ? [] : [e.delivery.sequence])] : [];
      const input = `s.${schemaNames(e.brandIdentifier).input}`;
      return filled.length === 0 ? input : `Omit<${input}, ${filled.map(q).join(' | ')}>`;
    };
    const payloads = [
      `/** Every declared error, by URN: its payload as a handler builds it (plain, \`kind\` included). */`,
      errors.length === 0
        ? `export interface ErrorPayloads {}`
        : [
            `export interface ErrorPayloads {`,
            ...errors.map((e) => `  readonly ${q(e.urn)}: s.${schemaNames(e.brandIdentifier).input};`),
            `}`,
          ].join('\n'),
      ``,
      `/** Every event, by URN: its payload as a handler builds it with \`emit\` (plain, \`kind\` included). */`,
      events.length === 0
        ? `export interface EventPayloads {}`
        : [`export interface EventPayloads {`, ...events.map((e) => `  readonly ${q(e.urn)}: ${coreEventType(e)};`), `}`].join('\n'),
    ].join('\n');

    const anyChanges = operations.some((op) => op.changes !== undefined);
    const anyReads = operations.some((op) => op.reads !== undefined);
    const anyCaller = ir.meta.caller !== undefined;
    const anyConditions = operations.some((op) => op.requires !== undefined || op.ensures !== undefined || op.exactly !== undefined) || anyCaller;
    const handlers = operations.map((op) => {
      const errorTypes = op.errors.map((urn) => `s.${schemaNames(error(urn).brandIdentifier).input}`);
      // Only the events of the operation: tsc refuses another.
      const eventTypes = op.emits.map((urn) => coreEventType(event(urn)));
      return [
        docComment(`${op.urn} — ${op.description}`, op),
        `export type ${handlerName(op.brandIdentifier)} = (`,
        `  input: s.${schemaNames(entity(op.input).brandIdentifier).output},`,
        // The record that the operation changes, as stored, after the runtime checked its state.
        ...(op.changes || op.reads ? [`  current: s.${schemaNames(entity((op.changes ?? op.reads)!.entity).brandIdentifier).output},`] : []),
        `) => Result<s.${schemaNames(entity(op.output).brandIdentifier).input}, ${errorTypes.length > 0 ? errorTypes.join(' | ') : 'never'}${eventTypes.length > 0 ? `, ${eventTypes.join(' | ')}` : ''}>;`,
      ].join('\n');
    });

    const registry = [
      `export interface DomainCoreImplementation {`,
      ...operations.map((op) => `  readonly ${q(op.urn)}: ${handlerName(op.brandIdentifier)};`),
      `}`,
    ].join('\n');

    const dispatch = [
      `export interface FieldInfo {`,
      `  /** The field whose values the property holds; for a link, the linked entity's key field. */`,
      `  readonly urn: string;`,
      `  readonly primitive: ${PRIMITIVE_NAMES.map(q).join(' | ')};`,
      `  readonly required: boolean;`,
      `  /** The property holds a list of the field's values. */`,
      `  readonly many?: true;`,
      `  /** The entity that a link points at, by its key. */`,
      `  readonly link?: string;`,
      `}`,
      ``,
      `/** A property that holds an embedded entity: its properties, nested. */`,
      `export interface EmbeddedInfo {`,
      `  readonly entity: string;`,
      `  readonly required: boolean;`,
      `  readonly many?: true;`,
      `  readonly fields: Readonly<Record<string, PropertyInfo>>;`,
      `}`,
      ``,
      `export type PropertyInfo = FieldInfo | EmbeddedInfo;`,
      ``,
      `export interface InvariantInfo {`,
      `  readonly urn: string;`,
      `  /** The exported rule; an issue whose requirement is this function comes from the invariant. */`,
      `  readonly rule: unknown;`,
      `}`,
      ``,
      `export interface EntityContract {`,
      `  readonly schema: v.GenericSchema;`,
      `  /** Keyed by property name, in declaration order. */`,
      `  readonly fields: Readonly<Record<string, PropertyInfo>>;`,
      `  /** The invariants of the entity, when it has any. */`,
      `  readonly invariants?: readonly InvariantInfo[];`,
      `}`,
      ``,
      `export type ErrorCategory = ${ERROR_CATEGORIES.map(q).join(' | ')};`,
      ``,
      `/** Literal text, or a placeholder naming a property of the error. */`,
      `export type MessagePart = { readonly text: string } | { readonly field: string };`,
      ``,
      `export interface ErrorContract extends EntityContract {`,
      `  readonly category: ErrorCategory;`,
      `  readonly retryable: boolean;`,
      `  readonly message: readonly MessagePart[];`,
      `  /** The event that records the error, when it names one. */`,
      `  readonly recordAs?: EntityContract & { readonly urn: string };`,
      `}`,
      ``,
      `export interface OperationContract {`,
      `  readonly input: EntityContract;`,
      `  readonly output: EntityContract;`,
      `  /** Keyed by error URN. */`,
      `  readonly errors: Readonly<Record<string, ErrorContract>>;`,
      `  /** Keyed by event URN: the events it may return on success. */`,
      `  readonly events: Readonly<Record<string, ${anyDelivery ? 'EventContract' : 'EntityContract'}>>;`,
      ...(anyChanges ? [`  /** The record that the operation changes, when it changes one. */`, `  readonly changes?: ChangeContract;`] : []),
      ...(anyReads ? [`  /** The record that the operation reads, when it reads one. */`, `  readonly reads?: ReadContract;`] : []),
      ...(anyCaller ? [`  /** Who may call the operation. */`, `  readonly callers: CallersContract;`] : []),
      ...(anyConditions
        ? [
            `  /** Rules that must hold before the handler runs, each with the error that answers when it does not. */`,
            `  readonly requires?: readonly RequireInfo[];`,
            `  /** Rules that the answer must keep. */`,
            `  readonly ensures?: readonly ConditionInfo[];`,
            ...(anyCounts ? [`  /** The events that it emits exactly once on a success where the rule holds, and never where it does not. */`, `  readonly exactly?: readonly CountInfo[];`] : []),
          ]
        : []),
      `}`,
      ...(anyReads
        ? [``, `/** The record that an operation reads, and the error when the shell finds none. */`, `export interface ReadContract {`, `  readonly entity: EntityContract & { readonly urn: string };`, `  readonly missing?: string;`, `}`]
        : []),
      ...(anyCaller
        ? [
            ``,
            `/** Who may call an operation: any caller, or one for whom a rule holds; else the error \`otherwise\`. */`,
            `export interface CallersContract {`,
            `  readonly allow: 'any' | readonly ConditionInfo[];`,
            `  /** Absent with allow: any. */`,
            `  readonly otherwise?: string;`,
            `}`,
          ]
        : []),
      ...(anyCounts
        ? [``, `/** An event that an operation emits exactly once where its rule holds (always, without one). */`, `export interface CountInfo {`, `  readonly event: string;`, `  readonly when?: ConditionInfo;`, `}`]
        : []),
      ...(anyDelivery
        ? [
            ``,
            `/** How an event reaches a consumer: the property of its id, the properties that order it, and the one that the outbox fills. */`,
            `export interface DeliveryInfo {`,
            `  readonly id: string;`,
            `  readonly orderBy: readonly string[];`,
            `  readonly sequence?: string;`,
            `}`,
            ``,
            `export interface EventContract extends EntityContract {`,
            `  readonly delivery?: DeliveryInfo;`,
            `}`,
          ]
        : []),
      ...(anyConditions
        ? [
            ``,
            `/** A rule of a condition: its text, and the generated function that checks it. */`,
            `export interface ConditionInfo {`,
            `  readonly text: string;`,
            `  readonly check: (values: never) => boolean;`,
            ...(anyCounts ? [`  /** The rule reads the event, so the success must have one. */`, `  readonly event?: true;`] : []),
            `}`,
            ``,
            `export interface RequireInfo extends ConditionInfo {`,
            `  /** The declared error that answers when the rule does not hold. */`,
            `  readonly otherwise: string;`,
            `  /** The prefixed name that fills a property of the error; the others fill by name. */`,
            `  readonly fill?: Readonly<Record<string, string>>;`,
            `}`,
          ]
        : []),
      ...(anyChanges
        ? [
            ``,
            `/** The record that an operation changes, and the move it makes. */`,
            `export interface ChangeContract {`,
            `  readonly entity: EntityContract & { readonly urn: string };`,
            `  /** The property that holds the state. */`,
            `  readonly property: string;`,
            `  /** The states that the operation starts from. */`,
            `  readonly from: readonly string[];`,
            `  /** The states that the record can be in after the call; absent when the state stays. */`,
            `  readonly to?: readonly string[];`,
            `  /** The moves of the state field: a new state must be one of the moves of the old, or the same. */`,
            `  readonly moves: Readonly<Record<string, readonly string[]>>;`,
            `  /** The declared error for any other state. */`,
            `  readonly otherwise: string;`,
            `  /** The declared error when the shell finds no record (\\\`current: null\\\`). */`,
            `  readonly missing?: string;`,
            `  /** The property that holds the key of the record, when it has one. */`,
            `  readonly key?: string;`,
            `  /** The properties of the answer that hold the new state and the key, when the answer has them. */`,
            `  readonly answerState?: string;`,
            `  readonly answerKey?: string;`,
            `}`,
          ]
        : []),
      ``,
      `export const DispatchMap = {`,
      ...operations.flatMap((op) => [
        `  ${q(op.urn)}: {`,
        `    input: {`,
        ...entityContract(entity(op.input), ir, '      '),
        `    },`,
        `    output: {`,
        ...entityContract(entity(op.output), ir, '      '),
        `    },`,
        ...(op.errors.length === 0
          ? [`    errors: {},`]
          : [`    errors: {`, ...op.errors.flatMap((urn) => errorContract(error(urn), ir, '      ')), `    },`]),
        ...(op.emits.length === 0
          ? [`    events: {},`]
          : [`    events: {`, ...op.emits.flatMap((urn) => [`      ${q(urn)}: {`, ...eventLines(event(urn), ir, '        '), `      },`]), `    },`]),
        ...(op.changes ? changeLines(op.changes, op.output, ir, '    ') : []),
        ...(op.reads
          ? [
              `    reads: {`,
              `      entity: {`,
              `        urn: ${q(op.reads.entity)},`,
              ...entityContract(entity(op.reads.entity), ir, '        '),
              `      },`,
              ...(op.reads.missing === undefined ? [] : [`      missing: ${q(op.reads.missing)},`]),
              `    },`,
            ]
          : []),
        ...(op.callers
          ? [
              op.callers.allow === 'any'
                ? `    callers: { allow: 'any' },`
                : [
                    `    callers: {`,
                    `      allow: [`,
                    ...op.callers.allow.map((r, i) => `        { text: ${q(r.ruleText)}, check: s.${conditionName(op.brandIdentifier, 'caller', i)} },`),
                    `      ],`,
                    `      otherwise: ${q(op.callers.otherwise!)},`,
                    `    },`,
                  ].join('\n'),
            ]
          : []),
        ...(op.requires
          ? [`    requires: [`, ...op.requires.map((r, i) => `      { text: ${q(r.ruleText)}, check: s.${conditionName(op.brandIdentifier, 'requires', i)}, otherwise: ${q(r.otherwise)}${r.fill ? `, fill: { ${Object.entries(r.fill).map(([k, v]) => `${q(k)}: ${q(v)}`).join(', ')} }` : ''} },`), `    ],`]
          : []),
        ...(op.ensures
          ? [
              `    ensures: [`,
              ...op.ensures.map((r, i) => `      { text: ${q(r.ruleText)}, check: s.${conditionName(op.brandIdentifier, 'ensures', i)}${namesIn(r.rule).some((n) => n.startsWith('event.')) ? ', event: true' : ''} },`),
              `    ],`,
            ]
          : []),
        ...(op.exactly
          ? [
              `    exactly: [`,
              ...op.exactly.map((item, i) => `      { event: ${q(item.event)}${item.when ? `, when: { text: ${q(item.when.ruleText)}, check: s.${conditionName(op.brandIdentifier, 'when', i)} }` : ''} },`),
              `    ],`,
            ]
          : []),
        `  },`,
      ]),
      `} as const satisfies Readonly<Record<keyof DomainCoreImplementation, OperationContract>>;`,
      ...(anyCaller
        ? [
            ``,
            `/** Who calls, as the shell authenticated them: the caller entity of the manifest. */`,
            `export const CallerContract = {`,
            `  urn: ${q(ir.meta.caller!)},`,
            ...entityContract(entity(ir.meta.caller!), ir, '  '),
            `} as const satisfies EntityContract & { readonly urn: string };`,
          ]
        : []),
    ].join('\n');

    const sections = [
      `import * as v from 'valibot';\nimport * as s from '${schemasModule}';`,
      `// Results`,
      payloads,
      RESULTS,
      `// Handler contracts: branded input in; plain output and events, or a plain declared error, out (the shell brands them).`,
      ...handlers,
      `// Registry`,
      registry,
      `// Dispatch`,
      dispatch,
      shell(anyChanges, anyConditions, anyCounts, anyDelivery, anyReads, anyCaller).trimEnd(),
    ];
    return {
      artifacts: [{ relativePath: FCIS_RUNTIME_FILE, content: `${sections.join('\n\n')}\n` }],
      diagnostics: [],
    };
  },
};
