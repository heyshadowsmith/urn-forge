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

export interface ConstraintSpec<T extends ConstraintValue = ConstraintValue> {
  /** Validates the constraint's value in the manifest (pass 1). */
  readonly schema: v.GenericSchema<unknown, T>;
}

/** A combination of constraints that no value can satisfy. */
export interface CoherenceProblem {
  /** The constraint to point the diagnostic at. */
  readonly constraint: string;
  /** Completes `<urn>: …`, e.g. `min (5) is greater than max (1)`. */
  readonly message: string;
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
  /** Pass 7: problems with the constraints a field sets. Runs after each value passed its schema. */
  readonly coherence: (constraints: Partial<ConstraintValues<C>>) => readonly CoherenceProblem[];
  /** Turns a non-empty Gherkin table cell into the value the field's schema parses. */
  readonly parseCell: (cell: string) => unknown;
}

/** Infers a descriptor's literal name and constraint types. */
export function definePrimitive<N extends string, C extends Readonly<Record<string, ConstraintSpec>>>(
  descriptor: PrimitiveDescriptor<N, C>,
): PrimitiveDescriptor<N, C> {
  return descriptor;
}
