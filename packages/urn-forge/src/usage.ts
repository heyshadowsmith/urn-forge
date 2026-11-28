/**
 * The usage and the version, and the answers that need no command: --help, --version, no command and an
 * unknown command. The bin answers these with this module alone, so that they load no compiler, no test
 * runner and no command (planning/startup-plan.md).
 */
import { readFileSync } from 'node:fs';
import { CONFIG_FILE } from './config.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version as string;

/** The commands of urn-forge; each one loads its own modules when it runs. */
export const COMMANDS = ['init', 'compile', 'verify', 'diff'] as const;

/** The help of each command: its line, what it does, its options, and its exit codes. */
export const HELP: Readonly<Record<(typeof COMMANDS)[number], string>> = {
  init: `urn-forge init [--namespace <name>] [--domain <name>]

Writes a starter project that passes verify, with AGENTS.md and a Claude Code skill for coding agents.
It writes no file when a starter file exists already, or when package.json is not a JSON object.

Options:
  --namespace <name>  The namespace of the starter manifest (default: app)
  --domain <name>     The domain of the starter manifest (default: starter)

Exit codes: 0 written, 1 nothing written (the message says why), 2 wrong command line`,
  compile: `urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--format text|json]

Writes the generated files of each domain of the config, or of the one manifest.

Options:
  --config <file>    The config (default: ${CONFIG_FILE}, when it exists). The flags below override it
  --manifest <file>  The manifest (default: domain.manifest.yaml)
  --out <dir>        The directory of the generated files (default: src/generated)
  --format <format>  text (default), or json: one JSON object on stdout, and nothing else

Exit codes: 0 written, 1 a problem, 2 wrong command line, 3 urn-forge itself failed (report it)`,
  verify: `urn-forge verify [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--base <ref>] [--format text|json]

Compiles each domain in memory and runs the gates; writes nothing. The report goes to stdout.
Gate 1 checks the core, gate 2 the shell, gate 3 the scenarios, gate 4 the generated files; gate 5 runs only with --base.

Options:
  --config <file>    The config (default: ${CONFIG_FILE}, when it exists). The flags below override it
  --manifest <file>  The manifest (default: domain.manifest.yaml)
  --out <dir>        The directory of the generated files, which gate 4 compares (default: src/generated)
  --core <file>      The core, which exports … satisfies DomainCore (default: src/core.ts)
  --features <dir>   The directory of the .feature files (default: features)
  --tsconfig <file>  The tsconfig of gate 1 (default: tsconfig.json)
  --base <ref>       Run gate 5, which compares the contract with the one at this git ref (a branch, tag or commit)
  --format <format>  text (default), or json: one JSON object on stdout, and nothing else

Exit codes: 0 pass (also with warnings), 1 a gate or a problem failed, 2 wrong command line, 3 urn-forge itself failed (report it)`,
  diff: `urn-forge diff <old manifest> <new manifest> [--report] [--format text|json]

Classifies each change between two manifests as breaking or compatible, and judges whether the new
version allows the breaking changes.

Options:
  --report           List the changes, and do not fail on a breaking change
  --format <format>  text (default), or json: one JSON object on stdout, and nothing else

Exit codes: 0 no breaking change, or one that the versions allow, 1 a breaking change that they do not allow or a problem, 2 wrong command line, 3 urn-forge itself failed (report it)`,
};

export const USAGE = `urn-forge ${VERSION}: the contract of a domain, checked by its compiler, its scenarios and its gates.

Usage:
  urn-forge init    [--namespace <name>] [--domain <name>]
  urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--format text|json]
  urn-forge verify  [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--base <ref>] [--format text|json]
  urn-forge diff    <old manifest> <new manifest> [--report] [--format text|json]
  urn-forge --help | -h | help [<command>]
  urn-forge --version | -V | version

Run urn-forge <command> --help for its options.

Exit codes: 0 pass, 1 failure, 2 wrong command line, 3 urn-forge itself failed (report it)`;

/** A wrong command line: its one line, and where to read the right one. */
export function usageLine(command: string | undefined, message: string): string {
  return command && (COMMANDS as readonly string[]).includes(command)
    ? `urn-forge ${command}: ${message}\nRun urn-forge ${command} --help for its options.`
    : `urn-forge: ${message}\nRun urn-forge --help for the commands.`;
}

/** The options before --: help and its alias stop there, as each option does. */
function options(args: readonly string[]): readonly string[] {
  const end = args.indexOf('--');
  return end === -1 ? args : args.slice(0, end);
}

type Io = { readonly stdout: (text: string) => void; readonly stderr: (text: string) => void };

/**
 * The answer to a command line that needs no command: the usage, the help of a command, the version, or
 * a wrong command line. Undefined for a command, which loads its own modules.
 */
export function answerWithoutCommand(argv: readonly string[], io: Io): number | undefined {
  const [command, ...args] = argv;
  const wrong = (message: string, of = command): number => {
    io.stderr(usageLine(of, message));
    return 2;
  };
  if (command !== undefined && (COMMANDS as readonly string[]).includes(command)) {
    if (!options(args).some((a) => a === '--help' || a === '-h')) return undefined;
    io.stdout(HELP[command as (typeof COMMANDS)[number]]);
    return 0;
  }
  switch (command) {
    case undefined:
      io.stderr(USAGE);
      return 2;
    case '--help':
    case '-h':
    case 'help': {
      if (args.length === 0) {
        io.stdout(USAGE);
        return 0;
      }
      const [topic, ...more] = args;
      if (command === 'help' && more.length === 0 && (COMMANDS as readonly string[]).includes(topic!)) {
        io.stdout(HELP[topic as (typeof COMMANDS)[number]]);
        return 0;
      }
      return wrong(command === 'help' ? `help takes one command: ${COMMANDS.join(', ')}` : `${command} takes no argument: ${args.join(' ')}`, undefined);
    }
    case '--version':
    case '-V':
    case 'version':
      if (args.length > 0) return wrong(`${command} takes no argument: ${args.join(' ')}`, undefined);
      io.stdout(VERSION);
      return 0;
    default:
      return wrong(command.startsWith('-') ? `put ${command} after the command` : `unknown command ${command}`, undefined);
  }
}
