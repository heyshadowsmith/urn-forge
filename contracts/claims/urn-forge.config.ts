import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // The Postgres extra writes the outbox of the events with a delivery, and the claims table, so
  // the store file has the query of the timed change report_overdue.
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['claim.entity.claim'] }]],
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
