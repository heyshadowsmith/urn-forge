/**
 * The shape of a primitive descriptor (foundations plan, phase 2).
 *
 * A descriptor holds the facts about a primitive that every part of urn-forge shares,
 * independent of any plugin: which constraints it accepts and their value schemas, which
 * combinations of constraints admit no value (pass 7), and how a Gherkin table cell
 * becomes a value. Plugin-specific translation stays in each plugin, in a table typed
 * `PrimitiveTable<…>` so `tsc` names every plugin that does not handle a primitive.
 */
import type * as v from 'valibot';

/** A JSON value, the form every constraint takes in the manifest and the IR. */
export type ConstraintValue = number | string | boolean | null | readonly ConstraintValue[];

/**
 * The aspect of a value a constraint restricts (primitives plan, "Aspects"). Each constraint
 * restricts exactly one, and a constraint name has the same aspect on every primitive.
 */
export type Aspect = 'range' | 'step' | 'size' | 'shape' | 'membership' | 'exclusion';
export const ASPECTS: readonly Aspect[] = ['range', 'step', 'size', 'shape', 'membership', 'exclusion'];

export interface ConstraintSpec<T extends ConstraintValue = ConstraintValue> {
  /** Validates the constraint's value in the manifest (pass 1). */
  readonly schema: v.GenericSchema<unknown, T>;
  readonly aspect: Aspect;
  /** A field of the primitive must set it (an `enum` must list its `values`). */
  readonly required?: boolean;
}

/**
 * Constraints of which a field may set at most one, because they restrict the same side of
 * the same aspect: `min` and `exclusiveMin` are both a lower bound.
 */
export interface ExclusiveGroup {
  readonly keys: readonly string[];
  /** Completes "… both set <what>": `a lower bound`, `the shape`. */
  readonly what: string;
}

/** A combination of constraints that no value can satisfy. */
export interface CoherenceProblem {
  /** The constraint to point the diagnostic at. */
  readonly constraint: string;
  /** Completes `<urn>: …`, e.g. `min (5) is greater than max (1)`. */
  readonly message: string;
}

/**
 * One value that boundary coverage requires a field's examples to include (spec §8, gate 3
 * check 3). Coverage only shows the case is present; the test run shows whether it passes.
 */
export interface BoundaryCase {
  /** Completes "has no …": `value at min 0`, `value below min 0`, `invalid value for regex [a-z]+`. */
  readonly label: string;
  /** Whether a value covers the case. The value is a table cell after `parseCell`. */
  readonly covers: (value: unknown) => boolean;
}

/** Each constraint key mapped to its value type. */
export type ConstraintValues<C extends Readonly<Record<string, ConstraintSpec>>> = {
  readonly [K in keyof C]: C[K] extends ConstraintSpec<infer T> ? T : never;
};

export interface PrimitiveDescriptor<
  N extends string = string,
  C extends Readonly<Record<string, ConstraintSpec>> = Readonly<Record<string, ConstraintSpec>>,
> {
  readonly name: N;
  /** Accepted constraints, in the order plugins emit them. */
  readonly constraints: C;
  /** Groups of constraints that exclude each other (`conflicting-constraints`). */
  readonly exclusive?: readonly ExclusiveGroup[];
  /** Pass 7: problems with the constraints a field sets. Runs after each value passed its schema. */
  readonly coherence: (constraints: Partial<ConstraintValues<C>>) => readonly CoherenceProblem[];
  /** Turns a non-empty Gherkin table cell into the value the field's schema parses. */
  readonly parseCell: (cell: string) => unknown;
  /** The cases boundary coverage requires for the constraints a field sets. */
  readonly boundaries: (constraints: Partial<ConstraintValues<C>>) => readonly BoundaryCase[];
}

/** Infers a descriptor's literal name and constraint types. */
export function definePrimitive<N extends string, C extends Readonly<Record<string, ConstraintSpec>>>(
  descriptor: PrimitiveDescriptor<N, C>,
): PrimitiveDescriptor<N, C> {
  return descriptor;
}
