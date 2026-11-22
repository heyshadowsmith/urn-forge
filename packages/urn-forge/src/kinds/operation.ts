import * as v from 'valibot';
import { Description, ShortKeyRef } from '../grammar.js';
import type { IRCallers, IRChange, IREmitRule, IREntity, IRError, IREvent, IRField, IROperation, IRRead, IRRequire, IRRule, Urn } from '../ir/types.js';
import { checkRule, namesIn, parseRule, printRule, stripColumns, TIME_NAMES, type RuleField } from '../rules/index.js';
import { ruleFields } from './invariant.js';
import { defineKind } from './types.js';

const OperationSchema = v.strictObject({
  description: Description,
  input: ShortKeyRef,
  output: ShortKeyRef,
  /** Expected domain rejections. Absent means none. */
  errors: v.optional(v.array(ShortKeyRef)),
  /**
   * The events produced on success. Absent means none. A short key: zero or more of it.
   * `{ event, when }`: exactly one on each success where the rule holds, and none where it does not.
   */
  emits: v.optional(v.array(v.union([ShortKeyRef, v.strictObject({ event: ShortKeyRef, when: v.optional(v.string()) })]))),
  /** The stored record that the operation changes, and the move it makes. */
  changes: v.optional(
    v.strictObject({
      entity: ShortKeyRef,
      from: v.pipe(v.array(v.string()), v.minLength(1, 'must list at least one state')),
      to: v.optional(v.union([v.string(), v.pipe(v.array(v.string()), v.minLength(1, 'must list at least one state'))])),
      otherwise: ShortKeyRef,
      missing: v.optional(ShortKeyRef),
    }),
  ),
  /** The stored record that the operation reads, without a change of state. */
  reads: v.optional(v.strictObject({ entity: ShortKeyRef, missing: v.optional(ShortKeyRef) })),
  /** Who may call: any caller, or one for whom a rule holds; else the error `otherwise`. */
  callers: v.optional(
    v.strictObject({
      allow: v.union([v.literal('any'), v.pipe(v.array(v.string()), v.minLength(1, 'must list at least one rule, or be any'))]),
      /** The error for a caller that no rule allows; not with allow: any, which refuses no caller. */
      otherwise: v.optional(ShortKeyRef),
    }),
  ),
  /** Rules over the request and the record that must hold before the handler runs, each with the error that answers when it does not. */
  requires: v.optional(v.array(v.strictObject({ rule: v.string(), otherwise: ShortKeyRef, fill: v.optional(v.record(v.string(), v.string())) }))),
  /** Rules over the request, the record and the answer that the answer must keep. */
  ensures: v.optional(v.array(v.string())),
});
export type OperationDecl = v.InferOutput<typeof OperationSchema>;

