import * as v from 'valibot';
import { Description, ShortKeyRef } from '../grammar.js';
import type { IROperation } from '../ir/types.js';
import { defineKind } from './types.js';

const OperationSchema = v.strictObject({
  description: Description,
  input: ShortKeyRef,
  output: ShortKeyRef,
});
export type OperationDecl = v.InferOutput<typeof OperationSchema>;

/** A synchronous handler contract: an input entity in, an output entity out. */
export const operation = defineKind<OperationDecl, IROperation>()({
  name: 'operation',
  group: 'operations',
  article: 'an',
  schema: OperationSchema,
  references: [
    { path: ['input'], targets: ['entity'] },
    { path: ['output'], targets: ['entity'] },
  ],
  build({ atom, decl, ref }) {
    const input = ref(['input']);
    const output = ref(['output']);
    if (!input || !output) return undefined;
    return {
      urn: atom.urn,
      brandIdentifier: atom.brandIdentifier,
      description: decl.description,
      input: input.urn,
      output: output.urn,
    };
  },
});
