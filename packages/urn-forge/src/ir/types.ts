/**
 * The Universal IR, MVP subset (spec §5; scope per mvp-plan.md).
 *
 * Cut from the MVP and added back later: invariants, events, errors, lifecycle
 * metadata and `nullable`. Plain objects keyed by full URN, keys sorted, so the
 * canonical JSON and the fingerprint see one form.
 */
import type { DiagnosticCode, ManifestPath, SourceLocation } from '../diagnostics.js';
import type { ConstraintValue, Primitive } from '../primitives/index.js';

export type Urn = string & { readonly __urn: unique symbol };

export interface UniversalIR {
  readonly meta: {
    readonly namespace: string;
    readonly domain: string;
    /** Author-set semver from the manifest header. */
    readonly manifestVersion: string;
    readonly stability: 'experimental' | 'stable';
    /** SHA-256 (hex) of the canonical JSON of the validated manifest. */
    readonly manifestHash: string;
    readonly irSchemaVersion: 1;
  };
  readonly fields: Readonly<Record<Urn, IRField>>;
  readonly entities: Readonly<Record<Urn, IREntity>>;
  readonly operations: Readonly<Record<Urn, IROperation>>;
}

export interface IRField {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly primitive: Primitive;
  /** Only the constraint keys the manifest set, validated per primitive by the meta-schema. */
  readonly constraints: Readonly<Record<string, ConstraintValue>>;
  readonly description?: string;
}

export interface IRFieldRef {
  readonly field: Urn;
  /**
   * Property name of this field on the entity: the field's URN identifier
   * (`radius` for `urn:demo:math:geometry:field:radius`). Not in spec §5; added so
   * every plugin and gate reads the same name from the IR instead of re-deriving it.
   */
  readonly name: string;
  readonly required: boolean;
}

export interface IREntity {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly description: string;
  /** Declaration order preserved. */
  readonly fields: readonly IRFieldRef[];
}

export interface IROperation {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly description: string;
  /** An entity URN. Spec §5 also allows a field; the MVP accepts entities only. */
  readonly input: Urn;
  /** An entity URN. Spec §5 also allows a field; the MVP accepts entities only. */
  readonly output: Urn;
}

/** A diagnostic from passes 1–4. `urn` is set whenever the problem belongs to an atom. */
export interface IRIssue {
  readonly code: DiagnosticCode;
  readonly urn?: string;
  readonly message: string;
  /** Where in the manifest the problem is (top-level short key first). */
  readonly path?: ManifestPath;
  /** Whether the problem is the key at `path` or its value. */
  readonly target?: 'key' | 'value';
  /** Set when the issue was built from source text (`buildIrFromSource`). */
  readonly location?: SourceLocation;
}

export type IRBuildResult =
  | { readonly success: true; readonly ir: UniversalIR }
  | { readonly success: false; readonly issues: readonly IRIssue[] };
