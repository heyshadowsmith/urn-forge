/**
 * urn-forge CLI (spec §9; the MVP ships `compile` and `verify`).
 *
 *   urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--format text|json]
 *   urn-forge verify  [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--format text|json]
 *
 * Each setting comes from its flag, else from the config file (`--config`, or
 * `urn-forge.config.ts` in the current directory when it exists), else its default.
 *
 * Text diagnostics print to stderr as `<file>:<line>:<col>  <severity>  <code>  <message>`;
 * messages lead with the manifest key or URN. `--format json` prints JSON lines to stdout
 * instead (diagnostics, then files or gates, then one result line), for CI annotations.
 * Exit codes: 0 success, 1 error diagnostics or a failed gate, 2 usage error.
 */
import { access, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { diagnosticJson, formatDiagnostic, hasErrors, type Diagnostic } from './diagnostics.js';
import { CONFIG_FILE, loadConfig, pluginEntries, type UrnForgeConfig } from './config.js';
import { compile, type PluginEntry } from './engine.js';
import { DEFAULT_PLUGINS } from './plugins/index.js';
import { GATES, verify } from './verify/index.js';
import { GENERATOR_VERSION } from './version.js';
import { writeGeneratedFiles } from './write.js';

export interface CliIo {
  readonly cwd: string;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

const defaultIo: CliIo = {
  cwd: process.cwd(),
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
};

const USAGE = `urn-forge ${GENERATOR_VERSION}

Usage:
  urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--format text|json]
  urn-forge verify  [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--format text|json]

Options:
  --config <file>    Config file (default: ${CONFIG_FILE}, when it exists). Flags override it
  --manifest <file>  Manifest YAML (default: domain.manifest.yaml)
  --out <dir>        Directory for generated files (default: src/generated)
  --format <format>  text (default) or json: JSON lines on stdout, for CI annotations
  --core <file>      verify: core entry exporting \`satisfies DomainCoreImplementation\` (default: src/core.ts)
  --features <dir>   verify: directory searched for .feature files (default: features)
  --tsconfig <file>  verify: tsconfig whose options gate 1 type-checks with (default: tsconfig.json)`;

/** Paths printed relative to cwd with forward slashes, so output does not depend on the machine. */
function display(io: CliIo, path: string): string {
  return relative(io.cwd, path).split('\\').join('/') || '.';
}

function printDiagnostics(io: CliIo, file: string, diagnostics: readonly Diagnostic[]): void {
  for (const d of diagnostics) io.stderr(formatDiagnostic(d, file));
}

class UsageError extends Error {}

const FORMAT_OPTION = { format: { type: 'string', default: 'text' } } as const;

/** Options shared by both commands. No defaults here: an absent flag falls back to the config. */
const PATH_OPTIONS = {
  config: { type: 'string' },
  manifest: { type: 'string' },
  out: { type: 'string' },
} as const;

const DEFAULTS = {
  manifest: 'domain.manifest.yaml',
  out: 'src/generated',
  core: 'src/core.ts',
  features: 'features',
  tsconfig: 'tsconfig.json',
} as const;

type PathSetting = keyof typeof DEFAULTS;

interface Settings {
  /** Absolute path of each setting. */
  readonly paths: Readonly<Record<PathSetting, string>>;
  readonly plugins: readonly PluginEntry[];
  /** Gate 3's coverage mode, from the config. */
  readonly boundaryCoverage: 'warn' | 'error';
  /** Display path of the config file, when one was loaded. */
  readonly configLabel?: string;
}

/** Problems with the plugin list belong to the config that set it, when there is one. */
function attributePluginProblems(diagnostics: readonly Diagnostic[], configLabel: string | undefined): readonly Diagnostic[] {
  if (configLabel === undefined) return diagnostics;
  return diagnostics.map((d) =>
    d.file === undefined && (d.code === 'missing-plugin' || d.code === 'plugin-config') ? { ...d, file: configLabel } : d,
  );
}

/** Flag, else config (relative to the config file), else default (relative to cwd). */
async function resolveSettings(
  io: CliIo,
  flags: Partial<Record<PathSetting | 'config', string>>,
): Promise<{ ok: true; settings: Settings } | { ok: false; diagnostics: readonly Diagnostic[] }> {
  let config: UrnForgeConfig = {};
  let configDir = io.cwd;
  let configLabel: string | undefined;
  const configPath = resolve(io.cwd, flags.config ?? CONFIG_FILE);
  const configExists = await access(configPath).then(
    () => true,
    () => false,
  );
  if (flags.config !== undefined || configExists) {
    const loaded = await loadConfig(configPath, display(io, configPath));
    if (!loaded.ok) return loaded;
    config = loaded.config;
    configDir = dirname(configPath);
    configLabel = display(io, configPath);
  }

  let plugins = DEFAULT_PLUGINS;
  if (config.plugins !== undefined) {
    const entries = pluginEntries(config.plugins, display(io, configPath));
    if (!entries.ok) return entries;
    plugins = entries.entries;
  }

  const path = (key: PathSetting): string => {
    const flag = flags[key];
    if (flag !== undefined) return resolve(io.cwd, flag);
    const fromConfig = config[key];
    return fromConfig !== undefined ? resolve(configDir, fromConfig) : resolve(io.cwd, DEFAULTS[key]);
  };
  const paths = Object.fromEntries((Object.keys(DEFAULTS) as PathSetting[]).map((key) => [key, path(key)]));
  return {
    ok: true,
    settings: {
      paths: paths as Settings['paths'],
      plugins,
      boundaryCoverage: config.boundaryCoverage ?? 'warn',
      ...(configLabel === undefined ? {} : { configLabel }),
    },
  };
}

function outputFormat(value: string): 'text' | 'json' {
  if (value === 'text' || value === 'json') return value;
  throw new UsageError(`--format must be text or json, not "${value}"`);
}

async function runCompile(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args,
    options: { ...PATH_OPTIONS, ...FORMAT_OPTION },
    strict: true,
    allowPositionals: false,
  });
  const format = outputFormat(values.format);
  const resolved = await resolveSettings(io, values);
  const manifestLabel = resolved.ok ? display(io, resolved.settings.paths.manifest) : '';

  const report = (diagnostics: readonly Diagnostic[]) => {
    if (format === 'json') for (const d of diagnostics) io.stdout(diagnosticJson(d, manifestLabel));
    else printDiagnostics(io, manifestLabel, diagnostics);
  };
  const finish = (ok: boolean, fingerprint?: string): number => {
    if (format === 'json') {
      io.stdout(JSON.stringify({ type: 'result', ok, ...(fingerprint === undefined ? {} : { fingerprint }) }));
    } else if (fingerprint !== undefined) {
      io.stdout(`fingerprint ${fingerprint}`);
    }
    return ok ? 0 : 1;
  };

  if (!resolved.ok) {
    report(resolved.diagnostics);
    return finish(false);
  }
  const { paths, plugins, configLabel } = resolved.settings;

  let source: string;
  try {
    source = await readFile(paths.manifest, 'utf8');
  } catch (error) {
    report([{ code: 'manifest-unreadable', severity: 'error', message: `cannot read manifest: ${(error as Error).message}` }]);
    return finish(false);
  }

  const result = compile(source, plugins);
  report(attributePluginProblems(result.diagnostics, configLabel));
  if (hasErrors(result.diagnostics)) return finish(false);

  for (const { path, changed } of await writeGeneratedFiles(paths.out, result.files)) {
    if (format === 'json') io.stdout(JSON.stringify({ type: 'file', path: display(io, path), changed }));
    else io.stdout(`${changed ? 'wrote     ' : 'unchanged '} ${display(io, path)}`);
  }
  return finish(true, result.fingerprint);
}

