/**
 * `urn-forge.config.ts`: the paths of a project, and its options.
 *
 *   import { defineConfig } from 'urn-forge/config';
 *   export default defineConfig({ coverage: 'error' });
 *
 * Paths are relative to the config file. Flags on the command line override the config.
 */
import { pathToFileURL } from 'node:url';

export interface PostgresConfig {
  /** The objects that become tables. Each needs an identifier. */
  readonly tables: readonly string[];
  /** A property that holds the identifier of another table: `{ booking: { restaurant_ref: 'restaurant' } }`. */
  readonly references?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Properties whose values no two rows of a table share: `{ booking: [['restaurant_ref', 'starts_at']] }`. */
  readonly unique?: Readonly<Record<string, readonly (readonly string[])[]>>;
}

export interface UrnForgeConfig {
  /** The manifest. Default: `domain.manifest.yaml`. */
  readonly manifest?: string;
  /** The directory of the generated files. Default: `src/generated`. */
  readonly out?: string;
  /** verify: the core, which exports `… satisfies DomainCore`. Default: `src/core.ts`. */
  readonly core?: string;
  /** verify: the directory of the `.feature` files. Default: `features`. */
  readonly features?: string;
  /** verify: the tsconfig of gate 1. Default: `tsconfig.json`. */
  readonly tsconfig?: string;
  /** verify: the files and directories of the shell, which gate 2 checks besides the core. Default: none. */
  readonly shell?: readonly string[];
  /** verify: whether a gap in the scenarios is a warning or an error. Default: `warn`. */
  readonly coverage?: 'warn' | 'error';
  /** compile: write a Postgres schema of these tables, `schema.generated.sql`. */
  readonly postgres?: PostgresConfig;
}

/** Types a config. It returns the config unchanged. */
export function defineConfig(config: UrnForgeConfig): UrnForgeConfig {
  return config;
}

export const CONFIG_FILE = 'urn-forge.config.ts';

const KEYS = ['manifest', 'out', 'core', 'features', 'tsconfig', 'shell', 'coverage', 'postgres'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): boolean => typeof value === 'string' && value !== '';
const isTexts = (value: unknown): boolean => Array.isArray(value) && value.every(isText);

/** The problems of a config, as messages. */
export function configProblems(config: unknown): string[] {
  if (!isRecord(config)) return ['the config must be an object: export default defineConfig({ … })'];
  const problems: string[] = [];
  for (const key of Object.keys(config)) if (!KEYS.includes(key)) problems.push(`config.${key} is not an option; the options are ${KEYS.join(', ')}`);
  for (const key of ['manifest', 'out', 'core', 'features', 'tsconfig']) {
    if (config[key] !== undefined && !isText(config[key])) problems.push(`config.${key} must be a path`);
  }
  if (config['shell'] !== undefined && !isTexts(config['shell'])) problems.push('config.shell must be a list of paths');
  if (config['coverage'] !== undefined && config['coverage'] !== 'warn' && config['coverage'] !== 'error') problems.push("config.coverage must be 'warn' or 'error'");
  const postgres = config['postgres'];
  if (postgres !== undefined) {
    if (!isRecord(postgres) || !isTexts(postgres['tables'])) problems.push('config.postgres must have tables, a list of object names');
    else {
      for (const key of Object.keys(postgres)) if (!['tables', 'references', 'unique'].includes(key)) problems.push(`config.postgres.${key} is not an option`);
      const references = postgres['references'];
      if (references !== undefined && (!isRecord(references) || !Object.values(references).every((r) => isRecord(r) && Object.values(r).every(isText)))) {
        problems.push('config.postgres.references must map a table to its properties, each to the table it refers to');
      }
      const unique = postgres['unique'];
      if (unique !== undefined && (!isRecord(unique) || !Object.values(unique).every((u) => Array.isArray(u) && u.every(isTexts)))) {
        problems.push('config.postgres.unique must map a table to a list of lists of properties');
      }
    }
  }
  return problems;
}

/** Imports a config module (TypeScript, through tsx) and checks its default export. */
export async function loadConfig(path: string): Promise<{ readonly ok: true; readonly config: UrnForgeConfig } | { readonly ok: false; readonly problems: readonly string[] }> {
  let module: { default?: unknown };
  try {
    module = (await import(pathToFileURL(path).href)) as { default?: unknown };
  } catch (error) {
    return { ok: false, problems: [`cannot load the config: ${(error as Error).message}`] };
  }
  if (module.default === undefined) return { ok: false, problems: ['the config must export default the config'] };
  const problems = configProblems(module.default);
  return problems.length > 0 ? { ok: false, problems } : { ok: true, config: module.default as UrnForgeConfig };
}
