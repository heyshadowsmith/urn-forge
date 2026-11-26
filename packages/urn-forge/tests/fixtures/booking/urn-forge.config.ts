import { defineConfig } from '../../../src/config.js';

export default defineConfig({
  tsconfig: '../../../tsconfig.json',
  domains: [{ out: 'generated', core: 'core.ts', postgres: { tables: ['booking'] } }],
});
