import * as v from 'valibot';
import { Description, ShortKeyRef } from '../grammar.js';
import type { IRChange, IREntity, IRError, IRField, IROperation, IRRequire, IRRule, Urn } from '../ir/types.js';
import { checkRule, namesIn, parseRule, printRule, stripColumns, type RuleField } from '../rules/index.js';
import { ruleFields } from './invariant.js';
import { defineKind } from './types.js';

const OperationSchema = v.strictObject({
  description: Description,
  input: ShortKeyRef,
  output: ShortKeyRef,
  /** Expected domain rejections. Absent means none. */
  errors: v.optional(v.array(ShortKeyRef)),
  /** The events produced on success. Absent means none. */
  emits: v.optional(v.array(ShortKeyRef)),
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
    { path: ['changes', 'entity'], targets: ['entity'] },
    { path: ['changes', 'otherwise'], targets: ['error'] },
    { path: ['changes', 'missing'], targets: ['error'] },
    { path: ['requires', '*', 'otherwise'], targets: ['error'] },
  ],
  // `changes` is checked against the state field of its entity and the fields of its error.
  after: ['field', 'entity', 'error'],
  build({ atom, shortKey, decl, ref, node, report }) {
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
    (decl.emits ?? []).forEach((_, index) => {
      const target = ref(['emits', index]);
      if (!target) {
        resolved = false;
      } else if (emits.includes(target.urn)) {
        report({ code: 'duplicate-ref', urn: atom.urn, message: `${atom.urn}: emits[${index}] lists ${target.urn} more than once`, path: [shortKey, 'emits', index] });
      } else {
        emits.push(target.urn);
      }
    });
    if (!input || !output || !resolved) return undefined;
    let changes: IRChange | undefined;
    if (decl.changes) {
      changes = buildChange(decl.changes, { urn: atom.urn, shortKey, input: input.urn, errors, ref, node, report });
      if (!changes) return undefined;
    }
    const conditions = buildConditions(decl, { urn: atom.urn, shortKey, input: input.urn, output: output.urn, errors, changes, ref, node, report });
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
      ...(conditions.requires.length > 0 ? { requires: conditions.requires } : {}),
      ...(conditions.ensures.length > 0 ? { ensures: conditions.ensures } : {}),
    };
  },
});

interface ConditionContext {
  readonly urn: Urn;
  readonly shortKey: string;
  readonly input: Urn;
  readonly output: Urn;
  readonly errors: readonly Urn[];
  readonly changes: IRChange | undefined;
  readonly ref: (path: (string | number)[]) => { readonly urn: Urn } | undefined;
  readonly node: (kind: 'field' | 'entity' | 'error', urn: Urn) => unknown;
  readonly report: (issue: { code: 'invalid-condition' | 'rule-syntax' | 'unknown-rule-field' | 'rule-type' | 'unguarded-field'; urn: string; message: string; path: (string | number)[] }) => void;
}

/** Parses and types the requires and ensures rules; undefined after a problem. */
function buildConditions(decl: OperationDecl, c: ConditionContext): { requires: IRRequire[]; ensures: IRRule[] } | undefined {
  const entity = (urn: Urn) => c.node('entity', urn) as IREntity | undefined;
  const node = c.node as (kind: 'field' | 'entity', urn: Urn) => unknown;
  const [input, output, record] = [entity(c.input), entity(c.output), c.changes ? entity(c.changes.entity) : undefined];
  if (!input || !output) return undefined;
  const before: Record<string, RuleField> = { ...ruleFields(input, node, 'input.'), ...(record ? ruleFields(record, node, 'current.') : {}) };
  const after: Record<string, RuleField> = { ...before, ...ruleFields(output, node, 'output.') };
  let problems = 0;

  /** One rule: parsed, its prefixes checked, typed against the fields of its condition. */
  const rule = (text: string, fields: Record<string, RuleField>, where: (string | number)[], kind: 'requires' | 'ensures'): IRRule | undefined => {
    const fail = (code: Parameters<ConditionContext['report']>[0]['code'], message: string) => {
      problems += 1;
      c.report({ code, urn: c.urn, message: `${c.urn}: ${where.join('.')}: ${message}`, path: [c.shortKey, ...where] });
    };
    const parsed = parseRule(text);
    if (!parsed.ok) return void fail('rule-syntax', `${parsed.problem.message} (at column ${parsed.problem.column} of the rule)`);
    const before = problems;
    for (const name of namesIn(stripColumns(parsed.expr))) {
      if (name.startsWith('current.') && !c.changes) fail('invalid-condition', `"${name}" reads the record that the operation changes, but the operation has no changes`);
      else if (name.startsWith('output.') && kind === 'requires') fail('invalid-condition', `"${name}" reads the answer, which a requires rule runs before; use it in ensures`);
      else if (!/^(input|current|output)\./.test(name)) fail('invalid-condition', `"${name}" has no prefix; write input.${name}, current.${name} or output.${name}`);
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
      const from = Object.hasOwn(before, source) ? before[source] : undefined;
      if (!target) fail(`fill: "${property}" is not a property of ${error.urn} (properties: ${Object.keys(errorFields).join(', ')})`);
      else if (!from) fail(`fill.${property}: "${source}" is not a value of the request or the record (values: ${Object.keys(before).join(', ')})`);
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
    const built = rule(text, after, ['ensures', index], 'ensures');
    if (built) ensures.push(built);
  });
  return problems > 0 ? undefined : { requires, ensures };
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
