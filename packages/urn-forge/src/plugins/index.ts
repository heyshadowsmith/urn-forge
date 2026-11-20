/**
 * The plugin registry: every plugin a config can enable, by name (spec §7.5).
 */
import type { PluginEntry } from '../engine.js';
import { fcisPlugin } from './fcis.plugin.js';
import { valibotPlugin } from './valibot.plugin.js';

export const PLUGINS = { valibot: valibotPlugin, fcis: fcisPlugin } as const;

export type PluginName = keyof typeof PLUGINS;
export const PLUGIN_NAMES = Object.keys(PLUGINS) as PluginName[];

/** The config type of one plugin, from its `configSchema`. */
export type PluginConfigOf<N extends PluginName> = (typeof PLUGINS)[N] extends { readonly emit: (ir: never, config: infer C) => unknown }
  ? C
  : never;

export function isPluginName(name: string): name is PluginName {
  return Object.hasOwn(PLUGINS, name);
}

/** The plugins `compile` runs when no config names them: every plugin, each with an empty config. */
export const DEFAULT_PLUGINS: readonly PluginEntry[] = [
  { plugin: valibotPlugin, config: {} },
  { plugin: fcisPlugin, config: {} },
];
