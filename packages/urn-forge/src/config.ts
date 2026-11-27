/**
 * `urn-forge.config.ts`: the paths of a project, and its options.
 *
 *   import { defineConfig } from 'urn-forge/config';
 *   export default defineConfig({ shell: ['src/shell'] });
 *   export default defineConfig({ domains: [{ manifest: 'billing/domain.manifest.yaml', out: 'billing/generated', … }] });
 *
 * Paths are relative to the config file. Flags on the command line override the config.
 */
import { pathToFileURL } from 'node:url';

/** One domain of a project: its manifest, its generated files, its core and its scenarios. */
export interface DomainConfig {
  /** The manifest. Default: `domain.manifest.yaml`. */
  readonly manifest?: string;
  /** The directory of the generated files. Default: `src/generated`. */
  readonly out?: string;
  /** verify: the core, which exports `… satisfies DomainCore`. Default: `src/core.ts`. */
  readonly core?: string;
  /** verify: the directory of the `.feature` files. Default: `features`. */
  readonly features?: string;
}

export interface UrnForgeConfig {
  /** verify: the tsconfig of gate 1, for each domain. Default: `tsconfig.json`. */
  readonly tsconfig?: string;
  /** verify: the files and directories of the shell, which gate 2 checks against the core of each domain. Default: none. */
  readonly shell?: readonly string[];
  /** The domains of the project. Default: one domain at the default paths. */
  readonly domains?: readonly DomainConfig[];
}

/** Types a config. It returns the config unchanged. */
export function defineConfig(config: UrnForgeConfig): UrnForgeConfig {
  return config;
}

export const CONFIG_FILE = 'urn-forge.config.ts';

const KEYS = ['tsconfig', 'shell', 'domains'];
const DOMAIN_KEYS = ['manifest', 'out', 'core', 'features'];

/** Options that urn-forge no longer has, or that moved, with what to do. */
const REMOVED: Readonly<Record<string, string>> = {
  coverage: 'config.coverage is removed: a gap in the scenarios is always an error; remove the option',
  ...Object.fromEntries(DOMAIN_KEYS.map((key) => [key, `config.${key} moved into domains: write domains: [{ ${key}: … }]`])),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): boolean => typeof value === 'string' && value !== '';
const isTexts = (value: unknown): boolean => Array.isArray(value) && value.every(isText);

/** The problems of a config, as messages. */
export function configProblems(config: unknown): string[] {
  if (!isRecord(config)) return ['the config must be an object: export default defineConfig({ … })'];
  const problems: string[] = [];
  for (const key of Object.keys(config)) {
    if (REMOVED[key]) problems.push(REMOVED[key]);
    else if (!KEYS.includes(key)) problems.push(`config.${key} is not an option; the options are ${KEYS.join(', ')}`);
  }
  if (config['tsconfig'] !== undefined && !isText(config['tsconfig'])) problems.push('config.tsconfig must be a path');
  if (config['shell'] !== undefined && !isTexts(config['shell'])) problems.push('config.shell must be a list of paths');
  const domains = config['domains'];
  if (domains !== undefined) {
    if (!Array.isArray(domains) || domains.length === 0) problems.push('config.domains must be a list of one or more domains');
    else domains.forEach((domain, i) => problems.push(...domainProblems(domain, `config.domains[${i}]`)));
  }
  return problems;
}

/** The problems of one domain of a config. */
function domainProblems(domain: unknown, at: string): string[] {
  if (!isRecord(domain)) return [`${at} must be an object: { manifest, out, core, features }`];
  const problems: string[] = [];
  for (const key of Object.keys(domain)) if (!DOMAIN_KEYS.includes(key)) problems.push(`${at}.${key} is not an option; the options are ${DOMAIN_KEYS.join(', ')}`);
  for (const key of ['manifest', 'out', 'core', 'features']) if (domain[key] !== undefined && !isText(domain[key])) problems.push(`${at}.${key} must be a path`);
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
