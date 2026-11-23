/**
 * Structured diagnostics: each one carries the URN, the manifest file, the line and the
 * column, in text and in `--format json`.
 *
 * Every problem urn-forge reports, from the manifest passes, the plugins or the verify
 * gates, is one `Diagnostic` with a stable `code`. The CLI renders it as text or as a JSON
 * line; the message text is the same in both.
 */
import { isAbsolute, relative } from 'node:path';
import { isMap, isScalar, isSeq, type Document, type LineCounter, type Node } from 'yaml';

/**
 * Every diagnostic code, with a one-line summary. docs/reference/diagnostics.md documents
 * each one, and a test keeps the two in step.
 */
export const DIAGNOSTIC_CODES = {
  // Reading the config
  'config-unreadable': 'The config file cannot be loaded',
  'config-invalid': 'The config file has an option or a value that is not valid',
  // Reading the manifest
  'manifest-unreadable': 'The manifest file cannot be read',
  'yaml-syntax': 'The manifest is not valid YAML',
  'duplicate-key': 'A YAML key occurs more than once',
  // Pass 1: meta-schema
  'not-a-mapping': 'The top level of the manifest is not a mapping',
  'missing-header': 'The manifest has no `manifest:` header',
  'invalid-key': 'A top-level key is not a valid short key',
  'unknown-kind': 'The kind segment of a short key is not a known kind',
  'unknown-primitive': 'A field uses a primitive that this version does not support',
  'constraint-not-allowed': 'A constraint does not apply to the field primitive',
  'unknown-property': 'An entry has a property it does not accept',
  'missing-property': 'An entry does not have a property that it must have',
  'invalid-value': 'A property has a value of the wrong type or form',
  'invalid-lifecycle': 'An active atom sets supersededBy, deprecatedOn or sunsetDate, or supersededBy names the atom itself',
  'invalid-compatibility': 'The compatibility of the header has a callers rule that is not ignore-unknown, or a notice that is not a number of days or months',
  // Pass 3: uniqueness
  'duplicate-brand': 'Two atoms derive the same brand identifier',
  'duplicate-property': 'Two fields of one entity become the same property',
  'duplicate-ref': 'An entity lists the same field more than once',
  'invalid-entity-key': 'The key of an entity is not one of its own required, single-valued fields',
  'reserved-property': 'A field of an error or an event would become the property kind, which the payload reserves for its URN',
  // Pass 4: references
  'unresolved-ref': 'A reference names no atom in the manifest',
  'wrong-ref-kind': 'A reference names an atom of the wrong kind',
  // Pass 5: structure
  'missing-key': 'A link, or a unique list of an embedded entity, names an entity that has no key',
  'invalid-unique': 'A unique list of properties is not on a list of embedded entities, or names a property that the item does not have or that holds a list or an entity; or a unique entry of an entity names a property that it does not have or that holds a list or an entity, has a when that is not a rule over its own fields or that SQL cannot write, an otherwise that the record cannot fill, or is on an entity that is not a table',
  'invalid-delivery': 'The delivery of an event names a property that the event does not have, or one that is optional, a list, an entity, or of the wrong primitive',
  'embedding-cycle': 'Entities embed each other in a cycle, so the type of an object would never end',
  // Pass 6: rule and template typing
  'unknown-placeholder': 'An error message placeholder does not name a required field of the error',
  'invalid-record-as': 'The recordAs event of an error cannot be built from the error: it lacks a property of the error, or has another required property',
  'rule-syntax': 'An invariant rule is not valid in the rule language',
  'unknown-rule-field': 'An invariant rule names a field that its entity does not have',
  'rule-type': 'An invariant rule mixes primitives, or uses an operator or a literal that does not fit them',
  'unguarded-field': 'An invariant rule uses an optional field outside a guard such as x is present and …',
  'invalid-report-on': 'The reportOn of an invariant is not a property that its rule names',
  // States and moves
  'invalid-moves': 'The moves of an enum field name a state that is not one of its values, or a move more than once',
  'invalid-changes': 'The changes of an operation do not fit its entity, the moves of its state field, or its declared errors',
  'invalid-callers': 'An operation of a domain with a caller does not state its callers, or its callers have a rule that names a value it cannot read, or an otherwise error that is not declared or cannot be filled',
  'invalid-reads': 'The reads of an operation name an entity that the operation also changes, or a missing error that is not declared or cannot be filled from the input',
  'invalid-idempotency': 'The idempotency of an operation has a key that is not a text of the input, a scope that is not the caller or the input, a window that is not a time, or an otherwise error that is not declared or cannot be filled from the input',
  'invalid-rejects': 'The rejects error of an operation is not in its errors, or has a required property, which an input that does not parse cannot fill',
  'invalid-refuses': 'A refuses entry of an operation names an error that is not in its errors, or names it twice, or has a rule that reads the answer of a success or a value it cannot read',
  'invalid-due': 'The due rule of an operation is on an operation with no changes, or names a value that is not the record or the time',
  'invalid-condition': 'A requires or ensures rule names a value that it cannot read, or the otherwise error of a requires rule is not declared or cannot be filled',
  // Pass 8: lifecycle
  'deprecated-ref': 'An active atom refers to a deprecated atom (a warning)',
  'sunset-ref': 'An atom refers to a sunset atom, or to an atom whose sunset date is on or before the reference date',
  'short-notice': 'With a notice in the header, a sunset date is less than the notice after deprecatedOn, has no deprecatedOn, or a sunset atom has no sunset date',
  'early-sunset': 'A sunset atom has a sunset date after the reference date',
  // Pass 7: constraint coherence
  'conflicting-constraints': 'A field sets two constraints for one side of one aspect, such as min and exclusiveMin',
  'incoherent-constraints': 'The constraints of a field admit no value',
  // Plugins
  'plugin-config': 'A plugin configuration is not valid',
  'unsupported-construct': 'A plugin cannot translate a construct in the IR',
  'export-collision': 'Two atoms generate the same export name',
  'output-conflict': 'Two plugins write the same file',
  'missing-plugin': 'A plugin requires another plugin that is not enabled',
  'unenforced-in-sql': 'A rule has no exact form in SQL, so the Postgres schema does not enforce it (a warning, or an error with unenforced: error)',
  'invalid-sql-name': 'A name in the Postgres schema is longer than 63 bytes, or two parts get the same name',
  // urn-forge diff (gate 5)
  'breaking-change': 'A change to a live URN can break a consumer that worked before it (a warning while the old manifest is experimental)',
  // Gate 1: completeness
  'tsconfig-unreadable': 'The tsconfig for gate 1 cannot be read',
  'core-not-found': 'The core entry file does not exist',
  'type-error': 'The TypeScript compiler reports an error',
  'missing-satisfies': 'No core export satisfies the generated DomainCoreImplementation',
  // Gate 2: boundary discipline
  'brand-assertion': 'A type assertion makes a branded type without a parse',
  'brand-from-any': 'A value of type any is used where a branded type belongs',
  'suppressed-check': 'A @ts-ignore, @ts-expect-error or @ts-nocheck comment turns off a type check in a core or shell file',
  'shell-not-found': 'A path in the shell setting matches no TypeScript file, so gate 2 examines nothing there (a warning)',
  'core-parser-import': 'A core file imports the generated schemas or valibot as a value',
  // Gate 3: Gherkin traceability
  'features-unreadable': 'The features directory cannot be read',
  'feature-parse-error': 'A feature file is not valid Gherkin',
  'unresolved-tag': 'A @urn: tag names no URN in the manifest',
  'untagged-operation': 'An operation has no feature or scenario tagged with its URN',
  'ambiguous-tag': 'A scenario has more than one operation or entity tag',
  'unknown-header': 'A table header is not a field key of the tagged operation or entity',
  'invalid-cell': 'A list or object cell is malformed, or names a property that its entity does not have',
  'missing-column': 'The input table of an operation has no column for a required field',
  'undeclared-error': 'A scenario expects an error that its operation does not declare',
  'uncovered-error': 'A declared error has no scenario that expects it (a warning)',
  'undeclared-event': 'A scenario expects an event that its operation does not emit',
  'uncovered-event': 'An event of an operation has no scenario that expects it (a warning)',
  'undeclared-record': 'A scenario expects a record that no declared error of its operation records as',
  'uncovered-record': 'The record of a refusal (recordAs) has no scenario that expects it (a warning)',
  'undeclared-invariant': 'A scenario expects an invariant that is not on the input entity of its operation',
  'uncovered-invariant': 'An invariant of an operation\'s input has no scenario that breaks it (a warning)',
  'uncovered-state': 'A state that an operation starts from, or a state outside its from that expects otherwise, has no scenario',
  'invalid-current': 'A Given the current <entity> is: step is on an operation that changes no record or names another entity, or an operation that changes a record runs without one',
  'invalid-time': 'A scenario of an operation whose rules read the time runs it without Given the time is, or the time is not a UTC timestamp',
  'invalid-caller': 'A scenario of an operation with callers runs it without Given the caller is:, or the step is in a domain whose manifest names no caller',
  'uncovered-idempotency': 'No scenario repeats a call of an operation with idempotency',
  'uncovered-unique': 'A unique entry of an entity with otherwise has no scenario that stores a record and fails with the error of the clash, or a stored-records step names an entity with no unique values',
  'uncovered-due': 'No scenario calls a timed change for a record that is not due, or the step is on an operation with no due',
  'uncovered-boundary': 'The examples of an input field do not include every boundary case of its constraints (a warning)',
  'ratchet-ready': 'Every feature is strict, so boundaryCoverage can be set to error (a note)',
  'waived-boundary': 'A waiver removed the boundary gaps of a field, with its reason (a note)',
  'invalid-waiver': 'A urn-forge:waive comment does not have the form # urn-forge:waive <field URN> <reason>',
  'unknown-waiver': 'A waiver names a field that is not a constrained input field of the feature\'s operations',
  'unused-waiver': 'A waiver names a field that has no boundary gap, so it waives nothing (a warning)',
  // Gate 4: drift
  'generated-missing': 'A generated file is not in the output directory',
  'generated-differs': 'A generated file differs from a fresh compile',
  'generated-orphan': 'A generated file has no source in the current compile',
} as const;

