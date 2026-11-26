import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json. Payments and refunds are stored records, so the Postgres extra
// writes their tables (schema.generated.sql), with CHECK constraints for their rules.
export default defineConfig({
  domains: [
    {
      postgres: { tables: ['payment', 'refund'] },
    },
  ],
});
