/**
 * urn-forge's public entry point (`import … from 'urn-forge'`).
 *
 * Subpaths:
 *   urn-forge/config    defineConfig, for urn-forge.config.ts
 *   urn-forge/cucumber  registerOperationSteps, the generic Cucumber steps
 *
 * The entry points are TypeScript source, run through tsx like the CLI; there is no build
 * step yet. tests/public-api.test.ts lists every export, so a change here is deliberate.
 */

// Compile and verify
export { compile, unsupportedConstructs, type CompileResult, type PluginEntry } from './engine.js';
export { verify, GATES, type VerifyOptions, type VerifyResult } from './verify/index.js';
export type { Gate, GateContext, GateNumber, GateOutcome, GateResult } from './verify/types.js';

// Config
export { defineConfig, type PluginSpec, type UrnForgeConfig } from './config.js';

// Diagnostics
export {
  DIAGNOSTIC_CODES,
  diagnosticJson,
  formatDiagnostic,
  type Diagnostic,
  type DiagnosticCode,
  type Severity,
  type SourceLocation,
} from './diagnostics.js';

// The IR
export type { IREntity, IRField, IRFieldRef, IROperation, UniversalIR, Urn } from './ir/types.js';

// Plugins
export { DEFAULT_PLUGINS, PLUGINS, type PluginName } from './plugins/index.js';
export type {
  CodegenPlugin,
  GeneratedArtifact,
  PluginDiagnostic,
  PluginOutput,
  PluginSupport,
} from './plugins/plugin.interface.js';

// Registries
export { KIND_NAMES, type KindName } from './kinds/index.js';
export { PRIMITIVE_NAMES, type ConstraintValue, type Primitive } from './primitives/index.js';
export { handlerName, schemaNames, toBrandIdentifier } from './naming.js';

export { GENERATOR_VERSION } from './version.js';
