// urn-forge's own domain. Paths are relative to this file.
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  out: 'generated',
  core: 'core.ts',
  tsconfig: '../tsconfig.json',
});