/** A synchronous handler contract: an input entity in, an output entity or a declared error out. */
export const operation = defineKind<OperationDecl, IROperation>()({
  name: 'operation',
  group: 'operations',
  article: 'an',
  schema: OperationSchema,
  references: [
    { path: ['input'], targets: ['entity'] },
    { path: ['output'], targets: ['entity'] },
    { path: ['errors', '*'], targets: ['error'] },
    { path: ['emits', '*'], targets: ['event'] },
    { path: ['emits', '*', 'event'], targets: ['event'] },
    { path: ['changes', 'entity'], targets: ['entity'] },
    { path: ['changes', 'otherwise'], targets: ['error'] },
    { path: ['changes', 'missing'], targets: ['error'] },
    { path: ['requires', '*', 'otherwise'], targets: ['error'] },
    { path: ['reads', 'entity'], targets: ['entity'] },
    { path: ['reads', 'missing'], targets: ['error'] },
    { path: ['callers', 'otherwise'], targets: ['error'] },
  ],
  // `changes` is checked against the state field of its entity and the fields of its error.
  after: ['field', 'entity', 'error', 'event'],
  build({ atom, shortKey, decl, ref, node, report, caller }) {
    const input = ref(['input']);
    const output = ref(['output']);
    const errors: Urn[] = [];
    let resolved = true;
    (decl.errors ?? []).forEach((_, index) => {
      const target = ref(['errors', index]);
      if (!target) {
        resolved = false;
      } else if (errors.includes(target.urn)) {
        report({
          code: 'duplicate-ref',
          urn: atom.urn,
          message: `${atom.urn}: errors[${index}] lists ${target.urn} more than once`,
          path: [shortKey, 'errors', index],
        });
      } else {
        errors.push(target.urn);
      }
    });
    const emits: Urn[] = [];
    const counted: CountedEmit[] = [];
    (decl.emits ?? []).forEach((item, index) => {
      const target = ref(typeof item === 'string' ? ['emits', index] : ['emits', index, 'event']);
      if (!target) {
        resolved = false;
      } else if (emits.includes(target.urn)) {
        report({ code: 'duplicate-ref', urn: atom.urn, message: `${atom.urn}: emits[${index}] lists ${target.urn} more than once`, path: [shortKey, 'emits', index] });
      } else {
        emits.push(target.urn);
        if (typeof item !== 'string') counted.push({ event: target.urn, index, ...(item.when === undefined ? {} : { when: item.when }) });
      }
    });
    const countsAll = (decl.emits ?? []).length > 0 && counted.length === (decl.emits ?? []).length;
    if (!input || !output || !resolved) return undefined;
    let changes: IRChange | undefined;
    if (decl.changes) {
      changes = buildChange(decl.changes, { urn: atom.urn, shortKey, input: input.urn, errors, ref, node, report });
      if (!changes) return undefined;
    }
    let reads: IRRead | undefined;
    if (decl.reads) {
      reads = buildRead(decl.reads, { urn: atom.urn, shortKey, input: input.urn, errors, changes, ref, node, report });
      if (!reads) return undefined;
    }
    const record = changes?.entity ?? reads?.entity;
    const conditions = buildConditions(decl, { urn: atom.urn, shortKey, input: input.urn, output: output.urn, errors, changes, record, caller, counted, countsAll, ref, node, report });
    if (!conditions) return undefined;
    return {
      urn: atom.urn,
      brandIdentifier: atom.brandIdentifier,
      description: decl.description,
      input: input.urn,
      output: output.urn,
      errors,
      emits,
      ...(changes ? { changes } : {}),
      ...(reads ? { reads } : {}),
      ...(conditions.callers ? { callers: conditions.callers } : {}),
      ...(conditions.requires.length > 0 ? { requires: conditions.requires } : {}),
      ...(conditions.ensures.length > 0 ? { ensures: conditions.ensures } : {}),
      ...(conditions.exactly.length > 0 ? { exactly: conditions.exactly } : {}),
    };
  },
});

/** An item of emits in the form { event, when }: the event, where it is, and its rule. */
interface CountedEmit {
  readonly event: Urn;
  readonly index: number;
  readonly when?: string;
}

interface ConditionContext {
  readonly urn: Urn;
  readonly shortKey: string;
  readonly input: Urn;
  readonly output: Urn;
  readonly errors: readonly Urn[];
  readonly changes: IRChange | undefined;
  /** The entity of the record that the operation changes or reads, which `current.` names. */
  readonly record: Urn | undefined;
  /** The caller entity of the manifest header, which `caller.` names. */
  readonly caller: Urn | undefined;
  readonly counted: readonly CountedEmit[];
  /** Each item of emits has the form { event }, so a success has at most one event of each, and `event.` can name their common properties. */
  readonly countsAll: boolean;
  readonly ref: (path: (string | number)[]) => { readonly urn: Urn } | undefined;
  readonly node: (kind: 'field' | 'entity' | 'error' | 'event', urn: Urn) => unknown;
  readonly report: (issue: { code: 'invalid-condition' | 'invalid-callers' | 'rule-syntax' | 'unknown-rule-field' | 'rule-type' | 'unguarded-field'; urn: string; message: string; path: (string | number)[] }) => void;
}

