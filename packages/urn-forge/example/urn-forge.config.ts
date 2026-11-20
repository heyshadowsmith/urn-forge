// The math example's urn-forge config. Paths are relative to this file.
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  manifest: '../tests/fixtures/math/domain.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../tsconfig.json',
  plugins: [
    ['valibot', {}],
    ['fcis', {}],
  ],
});
