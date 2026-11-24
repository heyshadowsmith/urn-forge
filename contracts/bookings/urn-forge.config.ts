import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // Every operation, output and rule must have a scenario.
  coverage: 'error',
  // The booking table. A reference is its primary key: two stored bookings never share one.
  postgres: { tables: ['booking'] },
});