/** Parses and types the requires and ensures rules; undefined after a problem. */
function buildConditions(decl: OperationDecl, c: ConditionContext): { requires: IRRequire[]; ensures: IRRule[]; exactly: IREmitRule[]; callers?: IRCallers } | undefined {
  const entity = (urn: Urn) => c.node('entity', urn) as IREntity | undefined;
  const node = c.node as (kind: 'field' | 'entity', urn: Urn) => unknown;
  const [input, output, record] = [entity(c.input), entity(c.output), c.record ? entity(c.record) : undefined];
  const callerEntity = c.caller ? entity(c.caller) : undefined;
  if (!input || !output) return undefined;
  // The time of the call, which the shell gives: now, and its UTC date.
  const time: Record<string, RuleField> = { now: { primitive: 'timestamp', required: true, many: false }, today: { primitive: 'date', required: true, many: false } };
  // The values that fill a refusal: the request and the record, not the time.
  const stored: Record<string, RuleField> = { ...ruleFields(input, node, 'input.'), ...(record ? ruleFields(record, node, 'current.') : {}) };
  const before: Record<string, RuleField> = { ...stored, ...time };
  const after: Record<string, RuleField> = { ...before, ...ruleFields(output, node, 'output.') };
  // `event.`: the properties that every counted event has, with one primitive and count.
  const events = c.counted.map((item) => c.node('event', item.event) as IREvent | undefined);
  let eventFields: Record<string, RuleField> | undefined;
  if (c.countsAll && events.every((e) => e !== undefined)) {
    const each = events.map((e) => ruleFields(e as unknown as IREntity, node, 'event.'));
    eventFields = Object.fromEntries(
      Object.entries(each[0]!).filter(([name, field]) => each.every((f) => Object.hasOwn(f, name) && f[name]!.primitive === field.primitive && f[name]!.many === field.many && f[name]!.required === field.required)),
    );
  }
  let problems = 0;

  /** One rule: parsed, its prefixes checked, typed against the fields of its condition. */
  const rule = (text: string, fields: Record<string, RuleField>, where: (string | number)[], kind: 'requires' | 'ensures' | 'when' | 'callers'): IRRule | undefined => {
    const fail = (code: Parameters<ConditionContext['report']>[0]['code'], message: string) => {
      problems += 1;
      const at = code === 'invalid-condition' && kind === 'callers' ? 'invalid-callers' : code;
      c.report({ code: at, urn: c.urn, message: `${c.urn}: ${where.join('.')}: ${message}`, path: [c.shortKey, ...where] });
    };
    const parsed = parseRule(text);
    if (!parsed.ok) return void fail('rule-syntax', `${parsed.problem.message} (at column ${parsed.problem.column} of the rule)`);
    const before = problems;
    for (const name of namesIn(stripColumns(parsed.expr))) {
      if (name.startsWith('current.') && !c.record) fail('invalid-condition', `"${name}" reads the record that the operation changes or reads, but the operation has no changes or reads`);
      else if (name.startsWith('caller.') && kind !== 'callers') fail('invalid-condition', `"${name}" reads the caller, which only a rule of callers can`);
      else if (kind === 'callers' && (name.startsWith('output.') || name.startsWith('event.'))) fail('invalid-condition', `"${name}" reads the answer, which a rule of callers runs before`);
      else if (name.startsWith('output.') && kind === 'requires') fail('invalid-condition', `"${name}" reads the answer, which a requires rule runs before; use it in ensures`);
      else if (name.startsWith('event.') && kind !== 'ensures') fail('invalid-condition', `"${name}" reads the event, which only an ensures rule can`);
      else if (name.startsWith('event.') && !eventFields) fail('invalid-condition', `"${name}" reads the event, so each item of emits must have the form { event } or { event, when }`);
      else if (!/^(input|current|output|event|caller)\./.test(name) && !TIME_NAMES.includes(name)) fail('invalid-condition', `"${name}" has no prefix; write input.${name}, current.${name} or output.${name}`);
    }
    if (problems > before) return undefined;
    for (const problem of checkRule(parsed.expr, fields, 'the condition')) fail(problem.code, `${problem.message} (at column ${problem.column} of the rule)`);
    if (problems > before) return undefined;
    const expr = stripColumns(parsed.expr);
    return { rule: expr, ruleText: printRule(expr) };
  };

  const requires: IRRequire[] = [];
  (decl.requires ?? []).forEach((entry, index) => {
    const built = rule(entry.rule, before, ['requires', index, 'rule'], 'requires');
    const target = c.ref(['requires', index, 'otherwise']);
    const error = target && (c.node('error', target.urn) as IRError | undefined);
    if (!built || !error) return;
    const at = ['requires', index, 'otherwise'];
    const fail = (message: string) => {
      problems += 1;
      c.report({ code: 'invalid-condition', urn: c.urn, message: `${c.urn}: ${at.join('.')}: ${message}`, path: [c.shortKey, ...at] });
    };
    if (!c.errors.includes(error.urn)) fail(`${error.urn} is not one of the errors of the operation; add it to errors`);
    // `fill`: a property of the error, from a value of the request or the record of the same primitive.
    const fill = entry.fill ?? {};
    const errorFields = ruleFields(error as unknown as IREntity, node);
    for (const [property, source] of Object.entries(fill)) {
      const target = Object.hasOwn(errorFields, property) ? errorFields[property] : undefined;
      const from = Object.hasOwn(stored, source) ? stored[source] : undefined;
      if (!target) fail(`fill: "${property}" is not a property of ${error.urn} (properties: ${Object.keys(errorFields).join(', ')})`);
      else if (!from) fail(`fill.${property}: "${source}" is not a value of the request or the record (values: ${Object.keys(stored).join(', ')})`);
      else if (from.primitive !== target.primitive || from.many !== target.many) fail(`fill.${property}: "${source}" is ${from.primitive}${from.many ? ' (a list)' : ''}, but ${property} is ${target.primitive}${target.many ? ' (a list)' : ''}`);
    }
    // The other properties are filled by name, from the request and the record.
    const known = new Set([...input.fields, ...(record?.fields ?? [])].map((p) => p.name));
    for (const property of error.fields) {
      if (property.required && !Object.hasOwn(fill, property.name) && !known.has(property.name)) {
        fail(`${error.urn} needs ${property.name}, which neither the input nor the record has; give it with fill`);
      }
    }
    requires.push({ ...built, otherwise: error.urn, ...(Object.keys(fill).length > 0 ? { fill } : {}) });
  });
  const ensures: IRRule[] = [];
  (decl.ensures ?? []).forEach((text, index) => {
    const built = rule(text, { ...after, ...eventFields }, ['ensures', index], 'ensures');
    if (built) ensures.push(built);
  });
  // A `when` rule reads what an ensures rule reads, except the event.
  const exactly: IREmitRule[] = [];
  for (const item of c.counted) {
    if (item.when === undefined) {
      exactly.push({ event: item.event });
      continue;
    }
    const built = rule(item.when, after, ['emits', item.index, 'when'], 'when');
    if (built) exactly.push({ event: item.event, when: built });
  }
  // callers: required once the header names a caller; each rule reads the caller, the request and the record.
  let callers: IRCallers | undefined;
  const callersAt = ['callers'];
  const callersProblem = (message: string, ...path: (string | number)[]) => {
    problems += 1;
    c.report({ code: 'invalid-callers', urn: c.urn, message: `${c.urn}: ${message}`, path: [c.shortKey, ...callersAt, ...path] });
  };
  if (!decl.callers && c.caller) {
    problems += 1;
    c.report({ code: 'invalid-callers', urn: c.urn, message: `${c.urn}: states no callers, but the manifest names the caller ${c.caller}; add callers, with allow: any for every caller`, path: [c.shortKey] });
  } else if (decl.callers && !c.caller) {
    callersProblem('callers: the manifest header names no caller; add caller: <entity> to it');
  } else if (decl.callers && callerEntity && decl.callers.allow === 'any') {
    if (decl.callers.otherwise !== undefined) callersProblem('callers.otherwise: allow: any refuses no caller, so leave out otherwise', 'otherwise');
    else callers = { allow: 'any' };
  } else if (decl.callers && callerEntity && decl.callers.otherwise === undefined) {
    callersProblem('callers.otherwise: name the declared error for a caller that no rule allows', 'allow');
  } else if (decl.callers && callerEntity) {
    const target = c.ref(['callers', 'otherwise']);
    const error = target && (c.node('error', target.urn) as IRError | undefined);
    const fields = { ...before, ...ruleFields(callerEntity, node, 'caller.') };
    const allow = decl.callers.allow === 'any' ? 'any' : decl.callers.allow.map((text, index) => rule(text, fields, ['callers', 'allow', index], 'callers'));
    if (error) {
      if (!c.errors.includes(error.urn)) callersProblem(`callers.otherwise: ${error.urn} is not one of the errors of the operation; add it to errors`, 'otherwise');
      // The runtime fills the error by name, from the caller, the record and the request.
      const known = new Set([...input.fields, ...(record?.fields ?? []), ...callerEntity.fields].map((p) => p.name));
      for (const property of error.fields) {
        if (property.required && !known.has(property.name)) callersProblem(`callers.otherwise: ${error.urn} needs ${property.name}, which neither the caller, the input nor the record has`, 'otherwise');
      }
      if (allow === 'any' || allow.every((r) => r !== undefined)) callers = { allow: allow as IRCallers['allow'], otherwise: error.urn };
    }
  }
  return problems > 0 ? undefined : { requires, ensures, exactly, ...(callers ? { callers } : {}) };
}

