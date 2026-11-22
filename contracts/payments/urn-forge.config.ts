import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
