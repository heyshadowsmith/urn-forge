import * as v from 'valibot';
import { Description, ShortKeyRef } from '../grammar.js';
import type { IROperation, Urn } from '../ir/types.js';
import { defineKind } from './types.js';

const OperationSchema = v.strictObject({
  description: Description,
  input: ShortKeyRef,
  output: ShortKeyRef,
  /** Expected domain rejections. Absent means none. */
  errors: v.optional(v.array(ShortKeyRef)),
  /** The events produced on success. Absent means none. */
  emits: v.optional(v.array(ShortKeyRef)),
});
export type OperationDecl = v.InferOutput<typeof OperationSchema>;

/** A synchronous handler contract: an input entity in, an output entity or a declared error out. */
export const operation = defineKind<OperationDecl, IROperation>()({
  name: 'operation',
  group: 'operations',
  article: 'an',
  schema: OperationSchema,
  references: [
    { path: ['input'], targets: ['entity'] },
    { path: ['output'], targets: ['entity'] },
    { path: ['errors', '*'], targets: ['error'] },
    { path: ['emits', '*'], targets: ['event'] },
  ],
  build({ atom, shortKey, decl, ref, report }) {
    const input = ref(['input']);
    const output = ref(['output']);
    const errors: Urn[] = [];
    let resolved = true;
    (decl.errors ?? []).forEach((_, index) => {
      const target = ref(['errors', index]);
      if (!target) {
        resolved = false;
      } else if (errors.includes(target.urn)) {
        report({
          code: 'duplicate-ref',
          urn: atom.urn,
          message: `${atom.urn}: errors[${index}] lists ${target.urn} more than once`,
          path: [shortKey, 'errors', index],
        });
      } else {
        errors.push(target.urn);
      }
    });
    const emits: Urn[] = [];
    (decl.emits ?? []).forEach((_, index) => {
      const target = ref(['emits', index]);
      if (!target) {
        resolved = false;
      } else if (emits.includes(target.urn)) {
        report({ code: 'duplicate-ref', urn: atom.urn, message: `${atom.urn}: emits[${index}] lists ${target.urn} more than once`, path: [shortKey, 'emits', index] });
      } else {
        emits.push(target.urn);
      }
    });
    if (!input || !output || !resolved) return undefined;
    return {
      urn: atom.urn,
      brandIdentifier: atom.brandIdentifier,
      description: decl.description,
      input: input.urn,
      output: output.urn,
      errors,
      emits,
    };
  },
});