interface ChangeContext {
  readonly urn: Urn;
  readonly shortKey: string;
  readonly input: Urn;
  readonly errors: readonly Urn[];
  readonly ref: (path: (string | number)[]) => { readonly urn: Urn } | undefined;
  readonly node: (kind: 'field' | 'entity' | 'error', urn: Urn) => unknown;
  readonly report: (issue: { code: 'invalid-changes'; urn: string; message: string; path: (string | number)[] }) => void;
}

/** Checks `changes` against its entity, the moves of the state field, and its error; undefined after a problem. */
function buildChange(decl: NonNullable<OperationDecl['changes']>, c: ChangeContext): IRChange | undefined {
  const at = (...path: (string | number)[]) => [c.shortKey, 'changes', ...path];
  let problems = 0;
  const problem = (message: string, ...path: (string | number)[]) => {
    problems += 1;
    c.report({ code: 'invalid-changes', urn: c.urn, message: `${c.urn}: changes: ${message}`, path: at(...path) });
  };
  const entityAtom = c.ref(['changes', 'entity']);
  const otherwiseAtom = c.ref(['changes', 'otherwise']);
  const missingAtom = decl.missing === undefined ? undefined : c.ref(['changes', 'missing']);
  if (decl.missing !== undefined && !missingAtom) return undefined; // pass 4 reported the reference
  const missing = missingAtom && (c.node('error', missingAtom.urn) as IRError | undefined);
  const entity = entityAtom && (c.node('entity', entityAtom.urn) as IREntity | undefined);
  const error = otherwiseAtom && (c.node('error', otherwiseAtom.urn) as IRError | undefined);
  if (!entity || !error) return undefined; // pass 4 reported the reference

  // The state: the one property of the entity whose field has moves.
  const states = entity.fields.flatMap((property) => {
    const field = 'field' in property ? (c.node('field', property.field) as IRField | undefined) : undefined;
    return field?.moves ? [{ property, field }] : [];
  });
  if (states.length === 0) {
    problem(`${entity.urn} has no state: give one of its enum fields moves`, 'entity');
    return undefined;
  }
  if (states.length > 1) {
    problem(`${entity.urn} has more than one state (${states.map((s) => s.property.name).join(', ')}); keep moves on one field`, 'entity');
    return undefined;
  }
  const { property, field } = states[0]!;
  if (!property.required || property.many) problem(`${entity.urn} holds its state in ${property.name}, which must be required and hold one value`, 'entity');
  const values = (field.constraints['values'] as readonly string[] | undefined) ?? [];
  const moves = field.moves!;
  decl.from.forEach((state, index) => {
    if (!values.includes(state)) problem(`from: "${state}" is not a state of ${field.urn} (${values.join(', ')})`, 'from', index);
    else if (decl.from.indexOf(state) !== index) problem(`from lists "${state}" more than once`, 'from', index);
  });
  // `to`: one state or a list. Staying in a state is not a move, so a `from` state may be in `to`.
  const to = decl.to === undefined ? undefined : typeof decl.to === 'string' ? [decl.to] : decl.to;
  const reaches = (from: string, target: string) => from === target || (moves[from] ?? []).includes(target);
  if (to !== undefined) {
    to.forEach((target, index) => {
      const at = typeof decl.to === 'string' ? ['to'] : ['to', index];
      if (!values.includes(target)) problem(`to: "${target}" is not a state of ${field.urn} (${values.join(', ')})`, ...at);
      else if (to.indexOf(target) !== index) problem(`to lists "${target}" more than once`, ...at);
      // With one state in `to`, the check of each `from` state below says the same.
      else if (to.length > 1 && !decl.from.some((state) => values.includes(state) && reaches(state, target))) {
        problem(`no state of from (${decl.from.join(', ')}) can move to ${target}: ${field.urn} has no such move`, ...at);
      }
    });
    for (const state of decl.from) {
      if (values.includes(state) && to.every((target) => values.includes(target)) && !to.some((target) => reaches(state, target))) {
        problem(`${state} cannot move to ${to.join(' or ')}: ${field.urn} has no such move`, 'to');
      }
    }
  }
  if (!c.errors.includes(error.urn)) problem(`otherwise: ${error.urn} is not one of the errors of the operation; add it to errors`, 'otherwise');
  // The runtime fills the error from the record and the request, by property name.
  const input = c.node('entity', c.input) as IREntity | undefined;
  const known = new Set([...entity.fields, ...(input?.fields ?? [])].map((p) => p.name));
  for (const errorProperty of error.fields) {
    if (errorProperty.required && !known.has(errorProperty.name)) {
      problem(`otherwise: ${error.urn} needs ${errorProperty.name}, which neither ${entity.urn} nor the input has`, 'otherwise');
    }
  }
  // With no record, the runtime fills the missing error from the request only.
  if (missing) {
    if (!c.errors.includes(missing.urn)) problem(`missing: ${missing.urn} is not one of the errors of the operation; add it to errors`, 'missing');
    const inputNames = new Set((input?.fields ?? []).map((p) => p.name));
    for (const errorProperty of missing.fields) {
      if (errorProperty.required && !inputNames.has(errorProperty.name)) {
        problem(`missing: ${missing.urn} needs ${errorProperty.name}, which the input does not have`, 'missing');
      }
    }
  }
  if (problems > 0) return undefined;
  return {
    entity: entity.urn,
    property: property.name,
    from: decl.from,
    ...(to === undefined ? {} : { to }),
    otherwise: error.urn,
    ...(missing ? { missing: missing.urn } : {}),
  };
}

