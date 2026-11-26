// The math example's urn-forge config. Paths are relative to this file.
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  tsconfig: '../tsconfig.json',
  domains: [{ out: 'generated', core: 'core.ts' }],
});
