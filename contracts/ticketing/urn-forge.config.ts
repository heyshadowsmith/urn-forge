import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // Every operation, output and rule must have a scenario.
  coverage: 'error',
  // The Postgres extra writes the table of the holds and the table of the tickets, whose primary key
  // keeps each ticket code unique across all stored tickets, whatever their event.
  postgres: { tables: ['hold', 'ticket'] },
});