interface ReadContext {
  readonly urn: Urn;
  readonly shortKey: string;
  readonly input: Urn;
  readonly errors: readonly Urn[];
  readonly changes: IRChange | undefined;
  readonly ref: (path: (string | number)[]) => { readonly urn: Urn } | undefined;
  readonly node: (kind: 'field' | 'entity' | 'error', urn: Urn) => unknown;
  readonly report: (issue: { code: 'invalid-reads'; urn: string; message: string; path: (string | number)[] }) => void;
}

/** Checks `reads`: its entity, and its missing error, which the request alone must fill; undefined after a problem. */
function buildRead(decl: NonNullable<OperationDecl['reads']>, c: ReadContext): IRRead | undefined {
  let problems = 0;
  const problem = (message: string, ...path: (string | number)[]) => {
    problems += 1;
    c.report({ code: 'invalid-reads', urn: c.urn, message: `${c.urn}: reads: ${message}`, path: [c.shortKey, 'reads', ...path] });
  };
  const entityAtom = c.ref(['reads', 'entity']);
  const missingAtom = decl.missing === undefined ? undefined : c.ref(['reads', 'missing']);
  if (!entityAtom || (decl.missing !== undefined && !missingAtom)) return undefined; // pass 4 reported the reference
  if (c.changes) problem('the operation also changes a record; changes gives it as current, so leave out reads');
  const missing = missingAtom && (c.node('error', missingAtom.urn) as IRError | undefined);
  if (missing) {
    if (!c.errors.includes(missing.urn)) problem(`missing: ${missing.urn} is not one of the errors of the operation; add it to errors`, 'missing');
    const input = c.node('entity', c.input) as IREntity | undefined;
    const names = new Set((input?.fields ?? []).map((p) => p.name));
    for (const property of missing.fields) {
      if (property.required && !names.has(property.name)) problem(`missing: ${missing.urn} needs ${property.name}, which the input does not have`, 'missing');
    }
  }
  if (problems > 0) return undefined;
  return { entity: entityAtom.urn, ...(missing ? { missing: missing.urn } : {}) };
}
