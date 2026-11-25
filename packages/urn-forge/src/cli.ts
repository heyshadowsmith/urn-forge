/**
 * The command line: init, compile, verify and diff.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isNode, LineCounter, parseDocument } from 'yaml';
import { compileManifest, generate, GENERATED_FILE, type Compiled } from './compile.js';
import { CONFIG_FILE, loadConfig, type UrnForgeConfig } from './config.js';
import { fixOf, type Code } from './codes.js';
import type { Diagnostic, Path } from './diagnostics.js';
import { longNames, postgresProblems, postgresSchema } from './generate/postgres.js';
import { initProject, nameProblem } from './init.js';
import { boundaryGate } from './verify/boundary.js';
import { completenessGate, coreProgram } from './verify/completeness.js';
import { contractGate, type ContractGateInput } from './verify/contract.js';
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
  urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--format text|json]
  urn-forge verify  [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--base <ref>] [--format text|json]
  urn-forge diff    <old manifest> <new manifest> [--report] [--format text|json]

Options:
  --namespace <name> init: the namespace of the starter manifest (default: app)
  --domain <name>    init: the domain of the starter manifest (default: starter)
  --config <file>    The config (default: ${CONFIG_FILE}, when it exists). Flags override it
  --manifest <file>  The manifest (default: domain.manifest.yaml)
  --out <dir>        The directory of the generated files (default: src/generated)
  --core <file>      verify: the core, which exports … satisfies DomainCore (default: src/core.ts)
  --features <dir>   verify: the directory of the .feature files (default: features)
  --tsconfig <file>  verify: the tsconfig of gate 1 (default: tsconfig.json)
  --base <ref>       verify: run gate 5, which compares the contract with the one at this git ref
  --report           diff: list the changes, and do not fail on a breaking change
  --format <format>  compile, verify, diff: text (default), or json: one JSON object on stdout, and nothing else`;

class UsageError extends Error {}

/** A problem as the commands report it: a stable code, where it is, what is wrong, and (from its code) the fix. */
export interface Problem {
  readonly code: Code;
  readonly severity: 'error' | 'warning';
  readonly file?: string;
  readonly line?: number;
  /** The place in the manifest or the config, as a path of keys. */
  readonly path?: Path;
  readonly message: string;
}

export type Format = 'text' | 'json';

/**
 * The output of a command. As text, it writes each line as it comes, and each problem with its fix on
 * the next line. As JSON, it writes nothing until the end, and then one object to stdout.
 */
export class Report {
  readonly problems: Problem[] = [];

  constructor(
    private readonly io: CliIo,
    readonly format: Format,
  ) {}

  /** A line of text for stdout; nothing as JSON. */
  out(text: string): void {
    if (this.format === 'text') this.io.stdout(text);
  }

  /** A line of text for stderr; nothing as JSON. */
  err(text: string): void {
    if (this.format === 'text') this.io.stderr(text);
  }

  problem(problem: Problem, stream: 'stdout' | 'stderr' = 'stderr', indent = ''): void {
    this.problems.push(problem);
    if (this.format !== 'text') return;
    const write = stream === 'stdout' ? this.io.stdout : this.io.stderr;
    const where = problem.file ? `${problem.file}${problem.line ? `:${problem.line}` : ''}  ` : '';
    write(`${indent}${where}${problem.severity}  ${problem.code}  ${problem.message}`);
    write(`${indent}  fix: ${fixOf(problem.code)}`);
  }

  /** Ends the command with its exit code: as JSON, writes the one object. */
  end(code: number, extra: Record<string, unknown> = {}): number {
    if (this.format === 'json') {
      const problems = this.problems.map((p) => ({
        code: p.code,
        severity: p.severity,
        file: p.file ?? null,
        line: p.line ?? null,
        path: p.path ?? null,
        message: p.message,
        fix: fixOf(p.code),
      }));
      this.io.stdout(JSON.stringify({ ok: code === 0, ...extra, problems }));
    }
    return code;
  }
}

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