export type DiagnosticCode = keyof typeof DIAGNOSTIC_CODES;
/** `error` fails; `warning` does not, and is counted; `note` does not, and is not counted (e.g. a waiver). */
export type Severity = 'error' | 'warning' | 'note';

/** 1-based line and column. */
export interface SourceLocation {
  readonly line: number;
  readonly column: number;
}

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: Severity;
  /** Leads with the manifest key or URN the problem concerns. May span lines. */
  readonly message: string;
  /** The atom the problem concerns, when there is one. */
  readonly urn?: string;
  /** Display path of the file. Absent means the manifest being compiled. */
  readonly file?: string;
  readonly location?: SourceLocation;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** `<file>[:line:col]  <severity>  <code>  <message>`; `file` stands in when the diagnostic has none. */
export function formatDiagnostic(diagnostic: Diagnostic, file = ''): string {
  const path = diagnostic.file ?? file;
  const where = diagnostic.location ? `${path}:${diagnostic.location.line}:${diagnostic.location.column}` : path;
  return `${where}  ${diagnostic.severity}  ${diagnostic.code}  ${diagnostic.message}`;
}

/** The JSON-lines form: flat, with absent properties left out. */
export function diagnosticJson(diagnostic: Diagnostic, file = '', extra: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    type: 'diagnostic',
    ...extra,
    severity: diagnostic.severity,
    code: diagnostic.code,
    file: diagnostic.file ?? file,
    ...(diagnostic.location ?? {}),
    ...(diagnostic.urn === undefined ? {} : { urn: diagnostic.urn }),
    message: diagnostic.message,
  });
}

