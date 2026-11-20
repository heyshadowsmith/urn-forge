import * as v from 'valibot';
import { Description, ShortKeyRef } from '../grammar.js';
import type { IREntity, IRFieldRef, Urn } from '../ir/types.js';
import { defineKind } from './types.js';

const FieldRef = v.strictObject({
  ref: ShortKeyRef,
  required: v.optional(v.boolean(), true),
});

const EntitySchema = v.strictObject({
  description: Description,
  fields: v.pipe(v.array(FieldRef), v.minLength(1, 'must list at least one field')),
});
export type EntityDecl = v.InferOutput<typeof EntitySchema>;

/** A named group of fields. Each field becomes a property named by its identifier. */
export const entity = defineKind<EntityDecl, IREntity>()({
  name: 'entity',
  group: 'entities',
  article: 'an',
  schema: EntitySchema,
  references: [{ path: ['fields', '*', 'ref'], targets: ['field'] }],
  build({ atom, shortKey, decl, ref, report }) {
    const fields: IRFieldRef[] = [];
    const seenNames = new Map<string, Urn>();
    decl.fields.forEach((fieldRef, index) => {
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
        fields.push({ field: target.urn, name: target.identifier, required: fieldRef.required });
      }
    });
    return { urn: atom.urn, brandIdentifier: atom.brandIdentifier, description: decl.description, fields };
  },
});
