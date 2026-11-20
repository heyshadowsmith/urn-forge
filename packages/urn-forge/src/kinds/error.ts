import * as v from 'valibot';
import { Description } from '../grammar.js';
import { ERROR_CATEGORIES, type IRError, type MessagePart } from '../ir/types.js';
import { FIELDS_SLOT, FieldRef, buildFieldRefs } from './field-refs.js';
import { defineKind } from './types.js';

const ErrorSchema = v.strictObject({
  description: Description,
  category: v.picklist(ERROR_CATEGORIES),
  retryable: v.boolean(),
  message: v.pipe(v.string(), v.minLength(1, 'must not be empty')),
  fields: v.optional(v.array(FieldRef), []),
  // Spec §4.6 names an event to record; it waits for the event kind (error kind plan, decision 10).
  recordAs: v.optional(v.custom<never>(() => false, 'needs the event kind, which urn-forge does not support yet')),
});
export type ErrorDecl = v.InferOutput<typeof ErrorSchema>;

/**
 * A placeholder is `{…}` with no whitespace or braces inside. `{ and }` stays text, while a
 * typo such as `{Quantity}` is still a placeholder, so pass 6 reports it instead of
 * rendering it literally.
 */
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
 * A named rejection: the operation was refused and nothing changed (spec §4.6). Its fields
 * are entity-shaped and may be empty. Its message is a template whose placeholders must
 * name required fields, so a rendered message is always complete (pass 6).
 */
export const error = defineKind<ErrorDecl, IRError>()({
  name: 'error',
  group: 'errors',
  article: 'an',
  schema: ErrorSchema,
  references: [FIELDS_SLOT],
  build(context) {
    const { atom, shortKey, decl, report } = context;
    const fields = buildFieldRefs(context as never, decl.fields);
    const message = parseMessage(decl.message);

    // Pass 6: every placeholder names a required field of this error.
    const required = fields.filter((f) => f.required).map((f) => f.name);
    for (const part of message) {
      if (!('field' in part)) continue;
      const field = fields.find((f) => f.name === part.field);
      if (!field || !field.required) {
        report({
          code: 'unknown-placeholder',
          urn: atom.urn,
          message:
            `${atom.urn}: message placeholder {${part.field}} ` +
            (field ? 'names an optional field; placeholders must name required fields' : 'names no field of the error') +
            ` (required fields: ${required.length > 0 ? required.join(', ') : 'none'})`,
          path: [shortKey, 'message'],
        });
      }
    }

    return {
      urn: atom.urn,
      brandIdentifier: atom.brandIdentifier,
      description: decl.description,
      category: decl.category,
      retryable: decl.retryable,
      message,
      fields,
    };
  },
});
