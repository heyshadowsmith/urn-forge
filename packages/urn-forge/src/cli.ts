/**
 * The command line: init, compile, verify and diff.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isNode, LineCounter, parseDocument } from 'yaml';
import { compileManifest, generate, GENERATED_FILE, type Compiled } from './compile.js';
import { CONFIG_FILE, loadConfig, type UrnForgeConfig } from './config.js';
import type { Diagnostic, Path } from './diagnostics.js';
import { postgresProblems } from './generate/postgres.js';
import { initProject, nameProblem } from './init.js';
import { boundaryGate } from './verify/boundary.js';
import { completenessGate, coreProgram } from './verify/completeness.js';
import { driftGate } from './verify/drift.js';
import { gherkinGate } from './verify/gherkin.js';
import type { GateOutcome } from './verify/types.js';
import { writeGenerated } from './write.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version as string;

export interface CliIo {
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

const USAGE = `urn-forge ${VERSION}

Usage:
  urn-forge init    [--namespace <name>] [--domain <name>]
  urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>]
  urn-forge verify  [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>]
  urn-forge diff    <old manifest> <new manifest> [--report]

Options:
  --namespace <name> init: the namespace of the starter manifest (default: app)
  --domain <name>    init: the domain of the starter manifest (default: starter)
  --config <file>    The config (default: ${CONFIG_FILE}, when it exists). Flags override it
  --manifest <file>  The manifest (default: domain.manifest.yaml)
  --out <dir>        The directory of the generated files (default: src/generated)
  --core <file>      verify: the core, which exports … satisfies DomainCore (default: src/core.ts)
  --features <dir>   verify: the directory of the .feature files (default: features)
  --tsconfig <file>  verify: the tsconfig of gate 1 (default: tsconfig.json)
  --report           diff: list the changes, and do not fail on a breaking change`;

class UsageError extends Error {}

/** A path as the output shows it: relative to the working directory, with forward slashes. */
function display(io: CliIo, path: string): string {
  return relative(io.cwd, path).split('\\').join('/') || '.';
}

/** The line of a path in a YAML text, or of the nearest part of it that exists. */
export function lineOf(text: string, path: Path): number | undefined {
  const counter = new LineCounter();
  const document = parseDocument(text, { lineCounter: counter, keepSourceTokens: true });
  for (let length = path.length; length >= 0; length--) {
    const node = document.getIn(path.slice(0, length), true);
    if (isNode(node) && node.range) return counter.linePos(node.range[0]).line;
  }
  return undefined;
}

function showDiagnostics(io: CliIo, file: string, text: string, diagnostics: readonly Diagnostic[]): void {
  for (const d of diagnostics) {
    const line = d.line ?? lineOf(text, d.path);
    io.stderr(`${file}${line ? `:${line}` : ''}  ${d.severity}  ${d.code}  ${d.message}`);
  }
}

interface Project {
  readonly config: UrnForgeConfig;
  readonly configPath: string;
  readonly base: string;
  readonly manifestPath: string;
  readonly outDir: string;
}

const OPTIONS = {
  config: { type: 'string' },
  manifest: { type: 'string' },
  out: { type: 'string' },
  core: { type: 'string' },
  features: { type: 'string' },
  tsconfig: { type: 'string' },
  namespace: { type: 'string' },
  domain: { type: 'string' },
} as const;

async function project(io: CliIo, values: Record<string, string | undefined>): Promise<Project | undefined> {
  const configPath = values['config'] ? resolve(io.cwd, values['config']) : join(io.cwd, CONFIG_FILE);
  let config: UrnForgeConfig = {};
  if (values['config'] || existsSync(configPath)) {
    if (!existsSync(configPath)) {
      io.stderr(`${display(io, configPath)}  error  config-unreadable  the config does not exist`);
      return undefined;
    }
    const loaded = await loadConfig(configPath);
    if (!loaded.ok) {
      for (const problem of loaded.problems) io.stderr(`${display(io, configPath)}  error  config-invalid  ${problem}`);
      return undefined;
    }
    config = loaded.config;
  }
  // A path of the config is relative to the config; a path of a flag to the working directory.
  const base = dirname(configPath);
  const path = (flag: string | undefined, option: string | undefined, fallback: string): string =>
    flag !== undefined ? resolve(io.cwd, flag) : resolve(base, option ?? fallback);
  return {
    config: {
      ...config,
      core: path(values['core'], config.core, 'src/core.ts'),
      features: path(values['features'], config.features, 'features'),
      tsconfig: path(values['tsconfig'], config.tsconfig, 'tsconfig.json'),
      shell: (config.shell ?? []).map((s) => resolve(base, s)),
    },
    configPath,
    base,
    manifestPath: path(values['manifest'], config.manifest, 'domain.manifest.yaml'),
    outDir: path(values['out'], config.out, 'src/generated'),
  };
}

