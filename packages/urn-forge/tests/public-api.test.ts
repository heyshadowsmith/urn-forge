/**
 * urn-forge's public surface (foundations plan, phase 6). Changing what the package
 * exports should be a deliberate, reviewed change, so this test lists every export.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as direct from '../src/index.js';
import type { ErrorCategory, IRError, IRInvariant, MessagePart, RuleExpr, UniversalIR, Urn } from '../src/index.js';

const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as {
  exports: Record<string, string>;
};

// Type exports have no runtime trace, so tsc checks these: every type that UniversalIR
// contains can be named from the package.
type ErrorOf<I extends UniversalIR> = I['errors'][Urn];
const typesOfTheIr: [IRError, ErrorCategory, MessagePart, IRInvariant, RuleExpr] extends [ErrorOf<UniversalIR>, IRError['category'], IRError['message'][number], UniversalIR['invariants'][Urn], IRInvariant['rule']] ? true : never = true;

describe('public API', () => {
  it('names every type of the IR, errors included (checked by tsc)', () => {
    expect(typesOfTheIr).toBe(true);
  });

  it('maps the package entry points to their modules', () => {
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './config': './src/config.ts',
      './cucumber': './src/gherkin/steps.ts',
      './register-tsx': './src/gherkin/register-tsx.mjs',
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
      'invariantsOf',
      'ruleName',
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
      'assertRejectedBy',
      'assertRejectedOn',
      'coerceCell',
      'operationUrnFromTags',
      'registerOperationSteps',
      'tableToObject',
    ]);
  });
});
