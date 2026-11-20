/**
 * Compilation pass 1: the manifest meta-schema (spec §4, §7 pass 1; MVP scope per mvp-plan.md).
 *
 * Validates the manifest header and the short-key grammar (`<context>.<kind>.<identifier>`),
 * then each entry against its kind's schema from the kind registry (src/kinds/). A field's
 * schema in turn comes from its primitive's descriptor (src/primitives/).
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
import { SEGMENT_PATTERN, SHORT_KEY_PATTERN, Segment } from './grammar.js';
import { KINDS, KIND_NAMES, NOT_YET_SUPPORTED_KINDS, isKindName, type DeclOf, type KindName } from './kinds/index.js';
import type { EntityDecl } from './kinds/entity.js';
import type { FieldDecl } from './kinds/field.js';
import type { OperationDecl } from './kinds/operation.js';
import { PRIMITIVE_NAMES, constraintKeys, isPrimitive } from './primitives/index.js';

export { SEGMENT_PATTERN };
export type { EntityDecl, FieldDecl, OperationDecl };

export interface ShortKey {
  readonly context: string;
  readonly kind: KindName;
  readonly identifier: string;
}

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

/**
 * A structurally valid manifest, grouped by kind (each group is a kind's `group`). Keys are
 * still short keys, in declaration order. Its canonical JSON is hashed into the IR, so this
 * shape is part of every fingerprint.
 */
export type ValidManifest = { readonly header: ManifestHeader } & {
  readonly [K in KindName as (typeof KINDS)[K]['group']]: Readonly<Record<string, DeclOf<K>>>;
};

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
  if (isKindName(kind)) return { ok: true, value: { context, kind, identifier } };
  if ((NOT_YET_SUPPORTED_KINDS as readonly string[]).includes(kind)) {
    return {
      ok: false,
      code: 'unsupported-kind',
      message: `invalid key "${key}": kind "${kind}" is not supported yet (MVP kinds: ${KIND_NAMES.join(', ')})`,
    };
  }
  return {
    ok: false,
    code: 'unknown-kind',
    message: `invalid key "${key}": unknown kind "${kind}" (MVP kinds: ${KIND_NAMES.join(', ')})`,
  };
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
      `${prefix}: unknown primitive ${issue.received} (MVP primitives: ${PRIMITIVE_NAMES.join(', ')})`,
    );
  }
  if (unknownKey && typeof primitive === 'string' && isPrimitive(primitive)) {
    const allowed = constraintKeys(primitive);
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
  const groups: Record<string, Record<string, unknown>> = Object.fromEntries(
    KIND_NAMES.map((name) => [KINDS[name].group, {}]),
  );

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
    const output = collect(key, KINDS[kind].schema, entry, issues, urn);
    if (output !== undefined) groups[KINDS[kind].group]![key] = output;
  }

  if (issues.length > 0 || header === undefined) return { success: false, issues };
  return { success: true, manifest: { header, ...groups } as unknown as ValidManifest };
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
