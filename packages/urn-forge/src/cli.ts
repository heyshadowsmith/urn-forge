/**
 * urn-forge CLI (spec §9; the MVP ships `compile` and `verify`).
 *
 *   urn-forge compile [--manifest <file>] [--out <dir>]
 *   urn-forge verify  [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>]
 *
 * Diagnostics print as `<manifest>  <severity>  <message>`; messages lead with the URN.
 * Exit codes: 0 success, 1 error diagnostics or a failed gate, 2 usage error.
 */
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { compile, type Diagnostic } from './engine.js';
import { verify } from './verify/index.js';
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
  urn-forge compile [--manifest <file>] [--out <dir>]
  urn-forge verify  [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>]

Options:
  --manifest <file>  Manifest YAML (default: domain.manifest.yaml)
  --out <dir>        Directory for generated files (default: src/generated)
  --core <file>      verify: core entry exporting \`satisfies DomainCoreImplementation\` (default: src/core.ts)
  --features <dir>   verify: directory searched for .feature files (default: features)
  --tsconfig <file>  verify: tsconfig whose options gate 1 type-checks with (default: tsconfig.json)`;

/** Paths printed relative to cwd with forward slashes, so output does not depend on the machine. */
function display(io: CliIo, path: string): string {
  return relative(io.cwd, path).split('\\').join('/') || '.';
}

function printDiagnostics(io: CliIo, file: string, diagnostics: readonly Diagnostic[]): void {
  for (const d of diagnostics) io.stderr(`${file}  ${d.severity}  ${d.message}`);
}

async function runCompile(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      manifest: { type: 'string', default: 'domain.manifest.yaml' },
      out: { type: 'string', default: 'src/generated' },
    },
    strict: true,
    allowPositionals: false,
  });
  const manifestPath = resolve(io.cwd, values.manifest);
  const outDir = resolve(io.cwd, values.out);
  const manifestLabel = display(io, manifestPath);

  let source: string;
  try {
    source = await readFile(manifestPath, 'utf8');
  } catch (error) {
    io.stderr(`${manifestLabel}  error  cannot read manifest: ${(error as Error).message}`);
    return 1;
  }

  const result = compile(source);
  printDiagnostics(io, manifestLabel, result.diagnostics);
  if (result.diagnostics.some((d) => d.severity === 'error')) return 1;

  for (const { path, changed } of await writeGeneratedFiles(outDir, result.files)) {
    io.stdout(`${changed ? 'wrote     ' : 'unchanged '} ${display(io, path)}`);
  }
  io.stdout(`fingerprint ${result.fingerprint}`);
  return 0;
}

async function runVerify(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      manifest: { type: 'string', default: 'domain.manifest.yaml' },
      out: { type: 'string', default: 'src/generated' },
      core: { type: 'string', default: 'src/core.ts' },
      features: { type: 'string', default: 'features' },
      tsconfig: { type: 'string', default: 'tsconfig.json' },
    },
    strict: true,
    allowPositionals: false,
  });
  const manifestPath = resolve(io.cwd, values.manifest);
  const result = await verify({
    cwd: io.cwd,
    manifestPath,
    outDir: resolve(io.cwd, values.out),
    corePath: resolve(io.cwd, values.core),
    featuresDir: resolve(io.cwd, values.features),
    tsconfigPath: resolve(io.cwd, values.tsconfig),
  });

  printDiagnostics(io, display(io, manifestPath), result.diagnostics);
  for (const gate of result.gates) {
    io.stdout(`gate ${gate.gate}  ${gate.name.padEnd(12)}  ${gate.ok ? 'PASS' : 'FAIL'}  ${gate.summary}`);
    for (const problem of gate.problems) {
      for (const line of problem.split('\n')) io.stdout(`    ${line}`);
    }
  }
  if (result.ok) {
    io.stdout('verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)');
    return 0;
  }
  const failed = result.gates.filter((g) => !g.ok).map((g) => g.gate);
  io.stderr(failed.length > 0 ? `verify failed: gate ${failed.join(', ')}` : 'verify failed: the manifest does not compile');
  return 1;
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
    if ((error as { code?: string }).code?.startsWith('ERR_PARSE_ARGS')) {
      io.stderr(`${(error as Error).message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
}
