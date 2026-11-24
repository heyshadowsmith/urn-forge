import { defineConfig } from '../../../src/config.js';

export default defineConfig({
  out: 'generated',
  core: 'core.ts',
  tsconfig: '../../../tsconfig.json',
  coverage: 'error',
});
