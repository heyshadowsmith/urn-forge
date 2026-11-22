import * as v from 'valibot';
import { Description, ShortKeyRef } from '../grammar.js';
import { ERROR_CATEGORIES, type IREvent, type IRError, type IRPropertyRef, type MessagePart } from '../ir/types.js';
import { FIELDS_SLOT, FieldRef, LINKS_SLOT, RESERVED_PROPERTY, buildFieldRefs, checkReservedProperty } from './field-refs.js';
import { defineKind } from './types.js';

const ErrorSchema = v.strictObject({
  description: Description,
  category: v.picklist(ERROR_CATEGORIES),
  retryable: v.boolean(),
  message: v.pipe(v.string(), v.minLength(1, 'must not be empty')),
  fields: v.optional(v.array(FieldRef), []),
  /** An event that the shell may record when this error is returned, for an audit trail. */
  recordAs: v.optional(ShortKeyRef),
});
export type ErrorDecl = v.InferOutput<typeof ErrorSchema>;

/**
 * A placeholder is `{…}` with no whitespace or braces inside. `{ and }` stays text, while a
 * typo such as `{Quantity}` is still a placeholder, so pass 6 reports it instead of
 * rendering it literally.
 */
export { RESERVED_PROPERTY };

const PLACEHOLDER = /\{([^{}\s]+)\}/g;

/** `Policy {policy_id} is cancelled` → text, placeholder `policy_id`, text. */
export function parseMessage(template: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    if (match.index > last) parts.push({ text: template.slice(last, match.index) });
    parts.push({ field: match[1]! });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push({ text: template.slice(last) });
  return parts;
}

/**
 * A named rejection: the operation was refused and nothing changed. Its fields
 * are entity-shaped and may be empty. Its message is a template whose placeholders must
 * name required fields, so a rendered message is always complete (pass 6).
 */
export const error = defineKind<ErrorDecl, IRError>()({
  name: 'error',
  group: 'errors',
  article: 'an',
  schema: ErrorSchema,
  references: [FIELDS_SLOT, LINKS_SLOT, { path: ['recordAs'], targets: ['event'] }],
  // recordAs reads the event's properties (pass 6).
  after: ['event'],
  build(context) {
    const { atom, shortKey, decl, report } = context;
    const fields = buildFieldRefs(context as never, decl.fields);
    const message = parseMessage(decl.message);

    // The payload carries `kind: '<error URN>'`, so no field may become `kind`.
    checkReservedProperty(context as never, decl, 'an error');

    // Pass 6: every placeholder names a required field of this error.
    const required = fields.filter((f) => f.required).map((f) => f.name);
    for (const part of message) {
      if (!('field' in part)) continue;
      const field = fields.find((f) => f.name === part.field);
      if (!field || !field.required || field.many || 'entity' in field) {
        report({
          code: 'unknown-placeholder',
          urn: atom.urn,
          message:
            `${atom.urn}: message placeholder {${part.field}} ` +
            (!field
              ? 'names no field of the error'
              : field.many
                ? 'names a list; placeholders must name single values'
                : 'entity' in field
                  ? 'names an embedded entity; placeholders must name single values'
                : 'names an optional field; placeholders must name required fields') +
            ` (required fields: ${required.length > 0 ? required.join(', ') : 'none'})`,
          path: [shortKey, 'message'],
        });
      }
    }

    // Pass 6: the runtime builds the recordAs event from the error's fields, so the event has
    // each property of the error, with the same target, and any other property is optional.
    let recordAs: IRError['recordAs'];
    if (decl.recordAs !== undefined) {
      const target = context.ref(['recordAs']);
      const event = target && (context.node('event', target.urn) as IREvent | undefined);
      if (!event) return undefined; // pass 4 reported it, or the event did not build
      const problem = recordAsProblem(fields, event.fields);
      if (problem) {
        report({ code: 'invalid-record-as', urn: atom.urn, message: `${atom.urn}: recordAs ${event.urn} ${problem}`, path: [shortKey, 'recordAs'] });
        return undefined;
      }
      recordAs = event.urn;
    }

    return {
      urn: atom.urn,
      brandIdentifier: atom.brandIdentifier,
      description: decl.description,
      category: decl.category,
      retryable: decl.retryable,
      message,
      fields,
      ...(recordAs === undefined ? {} : { recordAs }),
    };
  },
});

/** The target of a property, for a comparison: `ref <urn>`, `link <urn>`. */
const targetOf = (p: IRPropertyRef) => ('field' in p ? `ref ${p.field}` : 'link' in p ? `link ${p.link}` : `ref ${p.entity}`);

/** Why an event cannot record an error, or undefined when it can. */
function recordAsProblem(error: readonly IRPropertyRef[], event: readonly IRPropertyRef[]): string | undefined {
  for (const p of error) {
    const q = event.find((e) => e.name === p.name);
    if (!q) return `has no property "${p.name}", which the error has`;
    if (targetOf(q) !== targetOf(p) || JSON.stringify(q.many) !== JSON.stringify(p.many) || q.required !== p.required) {
      return `has a property "${p.name}" that differs from the error's; it must have the same target, presence and count`;
    }
  }
  const extra = event.find((q) => q.required && !error.some((p) => p.name === q.name));
  if (extra) return `has the required property "${extra.name}", which the error does not have; make it optional, so the error's fields can build the event`;
  return undefined;
}
