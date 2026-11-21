/** Field references, shared by every kind with an entity-shaped payload (entities and errors). */
import * as v from 'valibot';
import { ShortKeyRef } from '../grammar.js';
import type { IRFieldRef, ListRule, Urn } from '../ir/types.js';
import type { BoundaryCase } from '../primitives/index.js';
import type { BuildContext, ReferenceSlot } from './types.js';

const Count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

/** `many: true` or `many: { minItems?, maxItems?, unique? }`: the property holds a list. */
const Many = v.union(
  [v.literal(true), v.strictObject({ minItems: v.optional(Count), maxItems: v.optional(Count), unique: v.optional(v.boolean()) })],
  'must be true or { minItems, maxItems, unique }',
);

export const FieldRef = v.strictObject({
  ref: ShortKeyRef,
  required: v.optional(v.boolean(), true),
  many: v.optional(Many),
});
export type FieldRefDecl = v.InferOutput<typeof FieldRef>;

/** The IR form of `many`: `true` is `{}`, and absent keys stay absent. */
function listRule(many: FieldRefDecl['many']): ListRule | undefined {
  if (many === undefined) return undefined;
  if (many === true) return {};
  return {
    ...(many.minItems === undefined ? {} : { minItems: many.minItems }),
    ...(many.maxItems === undefined ? {} : { maxItems: many.maxItems }),
    ...(many.unique === undefined ? {} : { unique: many.unique }),
  };
}

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
      const many = listRule(fieldRef.many);
      // Pass 7 for a list: an item count that no list can have.
      if (many?.minItems !== undefined && many.maxItems !== undefined && many.minItems > many.maxItems) {
        report({
          code: 'incoherent-constraints',
          urn: atom.urn,
          message: `${atom.urn}: fields[${index}] minItems (${many.minItems}) is greater than maxItems (${many.maxItems}), so no list is valid`,
          path: [shortKey, 'fields', index, 'many'],
        });
      }
      refs.push({ field: target.urn, name: target.identifier, required: fieldRef.required, ...(many === undefined ? {} : { many }) });
    }
  });
  return refs;
}

/**
 * Boundary cases of a list (gate 3, primitives plan step 10): the item counts at and just
 * outside `minItems` and `maxItems`, and a repeated value for `unique`. The items count as
 * values of the field for its own cases.
 */
export function listBoundaries(rule: ListRule): BoundaryCase[] {
  const isList = (value: unknown): value is readonly unknown[] => Array.isArray(value);
  const ofLength = (n: number) => (value: unknown) => isList(value) && value.length === n;
  const cases: BoundaryCase[] = [];
  if (rule.minItems !== undefined) {
    cases.push({ label: `list of ${rule.minItems} item(s) (minItems)`, covers: ofLength(rule.minItems) });
    if (rule.minItems > 0) cases.push({ label: `list of ${rule.minItems - 1} item(s) (below minItems)`, covers: ofLength(rule.minItems - 1) });
  }
  if (rule.maxItems !== undefined) {
    cases.push({ label: `list of ${rule.maxItems} item(s) (maxItems)`, covers: ofLength(rule.maxItems) });
    cases.push({ label: `list of ${rule.maxItems + 1} item(s) (above maxItems)`, covers: ofLength(rule.maxItems + 1) });
  }
  if (rule.unique) {
    cases.push({ label: 'list with a repeated value (unique)', covers: (value) => isList(value) && new Set(value).size < value.length });
  }
  return cases;
}
