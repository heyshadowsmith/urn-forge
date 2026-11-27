// urn-forge's own domain. Paths are relative to this file.
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  tsconfig: '../tsconfig.json',
  // urn-forge runs its own decisions through this harness: src/self.ts is the shell of self/.
  shell: ['../src/self.ts'],
  domains: [{ out: 'generated', core: 'core.ts' }],
});
