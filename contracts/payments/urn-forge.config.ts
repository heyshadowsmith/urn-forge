import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json. The Postgres plugin writes the outbox of the events, which keeps
// their delivery (schema.generated.sql and domain.store.generated.ts). The payment is a table, so
// the store file has selectPaymentExpirePaymentDue, the query of the shell's clock.
export default defineConfig({
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['payment.entity.payment'] }]],
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
