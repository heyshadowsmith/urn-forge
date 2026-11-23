import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // The Postgres extra writes the outbox of the events with a delivery, the table of the holds, with
  // the query that finds the holds due to expire (expire_hold), and the table of the tickets, whose
  // unique index keeps each ticket code unique across all events.
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['hold.entity.hold', 'ticket.entity.ticket'] }]],
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
