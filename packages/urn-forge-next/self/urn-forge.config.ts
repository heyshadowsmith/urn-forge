// urn-forge's own domain. Paths are relative to this file.
import { defineConfig } from 'urn-forge-next/config';

export default defineConfig({
  out: 'generated',
  core: 'core.ts',
  tsconfig: '../tsconfig.json',
  // Every operation, output and rule has a scenario; this keeps new ones covered too.
  coverage: 'error',
});
