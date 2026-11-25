import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Tests of the Postgres schema start PGlite, about a second each, some of them a few times in one test.
    testTimeout: 30_000,
  },
});
