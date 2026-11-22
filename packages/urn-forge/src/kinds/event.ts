import * as v from 'valibot';
import { Description } from '../grammar.js';
import type { IREvent } from '../ir/types.js';
import { FIELDS_SLOT, FieldRef, LINKS_SLOT, buildFieldRefs, checkReservedProperty } from './field-refs.js';
import { defineKind } from './types.js';

const EventSchema = v.strictObject({
  description: Description,
  fields: v.optional(v.array(FieldRef), []),
  /** How the event reaches a consumer: its id, the properties that order it, and the sequence that the outbox fills. */
  delivery: v.optional(
    v.strictObject({
      id: v.string(),
      orderBy: v.union([v.string(), v.pipe(v.array(v.string()), v.minLength(1, 'must list at least one property'))]),
      sequence: v.optional(v.string()),
    }),
  ),
});
export type EventDecl = v.InferOutput<typeof EventSchema>;

/**
 * A fact that happened: a named payload, declared like an entity,
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
    const delivery = decl.delivery && {
      id: decl.delivery.id,
      orderBy: typeof decl.delivery.orderBy === 'string' ? [decl.delivery.orderBy] : decl.delivery.orderBy,
      ...(decl.delivery.sequence === undefined ? {} : { sequence: decl.delivery.sequence }),
    };
    return { urn: atom.urn, brandIdentifier: atom.brandIdentifier, description: decl.description, fields, ...(delivery ? { delivery } : {}) };
  },
});
