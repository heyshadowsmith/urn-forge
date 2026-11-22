import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // The Postgres extra writes the outbox of the events with a delivery, and the table of the holds,
  // with the query that finds the holds due to expire (expire_hold).
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['hold.entity.hold'] }]],
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
