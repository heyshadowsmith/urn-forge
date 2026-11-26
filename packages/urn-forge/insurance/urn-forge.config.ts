// The insurance domain. Paths are relative to this file.
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  tsconfig: '../tsconfig.json',
  domains: [
    {
      out: 'generated',
      core: 'core.ts',
      // The customer and the policy are tables; a policy's holder refers to its customer.
      postgres: {
        tables: ['customer', 'policy'],
        references: { policy: { holder: 'customer' } },
      },
    },
  ],
});
