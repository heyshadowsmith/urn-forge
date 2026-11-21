import * as v from 'valibot';
import { Description } from '../grammar.js';
import type { IREvent } from '../ir/types.js';
import { FIELDS_SLOT, FieldRef, LINKS_SLOT, buildFieldRefs, checkReservedProperty } from './field-refs.js';
import { defineKind } from './types.js';

const EventSchema = v.strictObject({
  description: Description,
  fields: v.optional(v.array(FieldRef), []),
});
export type EventDecl = v.InferOutput<typeof EventSchema>;

/**
 * A fact that happened (spec §4.5; events plan): a named payload, declared like an entity,
 * that operations return on success when they list it under `emits`. An event never
 * describes a refusal. Its payload carries `kind: '<event URN>'`, as an error's does.
 */
export const event = defineKind<EventDecl, IREvent>()({
  name: 'event',
  group: 'events',
  article: 'an',
  schema: EventSchema,
  references: [FIELDS_SLOT, LINKS_SLOT],
  build(context) {
    const { atom, decl } = context;
    const fields = buildFieldRefs(context as never, decl.fields);
    checkReservedProperty(context as never, decl, 'an event');
    return { urn: atom.urn, brandIdentifier: atom.brandIdentifier, description: decl.description, fields };
  },
});
