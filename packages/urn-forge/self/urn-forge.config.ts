// urn-forge's own domain. Paths are relative to this file.
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  manifest: './domain.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../tsconfig.json',
  // Every feature is @urn-forge:strict; this keeps new features strict too.
  boundaryCoverage: 'error',
  plugins: ['valibot', 'fcis'],
});
