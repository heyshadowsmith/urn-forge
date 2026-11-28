/**
 * The entry of the bin. A command line with no command of urn-forge is answered here, with the usage and
 * the version alone; a command loads the CLI and its own modules only then.
 */
import type { CliIo } from './cli.js';
import { answerWithoutCommand } from './usage.js';

export async function run(argv: readonly string[], io?: CliIo): Promise<number> {
  const answer = answerWithoutCommand(argv, io ?? { stdout: (t) => console.log(t), stderr: (t) => console.error(t) });
  if (answer !== undefined) return answer;
  const { main } = await import('./cli.js');
  return main(argv, io);
}
