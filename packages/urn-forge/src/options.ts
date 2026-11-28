/**
 * The options of each command. A command takes only its own options: a flag of another command is a
 * usage error that names the flag and the command, so that a flag never does nothing without a word.
 */
import { parseArgs } from 'node:util';

const STRING = { type: 'string' } as const;
const PROJECT = { config: STRING, manifest: STRING, out: STRING } as const;

export const COMMAND_OPTIONS = {
  init: { namespace: STRING, domain: STRING },
  compile: { ...PROJECT },
  verify: { ...PROJECT, core: STRING, features: STRING, tsconfig: STRING, base: STRING },
  diff: { report: { type: 'boolean' } },
} as const;

export type OptionsCommand = keyof typeof COMMAND_OPTIONS;

/** A wrong command line: exit 2, with the message and the usage. */
export class UsageError extends Error {}

/** Reads the arguments of a command with its own options; a flag of another command is a UsageError. */
export function parseOptions<C extends OptionsCommand>(command: C, argv: readonly string[]) {
  try {
    return parseArgs({ args: [...argv], options: COMMAND_OPTIONS[command], strict: true, allowPositionals: true });
  } catch (error) {
    const flag = (error as { code?: string }).code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' ? /'--?([^'=]+)/.exec((error as Error).message)?.[1] : undefined;
    const elsewhere = flag && (Object.keys(COMMAND_OPTIONS) as OptionsCommand[]).filter((c) => c !== command && Object.hasOwn(COMMAND_OPTIONS[c], flag));
    if (elsewhere && elsewhere.length > 0) throw new UsageError(`--${flag} is not an option of ${command}; it is an option of ${elsewhere.join(' and ')}`);
    throw error;
  }
}
