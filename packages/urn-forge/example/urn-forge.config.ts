// The math example's urn-forge config. Paths are relative to this file.
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  out: 'generated',
  core: 'core.ts',
  tsconfig: '../tsconfig.json',
  // Every operation, output and rule has a scenario; this keeps new ones covered too.
  coverage: 'error',
});
