/**
 * urn-forge's public surface (foundations plan, phase 6). Changing what the package
 * exports should be a deliberate, reviewed change, so this test lists every export.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as direct from '../src/index.js';

const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as {
  exports: Record<string, string>;
};

describe('public API', () => {
  it('maps the package entry points to their modules', () => {
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './config': './src/config.ts',
      './cucumber': './src/gherkin/steps.ts',
    });
  });

  it('exports exactly these values from urn-forge', async () => {
    const api = await import('urn-forge');
    expect(Object.keys(api).sort()).toEqual([
      'DEFAULT_PLUGINS',
      'DIAGNOSTIC_CODES',
      'GATES',
      'GENERATOR_VERSION',
      'KIND_NAMES',
      'PLUGINS',
      'PRIMITIVE_NAMES',
      'compile',
      'defineConfig',
      'diagnosticJson',
      'formatDiagnostic',
      'handlerName',
      'schemaNames',
      'toBrandIdentifier',
      'toUrn',
      'unsupportedConstructs',
      'verify',
    ]);
    expect(api.compile).toBe(direct.compile);
  });

  it('exports defineConfig from urn-forge/config and the steps from urn-forge/cucumber', async () => {
    expect((await import('urn-forge/config')).defineConfig).toBe(direct.defineConfig);
    const cucumber = await import('urn-forge/cucumber');
    expect(Object.keys(cucumber).sort()).toEqual([
      'assertFailsWith',
      'assertOutput',
      'assertRejectedOn',
      'coerceCell',
      'operationUrnFromTags',
      'registerOperationSteps',
      'tableToObject',
    ]);
  });
});
