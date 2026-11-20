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
import { LineCounter, parseDocument } from 'yaml';
import {
  ManifestLocator,
  type DiagnosticCode,
  type ManifestPath,
  type SourceLocation,
} from './diagnostics.js';

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

/** One meta-schema problem. */
export interface ManifestIssue {
  readonly code: DiagnosticCode;
  readonly message: string;
  /** Where the problem is: the top-level key (`manifest` for the header), then the path inside the entry. */
  readonly path: ManifestPath;
  /** Whether the problem is the key at `path` (an unknown property, a bad short key) or its value. */
  readonly target: 'key' | 'value';
  /** The atom's URN, when the header and the short key are both valid. */
  readonly urn?: string;
  /** Set by `parseManifest`, which has the source text. */
  readonly location?: SourceLocation;
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

/** `parseManifest` also returns a locator, which later passes use to place their diagnostics. */
export type ParsedManifest =
  | { readonly success: true; readonly manifest: ValidManifest; readonly locator: ManifestLocator }
  | { readonly success: false; readonly issues: readonly ManifestIssue[] };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Splits a top-level key into its segments, or explains why it is not a valid MVP short key. */
export function parseShortKey(
  key: string,
): { ok: true; value: ShortKey } | { ok: false; code: DiagnosticCode; message: string } {
  const match = SHORT_KEY_PATTERN.exec(key);
  if (!match) {
    return {
      ok: false,
      code: 'invalid-key',
      message:
        `invalid key "${key}": expected <context>.<kind>.<identifier>, ` +
        'where context and identifier are lowercase snake_case starting with a letter (max 63 characters)',
    };
  }
  const [, context, kind, identifier] = match as unknown as [string, string, string, string];
  if ((DEFERRED_KINDS as readonly string[]).includes(kind)) {
    return {
      ok: false,
      code: 'unsupported-kind',
      message: `invalid key "${key}": kind "${kind}" is not supported yet (MVP kinds: ${MVP_KINDS.join(', ')})`,
    };
  }
  if (!(MVP_KINDS as readonly string[]).includes(kind)) {
    return {
      ok: false,
      code: 'unknown-kind',
      message: `invalid key "${key}": unknown kind "${kind}" (MVP kinds: ${MVP_KINDS.join(', ')})`,
    };
  }
  return { ok: true, value: { context, kind: kind as MvpKind, identifier } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeIssue(key: string, entry: unknown, issue: v.BaseIssue<unknown>, urn: string | undefined): ManifestIssue {
  const dotPath = v.getDotPath(issue) ?? '';
  const prefix = dotPath ? `${key}.${dotPath}` : key;
  const path: ManifestPath = [key, ...(issue.path ?? []).map((item) => item.key as string | number)];
  const primitive = isPlainObject(entry) ? entry['primitive'] : undefined;
  const unknownKey = issue.type === 'strict_object' && issue.expected === 'never';
  const at = (code: DiagnosticCode, message: string, target: 'key' | 'value' = 'value'): ManifestIssue => ({
    code,
    message,
    path,
    target,
    ...(urn === undefined ? {} : { urn }),
  });

  if (issue.type === 'variant' && dotPath === 'primitive') {
    return at(
      'unknown-primitive',
      `${prefix}: unknown primitive ${issue.received} (MVP primitives: ${MVP_PRIMITIVES.join(', ')})`,
    );
  }
  if (unknownKey && typeof primitive === 'string' && primitive in CONSTRAINTS_BY_PRIMITIVE) {
    const allowed = CONSTRAINTS_BY_PRIMITIVE[primitive as MvpPrimitive];
    return at(
      'constraint-not-allowed',
      `${prefix}: "${dotPath}" is not a constraint of primitive "${primitive}" (allowed: ${allowed.join(', ')})`,
      'key',
    );
  }
  if (unknownKey) {
    return at('unknown-property', `${prefix}: unknown property "${dotPath.split('.').at(-1) ?? dotPath}"`, 'key');
  }
  return at('invalid-value', `${prefix}: ${issue.message}`);
}

function collect(
  key: string,
  schema: v.GenericSchema,
  entry: unknown,
  issues: ManifestIssue[],
  urn?: string,
): unknown {
  const result = v.safeParse(schema, entry);
  if (result.success) return result.output;
  for (const issue of result.issues) issues.push(describeIssue(key, entry, issue, urn));
  return undefined;
}

/** Runs the meta-schema over an already-parsed YAML document. */
export function validateManifest(doc: unknown): MetaSchemaResult {
  if (!isPlainObject(doc)) {
    return {
      success: false,
      issues: [{ code: 'not-a-mapping', message: 'manifest must be a YAML mapping', path: [], target: 'value' }],
    };
  }

  const issues: ManifestIssue[] = [];
  const fields: Record<string, FieldDecl> = {};
  const entities: Record<string, EntityDecl> = {};
  const operations: Record<string, OperationDecl> = {};

  let header: ManifestHeader | undefined;
  if (!('manifest' in doc)) {
    issues.push({
      code: 'missing-header',
      message: 'manifest: missing header (namespace, domain, version)',
      path: [],
      target: 'value',
    });
  } else {
    header = collect('manifest', HeaderSchema, doc['manifest'], issues) as ManifestHeader | undefined;
  }

  for (const [key, entry] of Object.entries(doc)) {
    if (key === 'manifest') continue;
    const parsed = parseShortKey(key);
    if (!parsed.ok) {
      issues.push({ code: parsed.code, message: parsed.message, path: [key], target: 'key' });
      continue;
    }
    const { context, kind, identifier } = parsed.value;
    const urn = header && `urn:${header.namespace}:${header.domain}:${context}:${kind}:${identifier}`;
    const output = collect(key, SCHEMA_BY_KIND[kind], entry, issues, urn);
    if (output === undefined) continue;
    if (kind === 'field') fields[key] = output as FieldDecl;
    else if (kind === 'entity') entities[key] = output as EntityDecl;
    else operations[key] = output as OperationDecl;
  }

  if (issues.length > 0 || header === undefined) return { success: false, issues };
  return { success: true, manifest: { header, fields, entities, operations } };
}

/**
 * Parses manifest YAML source and runs the meta-schema, placing every issue at a line and
 * column. YAML syntax errors (including duplicate keys) are issues too.
 */
export function parseManifest(source: string): ParsedManifest {
  const lines = new LineCounter();
  const document = parseDocument(source, { uniqueKeys: true, lineCounter: lines });
  if (document.errors.length > 0) {
    return {
      success: false,
      issues: document.errors.map((error) => {
        const [start] = error.linePos ?? [];
        return {
          code: error.code === 'DUPLICATE_KEY' ? 'duplicate-key' : 'yaml-syntax',
          // The position is in `location`, so drop the parser's own `at line N, column M:` suffix.
          message: `YAML: ${(error.message.split('\n')[0] ?? '').replace(/ at line \d+, column \d+:?$/, '')}`,
          path: [],
          target: 'value',
          ...(start ? { location: { line: start.line, column: start.col } } : {}),
        } satisfies ManifestIssue;
      }),
    };
  }
  const locator = new ManifestLocator(document, lines);
  const result = validateManifest(document.toJS());
  if (result.success) return { ...result, locator };
  return {
    success: false,
    issues: result.issues.map((issue) => {
      const location = issue.path.length > 0 ? locator.locate(issue.path, issue.target) : undefined;
      return location ? { ...issue, location } : issue;
    }),
  };
}
