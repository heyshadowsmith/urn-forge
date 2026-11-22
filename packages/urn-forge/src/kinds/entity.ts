import * as v from 'valibot';
import { Description, ShortKeyRef } from '../grammar.js';
import type { IREntity } from '../ir/types.js';
import { FIELDS_SLOT, FieldRef, LINKS_SLOT, buildFieldRefs } from './field-refs.js';
import { defineKind } from './types.js';

const EntitySchema = v.strictObject({
  description: Description,
  /** The field whose value a link to this entity holds. */
  key: v.optional(ShortKeyRef),
  fields: v.pipe(v.array(FieldRef), v.minLength(1, 'must list at least one field')),
});
export type EntityDecl = v.InferOutput<typeof EntitySchema>;

/**
 * A named group of properties. A property holds a field's values, an embedded entity, or a
 * link to an entity. `key` names the field that identifies one object of the entity.
 */
export const entity = defineKind<EntityDecl, IREntity>()({
  name: 'entity',
  group: 'entities',
  article: 'an',
  schema: EntitySchema,
  references: [FIELDS_SLOT, LINKS_SLOT, { path: ['key'], targets: ['field'] }],
  build(context) {
    const { atom, shortKey, decl, ref, report } = context;
    const fields = buildFieldRefs(context as never, decl.fields);
    let key = undefined;
    if (decl.key !== undefined) {
      const target = ref(['key']);
      if (!target) return undefined; // pass 4 reported it
      // Pass 3: the key is one of the entity's own fields, present and single in every object.
      const property = fields.find((f) => 'field' in f && f.field === target.urn);
      const why = !property
        ? `is not a field of the entity`
        : !property.required
          ? `is optional; a key must be required`
          : property.many
            ? `is a list; a key must be one value`
            : undefined;
      if (why) {
        report({ code: 'invalid-entity-key', urn: atom.urn, message: `${atom.urn}: key ${target.urn} ${why}`, path: [shortKey, 'key'] });
        return undefined;
      }
      key = target.urn;
    }
    return {
      urn: atom.urn,
      brandIdentifier: atom.brandIdentifier,
      description: decl.description,
      ...(key === undefined ? {} : { key }),
      fields,
    };
  },
});
