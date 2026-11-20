/** Field references, shared by every kind with an entity-shaped payload (entities and errors). */
import * as v from 'valibot';
import { ShortKeyRef } from '../grammar.js';
import type { IRFieldRef, Urn } from '../ir/types.js';
import type { BuildContext, ReferenceSlot } from './types.js';

export const FieldRef = v.strictObject({
  ref: ShortKeyRef,
  required: v.optional(v.boolean(), true),
});
export type FieldRefDecl = v.InferOutput<typeof FieldRef>;

/** The reference slot for a `fields` list. */
export const FIELDS_SLOT: ReferenceSlot = { path: ['fields', '*', 'ref'], targets: ['field'] };

/**
 * The resolved field references of `fields`, in declaration order. Reports a field listed
 * twice (`duplicate-ref`) and two fields that become the same property (`duplicate-property`).
 */
export function buildFieldRefs(context: BuildContext<unknown>, fields: readonly FieldRefDecl[]): IRFieldRef[] {
  const { atom, shortKey, ref, report } = context;
  const refs: IRFieldRef[] = [];
  const seenNames = new Map<string, Urn>();
  fields.forEach((fieldRef, index) => {
    const target = ref(['fields', index, 'ref']);
    if (!target) return;
    const path = [shortKey, 'fields', index, 'ref'];
    const clash = seenNames.get(target.identifier);
    if (clash === target.urn) {
      report({
        code: 'duplicate-ref',
        urn: atom.urn,
        message: `${atom.urn}: fields[${index}].ref lists ${target.urn} more than once`,
        path,
      });
    } else if (clash) {
      report({
        code: 'duplicate-property',
        urn: atom.urn,
        message: `${atom.urn}: fields[${index}].ref ${target.urn} and ${clash} both become property "${target.identifier}"`,
        path,
      });
    } else {
      seenNames.set(target.identifier, target.urn);
      refs.push({ field: target.urn, name: target.identifier, required: fieldRef.required });
    }
  });
  return refs;
}
