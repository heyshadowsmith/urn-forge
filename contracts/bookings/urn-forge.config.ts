import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // The Postgres extra writes the outbox of the events with a delivery, and the booking table,
  // whose table of used references keeps a reference from ever being given to another booking.
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['booking.entity.booking'] }]],
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
