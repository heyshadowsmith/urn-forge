// The math example's urn-forge config. Paths are relative to this file.
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  manifest: '../tests/fixtures/math/domain.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../tsconfig.json',
  // Every feature is @urn-forge:strict; this keeps new features strict too.
  boundaryCoverage: 'error',
  plugins: [
    ['valibot', {}],
    ['fcis', {}],
  ],
});
