/**
 * urn-forge CLI (spec §9): `compile`, `verify` and `diff`, plus `init` for a new project.
 *
 *   urn-forge init    [--namespace <name>] [--domain <name>]
 *   urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--reference-date <YYYY-MM-DD>] [--format text|json]
 *   urn-forge verify  [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--reference-date <YYYY-MM-DD>] [--format text|json]
 *   urn-forge diff    <old manifest> <new manifest> [--config <file>] [--format text|json]
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
import { diffManifests } from './diff/index.js';
import { isCalendarDate } from './primitives/exact.js';
import { diagnosticJson, formatDiagnostic, hasErrors, relativePaths, type Diagnostic } from './diagnostics.js';
import { CONFIG_FILE, loadConfig, pluginEntries, type UrnForgeConfig } from './config.js';
import { compile, type PluginEntry } from './engine.js';
import { DEFAULT_PLUGINS } from './plugins/index.js';
import { initProject, segmentProblem } from './init.js';
import { GATES, verify } from './verify/index.js';
import { GENERATOR_VERSION } from './version.js';
import { removeOrphanFiles, writeGeneratedFiles } from './write.js';

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
  urn-forge init    [--namespace <name>] [--domain <name>]
  urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--reference-date <YYYY-MM-DD>] [--format text|json]
  urn-forge verify  [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--reference-date <YYYY-MM-DD>] [--format text|json]
  urn-forge diff    <old manifest> <new manifest> [--config <file>] [--format text|json]

Options:
  --namespace <name> init: the namespace of the starter manifest (default: app)
  --domain <name>    init: the domain of the starter manifest (default: starter)
  --config <file>    Config file (default: ${CONFIG_FILE}, when it exists). Flags override it. diff reads the postgres plugin's tables from it
  --manifest <file>  Manifest YAML (default: domain.manifest.yaml)
  --out <dir>        Directory for generated files (default: src/generated)
  --format <format>  text (default) or json: JSON lines on stdout, for CI annotations
  --reference-date <YYYY-MM-DD>
                     The day that sunset dates are compared with (default: referenceDate in the config; never the clock)
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
  'reference-date': { type: 'string' },
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
  /** Pass 8's reference date: the flag, else the config. */
  readonly referenceDate?: string;
  /** Gate 2: the shell's paths from the config, absolute. */
  readonly shellPaths: readonly string[];
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

/** Flag (relative to cwd), else config, else default (both relative to the config file's directory, or cwd with no config). */
async function resolveSettings(
  io: CliIo,
  flags: Partial<Record<PathSetting | 'config' | 'reference-date', string>>,
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
    const loaded = await loadConfig(configPath, display(io, configPath), io.cwd);
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
    // A config describes the project in its own directory, so its defaults start there too.
    return resolve(configDir, fromConfig ?? DEFAULTS[key]);
  };
  const paths = Object.fromEntries((Object.keys(DEFAULTS) as PathSetting[]).map((key) => [key, path(key)]));
  const flagDate = flags['reference-date'];
  if (flagDate !== undefined && !isCalendarDate(flagDate)) throw new UsageError(`--reference-date must be a date YYYY-MM-DD, not "${flagDate}"`);
  const referenceDate = flagDate ?? config.referenceDate;
  return {
    ok: true,
    settings: {
      paths: paths as Settings['paths'],
      plugins,
      boundaryCoverage: config.boundaryCoverage ?? 'warn',
      shellPaths: (config.shell ?? []).map((p) => resolve(configDir, p)),
      ...(referenceDate === undefined ? {} : { referenceDate }),
      ...(configLabel === undefined ? {} : { configLabel }),
    },
  };
}

function outputFormat(value: string): 'text' | 'json' {
  if (value === 'text' || value === 'json') return value;
  throw new UsageError(`--format must be text or json, not "${value}"`);
}

