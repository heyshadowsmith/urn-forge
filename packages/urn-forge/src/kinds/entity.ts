import * as v from 'valibot';
import { Description, ShortKeyRef } from '../grammar.js';
import type { IREntity, IRUnique } from '../ir/types.js';

/** An entry of unique before the rule `when` is typed, which needs every node: the build of the IR finishes it. */
export type IRUniqueDraft = Omit<IRUnique, 'when'> & { readonly whenText?: string };
import { FIELDS_SLOT, FieldRef, LINKS_SLOT, buildFieldRefs } from './field-refs.js';
import { defineKind } from './types.js';

const EntitySchema = v.strictObject({
  description: Description,
  /** The field whose value a link to this entity holds. */
  key: v.optional(ShortKeyRef),
  fields: v.pipe(v.array(FieldRef), v.minLength(1, 'must list at least one field')),
  /**
   * Values that no two stored records share: the properties `by`, among the records where `when`
   * holds, else the declared error `otherwise`; with `forever`, also not with a record that is gone.
   */
  unique: v.optional(
    v.array(
      v.strictObject({
        by: v.pipe(v.array(v.string()), v.minLength(1, 'must list at least one property')),
        when: v.optional(v.string()),
        otherwise: v.optional(ShortKeyRef),
        forever: v.optional(v.literal(true, 'must be true, or left out')),
      }),
    ),
  ),
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
  references: [FIELDS_SLOT, LINKS_SLOT, { path: ['key'], targets: ['field'] }, { path: ['unique', '*', 'otherwise'], targets: ['error'] }],
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
    // unique: the properties are values of the entity's own; the rule `when` and the error are checked once every node exists.
    const unique: IRUniqueDraft[] = [];
    let problems = 0;
    (decl.unique ?? []).forEach((entry, index) => {
      const fail = (message: string, ...path: (string | number)[]) => {
        problems += 1;
        report({ code: 'invalid-unique', urn: atom.urn, message: `${atom.urn}: unique.${index}: ${message}`, path: [shortKey, 'unique', index, ...path] });
      };
      entry.by.forEach((name, i) => {
        const property = fields.find((f) => f.name === name);
        if (!property) fail(`by: "${name}" is not a property of the entity (properties: ${fields.map((f) => f.name).join(', ')})`, 'by', i);
        else if ('entity' in property || property.many) fail(`by: "${name}" holds ${property.many ? 'a list' : 'an entity'}; a unique value is one value of a field or a link`, 'by', i);
        else if (entry.by.indexOf(name) !== i) fail(`by lists "${name}" more than once`, 'by', i);
      });
      if (entry.forever && entry.when !== undefined) fail('forever: a value used once is used for good, so a forever entry has no when', 'forever');
      if (entry.forever && entry.otherwise !== undefined) fail('forever: a value used again is a bug of the domain that gives it, not a refusal, so a forever entry has no otherwise', 'otherwise');
      const otherwise = entry.otherwise === undefined ? undefined : ref(['unique', index, 'otherwise']);
      if (entry.otherwise !== undefined && !otherwise) return; // pass 4 reported it
      unique.push({ by: entry.by, ...(entry.when === undefined ? {} : { whenText: entry.when }), ...(otherwise ? { otherwise: otherwise.urn } : {}), ...(entry.forever ? { forever: true } : {}) });
    });
    if (problems > 0) return undefined;
    return {
      urn: atom.urn,
      brandIdentifier: atom.brandIdentifier,
      description: decl.description,
      ...(key === undefined ? {} : { key }),
      fields,
      ...(unique.length > 0 ? { unique: unique as unknown as readonly IRUnique[] } : {}),
    };
  },
});