/** Reads and compiles the manifest; shows its diagnostics. Undefined when it cannot be read or has an error. */
function compileProject(io: CliIo, p: Project): { compiled: Compiled & { model: NonNullable<Compiled['model']> }; files: ReturnType<typeof generate> } | undefined {
  let text: string;
  try {
    text = readFileSync(p.manifestPath, 'utf8');
  } catch {
    io.stderr(`${display(io, p.manifestPath)}  error  manifest-unreadable  the manifest does not exist`);
    return undefined;
  }
  const compiled = compileManifest(text);
  showDiagnostics(io, display(io, p.manifestPath), text, compiled.diagnostics);
  if (!compiled.model) return undefined;
  if (p.config.postgres) {
    const problems = postgresProblems(compiled.model, p.config.postgres);
    for (const problem of problems) io.stderr(`${display(io, p.configPath)}  error  ${problem.code}  ${problem.path.join('.')}: ${problem.message}`);
    if (problems.length > 0) return undefined;
  }
  // The header names the manifest relative to the config, so that it does not depend on the working directory.
  const source = relative(p.base, p.manifestPath).split('\\').join('/');
  const files = generate(compiled as Compiled & { model: NonNullable<Compiled['model']> }, source, p.config);
  return { compiled: compiled as Compiled & { model: NonNullable<Compiled['model']> }, files };
}

async function compileCommand(io: CliIo, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({ args: [...argv], options: OPTIONS, strict: true, allowPositionals: true });
  if (positionals.length > 0) throw new UsageError(`compile takes no argument: ${positionals.join(' ')}`);
  const p = await project(io, values);
  if (!p) return 1;
  const result = compileProject(io, p);
  if (!result) return 1;
  for (const line of await writeGenerated(p.outDir, result.files)) io.stdout(`${line.status.padEnd(10)} ${display(io, line.path)}`);
  return 0;
}

function features(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (!statSync(dir).isDirectory()) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? features(join(dir, e.name)) : e.name.endsWith('.feature') ? [join(dir, e.name)] : [])).sort();
}

async function verifyCommand(io: CliIo, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({ args: [...argv], options: OPTIONS, strict: true, allowPositionals: true });
  if (positionals.length > 0) throw new UsageError(`verify takes no argument: ${positionals.join(' ')}`);
  const p = await project(io, values);
  if (!p) {
    io.stderr('verify failed: the config is not valid');
    return 1;
  }
  const result = compileProject(io, p);
  if (!result) {
    io.stderr('verify failed: the manifest does not compile');
    return 1;
  }
  // The warnings of the manifest, such as deprecated-use, count with those of the gates.
  let warnings = result.compiled.diagnostics.filter((d) => d.severity === 'warning').length;
  const show = (path: string): string => display(io, path);
  const generatedPath = join(p.outDir, GENERATED_FILE);
  const coreOptions = { corePath: p.config.core!, generatedPath, tsconfigPath: p.config.tsconfig!, show };
  const program = coreProgram(coreOptions);
  const outcomes: GateOutcome[] = [
    completenessGate(coreOptions, program),
    boundaryGate({ ...coreOptions, shell: p.config.shell ?? [] }, program),
    gherkinGate({
      model: result.compiled.model,
      applications: result.compiled.applications,
      features: features(p.config.features!).map((path) => ({ path: show(path), text: readFileSync(path, 'utf8') })),
      coverage: p.config.coverage ?? 'warn',
    }),
    await driftGate(p.outDir, result.files, show),
  ];
  for (const outcome of outcomes) {
    io.stdout(`gate ${outcome.gate}  ${outcome.name.padEnd(12)}  ${outcome.pass ? 'PASS' : 'FAIL'}  ${outcome.summary}`);
    for (const problem of outcome.problems) {
      if (problem.severity === 'warning') warnings++;
      io.stdout(`    ${problem.file}${problem.line ? `:${problem.line}` : ''}  ${problem.severity}  ${problem.code}  ${problem.message}`);
    }
  }
  const failed = outcomes.filter((o) => !o.pass).map((o) => o.gate);
  if (failed.length > 0) {
    io.stderr(`verify failed: gate ${failed.join(', ')}`);
    return 1;
  }
  io.stdout(warnings > 0 ? `verify passed with ${warnings} warning(s) (gates 1, 2, 3, 4)` : 'verify passed (gates 1, 2, 3, 4)');
  return 0;
}

async function initCommand(io: CliIo, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({ args: [...argv], options: OPTIONS, strict: true, allowPositionals: true });
  if (positionals.length > 0) throw new UsageError(`init takes no argument: ${positionals.join(' ')}`);
  const namespace = values['namespace'] ?? 'app';
  const domain = values['domain'] ?? 'starter';
  const problem = nameProblem('--namespace', namespace) ?? nameProblem('--domain', domain);
  if (problem) throw new UsageError(problem);
  const result = await initProject({ cwd: io.cwd, namespace, domain });
  if (!result.ok) {
    io.stderr(result.message);
    return 1;
  }
  for (const line of result.lines) io.stdout(line);
  io.stdout('next: npm install, then npx urn-forge compile, then npx urn-forge verify');
  return 0;
}

/** Runs a command. Gives the exit code: 0, 1 for a failure, 2 for a usage error. */
export async function main(argv: readonly string[], io: CliIo = { cwd: process.cwd(), stdout: (t) => console.log(t), stderr: (t) => console.error(t) }): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'init':
        return await initCommand(io, rest);
      case 'compile':
        return await compileCommand(io, rest);
      case 'verify':
        return await verifyCommand(io, rest);
      case 'diff': {
        const { diffCommand } = await import('./diff/command.js');
        return await diffCommand(io, rest);
      }
      case undefined:
      case '--help':
      case '-h':
      case 'help':
        io.stdout(USAGE);
        return command === undefined ? 2 : 0;
      case '--version':
        io.stdout(VERSION);
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

export { UsageError };
