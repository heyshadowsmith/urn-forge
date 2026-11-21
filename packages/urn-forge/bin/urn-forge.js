#!/usr/bin/env node
// Runs the TypeScript sources through tsx, so the CLI needs no build step in the MVP.
import { register } from 'tsx/esm/api';

// When the reader of the output stops early (`urn-forge verify | head`), the next write
// fails with EPIPE. That is not an error of urn-forge: drop the rest of the output.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error) => {
    if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_DESTROYED') throw error;
  });
}

register();
const { main } = await import('../src/cli.ts');
process.exitCode = await main(process.argv.slice(2));
