// urn-forge's own domain. Paths are relative to this file.
import { defineConfig } from '../src/config.js';

export default defineConfig({
  manifest: './domain.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../tsconfig.json',
  plugins: ['valibot', 'fcis'],
});