async function runInit(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args,
    options: { namespace: { type: 'string', default: 'app' }, domain: { type: 'string', default: 'starter' } },
    strict: true,
    allowPositionals: false,
  });
  const problem = segmentProblem('--namespace', values.namespace) ?? segmentProblem('--domain', values.domain);
  if (problem) {
    io.stderr(`urn-forge: ${problem}`);
    return 2;
  }
  const result = await initProject({ cwd: io.cwd, namespace: values.namespace, domain: values.domain });
  if (!result.ok) {
    io.stderr(`urn-forge: ${result.message}`);
    return 1;
  }
  for (const line of result.lines) io.stdout(line);
  // The starter's generated files, so verify and the scenarios run at once.
  const compiled = await runCompile([], io);
  if (compiled === 0) io.stdout('next: npm run verify, then npm run test:features');
  return compiled;
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
  const { paths, plugins, configLabel, referenceDate } = resolved.settings;

  let source: string;
  try {
    source = await readFile(paths.manifest, 'utf8');
  } catch (error) {
    report([{ code: 'manifest-unreadable', severity: 'error', message: `cannot read manifest: ${relativePaths((error as Error).message, io.cwd)}` }]);
    return finish(false);
  }

  const result = compile(source, plugins, referenceDate === undefined ? {} : { referenceDate });
  report(attributePluginProblems(result.diagnostics, configLabel));
  if (hasErrors(result.diagnostics)) return finish(false);

  for (const { path, changed } of await writeGeneratedFiles(paths.out, result.files)) {
    if (format === 'json') io.stdout(JSON.stringify({ type: 'file', path: display(io, path), changed }));
    else io.stdout(`${changed ? 'wrote     ' : 'unchanged '} ${display(io, path)}`);
  }
  // A file from an earlier compile that this one no longer writes would fail gate 4.
  for (const path of await removeOrphanFiles(paths.out, result.files)) {
    if (format === 'json') io.stdout(JSON.stringify({ type: 'file', path: display(io, path), changed: true, removed: true }));
    else io.stdout(`removed    ${display(io, path)}`);
  }
  return finish(true, result.fingerprint);
}

/** The short keys of the postgres plugin's tables in a config's plugin list, if it has one. */
function postgresTables(specs: UrnForgeConfig['plugins']): readonly string[] {
  for (const spec of specs ?? []) {
    if (typeof spec !== 'string' && spec[0] === 'postgres') return ((spec[1] as { tables?: readonly string[] }).tables ?? []);
  }
  return [];
}

