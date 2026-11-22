import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // The Postgres extra writes the outbox of the events with a delivery.
  plugins: ['valibot', 'fcis', ['postgres', {}]],
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
