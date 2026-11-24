/** `urn-forge diff`: built in phase 3. */
import type { CliIo } from '../cli.js';

export async function diffCommand(io: CliIo, _argv: readonly string[]): Promise<number> {
  io.stderr('diff is not built yet');
  return 1;
}
