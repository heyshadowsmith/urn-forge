import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // The Postgres plugin writes the outbox of the events with a delivery (schema.generated.sql and
  // insertEvents, nextEvents and markPublished in domain.store.generated.ts). It stores no entity.
  plugins: ['valibot', 'fcis', ['postgres', {}]],
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
