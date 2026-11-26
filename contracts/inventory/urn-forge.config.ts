import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // The reservations are stored: a table with the identifier reservation_id as its primary key.
  postgres: { tables: ['reservation'] },
});
