import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // The stored claims: a table with the claim id as its primary key.
  postgres: { tables: ['claim'] },
});