async function runDiff(args: string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseArgs({ args, options: { config: { type: 'string' }, ...FORMAT_OPTION }, strict: true, allowPositionals: true });
  const format = outputFormat(values.format);
  if (positionals.length !== 2) throw new UsageError('diff needs two manifests: <old manifest> <new manifest>');
  const [oldPath, newPath] = positionals.map((p) => resolve(io.cwd, p)) as [string, string];
  const [oldLabel, newLabel] = [display(io, oldPath), display(io, newPath)];

  // The config is optional: diff reads only the postgres plugin's tables from it, for the Stored use.
  let tables: readonly string[] = [];
  const configPath = resolve(io.cwd, values.config ?? CONFIG_FILE);
  const configExists = await access(configPath).then(() => true, () => false);
  if (values.config !== undefined || configExists) {
    const loaded = await loadConfig(configPath, display(io, configPath), io.cwd);
    if (!loaded.ok) {
      if (format === 'json') {
        for (const d of loaded.diagnostics) io.stdout(diagnosticJson(d));
        io.stdout(JSON.stringify({ type: 'result', ok: false, breaking: 0, compatible: 0, lifecycle: 0 }));
      } else {
        printDiagnostics(io, '', loaded.diagnostics);
        io.stderr('diff failed: the config is not valid');
      }
      return 1;
    }
    tables = postgresTables(loaded.config.plugins);
  }

  const read = async (path: string, label: string): Promise<string | Diagnostic> =>
    readFile(path, 'utf8').catch((error: Error) => ({ code: 'manifest-unreadable', severity: 'error', file: label, message: `cannot read manifest: ${relativePaths(error.message, io.cwd)}` }) as Diagnostic);
  const sources = [await read(oldPath, oldLabel), await read(newPath, newLabel)];
  const unreadable = sources.filter((s): s is Diagnostic => typeof s !== 'string');
  const finish = (ok: boolean, counts: { breaking: number; compatible: number; lifecycle: number }) => {
    if (format === 'json') io.stdout(JSON.stringify({ type: 'result', ok, ...counts }));
    return ok ? 0 : 1;
  };
  if (unreadable.length > 0) {
    if (format === 'json') for (const d of unreadable) io.stdout(diagnosticJson(d));
    else {
      printDiagnostics(io, '', unreadable);
      io.stderr('diff failed: a manifest cannot be read');
    }
    return finish(false, { breaking: 0, compatible: 0, lifecycle: 0 });
  }

  const result = diffManifests(sources[0] as string, sources[1] as string, { tables });
  if (!result.ok) {
    const label = result.which === 'old' ? oldLabel : newLabel;
    if (format === 'json') for (const d of result.diagnostics) io.stdout(diagnosticJson(d, label));
    else {
      printDiagnostics(io, label, result.diagnostics);
      io.stderr(`diff failed: ${label} does not compile`);
    }
    return finish(false, { breaking: 0, compatible: 0, lifecycle: 0 });
  }

  const count = (c: string) => result.changes.filter((x) => x.class === c).length;
  const counts = { breaking: count('breaking'), compatible: count('compatible'), lifecycle: count('lifecycle') };
  const ok = result.experimental || counts.breaking === 0;
  if (format === 'json') {
    for (const change of result.changes) {
      if (change.class !== 'breaking') io.stdout(JSON.stringify({ type: 'change', class: change.class, urn: change.urn, message: change.message }));
    }
    for (const d of result.breaking) io.stdout(diagnosticJson(d, newLabel));
    return finish(ok, counts);
  }
  for (const change of result.changes) io.stdout(`${change.class.padEnd(10)}  ${change.urn}  ${change.message}`);
  const summary = `${counts.breaking} breaking, ${counts.compatible} compatible, ${counts.lifecycle} lifecycle change(s)`;
  if (counts.breaking === 0) io.stdout(`diff passed: ${summary}`);
  else if (result.experimental) io.stdout(`diff passed: ${summary}; the breaking changes are warnings, because ${oldLabel} is experimental`);
  else io.stderr(`diff failed: ${summary}`);
  return ok ? 0 : 1;
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
    shellPaths: resolved.settings.shellPaths,
    ...(resolved.settings.referenceDate === undefined ? {} : { referenceDate: resolved.settings.referenceDate }),
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
    io.stdout(JSON.stringify({ type: 'result', ok: result.ok, failedGates: failed, warnings, sunsetDatesChecked: result.sunsetDatesChecked }));
    return result.ok ? 0 : 1;
  }

  printDiagnostics(io, manifestLabel, diagnostics);
  if (!result.sunsetDatesChecked) io.stdout('note: sunset dates are not checked: set --reference-date or referenceDate in the config');
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
  const unreadable = diagnostics.some((d) => d.code === 'manifest-unreadable');
  io.stderr(
    failed.length > 0
      ? `verify failed: gate ${failed.join(', ')}`
      : `verify failed: the manifest ${unreadable ? 'cannot be read' : 'does not compile'}`,
  );
  return 1;
}

/** `verify passed [with N warning(s)] (gates 1, 2, 3, 4; gate 5 is urn-forge diff)`; a gate that is not built is named too. */
export function verifyPassedLine(ran: readonly number[], warnings: number): string {
  // Gate 5 compares two manifests, so it is its own command, not a gate of verify.
  const notBuilt = ([1, 2, 3, 4] as const).filter((n) => !GATES.some((g) => g.number === n));
  const scope = `gates ${ran.join(', ')}${notBuilt.map((n) => `; gate ${n} is not built`).join('')}; gate 5 is urn-forge diff`;
  return `verify passed${warnings > 0 ? ` with ${warnings} warning(s)` : ''} (${scope})`;
}

export async function main(argv: readonly string[], io: CliIo = defaultIo): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'init':
        return await runInit(rest, io);
      case 'compile':
        return await runCompile(rest, io);
      case 'verify':
        return await runVerify(rest, io);
      case 'diff':
        return await runDiff(rest, io);
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