async function runVerify(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      ...PATH_OPTIONS,
      core: { type: 'string' },
      features: { type: 'string' },
      tsconfig: { type: 'string' },
      ...FORMAT_OPTION,
    },
    strict: true,
    allowPositionals: false,
  });
  const format = outputFormat(values.format);
  const resolved = await resolveSettings(io, values);
  if (!resolved.ok) {
    if (format === 'json') {
      for (const d of resolved.diagnostics) io.stdout(diagnosticJson(d));
      io.stdout(JSON.stringify({ type: 'result', ok: false, failedGates: [], warnings: 0 }));
    } else {
      printDiagnostics(io, '', resolved.diagnostics);
      io.stderr('verify failed: the config is not valid');
    }
    return 1;
  }
  const { paths, plugins } = resolved.settings;
  const result = await verify({
    cwd: io.cwd,
    manifestPath: paths.manifest,
    outDir: paths.out,
    corePath: paths.core,
    featuresDir: paths.features,
    tsconfigPath: paths.tsconfig,
    plugins,
    boundaryCoverage: resolved.settings.boundaryCoverage,
  });

  const manifestLabel = display(io, paths.manifest);
  const diagnostics = attributePluginProblems(result.diagnostics, resolved.settings.configLabel);
  const failed = result.gates.filter((g) => !g.ok).map((g) => g.gate);

  const warnings = [...diagnostics, ...result.gates.flatMap((g) => g.problems)].filter((d) => d.severity === 'warning').length;

  if (format === 'json') {
    for (const d of diagnostics) io.stdout(diagnosticJson(d, manifestLabel));
    for (const gate of result.gates) {
      for (const problem of gate.problems) io.stdout(diagnosticJson(problem, manifestLabel, { gate: gate.gate }));
    }
    for (const { gate, name, ok, summary } of result.gates) {
      io.stdout(JSON.stringify({ type: 'gate', gate, name, ok, summary }));
    }
    io.stdout(JSON.stringify({ type: 'result', ok: result.ok, failedGates: failed, warnings }));
    return result.ok ? 0 : 1;
  }

  printDiagnostics(io, manifestLabel, diagnostics);
  for (const gate of result.gates) {
    io.stdout(`gate ${gate.gate}  ${gate.name.padEnd(12)}  ${gate.ok ? 'PASS' : 'FAIL'}  ${gate.summary}`);
    for (const problem of gate.problems) {
      for (const line of formatDiagnostic(problem, manifestLabel).split('\n')) io.stdout(`    ${line}`);
    }
  }
  if (result.ok) {
    io.stdout(verifyPassedLine(result.gates.map((g) => g.gate), warnings));
    return 0;
  }
  io.stderr(failed.length > 0 ? `verify failed: gate ${failed.join(', ')}` : 'verify failed: the manifest does not compile');
  return 1;
}

/** `verify passed [with N warning(s)] (gates …; gates … are not in the MVP)`. */
export function verifyPassedLine(ran: readonly number[], warnings: number): string {
  const notBuilt = ([1, 2, 3, 4, 5] as const).filter((n) => !GATES.some((g) => g.number === n));
  const scope = `gates ${ran.join(', ')}${notBuilt.length > 0 ? `; gates ${notBuilt.join(' and ')} are not in the MVP` : ''}`;
  return `verify passed${warnings > 0 ? ` with ${warnings} warning(s)` : ''} (${scope})`;
}

export async function main(argv: readonly string[], io: CliIo = defaultIo): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'compile':
        return await runCompile(rest, io);
      case 'verify':
        return await runVerify(rest, io);
      case undefined:
      case '--help':
      case '-h':
      case 'help':
        io.stdout(USAGE);
        return command === undefined ? 2 : 0;
      case '--version':
        io.stdout(GENERATOR_VERSION);
        return 0;
      default:
        io.stderr(`unknown command "${command}"\n\n${USAGE}`);
        return 2;
    }
  } catch (error) {
    if (error instanceof UsageError || (error as { code?: string }).code?.startsWith('ERR_PARSE_ARGS')) {
      io.stderr(`${(error as Error).message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
}
