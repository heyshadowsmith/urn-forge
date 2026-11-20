/**
 * Compilation pass 1: the manifest meta-schema (spec §4, §7 pass 1; MVP scope per mvp-plan.md).
 *
 * Validates the manifest header, the short-key grammar (`<context>.<kind>.<identifier>`),
 * the three MVP kinds (`field`, `entity`, `operation`), the three MVP primitives
 * (`integer`, `float`, `string`) and which constraint keys each primitive accepts.
 *
 * It checks structure only. Expanding short keys to URNs, uniqueness and reference
 * resolution are later passes (src/ir/).
 */
import * as v from 'valibot';
import { parseDocument } from 'yaml';

// ---------------------------------------------------------------------------
// Grammar
// ---------------------------------------------------------------------------

/** Every non-kind URN segment: lowercase snake_case, starts with a letter, at most 63 chars (spec §3). */
export const SEGMENT_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

/** Kinds the MVP supports. The spec's other kinds are rejected with a "not supported yet" message. */
export const MVP_KINDS = ['field', 'entity', 'operation'] as const;
export type MvpKind = (typeof MVP_KINDS)[number];

/** Kinds that exist in spec v1.1 but are cut from the MVP. */
const DEFERRED_KINDS = ['invariant', 'event', 'error'] as const;

export const MVP_PRIMITIVES = ['float', 'integer', 'string'] as const;
export type MvpPrimitive = (typeof MVP_PRIMITIVES)[number];

/** Constraint keys accepted by each primitive. */
export const CONSTRAINTS_BY_PRIMITIVE = {
  float: ['min', 'max', 'notEqual'],
  integer: ['min', 'max', 'notEqual'],
  string: ['minLength', 'maxLength'],
} as const satisfies Record<MvpPrimitive, readonly string[]>;

const SHORT_KEY_PATTERN = /^([a-z][a-z0-9_]{0,62})\.([a-z]+)\.([a-z][a-z0-9_]{0,62})$/;

export interface ShortKey {
  readonly context: string;
  readonly kind: MvpKind;
  readonly identifier: string;
}

const Segment = v.pipe(
  v.string(),
  v.regex(SEGMENT_PATTERN, 'must be lowercase snake_case, start with a letter and be at most 63 characters'),
);

/** A short key naming any MVP atom, used for references (`ref`, `input`, `output`). */
const ShortKeyRef = v.pipe(
  v.string(),
  v.regex(SHORT_KEY_PATTERN, 'must be a short key of the form <context>.<kind>.<identifier> in snake_case'),
);

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const HeaderSchema = v.strictObject({
  namespace: Segment,
  domain: Segment,
  version: v.pipe(v.string(), v.regex(SEMVER_PATTERN, 'must be a semver version such as 0.1.0')),
  stability: v.optional(v.picklist(['experimental', 'stable'])),
});
export type ManifestHeader = v.InferOutput<typeof HeaderSchema>;

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

const Description = v.pipe(v.string(), v.minLength(1, 'must not be empty'));
const FiniteNumber = v.pipe(v.number(), v.finite());
const SafeInteger = v.pipe(v.number(), v.safeInteger());
const Length = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

const FloatField = v.strictObject({
  primitive: v.literal('float'),
  description: v.optional(Description),
  min: v.optional(FiniteNumber),
  max: v.optional(FiniteNumber),
  notEqual: v.optional(FiniteNumber),
});

const IntegerField = v.strictObject({
  primitive: v.literal('integer'),
  description: v.optional(Description),
  min: v.optional(SafeInteger),
  max: v.optional(SafeInteger),
  notEqual: v.optional(SafeInteger),
});

const StringField = v.strictObject({
  primitive: v.literal('string'),
  description: v.optional(Description),
  minLength: v.optional(Length),
  maxLength: v.optional(Length),
});

export const FieldSchema = v.variant('primitive', [FloatField, IntegerField, StringField]);
export type FieldDecl = v.InferOutput<typeof FieldSchema>;

const FieldRef = v.strictObject({
  ref: ShortKeyRef,
  required: v.optional(v.boolean(), true),
});

export const EntitySchema = v.strictObject({
  description: Description,
  fields: v.pipe(v.array(FieldRef), v.minLength(1, 'must list at least one field')),
});
export type EntityDecl = v.InferOutput<typeof EntitySchema>;

export const OperationSchema = v.strictObject({
  description: Description,
  input: ShortKeyRef,
  output: ShortKeyRef,
});
export type OperationDecl = v.InferOutput<typeof OperationSchema>;

const SCHEMA_BY_KIND = {
  field: FieldSchema,
  entity: EntitySchema,
  operation: OperationSchema,
} as const;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** One meta-schema problem. `key` is the top-level manifest key (`manifest` for the header). */
export interface ManifestIssue {
  readonly key: string;
  /** Dot path inside the entry, e.g. `fields.0.ref`; empty when the problem is the entry itself. */
  readonly path: string;
  readonly message: string;
}

