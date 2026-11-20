/**
 * `urn-forge.config.ts` (spec §7.5): project defaults for the CLI, and which plugins run.
 *
 *   import { defineConfig } from '<path to urn-forge>/src/config.js'; // a package import comes with phase 6
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
import * as v from 'valibot';
import type { Diagnostic } from './diagnostics.js';
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
  /** The plugins to run, in order. Default: every plugin with an empty config. */
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
  plugins: v.optional(v.array(v.union([v.string(), v.tuple([v.string(), v.unknown()])]))),
});

export type ConfigResult =
  | { readonly ok: true; readonly config: UrnForgeConfig }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** Imports the config module (TypeScript, through tsx) and validates its default export. `file` labels diagnostics. */
export async function loadConfig(path: string, file: string): Promise<ConfigResult> {
  const fail = (code: 'config-unreadable' | 'config-invalid', message: string): ConfigResult => ({
    ok: false,
    diagnostics: [{ code, severity: 'error', file, message }],
  });

  let module: { default?: unknown };
  try {
    module = (await import(pathToFileURL(path).href)) as { default?: unknown };
  } catch (error) {
    return fail('config-unreadable', `cannot load config: ${(error as Error).message.split('\n')[0]}`);
  }
  if (module.default === undefined) return fail('config-invalid', 'config: the file must `export default` the config');

  const parsed = v.safeParse(ConfigSchema, module.default);
  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: parsed.issues.map((issue) => {
        const path = v.getDotPath(issue);
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
