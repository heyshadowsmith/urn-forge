/**
 * The options of each command. A command takes only its own options: a flag of another command is a
 * usage error that names the flag and the command, so that a flag never does nothing without a word.
 */
import { parseArgs } from 'node:util';

const STRING = { type: 'string' } as const;
const PROJECT = { config: STRING, manifest: STRING, out: STRING } as const;

export const COMMAND_OPTIONS = {
  init: { namespace: STRING, domain: STRING },
  compile: { ...PROJECT, format: STRING },
  verify: { ...PROJECT, core: STRING, features: STRING, tsconfig: STRING, base: STRING, format: STRING },
  diff: { report: { type: 'boolean' }, format: STRING },
} as const;

export type OptionsCommand = keyof typeof COMMAND_OPTIONS;

/** A wrong command line: exit 2, with the message and the usage. */
export class UsageError extends Error {}

/**
 * Reads the arguments of a command with its own options. A wrong command line is a UsageError with a
 * short message: an option of another command, an unknown option with the nearest option of this one,
 * an option with no value, or an option given two times.
 */
export function parseOptions<C extends OptionsCommand>(command: C, argv: readonly string[]) {
  let parsed;
  try {
    parsed = parseArgs({ args: [...argv], options: COMMAND_OPTIONS[command], strict: true, allowPositionals: true, tokens: true });
  } catch (error) {
    throw usageOf(command, error);
  }
  const seen = new Set<string>();
  for (const token of parsed.tokens) {
    if (token.kind !== 'option') continue;
    if (seen.has(token.name)) throw new UsageError(`--${token.name} is given two times`);
    seen.add(token.name);
  }
  return parsed;
}

/** The UsageError of an error of parseArgs, with a message for the agent, not the hint of Node. */
function usageOf(command: OptionsCommand, error: unknown): unknown {
  const code = (error as { code?: string }).code;
  const message = (error as Error).message ?? '';
  if (code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
    const raw = /'(-[^']*)'/.exec(message)?.[1] ?? '';
    const name = raw.replace(/^--?/, '').split('=')[0]!;
    const elsewhere = (Object.keys(COMMAND_OPTIONS) as OptionsCommand[]).filter((c) => c !== command && Object.hasOwn(COMMAND_OPTIONS[c], name));
    if (raw.startsWith('--') && elsewhere.length > 0) return new UsageError(`--${name} is not an option of ${command}; it is an option of ${elsewhere.join(' and ')}`);
    const near = raw.startsWith('--') ? nearest(name, Object.keys(COMMAND_OPTIONS[command])) : undefined;
    return new UsageError(`unknown option ${raw}${near ? `; did you mean --${near}?` : ''}`);
  }
  if (code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') {
    const name = /'--?([a-z-]+)/.exec(message)?.[1] ?? '';
    return new UsageError(/does not take an argument/.test(message) ? `--${name} takes no value` : `--${name} needs a value`);
  }
  return error;
}

/** The option nearest to a name, at most two edits away: a typo, not another word. */
function nearest(name: string, options: readonly string[]): string | undefined {
  const distance = (a: string, b: string): number => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0]!;
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const current = row[j]!;
        row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    return row[b.length]!;
  };
  const ranked = options.map((o) => ({ o, d: distance(name, o) })).filter((x) => x.d <= 2).sort((x, y) => x.d - y.d);
  return ranked[0]?.o;
}