/** A structurally valid manifest, grouped by kind. Keys are still short keys, in declaration order. */
export interface ValidManifest {
  readonly header: ManifestHeader;
  readonly fields: Readonly<Record<string, FieldDecl>>;
  readonly entities: Readonly<Record<string, EntityDecl>>;
  readonly operations: Readonly<Record<string, OperationDecl>>;
}

export type MetaSchemaResult =
  | { readonly success: true; readonly manifest: ValidManifest }
  | { readonly success: false; readonly issues: readonly ManifestIssue[] };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Splits a top-level key into its segments, or explains why it is not a valid MVP short key. */
export function parseShortKey(key: string): { ok: true; value: ShortKey } | { ok: false; message: string } {
  const match = SHORT_KEY_PATTERN.exec(key);
  if (!match) {
    return {
      ok: false,
      message:
        `invalid key "${key}": expected <context>.<kind>.<identifier>, ` +
        'where context and identifier are lowercase snake_case starting with a letter (max 63 characters)',
    };
  }
  const [, context, kind, identifier] = match as unknown as [string, string, string, string];
  if ((DEFERRED_KINDS as readonly string[]).includes(kind)) {
    return {
      ok: false,
      message: `invalid key "${key}": kind "${kind}" is not supported yet (MVP kinds: ${MVP_KINDS.join(', ')})`,
    };
  }
  if (!(MVP_KINDS as readonly string[]).includes(kind)) {
    return {
      ok: false,
      message: `invalid key "${key}": unknown kind "${kind}" (MVP kinds: ${MVP_KINDS.join(', ')})`,
    };
  }
  return { ok: true, value: { context, kind: kind as MvpKind, identifier } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeIssue(key: string, entry: unknown, issue: v.BaseIssue<unknown>): ManifestIssue {
  const path = v.getDotPath(issue) ?? '';
  const prefix = path ? `${key}.${path}` : key;
  const primitive = isPlainObject(entry) ? entry['primitive'] : undefined;
  const unknownKey = issue.type === 'strict_object' && issue.expected === 'never';

  let message: string;
  if (issue.type === 'variant' && path === 'primitive') {
    message =
      `${prefix}: unknown primitive ${issue.received} ` +
      `(MVP primitives: ${MVP_PRIMITIVES.join(', ')})`;
  } else if (unknownKey && typeof primitive === 'string' && primitive in CONSTRAINTS_BY_PRIMITIVE) {
    const allowed = CONSTRAINTS_BY_PRIMITIVE[primitive as MvpPrimitive];
    message =
      `${prefix}: "${path}" is not a constraint of primitive "${primitive}" ` +
      `(allowed: ${allowed.join(', ')})`;
  } else if (unknownKey) {
    message = `${prefix}: unknown property "${path.split('.').at(-1) ?? path}"`;
  } else {
    message = `${prefix}: ${issue.message}`;
  }
  return { key, path, message };
}

function collect(key: string, schema: v.GenericSchema, entry: unknown, issues: ManifestIssue[]): unknown {
  const result = v.safeParse(schema, entry);
  if (result.success) return result.output;
  for (const issue of result.issues) issues.push(describeIssue(key, entry, issue));
  return undefined;
}

/** Runs the meta-schema over an already-parsed YAML document. */
export function validateManifest(doc: unknown): MetaSchemaResult {
  if (!isPlainObject(doc)) {
    return { success: false, issues: [{ key: '', path: '', message: 'manifest must be a YAML mapping' }] };
  }

  const issues: ManifestIssue[] = [];
  const fields: Record<string, FieldDecl> = {};
  const entities: Record<string, EntityDecl> = {};
  const operations: Record<string, OperationDecl> = {};

  let header: ManifestHeader | undefined;
  if (!('manifest' in doc)) {
    issues.push({ key: 'manifest', path: '', message: 'manifest: missing header (namespace, domain, version)' });
  } else {
    header = collect('manifest', HeaderSchema, doc['manifest'], issues) as ManifestHeader | undefined;
  }

  for (const [key, entry] of Object.entries(doc)) {
    if (key === 'manifest') continue;
    const parsed = parseShortKey(key);
    if (!parsed.ok) {
      issues.push({ key, path: '', message: parsed.message });
      continue;
    }
    const kind = parsed.value.kind;
    const output = collect(key, SCHEMA_BY_KIND[kind], entry, issues);
    if (output === undefined) continue;
    if (kind === 'field') fields[key] = output as FieldDecl;
    else if (kind === 'entity') entities[key] = output as EntityDecl;
    else operations[key] = output as OperationDecl;
  }

  if (issues.length > 0 || header === undefined) return { success: false, issues };
  return { success: true, manifest: { header, fields, entities, operations } };
}

/** Parses manifest YAML source and runs the meta-schema. YAML syntax errors (including duplicate keys) are issues too. */
export function parseManifest(source: string): MetaSchemaResult {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length > 0) {
    return {
      success: false,
      issues: document.errors.map((error) => ({ key: '', path: '', message: `YAML: ${error.message}` })),
    };
  }
  return validateManifest(document.toJS());
}
