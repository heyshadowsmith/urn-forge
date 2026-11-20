/**
 * Structured diagnostics (spec §5 "every diagnostic carries the URN, the manifest file,
 * line and column"; spec §9 `--format json`).
 *
 * Every problem urn-forge reports, from the manifest passes, the plugins or the verify
 * gates, is one `Diagnostic` with a stable `code`. The CLI renders it as text or as a JSON
 * line; the message text is the same in both.
 */
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
  'unsupported-kind': 'A kind from the spec that this version does not support yet',
  'unknown-kind': 'The kind segment of a short key is not a known kind',
  'unknown-primitive': 'A field uses a primitive that this version does not support',
  'constraint-not-allowed': 'A constraint does not apply to the field primitive',
  'unknown-property': 'An entry has a property it does not accept',
  'invalid-value': 'A property has a value of the wrong type or form',
  // Pass 3: uniqueness
  'duplicate-urn': 'Two entries expand to the same URN',
  'duplicate-brand': 'Two atoms derive the same brand identifier',
  'duplicate-property': 'Two fields of one entity become the same property',
  'duplicate-ref': 'An entity lists the same field more than once',
  'reserved-property': 'An error field would become the property kind, which the error reserves for its URN',
  // Pass 4: references
  'unresolved-ref': 'A reference names no atom in the manifest',
  'wrong-ref-kind': 'A reference names an atom of the wrong kind',
  // Pass 6: rule and template typing
  'unknown-placeholder': 'An error message placeholder does not name a required field of the error',
  // Pass 7: constraint coherence
  'incoherent-constraints': 'The constraints of a field admit no value',
  // Plugins
  'plugin-config': 'A plugin configuration is not valid',
  'unsupported-construct': 'A plugin cannot translate a construct in the IR',
  'export-collision': 'Two atoms generate the same export name',
  'output-conflict': 'Two plugins write the same file',
  'missing-plugin': 'A plugin requires another plugin that is not enabled',
  // Gate 1: completeness
  'tsconfig-unreadable': 'The tsconfig for gate 1 cannot be read',
  'core-not-found': 'The core entry file does not exist',
  'type-error': 'The TypeScript compiler reports an error',
  'missing-satisfies': 'No core export satisfies the generated DomainCoreImplementation',
  // Gate 3: Gherkin traceability
  'features-unreadable': 'The features directory cannot be read',
  'feature-parse-error': 'A feature file is not valid Gherkin',
  'unresolved-tag': 'A @urn: tag names no URN in the manifest',
  'untagged-operation': 'An operation has no feature or scenario tagged with its URN',
  'ambiguous-tag': 'A scenario has more than one operation or entity tag',
  'unknown-header': 'A table header is not a field key of the tagged operation or entity',
  'missing-column': 'The input table of an operation has no column for a required field',
  'undeclared-error': 'A scenario expects an error that its operation does not declare',
  'uncovered-error': 'A declared error has no scenario that expects it (a warning)',
  // Gate 4: drift
  'generated-missing': 'A generated file is not in the output directory',
  'generated-differs': 'A generated file differs from a fresh compile',
  'generated-orphan': 'A generated file has no source in the current compile',
} as const;

export type DiagnosticCode = keyof typeof DIAGNOSTIC_CODES;
export type Severity = 'error' | 'warning';

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
