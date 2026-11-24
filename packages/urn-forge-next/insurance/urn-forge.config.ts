// The insurance domain. Paths are relative to this file.
import { defineConfig } from 'urn-forge-next/config';

export default defineConfig({
  out: 'generated',
  core: 'core.ts',
  tsconfig: '../tsconfig.json',
  // Strict from the start.
  coverage: 'error',
  // The customer and the policy are tables; a policy's holder refers to its customer.
  postgres: {
    tables: ['customer', 'policy'],
    references: { policy: { holder: 'customer' } },
  },
});
