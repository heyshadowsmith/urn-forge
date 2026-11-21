/**
 * The plugin registry: every plugin a config can enable, by name (spec §7.5).
 */
import type { PluginEntry } from '../engine.js';
import { fcisPlugin } from './fcis.plugin.js';
import { postgresPlugin } from './postgres.plugin.js';
import { valibotPlugin } from './valibot.plugin.js';

export const PLUGINS = { valibot: valibotPlugin, fcis: fcisPlugin, postgres: postgresPlugin } as const;

export type PluginName = keyof typeof PLUGINS;
export const PLUGIN_NAMES = Object.keys(PLUGINS) as PluginName[];

/** The config type of one plugin, from its `configSchema`. */
export type PluginConfigOf<N extends PluginName> = (typeof PLUGINS)[N] extends { readonly emit: (ir: never, config: infer C) => unknown }
  ? C
  : never;

export function isPluginName(name: string): name is PluginName {
  return Object.hasOwn(PLUGINS, name);
}

/** The plugins `compile` runs when no config names them: Valibot and FCIS, each with an empty config. Postgres is opt-in. */
export const DEFAULT_PLUGINS: readonly PluginEntry[] = [
  { plugin: valibotPlugin, config: {} },
  { plugin: fcisPlugin, config: {} },
];
