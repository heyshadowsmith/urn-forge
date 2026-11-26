import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  domains: [
    {
      // The Postgres schema of the stored subscriptions and invoices (schema.generated.sql). A customer's
      // one live subscription to a plan is not a unique index: the config has no partial uniqueness.
      postgres: { tables: ['subscription', 'invoice'] },
    },
  ],
});
