/**
 * The Universal IR, MVP subset (spec §5; scope per mvp-plan.md).
 *
 * Cut from the MVP and added back later: invariants, events, errors, lifecycle
 * metadata and `nullable`. Plain objects keyed by full URN, keys sorted, so the
 * canonical JSON and the fingerprint see one form.
 */
import type { DiagnosticCode, ManifestPath, SourceLocation } from '../diagnostics.js';
import type { ConstraintValue, Primitive } from '../primitives/index.js';
import type { RuleExpr } from '../rules/index.js';

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
  readonly invariants: Readonly<Record<Urn, IRInvariant>>;
  readonly operations: Readonly<Record<Urn, IROperation>>;
  readonly events: Readonly<Record<Urn, IREvent>>;
  readonly errors: Readonly<Record<Urn, IRError>>;
}

/**
 * A named rule over the fields of one entity (spec §4.3). The entity does not list its
 * invariants: `invariantsOf` finds them by `on`, so the link has one place.
 */
export interface IRInvariant {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly description: string;
  readonly on: Urn;
  /** The parsed rule, without positions. */
  readonly rule: RuleExpr;
  /** The canonical text of the rule (`printRule`). */
  readonly ruleText: string;
  readonly message: string;
  readonly lifecycle?: Lifecycle;
}

/** The invariants of an entity, in URN order. */
export function invariantsOf(ir: UniversalIR, entity: Urn): IRInvariant[] {
  return Object.values(ir.invariants ?? {}).filter((i) => i.on === entity);
}

/** Where an atom is in its life (lifecycle plan). The IR has it only when the atom is not plain active. */
export interface Lifecycle {
  readonly status: 'active' | 'deprecated' | 'sunset';
  readonly supersededBy?: Urn;
  /** YYYY-MM-DD. */
  readonly sunsetDate?: string;
}

/** The status of a node: `active` when it has no lifecycle. */
export function statusOf(node: { readonly lifecycle?: Lifecycle }): Lifecycle['status'] {
  return node.lifecycle?.status ?? 'active';
}

export interface IRField {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly primitive: Primitive;
  /** Only the constraint keys the manifest set, validated per primitive by the meta-schema. */
  readonly constraints: Readonly<Record<string, ConstraintValue>>;
  readonly description?: string;
  readonly lifecycle?: Lifecycle;
}

/**
 * What one property of an entity or an error holds (structure plan): the values of a field,
 * an embedded entity, or a link to an entity (its key's value). The three forms share the
 * property name, presence and count; each form has one target.
 */
export type IRPropertyRef = IRFieldRef | IREmbedRef | IRLinkRef;

interface PropertyBase {
  /** The property name: the target's identifier, or `as` in the manifest. */
  readonly name: string;
  readonly required: boolean;
  /** Present when the property holds a list. */
  readonly many?: ListRule;
}

/** `ref: <entity>`: the property holds an object of that entity, with its invariants. */
export interface IREmbedRef extends PropertyBase {
  readonly entity: Urn;
}

/** `link: <entity>`: the property holds the value of that entity's key, with the key field's brand. */
export interface IRLinkRef extends PropertyBase {
  readonly link: Urn;
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
  /**
   * Present when the property holds a list of the field's values (primitives plan, step 10):
   * how many it may hold, and whether a value may repeat. A list is structure, so it is a
   * property of the reference, not of the field's primitive.
   */
  readonly many?: ListRule;
}

/** The item count and uniqueness of a list. `{}` is a list of any length. */
export interface ListRule {
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly unique?: boolean;
}

export interface IREntity {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly description: string;
  /** The field whose value a link to this entity holds; one of its own required, single-valued fields. */
  readonly key?: Urn;
  /** Declaration order preserved. */
  readonly fields: readonly IRPropertyRef[];
  readonly lifecycle?: Lifecycle;
}

/** The field a property's values belong to: its own field, or a linked entity's key; undefined for an embedded entity. */
export function valueField(ir: UniversalIR, ref: IRPropertyRef): Urn | undefined {
  if ('field' in ref) return ref.field;
  if ('link' in ref) return ir.entities[ref.link]?.key;
  return undefined;
}

/**
 * A fact that happened (spec §4.5): a payload with the shape of an entity, without a key.
 * Operations list events under `emits` and return them only on success.
 */
export interface IREvent {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly description: string;
  /** Declaration order preserved; may be empty. */
  readonly fields: readonly IRPropertyRef[];
  readonly lifecycle?: Lifecycle;
}

/** The five error categories of spec §4.6. Metadata for the shell; the core never reads them. */
export const ERROR_CATEGORIES = ['validation', 'conflict', 'not_found', 'forbidden', 'precondition'] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/** One part of a parsed message template: literal text, or a placeholder naming a property of the error. */
export type MessagePart = { readonly text: string } | { readonly field: string };

/** A named, URN-addressed rejection (spec §4.6): the operation was refused and nothing changed. */
export interface IRError {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly description: string;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  /** Parsed; every placeholder names a required field of this error (pass 6). */
  readonly message: readonly MessagePart[];
  /** Declaration order preserved; may be empty. */
  readonly fields: readonly IRPropertyRef[];
  /** The event that the shell may record when this error is returned (spec §4.6). */
  readonly recordAs?: Urn;
  readonly lifecycle?: Lifecycle;
}

export interface IROperation {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly description: string;
  /** An entity URN. Spec §5 also allows a field; the MVP accepts entities only. */
  readonly input: Urn;
  /** An entity URN. Spec §5 also allows a field; the MVP accepts entities only. */
  readonly output: Urn;
  /** The declared errors (error URNs), in declaration order. */
  readonly errors: readonly Urn[];
  /** The events it may return on success (event URNs), in declaration order. */
  readonly emits: readonly Urn[];
  readonly lifecycle?: Lifecycle;
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
  /** Pass 8 gives warnings too; every other issue is an error. */
  readonly severity?: 'warning';
}

export type IRBuildResult =
  | { readonly success: true; readonly ir: UniversalIR; readonly warnings?: readonly IRIssue[] }
  | { readonly success: false; readonly issues: readonly IRIssue[] };
