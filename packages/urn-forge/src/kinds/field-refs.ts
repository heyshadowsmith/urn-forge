/**
 * Property references, shared by every kind with an entity-shaped payload (entities and
 * errors): `ref` to a field or an entity (embedded), or `link` to an entity (its key's value).
 */
import * as v from 'valibot';
import { Segment, ShortKeyRef } from '../grammar.js';
import type { IRPropertyRef, ListRule, Urn } from '../ir/types.js';
import type { BoundaryCase } from '../primitives/index.js';
import type { BuildContext, ReferenceSlot } from './types.js';

const Count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

/** `many: true` or `many: { minItems?, maxItems?, unique? }`: the property holds a list. */
const Many = v.union(
  [v.literal(true), v.strictObject({ minItems: v.optional(Count), maxItems: v.optional(Count), unique: v.optional(v.boolean()) })],
  'must be true or { minItems, maxItems, unique }',
);

export const FieldRef = v.pipe(
  v.strictObject({
    /** A field (one value) or an entity (an embedded object). */
    ref: v.optional(ShortKeyRef),
    /** An entity, by the value of its key. */
    link: v.optional(ShortKeyRef),
    /** The property name, when it is not the target's identifier. */
    as: v.optional(Segment),
    required: v.optional(v.boolean(), true),
    many: v.optional(Many),
  }),
  v.check((decl) => (decl.ref === undefined) !== (decl.link === undefined), 'must have either ref or link'),
);
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

/** The reference slots of a `fields` list: `ref` names a field or an entity, `link` an entity. */
export const FIELDS_SLOT: ReferenceSlot = { path: ['fields', '*', 'ref'], targets: ['field', 'entity'] };
export const LINKS_SLOT: ReferenceSlot = { path: ['fields', '*', 'link'], targets: ['entity'] };

/**
 * The resolved field references of `fields`, in declaration order. Reports a field listed
 * twice (`duplicate-ref`) and two fields that become the same property (`duplicate-property`).
 */
export function buildFieldRefs(context: BuildContext<unknown>, fields: readonly FieldRefDecl[]): IRPropertyRef[] {
  const { atom, shortKey, ref, report } = context;
  const refs: IRPropertyRef[] = [];
  const seenNames = new Map<string, Urn>();
  fields.forEach((fieldRef, index) => {
    const slot = fieldRef.link === undefined ? 'ref' : 'link';
    const target = ref(['fields', index, slot]);
    if (!target) return;
    const path = [shortKey, 'fields', index, slot];
    const name = fieldRef.as ?? target.identifier;
    const clash = seenNames.get(name);
    if (clash === target.urn) {
      report({
        code: 'duplicate-ref',
        urn: atom.urn,
        message: `${atom.urn}: fields[${index}].${slot} lists ${target.urn} more than once; give one of them another name with as`,
        path,
      });
    } else if (clash) {
      report({
        code: 'duplicate-property',
        urn: atom.urn,
        message: `${atom.urn}: fields[${index}].${slot} ${target.urn} and ${clash} both become property "${name}"; rename one with as`,
        path,
      });
    } else {
      seenNames.set(name, target.urn);
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
      const base = { name, required: fieldRef.required, ...(many === undefined ? {} : { many }) };
      refs.push(slot === 'link' ? { link: target.urn, ...base } : target.kind === 'entity' ? { entity: target.urn, ...base } : { field: target.urn, ...base });
    }
  });
  return refs;
}

/**
 * Boundary cases of a list (gate 3, primitives plan step 10): the item counts at and just
 * outside `minItems` and `maxItems`, and a repeated value for `unique`. The items count as
 * values of the field for its own cases.
 */
export function listBoundaries(rule: ListRule, key?: string): BoundaryCase[] {
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
    // A list of objects repeats when two of them have one key.
    const values = (list: readonly unknown[]) => (key === undefined ? list : list.map((item) => (item as Record<string, unknown> | null)?.[key]));
    cases.push({
      label: key === undefined ? 'list with a repeated value (unique)' : `list with a repeated ${key} (unique)`,
      covers: (value) => isList(value) && new Set(values(value)).size < value.length,
    });
  }
  return cases;
}

/** The property that an error or an event payload uses for its URN, so no field of either may have this name. */
export const RESERVED_PROPERTY = 'kind';

/** Reports each property of an error or an event that would be named `kind` (spec §7.1). */
export function checkReservedProperty(
  context: { readonly atom: { readonly urn: string }; readonly shortKey: string; ref(path: readonly (string | number)[]): { readonly identifier: string } | undefined; report(issue: never): void },
  decl: { readonly fields: readonly FieldRefDecl[] },
  what: 'an error' | 'an event',
): void {
  const { atom, shortKey } = context;
  decl.fields.forEach((fieldRef, index) => {
    const slot = fieldRef.link !== undefined ? 'link' : 'ref';
    // The property name is `as`, or the identifier of what the reference names.
    const name = fieldRef.as ?? context.ref(['fields', index, slot])?.identifier;
    if (name !== RESERVED_PROPERTY) return;
    const by = fieldRef.as !== undefined ? 'as' : slot;
    context.report({
      code: 'reserved-property',
      urn: atom.urn,
      message: `${atom.urn}: fields[${index}] becomes property "${RESERVED_PROPERTY}", which ${what} reserves for its URN; ${by === 'as' ? 'choose another name with as' : 'give it another name with as'}`,
      path: [shortKey, 'fields', index, by],
    } as never);
  });
}
