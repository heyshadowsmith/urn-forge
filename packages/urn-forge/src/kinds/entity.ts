import * as v from 'valibot';
import { Description } from '../grammar.js';
import type { IREntity } from '../ir/types.js';
import { FIELDS_SLOT, FieldRef, buildFieldRefs } from './field-refs.js';
import { defineKind } from './types.js';

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
  references: [FIELDS_SLOT],
  build(context) {
    const { atom, decl } = context;
    const fields = buildFieldRefs(context as never, decl.fields);
    return { urn: atom.urn, brandIdentifier: atom.brandIdentifier, description: decl.description, fields };
  },
});
