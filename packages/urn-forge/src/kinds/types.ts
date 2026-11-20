/**
 * The shape of a kind descriptor (foundations plan, phase 3).
 *
 * A descriptor holds everything urn-forge knows about one kind of atom: its meta-schema
 * (pass 1), the references it makes and which kinds they may name (pass 4), and how its
 * IR node is built from a resolved entry. The IR builder runs the passes as generic loops
 * over the descriptors, so a new kind brings its own reference checking with it.
 */
import type * as v from 'valibot';
import type { ManifestPath } from '../diagnostics.js';
import type { IRIssue, Urn } from '../ir/types.js';

/** Every kind the compiler supports. The registry in index.ts must have one descriptor per name. */
export type KindName = 'field' | 'entity' | 'operation';

/** An atom after expansion (pass 2). */
export interface Atom {
  readonly urn: Urn;
  readonly kind: KindName;
  readonly context: string;
  readonly identifier: string;
  readonly brandIdentifier: string;
}

/**
 * Where an entry makes references, and what they may name. `path` is relative to the
 * entry; a `'*'` segment stands for every index of a list, e.g. `['fields', '*', 'ref']`.
 */
export interface ReferenceSlot {
  readonly path: readonly string[];
  readonly targets: readonly KindName[];
}

export interface BuildContext<D> {
  readonly atom: Atom;
  readonly shortKey: string;
  readonly decl: D;
  /** The atom a reference resolved to (pass 4), by its concrete path, e.g. `['fields', 0, 'ref']`. Undefined if it did not resolve. */
  ref(path: ManifestPath): Atom | undefined;
  /** Records a problem found while building, e.g. pass 7 or an entity's duplicate property. */
  report(issue: IRIssue): void;
}

export interface KindDescriptor<N extends KindName = KindName, D = unknown, Node = unknown, G extends string = string> {
  readonly name: N;
  /** The key that groups this kind's entries in the validated manifest and its nodes in the IR. */
  readonly group: G;
  /** For messages: "must name an entity". */
  readonly article: 'a' | 'an';
  /** Pass 1: validates one entry of this kind. */
  readonly schema: v.GenericSchema<unknown, D>;
  /** Pass 4 resolves every reference these slots find, in this order. */
  readonly references: readonly ReferenceSlot[];
  /** Builds the IR node, or returns undefined when a reference it needs did not resolve. */
  readonly build: (context: BuildContext<D>) => Node | undefined;
}

/** Use as `defineKind<Decl, Node>()({ … })`: the entry and node types are given, the name and group are inferred. */
export function defineKind<D, Node>() {
  return <const N extends KindName, const G extends string>(descriptor: KindDescriptor<N, D, Node, G>) => descriptor;
}
