/**
 * Codegen plugin contract.
 *
 * A plugin is a pure function of `(ir, config)`: no clock, no randomness, no
 * environment reads. It returns file contents; the engine (step 7) adds the
 * `@generated` + fingerprint header and writes the files.
 */
import type * as v from 'valibot';
import type { DiagnosticCode } from '../diagnostics.js';
import type { Lifecycle, UniversalIR, Urn } from '../ir/types.js';
import type { KindName } from '../kinds/index.js';
import type { Primitive } from '../primitives/index.js';

export interface GeneratedArtifact {
  /** POSIX path, relative to `--out`. */
  readonly relativePath: string;
  /** File body without the generated header; `\n` line endings, one trailing newline. */
  readonly content: string;
}

export interface PluginDiagnostic {
  readonly code: DiagnosticCode;
  readonly severity: 'error' | 'warning';
  readonly urn?: Urn;
  readonly message: string;
}

export interface PluginOutput {
  readonly artifacts: readonly GeneratedArtifact[];
  readonly diagnostics: readonly PluginDiagnostic[];
}

/**
 * What a plugin can handle. A plugin handles each construct of the IR, or compilation fails
 * and names the construct. The engine checks the IR against
 * it before `emit`, and reports anything else as `unsupported-construct` with its URN.
 */
export interface PluginSupport {
  /** Kinds whose atoms this plugin handles. Handling may mean emitting nothing, on purpose. */
  readonly kinds: readonly KindName[];
  /**
   * Per primitive, the constraint keys this plugin translates. A field whose primitive is
   * not a key, or that sets a constraint not listed, is unsupported. Omit it for a plugin
   * that does not read primitives or constraints.
   */
  readonly constraints?: { readonly [P in Primitive]?: readonly string[] };
}

/** `C` is the config `emit` receives; `I` is the config a user writes, before defaults (the schema's input). */
export interface CodegenPlugin<C = unknown, I = C> {
  readonly name: string;
  /** Feeds the fingerprint, so a generator change shows up as drift. */
  readonly version: string;
  readonly configSchema: v.GenericSchema<I, C>;
  readonly supports: PluginSupport;
  /** Plugins whose output this plugin's output imports. Compile fails if one is not enabled. */
  readonly requires?: readonly string[];
  emit(ir: UniversalIR, config: C): PluginOutput;
}

/** Renders a number as a TypeScript literal, keeping `-0` distinct from `0`. */
export function numberLiteral(value: number): string {
  if (!Number.isFinite(value)) throw new TypeError(`cannot render non-finite number ${value}`);
  return Object.is(value, -0) ? '-0' : String(value);
}

/** Records keyed by URN in the IR are already sorted; this keeps call sites explicit about it. */
export function valuesInUrnOrder<T>(record: Readonly<Record<Urn, T>>): T[] {
  return Object.values(record) as T[];
}

/** "deprecated: superseded by <urn>; sunset on <date>" for a deprecated node, else undefined. */
export function deprecationNote(node: { readonly lifecycle?: Lifecycle }): string | undefined {
  const life = node.lifecycle;
  if (life?.status !== 'deprecated') return undefined;
  const plans = [life.supersededBy ? `superseded by ${life.supersededBy}` : undefined, life.sunsetDate ? `sunset on ${life.sunsetDate}` : undefined].filter(Boolean);
  return `deprecated${plans.length > 0 ? `: ${plans.join('; ')}` : ''}`;
}

/** A doc comment, with an `@deprecated` tag for a deprecated node, so editors cross its name out. */
export function docComment(text: string, node: { readonly lifecycle?: Lifecycle }): string {
  const note = deprecationNote(node);
  if (note === undefined) return `/** ${text} */`;
  const why = note.replace(/^deprecated:? ?/u, '');
  return `/**\n * ${text}\n * @deprecated${why ? ` ${why.charAt(0).toUpperCase()}${why.slice(1)}.` : ''}\n */`;
}
