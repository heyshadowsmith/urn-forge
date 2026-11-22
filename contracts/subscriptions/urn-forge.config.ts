import { defineConfig } from 'urn-forge/config';

// The other settings use their defaults: domain.manifest.yaml, src/generated, src/core.ts,
// features and tsconfig.json.
export default defineConfig({
  // The Postgres plugin writes the outbox of the events with a delivery (schema.generated.sql and
  // insertEvents, nextEvents and markPublished in domain.store.generated.ts), and the table of the
  // subscriptions, so the store file has selectSubscriptionAnnounceTrialEndDue, the query that the
  // shell's clock runs to find the trialing subscriptions whose trial_will_end is due.
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['subscription.entity.subscription'] }]],
  // Every boundary and every declared error must have a scenario.
  boundaryCoverage: 'error',
});
