/**
 * The command line: init, compile, verify and diff.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { isNode, LineCounter, parseDocument } from 'yaml';
import { compileManifest, generate, GENERATED_FILE, type Compiled } from './compile.js';
import { CONFIG_FILE, loadConfig, type UrnForgeConfig } from './config.js';
import { answerWithoutCommand, usageLine } from './usage.js';
export { VERSION } from './usage.js';
import { fixOf, type Code, type Command } from './codes.js';
import { brokenBy, decide, InternalContractError } from './self.js';
import type { Diagnostic, Path } from './diagnostics.js';
import { filesUnder } from './files.js';
import { initProject, nameProblem } from './init.js';
import { parseOptions, UsageError } from './options.js';
import { domainUrn } from './urn.js';
import { boundaryGate } from './verify/boundary.js';
import { completenessGate, coreProgram } from './verify/completeness.js';
import { contractGate, type ContractGateInput } from './verify/contract.js';
import { driftGate } from './verify/drift.js';
import { gherkinGate } from './verify/gherkin.js';
import type { GateOutcome, GateProblem } from './verify/types.js';
import { writeGenerated } from './write.js';


export interface CliIo {
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}



/** A problem as the commands report it: a stable code, where it is, what is wrong, and (from its code) the fix. */
export interface Problem {
  readonly code: Code;
  readonly severity: 'error' | 'warning';
  readonly file?: string;
  readonly line?: number;
  /** The place in the manifest or the config, as a path of keys. */
  readonly path?: Path;
  readonly message: string;
  /** The URN of the domain of the problem, when it is known. */
  readonly domain?: string;
}

export type Format = 'text' | 'json';

/** The keys of the report of each command, empty: the report of a failure has them too. */
const EMPTY_REPORT: Readonly<Record<Command, Record<string, unknown>>> = {
  compile: { files: [] },
  verify: { gates: [], domains: [], warnings: 0 },
  diff: { changes: [] },
};

/**
 * The output of a command. As text, it writes each line as it comes, and each problem with its fix on
 * the next line. As JSON, it writes nothing until the end, and then one object to stdout.
 */
export class Report {
  readonly problems: Problem[] = [];
  /** The URN of the domain that the next problems belong to, if any. */
  domain: string | undefined;

  constructor(
    private readonly io: CliIo,
    readonly format: Format,
    /** The command, whose JSON report keeps the definition <command>_report of self/. */
    private readonly command?: Command,
  ) {}

  private get definition(): 'compile_report' | 'verify_report' | 'diff_report' | undefined {
    return this.command && `${this.command}_report`;
  }

  /** A line of text for stdout; nothing as JSON. */
  out(text: string): void {
    if (this.format === 'text') this.io.stdout(text);
  }

  /**
   * A problem: on stdout, as each line of the report of the command, and on stderr only when urn-forge
   * itself failed. A wrong command line goes to stderr too, but it is no problem of a report.
   */
  problem(problem: Problem, indent = ''): void {
    this.problems.push(problem.domain === undefined && this.domain !== undefined ? { ...problem, domain: this.domain } : problem);
    if (this.format !== 'text') return;
    const write = problem.code === 'internal-error' || problem.code === 'internal-contract' ? this.io.stderr : this.io.stdout;
    const where = problem.file ? `${problem.file}${problem.line ? `:${problem.line}` : ''}  ` : '';
    write(`${indent}${where}${problem.severity}  ${problem.code}  ${problem.message}`);
    write(`${indent}  fix: ${fixFor(problem.code, problem.severity, this.command)}`);
  }

  /** Ends the command with its exit code: as JSON, writes the one object. */
  end(code: number, extra: Record<string, unknown> = {}): number {
    if (this.format === 'json') {
      // A key with no value is absent, not null: the manifest has no null.
      const problems = this.problems.map((p) => ({
        code: p.code,
        severity: p.severity,
        ...(p.file !== undefined ? { file: p.file } : {}),
        ...(p.line !== undefined ? { line: p.line } : {}),
        ...(p.path !== undefined ? { path: p.path } : {}),
        ...(p.domain !== undefined ? { domain: p.domain } : {}),
        message: p.message,
        fix: fixFor(p.code, p.severity, this.command),
      }));
      // Each key of the report of the command, empty when it does not apply, so that its shape is one on each path.
      const value = { ok: code === 0, ...(this.command ? EMPTY_REPORT[this.command] : {}), ...extra, problems };
      // urn-forge checks its own report against self/ before it writes it.
      const broken = this.definition && brokenBy(this.definition, value);
      if (broken) {
        this.io.stdout(JSON.stringify({ ok: false, problems: [{ code: 'internal-contract', severity: 'error', message: broken, fix: fixFor('internal-contract', 'error', this.command) }] }));
        return 1;
      }
      this.io.stdout(JSON.stringify(value));
    }
    return code;
  }
}

