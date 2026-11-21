import * as v from 'valibot';
import { Description } from '../grammar.js';
import type { IRField } from '../ir/types.js';
import {
  PRIMITIVES,
  checkCoherence,
  type ConstraintValue,
  type Primitive,
  type PrimitiveDescriptor,
} from '../primitives/index.js';
import { defineKind } from './types.js';

/** A field entry: its primitive, an optional description, and the constraints it sets. */
export interface FieldDecl {
  readonly primitive: Primitive;
  readonly description?: string;
  readonly [constraint: string]: ConstraintValue | undefined;
}

/** `{ primitive, description?, <each constraint>? }` for one primitive, built from its descriptor. */
function fieldSchemaFor(descriptor: PrimitiveDescriptor) {
  return v.strictObject({
    primitive: v.literal(descriptor.name),
    description: v.optional(Description),
    ...Object.fromEntries(
      Object.entries(descriptor.constraints).map(([key, spec]) => [key, spec.required ? spec.schema : v.optional(spec.schema)]),
    ),
  });
}

const FieldSchema = v.variant(
  'primitive',
  Object.values(PRIMITIVES).map(fieldSchemaFor) as [ReturnType<typeof fieldSchemaFor>],
) as unknown as v.GenericSchema<unknown, FieldDecl>;

/** One value, typed by a primitive from the registry and narrowed by its constraints. */
export const field = defineKind<FieldDecl, IRField>()({
  name: 'field',
  group: 'fields',
  article: 'a',
  schema: FieldSchema,
  references: [],
  build({ atom, shortKey, decl, report }) {
    const { primitive, description, ...rest } = decl;
    const constraints = rest as Record<string, ConstraintValue>;
    // Two constraints for one side of one aspect (`min` and `exclusiveMin`): one must go.
    let conflicting = false;
    for (const group of (PRIMITIVES[primitive] as PrimitiveDescriptor).exclusive ?? []) {
      const set = group.keys.filter((key) => constraints[key] !== undefined);
      if (set.length < 2) continue;
      conflicting = true;
      report({
        code: 'conflicting-constraints',
        urn: atom.urn,
        message: `${atom.urn}: ${set.join(' and ')} both set ${group.what}; keep one`,
        path: [shortKey, set[1]!],
      });
    }
    // Pass 7: constraint coherence, checked by the primitive's descriptor.
    for (const problem of conflicting ? [] : checkCoherence(primitive, constraints)) {
      report({
        code: 'incoherent-constraints',
        urn: atom.urn,
        message: `${atom.urn}: ${problem.message}`,
        path: [shortKey, problem.constraint],
      });
    }
    return {
      urn: atom.urn,
      brandIdentifier: atom.brandIdentifier,
      primitive,
      constraints,
      ...(description === undefined ? {} : { description }),
    };
  },
});
