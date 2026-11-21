// The insurance domain. Paths are relative to this file.
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  manifest: './domain.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../tsconfig.json',
  // Strict from the start (invariants plan, step 6).
  boundaryCoverage: 'error',
});