/**
 * The key of a path, so that two names of one file or folder are equal: its real path through each
 * symlink (for a path that does not exist yet, the real path of the nearest folder that exists, and the
 * rest), in lower case where the file system ignores case, as on macOS and Windows.
 */
function samePath(path: string): string {
  let existing = path;
  const rest: string[] = [];
  while (!existsSync(existing) && dirname(existing) !== existing) {
    rest.unshift(basename(existing));
    existing = dirname(existing);
  }
  const real = join(realpathSync.native(existing), ...rest);
  return process.platform === 'darwin' || process.platform === 'win32' ? real.toLowerCase() : real;
}

/** A path as the output shows it: relative to the working directory, with forward slashes. */
function display(io: CliIo, path: string): string {
  return relative(io.cwd, path).split('\\').join('/') || '.';
}

/** The line of a path in a YAML text, or of the nearest part of it that exists. */
/** The last manifest that lineOf parsed, so that the diagnostics of one manifest parse it once. */
let parsed: { readonly text: string; readonly counter: LineCounter; readonly document: ReturnType<typeof parseDocument> } | undefined;

export function lineOf(text: string, path: Path): number | undefined {
  if (parsed?.text !== text) {
    const counter = new LineCounter();
    parsed = { text, counter, document: parseDocument(text, { lineCounter: counter, keepSourceTokens: true }) };
  }
  const { counter, document } = parsed;
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

/** One domain of a project, with its paths resolved. */
interface DomainProject {
  readonly manifestPath: string;
  readonly outDir: string;
  readonly corePath: string;
  readonly featuresPath: string;
}

interface Project {
  readonly configPath: string;
  readonly base: string;
  readonly tsconfigPath: string;
  readonly shell: readonly string[];
  readonly domains: readonly DomainProject[];
}


/** The flags that name the paths of one domain. */
const DOMAIN_FLAGS = ['manifest', 'out', 'core', 'features'] as const;

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
  const domains = config.domains ?? [{}];
  const flags = DOMAIN_FLAGS.filter((flag) => values[flag] !== undefined);
  if (flags.length > 0 && domains.length > 1) {
    throw new UsageError(`--${flags[0]} names the path of one domain, and the config has ${domains.length} domains: change the config`);
  }
  // A path of the config is relative to the config; a path of a flag to the working directory.
  const base = dirname(configPath);
  const path = (flag: string | undefined, option: string | undefined, fallback: string): string =>
    flag !== undefined ? resolve(io.cwd, flag) : resolve(base, option ?? fallback);
  const resolved: DomainProject[] = domains.map((d) => ({
    manifestPath: path(values['manifest'], d.manifest, 'domain.manifest.yaml'),
    outDir: path(values['out'], d.out, 'src/generated'),
    corePath: path(values['core'], d.core, 'src/core.ts'),
    featuresPath: path(values['features'], d.features, 'features'),
  }));
  // Two domains must not share a manifest, a folder of generated files or a folder of scenarios.
  const clashes: [keyof DomainProject, string][] = [
    ['manifestPath', 'read the manifest'],
    ['outDir', 'write to'],
    ['featuresPath', 'read the scenarios of'],
  ];
  let clash = false;
  for (const [key, what] of clashes) {
    const seen = new Set<string>();
    for (const d of resolved) {
      const value = d[key] as string;
      if (seen.has(samePath(value))) {
        report.problem({ code: 'config-invalid', severity: 'error', file: display(io, configPath), message: `two domains ${what} ${display(io, value)}; give each domain its own` });
        clash = true;
      }
      seen.add(samePath(value));
    }
  }
  if (clash) return undefined;
  return {
    configPath,
    base,
    tsconfigPath: path(values['tsconfig'], config.tsconfig, 'tsconfig.json'),
    shell: (config.shell ?? []).map((s) => resolve(base, s)),
    domains: resolved,
  };
}

