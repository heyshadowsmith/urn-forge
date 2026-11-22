import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json. The Postgres plugin writes the outbox of the events, which keeps
// their delivery (schema.generated.sql and domain.store.generated.ts).
export default defineConfig({
  plugins: ['valibot', 'fcis', ['postgres', {}]],
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
