#!/usr/bin/env node
// Runs the TypeScript sources through tsx, so the CLI needs no build step in the MVP.
import { register } from 'tsx/esm/api';

register();
const { main } = await import('../src/cli.ts');
process.exitCode = await main(process.argv.slice(2));