/**
 * Rewrites the absolute paths in a message from Node, TypeScript or esbuild as paths
 * relative to `cwd`, with `/` separators, so a message is the same on every machine.
 */
export function relativePaths(message: string, cwd: string): string {
  return message.replace(/(?<![\w.:/\\])(?:\/|[A-Za-z]:\\)[^\s'"`:,()]+/g, (path) =>
    isAbsolute(path) ? relative(cwd, path).split('\\').join('/') || '.' : path,
  );
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}

// ---------------------------------------------------------------------------
// Manifest locations
// ---------------------------------------------------------------------------

/** A path into the manifest document: top-level key first, then property names and list indexes. */
export type ManifestPath = readonly (string | number)[];

/**
 * Maps a path in the parsed manifest to a line and column. When the path does not fully
 * exist (a missing property, say), it falls back to the deepest node it found, so the
 * location still points at the right entry.
 */
export class ManifestLocator {
  constructor(
    private readonly document: Document,
    private readonly lines: LineCounter,
  ) {}

  /** `target: 'key'` points at the key of the last segment rather than its value. */
  locate(path: ManifestPath, target: 'key' | 'value' = 'value'): SourceLocation | undefined {
    let node: unknown = this.document.contents;
    let best = rangeStart(node);
    for (const [i, segment] of path.entries()) {
      const last = i === path.length - 1;
      if (isMap(node)) {
        const pair = node.items.find((p) => isScalar(p.key) && String(p.key.value) === String(segment));
        if (!pair) break;
        best = rangeStart(pair.key) ?? best;
        if (last && target === 'key') break;
        node = pair.value;
        if (last) best = rangeStart(node) ?? best;
      } else if (isSeq(node) && typeof segment === 'number') {
        node = node.items[segment];
        if (node === undefined) break;
        best = rangeStart(node) ?? best;
      } else {
        break;
      }
    }
    return best === undefined ? undefined : this.position(best);
  }

  /** The key of the entry that declares `urn`, e.g. `geometry.field.radius` for `urn:demo:math:geometry:field:radius`. */
  locateUrn(urn: string): SourceLocation | undefined {
    const parts = urn.split(':');
    if (parts.length !== 6) return undefined;
    return this.locate([`${parts[3]}.${parts[4]}.${parts[5]}`], 'key');
  }

  position(offset: number): SourceLocation {
    const { line, col } = this.lines.linePos(offset);
    return { line, column: col };
  }
}

function rangeStart(node: unknown): number | undefined {
  return (node as Node | null | undefined)?.range?.[0];
}
