/**
 * The primitive registry. To add a primitive: write its descriptor module and add it
 * here. Every consumer that must handle each primitive declares a table typed
 * `{ readonly [P in Primitive]: … }` (the Valibot plugin's translations, for example), so
 * `tsc` then names each place that does not handle the new primitive yet.
 */
import { boolean } from './boolean.js';
import { float } from './float.js';
import { integer } from './integer.js';
import { string } from './string.js';
import type { CoherenceProblem, ConstraintValue, ConstraintValues, PrimitiveDescriptor } from './types.js';

/** In the order diagnostics list them. */
export const PRIMITIVES = { boolean, float, integer, string } as const;

export type Primitive = keyof typeof PRIMITIVES;
export const PRIMITIVE_NAMES = Object.keys(PRIMITIVES) as Primitive[];

/** The constraint keys a primitive accepts. */
export type ConstraintKey<P extends Primitive> = keyof (typeof PRIMITIVES)[P]['constraints'] & string;

/** The constraints a field of primitive `P` sets, with their value types. */
export type ConstraintsOf<P extends Primitive> = Partial<ConstraintValues<(typeof PRIMITIVES)[P]['constraints']>>;

export function isPrimitive(name: string): name is Primitive {
  return Object.hasOwn(PRIMITIVES, name);
}

/** Constraint keys of a primitive, in emission order. */
export function constraintKeys(primitive: Primitive): readonly string[] {
  return Object.keys(PRIMITIVES[primitive].constraints);
}

/** Pass 7 for one field, dispatched to its primitive's descriptor. */
export function checkCoherence(
  primitive: Primitive,
  constraints: Readonly<Record<string, ConstraintValue>>,
): readonly CoherenceProblem[] {
  const descriptor: PrimitiveDescriptor = PRIMITIVES[primitive] as PrimitiveDescriptor;
  return descriptor.coherence(constraints);
}

/** A non-empty Gherkin table cell as the value a field of `primitive` parses. */
export function parseCell(primitive: Primitive, cell: string): unknown {
  return PRIMITIVES[primitive].parseCell(cell);
}

export type { ConstraintValue };
export * from './types.js';
