#!/usr/bin/env node
// Runs the TypeScript sources through tsx, so the CLI needs no build step.
import module from 'node:module';
import { register } from 'tsx/esm/api';

// Keep the compiled code of each module in V8's cache between runs: a no-op where Node does not have it.
module.enableCompileCache?.();

// When the reader of the output stops early (`urn-forge verify | head`), drop the rest of the output.
// When the output cannot be written at all, such as on a full disk, say so in one line and exit 1.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error) => {
    if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED') return;
    if (stream === process.stdout) process.stderr.write(`urn-forge: cannot write the output: ${error.message}\n`);
    process.exit(1);
  });
}

register();
const { run } = await import('../src/entry.ts');
process.exitCode = await run(process.argv.slice(2));