interface CompiledDomain {
  readonly domain: DomainProject;
  readonly urn: string;
  readonly compiled: Compiled & { model: NonNullable<Compiled['model']> };
  readonly files: ReturnType<typeof generate>;
  readonly text: string;
}

/** Reads and compiles the manifest of a domain; shows its diagnostics. Undefined when it cannot be read or has an error. */
function compileDomain(io: CliIo, report: Report, p: Project, d: DomainProject): CompiledDomain | undefined {
  report.domain = undefined;
  let text: string;
  try {
    text = readFileSync(d.manifestPath, 'utf8');
  } catch {
    report.problem({ code: 'manifest-unreadable', severity: 'error', file: display(io, d.manifestPath), message: 'the manifest does not exist' });
    return undefined;
  }
  const compiled = compileManifest(text);
  if (compiled.model) report.domain = domainUrn(compiled.model.header);
  showDiagnostics(report, display(io, d.manifestPath), text, compiled.diagnostics);
  if (!compiled.model) return undefined;
  // The header names the manifest relative to the config, so that it does not depend on the working directory.
  const source = relative(p.base, d.manifestPath).split('\\').join('/');
  const model = compiled as Compiled & { model: NonNullable<Compiled['model']> };
  const files = generate(model, source);
  return { domain: d, urn: domainUrn(compiled.model.header), compiled: model, files, text };
}

/** Compiles each domain. Undefined when one of them has an error, or when two have one URN. */
function compileProject(io: CliIo, report: Report, p: Project): CompiledDomain[] | undefined {
  const results = p.domains.map((d) => compileDomain(io, report, p, d));
  report.domain = undefined;
  if (results.some((r) => r === undefined)) return undefined;
  const compiled = results as CompiledDomain[];
  const seen = new Set<string>();
  let clash = false;
  for (const c of compiled) {
    if (seen.has(c.urn)) {
      report.problem({ code: 'config-invalid', severity: 'error', file: display(io, p.configPath), message: `two domains have the URN ${c.urn}; give each a namespace and a domain of its own` });
      clash = true;
    }
    seen.add(c.urn);
  }
  return clash ? undefined : compiled;
}

