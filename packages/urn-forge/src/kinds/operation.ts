import * as v from 'valibot';
import { Description, ShortKeyRef } from '../grammar.js';
import type { IRChange, IREntity, IRError, IRField, IROperation, Urn } from '../ir/types.js';
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
      to: v.optional(v.string()),
      otherwise: ShortKeyRef,
    }),
  ),
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
    return {
      urn: atom.urn,
      brandIdentifier: atom.brandIdentifier,
      description: decl.description,
      input: input.urn,
      output: output.urn,
      errors,
      emits,
      ...(changes ? { changes } : {}),
    };
  },
});

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
  if (decl.to !== undefined) {
    if (!values.includes(decl.to)) problem(`to: "${decl.to}" is not a state of ${field.urn} (${values.join(', ')})`, 'to');
    else
      for (const state of decl.from) {
        if (values.includes(state) && !(moves[state] ?? []).includes(decl.to)) {
          problem(`${state} cannot move to ${decl.to}: ${field.urn} has no such move`, 'to');
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
  if (problems > 0) return undefined;
  return {
    entity: entity.urn,
    property: property.name,
    from: decl.from,
    ...(decl.to === undefined ? {} : { to: decl.to }),
    otherwise: error.urn,
  };
}