function showDiagnostics(report: Report, file: string, text: string, diagnostics: readonly Diagnostic[]): void {
  for (const d of diagnostics) {
    const line = d.line ?? lineOf(text, d.path);
    report.problem({ code: d.code, severity: d.severity, file, ...(line ? { line } : {}), path: d.path, message: d.message });
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
  base: { type: 'string' },
  namespace: { type: 'string' },
  domain: { type: 'string' },
} as const;

async function project(io: CliIo, report: Report, values: Record<string, string | undefined>): Promise<Project | undefined> {
  const configPath = values['config'] ? resolve(io.cwd, values['config']) : join(io.cwd, CONFIG_FILE);
  let config: UrnForgeConfig = {};
  if (values['config'] || existsSync(configPath)) {
    if (!existsSync(configPath)) {
      report.problem({ code: 'config-unreadable', severity: 'error', file: display(io, configPath), message: 'the config does not exist' });
      return undefined;
    }
    const loaded = await loadConfig(configPath);
    if (!loaded.ok) {
      for (const problem of loaded.problems) report.problem({ code: 'config-invalid', severity: 'error', file: display(io, configPath), message: problem });
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
function compileProject(io: CliIo, report: Report, p: Project): { compiled: Compiled & { model: NonNullable<Compiled['model']> }; files: ReturnType<typeof generate>; text: string } | undefined {
  let text: string;
  try {
    text = readFileSync(p.manifestPath, 'utf8');
  } catch {
    report.problem({ code: 'manifest-unreadable', severity: 'error', file: display(io, p.manifestPath), message: 'the manifest does not exist' });
    return undefined;
  }
  const compiled = compileManifest(text);
  showDiagnostics(report, display(io, p.manifestPath), text, compiled.diagnostics);
  if (!compiled.model) return undefined;
  if (p.config.postgres) {
    const problems = postgresProblems(compiled.model, p.config.postgres);
    if (problems.length === 0) {
      // Every name of the schema, also of a constraint, a function or a trigger, must fit in 63 bytes.
      for (const name of longNames(postgresSchema(compiled.model, compiled.applications, p.config.postgres))) {
        problems.push({ code: 'postgres-column', severity: 'error', path: ['postgres'], message: `${name} is longer than 63 bytes, the most that Postgres takes for a name` });
      }
    }
    for (const problem of problems) {
      report.problem({ code: problem.code, severity: 'error', file: display(io, p.configPath), path: problem.path, message: `${problem.path.join('.')}: ${problem.message}` });
    }
    if (problems.length > 0) return undefined;
  }
  // The header names the manifest relative to the config, so that it does not depend on the working directory.
  const source = relative(p.base, p.manifestPath).split('\\').join('/');
  const files = generate(compiled as Compiled & { model: NonNullable<Compiled['model']> }, source, p.config);
  return { compiled: compiled as Compiled & { model: NonNullable<Compiled['model']> }, files, text };
}

/** The contract at a git ref: the manifest and the features at their paths of the working tree. */
function baseContract(io: CliIo, p: Project, ref: string): ContractGateInput['old'] {
  const git = (args: string[]): string =>
    execFileSync('git', args, { cwd: dirname(p.manifestPath), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  let root: string;
  try {
    root = git(['rev-parse', '--show-toplevel']).trim();
  } catch {
    return { problem: 'the manifest is not in a git repository' };
  }
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  } catch {
    return { problem: `${ref} is not a commit of this repository: fetch it, with enough history, or give another ref` };
  }
  // Paths in the tree of a commit are relative to the root, with forward slashes.
  const real = (path: string): string => (existsSync(path) ? realpathSync(path) : path);
  const inTree = (path: string): string => relative(real(root), real(path)).split('\\').join('/');
  let text: string;
  try {
    text = git(['show', `${ref}:${inTree(p.manifestPath)}`]);
  } catch {
    return { nothing: `the manifest is new since ${ref}` };
  }
  const compiled = compileManifest(text);
  if (!compiled.model) return { nothing: `the manifest at ${ref} does not compile` };
  const names = git(['ls-tree', '-r', '--full-tree', '--name-only', ref, '--', inTree(p.config.features!)])
    .split('\n')
    .filter((name) => name.endsWith('.feature'));
  const features = names.map((name) => ({ path: display(io, join(root, name)), text: git(['show', `${ref}:${name}`]) }));
  return { side: { model: compiled.model, applications: compiled.applications }, features };
}

async function compileCommand(io: CliIo, report: Report, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({ args: [...argv], options: OPTIONS, strict: true, allowPositionals: true });
  if (positionals.length > 0) throw new UsageError(`compile takes no argument: ${positionals.join(' ')}`);
  const p = await project(io, report, values);
  if (!p) return report.end(1);
  const result = compileProject(io, report, p);
  if (!result) return report.end(1);
  const files = (await writeGenerated(p.outDir, result.files)).map((line) => ({ status: line.status, path: display(io, line.path) }));
  for (const file of files) report.out(`${file.status.padEnd(10)} ${file.path}`);
  return report.end(0, { files });
}

function features(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (!statSync(dir).isDirectory()) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? features(join(dir, e.name)) : e.name.endsWith('.feature') ? [join(dir, e.name)] : [])).sort();
}

async function verifyCommand(io: CliIo, report: Report, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({ args: [...argv], options: OPTIONS, strict: true, allowPositionals: true });
  if (positionals.length > 0) throw new UsageError(`verify takes no argument: ${positionals.join(' ')}`);
  const p = await project(io, report, values);
  if (!p) {
    report.err('verify failed: the config is not valid');
    return report.end(1, { gates: [] });
  }
  const result = compileProject(io, report, p);
  if (!result) {
    report.err('verify failed: the manifest does not compile');
    return report.end(1, { gates: [] });
  }
  // The warnings of the manifest, such as deprecated-use, count with those of the gates.
  let warnings = result.compiled.diagnostics.filter((d) => d.severity === 'warning').length;
  const show = (path: string): string => display(io, path);
  const generatedPath = join(p.outDir, GENERATED_FILE);
  const coreOptions = { corePath: p.config.core!, generatedPath, tsconfigPath: p.config.tsconfig!, show };
  const program = coreProgram(coreOptions);
  const featureFiles = features(p.config.features!).map((path) => ({ path: show(path), text: readFileSync(path, 'utf8') }));
  const outcomes: GateOutcome[] = [
    completenessGate(coreOptions, program),
    boundaryGate({ ...coreOptions, shell: p.config.shell ?? [] }, program),
    gherkinGate({
      model: result.compiled.model,
      applications: result.compiled.applications,
      features: featureFiles,
      coverage: p.config.coverage ?? 'warn',
    }),
    await driftGate(p.outDir, result.files, show),
  ];
  if (values['base'] !== undefined) {
    const manifestFile = show(p.manifestPath);
    outcomes.push(
      contractGate({
        base: values['base'],
        old: baseContract(io, p, values['base']),
        next: { side: { model: result.compiled.model, applications: result.compiled.applications }, features: featureFiles },
        at: (path) => {
          const line = lineOf(result.text, path);
          return { file: manifestFile, ...(line ? { line } : {}) };
        },
      }),
    );
  }
  for (const outcome of outcomes) {
    report.out(`gate ${outcome.gate}  ${outcome.name.padEnd(12)}  ${outcome.pass ? 'PASS' : 'FAIL'}  ${outcome.summary}`);
    for (const problem of outcome.problems) {
      if (problem.severity === 'warning') warnings++;
      report.problem(problem, 'stdout', '    ');
    }
  }
  const gates = outcomes.map((o) => ({ gate: o.gate, name: o.name, pass: o.pass, summary: o.summary }));
  const ran = `gates ${outcomes.map((o) => o.gate).join(', ')}`;
  const failed = outcomes.filter((o) => !o.pass).map((o) => o.gate);
  if (failed.length > 0) {
    report.err(`verify failed: gate ${failed.join(', ')}`);
    return report.end(1, { gates, warnings });
  }
  report.out(warnings > 0 ? `verify passed with ${warnings} warning(s) (${ran})` : `verify passed (${ran})`);
  return report.end(0, { gates, warnings });
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

/** Takes --format <text|json> (or --format=<…>) out of the arguments of a command. */
function takeFormat(args: readonly string[]): { format: Format; rest: string[] } {
  const rest: string[] = [];
  let format: string = 'text';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--format') {
      format = args[++i] ?? '';
    } else if (arg.startsWith('--format=')) {
      format = arg.slice('--format='.length);
    } else {
      rest.push(arg);
    }
  }
  if (format !== 'text' && format !== 'json') throw new UsageError(`--format must be text or json, not "${format}"`);
  return { format, rest };
}

/** Runs a command. Gives the exit code: 0, 1 for a failure, 2 for a usage error. */
export async function main(argv: readonly string[], io: CliIo = { cwd: process.cwd(), stdout: (t) => console.log(t), stderr: (t) => console.error(t) }): Promise<number> {
  const [command, ...args] = argv;
  // --format belongs to compile, verify and diff: it is taken out before their own options are read.
  let format: Format = 'text';
  let rest = args;
  let report = new Report(io, format);
  try {
    if (command === 'compile' || command === 'verify' || command === 'diff') {
      ({ format, rest } = takeFormat(args));
      report = new Report(io, format);
    }
    switch (command) {
      case 'init':
        return await initCommand(io, rest);
      case 'compile':
        return await compileCommand(io, report, rest);
      case 'verify':
        return await verifyCommand(io, report, rest);
      case 'diff': {
        const { diffCommand } = await import('./diff/command.js');
        return await diffCommand(io, report, rest);
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
      if (report.format === 'json') {
        report.problem({ code: 'usage', severity: 'error', message: (error as Error).message });
        return report.end(2);
      }
      io.stderr(`${(error as Error).message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
}

export { UsageError };