/** The contract at a git ref: the manifest and the features of a domain at their paths of the working tree. */
function baseContract(io: CliIo, d: DomainProject, ref: string): ContractGateInput['old'] {
  const git = (args: string[]): string =>
    execFileSync('git', args, { cwd: dirname(d.manifestPath), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
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
    text = git(['show', `${ref}:${inTree(d.manifestPath)}`]);
  } catch {
    return { nothing: `the manifest is new since ${ref}` };
  }
  const compiled = compileManifest(text);
  if (!compiled.model) return { nothing: `the manifest at ${ref} does not compile` };
  const names = git(['ls-tree', '-r', '--full-tree', '--name-only', ref, '--', inTree(d.featuresPath)])
    .split('\n')
    .filter((name) => name.endsWith('.feature'));
  const features = names.map((name) => ({ path: display(io, join(root, name)), text: git(['show', `${ref}:${name}`]) }));
  return { side: { model: compiled.model, applications: compiled.applications }, features };
}

async function compileCommand(io: CliIo, report: Report, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseOptions('compile', argv);
  if (positionals.length > 0) throw new UsageError(`takes no argument: ${positionals.join(' ')}`);
  const p = await project(io, report, values);
  if (!p) return report.end(1);
  const results = compileProject(io, report, p);
  if (!results) return report.end(1);
  const files: { domain: string; status: string; path: string }[] = [];
  for (const result of results) {
    if (results.length > 1) report.out(result.urn);
    for (const line of await writeGenerated(result.domain.outDir, result.files)) {
      const file = { domain: result.urn, status: line.status, path: display(io, line.path) };
      files.push(file);
      report.out(`${file.status.padEnd(10)} ${file.path}`);
    }
  }
  return report.end(0, { files });
}

/** The .feature files of a path, and the problems of the path: it does not exist, or it is not a .feature file. */
function features(path: string, show: (path: string) => string): { files: string[]; problems: GateProblem[] } {
  const problem = (message: string): GateProblem => ({ code: 'missing-input', severity: 'error', file: show(path), message });
  if (!existsSync(path)) return { files: [], problems: [problem('the features path does not exist, so gate 3 would read no scenario')] };
  if (!statSync(path).isDirectory() && !path.endsWith('.feature')) return { files: [], problems: [problem('the features path is a file, and not a .feature file')] };
  return { files: filesUnder(path, (name) => name.endsWith('.feature')).sort(), problems: [] };
}

async function verifyCommand(io: CliIo, report: Report, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseOptions('verify', argv);
  if (positionals.length > 0) throw new UsageError(`takes no argument: ${positionals.join(' ')}`);
  const p = await project(io, report, values);
  if (!p) {
    report.out('verify failed: the config is not valid');
    return report.end(1, { gates: [], domains: [] });
  }
  const results = compileProject(io, report, p);
  if (!results) {
    report.out('verify failed: the manifest does not compile');
    return report.end(1, { gates: [], domains: [] });
  }
  const show = (path: string): string => display(io, path);
  const several = results.length > 1;
  const domains: { urn: string; gates: { gate: number; name: string; pass: boolean; summary: string }[] }[] = [];
  const failures: string[] = [];
  // The warnings of the manifest, such as deprecated-use, count with those of the gates.
  let warnings = results.reduce((n, r) => n + r.compiled.diagnostics.filter((d) => d.severity === 'warning').length, 0);
  // A problem of the shared shell is shown once, not once for each domain.
  const shellProblems = new Set<string>();
  let ran = '';
  for (const result of results) {
    const d = result.domain;
    report.domain = result.urn;
    const generatedPath = join(d.outDir, GENERATED_FILE);
    const coreOptions = { corePath: d.corePath, generatedPath, tsconfigPath: p.tsconfigPath, show };
    const program = coreProgram(coreOptions);
    const found = features(d.featuresPath, show);
    const featureFiles = found.files.map((path) => ({ path: show(path), text: readFileSync(path, 'utf8') }));
    const boundary = boundaryGate({ ...coreOptions, shell: p.shell }, program);
    const outcomes: GateOutcome[] = [
      completenessGate(coreOptions, program),
      {
        ...boundary,
        problems: boundary.problems.filter((problem) => {
          const key = `${problem.code} ${problem.file} ${problem.line ?? ''} ${problem.message}`;
          if (shellProblems.has(key)) return false;
          shellProblems.add(key);
          return true;
        }),
      },
      gherkinGate({ model: result.compiled.model, applications: result.compiled.applications, features: featureFiles, inputProblems: found.problems }),
      await driftGate(d.outDir, result.files, show),
    ];
    if (values['base'] !== undefined) {
      const manifestFile = show(d.manifestPath);
      outcomes.push(
        contractGate({
          base: values['base'],
          old: baseContract(io, d, values['base']),
          next: { side: { model: result.compiled.model, applications: result.compiled.applications }, features: featureFiles },
          at: (path) => {
            const line = lineOf(result.text, path);
            return { file: manifestFile, ...(line ? { line } : {}) };
          },
        }),
      );
    }
    if (several) report.out(result.urn);
    for (const outcome of outcomes) {
      report.out(`gate ${outcome.gate}  ${outcome.name.padEnd(12)}  ${outcome.pass ? 'PASS' : 'FAIL'}  ${outcome.summary}`);
      for (const problem of outcome.problems) {
        if (problem.severity === 'warning') warnings++;
        report.problem(problem, '    ');
      }
    }
    domains.push({ urn: result.urn, gates: outcomes.map((o) => ({ gate: o.gate, name: o.name, pass: o.pass, summary: o.summary })) });
    const failed = outcomes.filter((o) => !o.pass).map((o) => o.gate);
    if (failed.length > 0) failures.push(several ? `${result.urn} gate ${failed.join(', ')}` : `gate ${failed.join(', ')}`);
    ran = `gates ${outcomes.map((o) => o.gate).join(', ')}`;
  }
  report.domain = undefined;
  const gates = domains.flatMap((d) => d.gates.map((g) => ({ domain: d.urn, ...g })));
  const extra = { gates, domains, warnings };
  if (failures.length > 0) {
    report.out(`verify failed: ${failures.join('; ')}`);
    return report.end(1, extra);
  }
  const what = several ? `${results.length} domains, ${ran}` : ran;
  report.out(warnings > 0 ? `verify passed with ${warnings} warning(s) (${what})` : `verify passed (${what})`);
  return report.end(0, extra);
}

async function initCommand(io: CliIo, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseOptions('init', argv);
  if (positionals.length > 0) throw new UsageError(`takes no argument: ${positionals.join(' ')}`);
  const namespace = values['namespace'] ?? 'app';
  const domain = values['domain'] ?? 'starter';
  const problem = nameProblem('--namespace', namespace) ?? nameProblem('--domain', domain);
  if (problem) throw new UsageError(problem);
  const result = await initProject({ cwd: io.cwd, namespace, domain });
  if (!result.ok) {
    io.stdout(result.message);
    return 1;
  }
  for (const line of result.lines) io.stdout(line);
  io.stdout('next: npm install, then npx urn-forge compile, then npx urn-forge verify');
  return 0;
}

/** The format that a command line asks for, before its options are read: the first --format before --. */
function formatOf(args: readonly string[]): string {
  for (let i = 0; i < args.length && args[i] !== '--'; i++) {
    const arg = args[i]!;
    if (arg === '--format') return args[i + 1] ?? '';
    if (arg.startsWith('--format=')) return arg.slice('--format='.length);
  }
  return 'text';
}

/** Runs a command. Gives the exit code: 0, 1 for a failure, 2 for a usage error, 3 for a failure of urn-forge itself. */
export async function main(argv: readonly string[], io: CliIo = { cwd: process.cwd(), stdout: (t) => console.log(t), stderr: (t) => console.error(t) }): Promise<number> {
  // The help, the version and a command line with no command: as the bin answers them.
  const answered = answerWithoutCommand(argv, io);
  if (answered !== undefined) return answered;
  const [command, ...args] = argv;
  // --format is an option of compile, verify and diff; the report needs it before the options are read.
  const asked = command === 'compile' || command === 'verify' || command === 'diff' ? formatOf(args) : 'text';
  const report = new Report(io, asked === 'json' ? 'json' : 'text', command === 'compile' || command === 'verify' || command === 'diff' ? command : undefined);
  try {
    if (asked !== 'text' && asked !== 'json') throw new UsageError(`--format must be text or json, not "${asked}"`);
    switch (command) {
      case 'init':
        return await initCommand(io, args);
      case 'compile':
        return await compileCommand(io, report, args);
      case 'verify':
        return await verifyCommand(io, report, args);
      case 'diff': {
        const { diffCommand } = await import('./diff/command.js');
        return await diffCommand(io, report, args);
      }
      default:
        return 2;
    }
  } catch (error) {
    if (error instanceof InternalContractError) {
      report.problem({ code: 'internal-contract', severity: 'error', message: error.message });
      return report.end(3);
    }
    if (isSystemError(error)) {
      const where = error.path === undefined ? {} : { file: display(io, error.path) };
      report.problem({ code: 'io-error', severity: 'error', ...where, message: `${error.syscall ?? 'the operation'} failed: ${error.code}` });
      return report.end(1);
    }
    if (error instanceof UsageError || (error as { code?: string }).code?.startsWith('ERR_PARSE_ARGS')) {
      if (report.format === 'json') {
        report.problem({ code: 'usage', severity: 'error', message: (error as Error).message });
        return report.end(2);
      }
      io.stderr(usageLine(command, (error as Error).message));
      return 2;
    }
    // A failure that urn-forge does not expect: exit 3, with no stack unless URN_FORGE_DEBUG asks for it.
    const message = error instanceof Error ? error.message : String(error);
    report.problem({ code: 'internal-error', severity: 'error', message });
    if (process.env['URN_FORGE_DEBUG'] && error instanceof Error && error.stack) io.stderr(error.stack);
    return report.end(3);
  }
}

/** An error of the system, such as ENOENT or EACCES, with the call and the path that failed. */
function isSystemError(error: unknown): error is { code: string; syscall?: string; path?: string } {
  const code = (error as { code?: unknown } | null)?.code;
  return error instanceof Error && typeof code === 'string' && /^E[A-Z]+$/.test(code);
}

/** The fix of a code, from urn-forge's own contract (fix_of of self/), which also checks the severity and the command of the problem. */
function fixFor(code: Code, severity: 'error' | 'warning', command: Command | undefined): string {
  // self: the fixes of urn-forge's own failures are read directly, so that a fix_of that fails can still be reported.
  if (code === 'internal-contract' || code === 'internal-error') return fixOf(code);
  return decide('fix_of', { code, severity, ...(command ? { command } : {}) }).value.fix;
}

export { UsageError };
