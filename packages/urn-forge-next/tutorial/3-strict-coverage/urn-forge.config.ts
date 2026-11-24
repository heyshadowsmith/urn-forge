import { defineConfig } from 'urn-forge-next/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // Every operation, output and rule must have a scenario: a gap fails verify.
  coverage: 'error',
});
