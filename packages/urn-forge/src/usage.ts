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

export const USAGE = `urn-forge ${VERSION}

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
  --format <format>  compile, verify, diff: text (default), or json: one JSON object on stdout, and nothing else

Exit codes: 0 pass, 1 failure, 2 wrong command line, 3 urn-forge itself failed (report it)`;

/** The answer to a command line that names no command of urn-forge, or undefined for a command. */
export function answerWithoutCommand(command: string | undefined, io: { readonly stdout: (text: string) => void; readonly stderr: (text: string) => void }): number | undefined {
  switch (command) {
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
      if ((COMMANDS as readonly string[]).includes(command)) return undefined;
      io.stderr(`unknown command "${command}"\n\n${USAGE}`);
      return 2;
  }
}
