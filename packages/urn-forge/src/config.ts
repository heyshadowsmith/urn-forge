/**
 * `urn-forge.config.ts` (spec §7.5): project defaults for the CLI, and which plugins run.
 *
 *   import { defineConfig } from 'urn-forge/config';
 *   export default defineConfig({
 *     manifest: './domain.manifest.yaml',
 *     out: './src/generated',
 *     plugins: [['valibot', {}], ['fcis', {}]],
 *   });
 *
 * Paths are relative to the config file. Flags on the command line override the config.
 * Each plugin's own config is checked against its `configSchema` by the engine.
 */
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import * as v from 'valibot';
import { relativePaths, type Diagnostic } from './diagnostics.js';
import type { PluginEntry } from './engine.js';
import { PLUGINS, PLUGIN_NAMES, isPluginName, type PluginConfigOf, type PluginName } from './plugins/index.js';

/** A plugin by name, with its config or (meaning `{}`) without. */
export type PluginSpec = { [N in PluginName]: N | readonly [N, PluginConfigOf<N>] }[PluginName];

export interface UrnForgeConfig {
  /** The manifest to compile. Default: `domain.manifest.yaml`. */
  readonly manifest?: string;
  /** The directory of the generated files. Default: `src/generated`. */
  readonly out?: string;
  /** verify: the core entry. Default: `src/core.ts`. */
  readonly core?: string;
  /** verify: the directory of the `.feature` files. Default: `features`. */
  readonly features?: string;
  /** verify: the tsconfig for gate 1. Default: `tsconfig.json`. */
  readonly tsconfig?: string;
  /**
   * verify: whether gate 3's coverage gaps (boundaries and declared errors) are warnings or
   * errors. Default: `warn`. A feature tagged `@urn-forge:strict` makes its operations' gaps
   * errors either way. Switch to `error` once every feature is strict (spec §8).
   */
  readonly boundaryCoverage?: 'warn' | 'error';
  /** The plugins to run, in order. Default: Valibot and FCIS, each with an empty config. */
  readonly plugins?: readonly PluginSpec[];
}

/** Types a config object. It returns the object unchanged. */
export function defineConfig(config: UrnForgeConfig): UrnForgeConfig {
  return config;
}

export const CONFIG_FILE = 'urn-forge.config.ts';

const Path = v.pipe(v.string(), v.minLength(1, 'must not be empty'));
const ConfigSchema = v.strictObject({
  manifest: v.optional(Path),
  out: v.optional(Path),
  core: v.optional(Path),
  features: v.optional(Path),
  tsconfig: v.optional(Path),
  boundaryCoverage: v.optional(v.picklist(['warn', 'error'])),
  // No plugin would write no file, and gate 1 would then fail on a missing runtime. An item
  // after the config of a tuple has no meaning, so it is refused, not ignored.
  plugins: v.optional(
    v.pipe(
      v.array(v.union([v.string(), v.strictTuple([v.string(), v.unknown()])], 'must be a plugin name or [name, config]')),
      v.minLength(1, 'must list one or more plugins'),
    ),
  ),
});

export type ConfigResult =
  | { readonly ok: true; readonly config: UrnForgeConfig }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/**
 * Imports the config module (TypeScript, through tsx) and validates its default export.
 * `file` labels diagnostics; paths in a load error are made relative to `cwd`.
 */
export async function loadConfig(path: string, file: string, cwd: string = process.cwd()): Promise<ConfigResult> {
  const fail = (code: 'config-unreadable' | 'config-invalid', message: string): ConfigResult => ({
    ok: false,
    diagnostics: [{ code, severity: 'error', file, message }],
  });

  let module: { default?: unknown };
  try {
    module = (await import(pathToFileURL(path).href)) as { default?: unknown };
  } catch (error) {
    // The whole message: its first line alone ("Transform failed with 1 error:") does not say what is wrong.
    return fail('config-unreadable', `cannot load config: ${relativePaths(stripVTControlCharacters((error as Error).message).trimEnd(), cwd)}`);
  }
  if (module.default === undefined) return fail('config-invalid', 'config: the file must `export default` the config');

  const parsed = v.safeParse(ConfigSchema, module.default);
  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: parsed.issues.map((issue) => {
        // `plugins[0]`, as pluginEntries writes it, not Valibot's `plugins.0`.
        const path = v.getDotPath(issue)?.replace(/\.(\d+)(?=\.|$)/g, '[$1]') ?? null;
        const unknownKey = issue.type === 'strict_object' && issue.expected === 'never';
        return {
          code: 'config-invalid' as const,
          severity: 'error' as const,
          file,
          message: unknownKey ? `config.${path}: unknown option "${path}"` : `config${path ? `.${path}` : ''}: ${issue.message}`,
        };
      }),
    };
  }
  return { ok: true, config: parsed.output as UrnForgeConfig };
}

export type PluginEntriesResult =
  | { readonly ok: true; readonly entries: readonly PluginEntry[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** Turns a config's `plugins` list into engine entries, rejecting unknown and repeated names. */
export function pluginEntries(specs: readonly PluginSpec[], file: string): PluginEntriesResult {
  const diagnostics: Diagnostic[] = [];
  const entries: PluginEntry[] = [];
  const seen = new Set<string>();
  specs.forEach((spec, i) => {
    const [name, config] = typeof spec === 'string' ? [spec as string, {}] : [spec[0] as string, spec[1]];
    const invalid = (message: string) =>
      diagnostics.push({ code: 'config-invalid', severity: 'error', file, message: `config.plugins[${i}]: ${message}` });
    if (!isPluginName(name)) return invalid(`unknown plugin "${name}" (plugins: ${PLUGIN_NAMES.join(', ')})`);
    if (seen.has(name)) return invalid(`plugin "${name}" is listed more than once`);
    seen.add(name);
    entries.push({ plugin: PLUGINS[name], config });
  });
  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, entries };
}
