import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // The Postgres extra writes the outbox of the events with a delivery, and the table of the
  // reservations, so the store file has the query of the reservations that are due to expire.
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['reservation.entity.reservation'] }]],
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
