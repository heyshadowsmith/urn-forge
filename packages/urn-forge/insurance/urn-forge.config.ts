// The insurance domain. Paths are relative to this file.
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  manifest: './domain.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../tsconfig.json',
  // Strict from the start.
  boundaryCoverage: 'error',
  // A fixture's reference date is fixed, so its verdict never depends on the day CI runs: the
  // sunset date of policy.field.note (2027-06-30) can never turn urn-forge's CI red. A real
  // project passes the commit's date instead (docs/how-to/run-verify-in-ci.md).
  referenceDate: '2026-11-21',
  // The customer and the policy are tables; the coverages are a child table of the policy.
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['customer.entity.customer', 'policy.entity.policy'] }]],
});
