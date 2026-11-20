// The math example's urn-forge config. Paths are relative to this file.
import { defineConfig } from '../src/config.js';

export default defineConfig({
  manifest: '../tests/fixtures/math.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../tsconfig.json',
  plugins: [
    ['valibot', {}],
    ['fcis', {}],
  ],
});
