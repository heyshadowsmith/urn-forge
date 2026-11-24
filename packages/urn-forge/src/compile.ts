/**
 * Compiles a manifest: the model, the uses of its rules, and every diagnostic. Then the generated
 * files of a manifest that has no error.
 */
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as v from 'valibot';
import type { UrnForgeConfig } from './config.js';
import { Diagnostics, type Diagnostic } from './diagnostics.js';
import { checksModule, generatedFile, type GeneratedFile } from './generate/code.js';
import { postgresSchema } from './generate/postgres.js';
import type { Failure } from './generate/runtime.js';
import { readManifest } from './manifest.js';
import { buildModel, type Model } from './model.js';
import { checkRules, standard, standardApplications, type Application } from './rules.js';

export interface Compiled {
  /** The model, when the manifest has no error. */
  readonly model: Model | undefined;
  readonly applications: readonly Application[];
  readonly diagnostics: readonly Diagnostic[];
}

type Checks = Readonly<Record<string, (value: unknown, path: string, failures: Failure[]) => boolean>>;

/** The checks of a model, run in the compiler: the same code as the generated file. */
function checksOf(model: Model, applications: readonly Application[]): Checks {
  const js = ts.transpileModule(checksModule(model, applications), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return (new Function(`return ${js.trim().replace(/;$/, '')}`)() as (valibot: typeof v) => Checks)(v);
}

let standardChecks: Checks | undefined;

/** An argument breaks no rule of its parameter's definition, such as a count of 0 or more. */
function checkArguments(model: Model, applications: readonly Application[], diagnostics: Diagnostics): void {
  const withArguments = applications.filter((a) => a.rule.parameters.length > 0);
  if (withArguments.length === 0) return;
  standardChecks ??= checksOf(standard(), standardApplications());
  let ownChecks: Checks | undefined;
  for (const application of withArguments) {
    const checks = application.owner === model ? (ownChecks ??= checksOf(model, applications)) : standardChecks;
    for (const [parameter, value] of Object.entries(application.arguments)) {
      const failures: Failure[] = [];
      if (checks[parameter]!(value, '', failures)) continue;
      const path = application.rule.parameters.length === 1 ? [...application.use.path, application.rule.name] : [...application.use.path, application.rule.name, parameter];
      for (const failure of failures) {
        diagnostics.error('rule-argument', path, `${application.rule.name}: ${JSON.stringify(value)} breaks ${failure.rule} of ${parameter}: ${failure.message}`);
      }
    }
  }
}

/** A live part that uses a deprecated part: a warning, so that the use can move before the part goes. */
function checkDeprecated(model: Model, diagnostics: Diagnostics): void {
  const deprecated = (name: string): boolean => model.definitions[name]?.deprecated === true;
  const warn = (path: Diagnostic['path'], user: string, used: string, kind: string): void =>
    diagnostics.warning('deprecated-use', path, `${user} uses the deprecated ${kind} ${used}`);
  for (const definition of Object.values(model.definitions)) {
    if (definition.deprecated) continue;
    if (!['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(definition.type) && deprecated(definition.type)) {
      warn([...definition.path, 'type'], definition.name, definition.type, 'definition');
    }
    definition.properties?.forEach((p, i) => deprecated(p) && warn([...definition.path, 'properties', i], definition.name, p, 'definition'));
    if (definition.items && deprecated(definition.items)) warn([...definition.path, 'items'], definition.name, definition.items, 'definition');
    for (const use of definition.rules) if (model.rules[use.rule]?.deprecated) warn(use.path, definition.name, use.rule, 'rule');
  }
  for (const operation of Object.values(model.operations)) {
    if (operation.deprecated) continue;
    if (deprecated(operation.input)) warn([...operation.path, 'input'], operation.name, operation.input, 'definition');
    for (const output of operation.outputs) {
      if (deprecated(output.object)) warn(output.path, operation.name, output.object, 'definition');
      for (const use of output.rules) if (model.rules[use.rule]?.deprecated) warn(use.path, operation.name, use.rule, 'rule');
    }
    for (const use of operation.rules) if (model.rules[use.rule]?.deprecated) warn(use.path, operation.name, use.rule, 'rule');
  }
}

/** Reads a manifest, checks it, and gives its model and the uses of its rules. */
export function compileManifest(text: string): Compiled {
  const diagnostics = new Diagnostics();
  const decl = readManifest(text, diagnostics);
  const model = decl ? buildModel(decl, diagnostics) : undefined;
  let applications: Application[] = [];
  if (model) {
    applications = checkRules(model, standard(), diagnostics);
    if (!diagnostics.hasErrors) checkArguments(model, applications, diagnostics);
    checkDeprecated(model, diagnostics);
  }
  return { model: diagnostics.hasErrors ? undefined : model, applications, diagnostics: diagnostics.list };
}

/** The name of the generated file. */
export const GENERATED_FILE = 'domain.generated.ts';

/** The fingerprint of a generated file: the SHA-256 of its body. */
export function fingerprint(body: string): string {
  return `sha256:${createHash('sha256').update(body).digest('hex')}`;
}

/** The generated files of a compiled manifest. `source` is the manifest's path, for the header. */
export function generate(compiled: Compiled & { readonly model: Model }, source: string, config: UrnForgeConfig = {}): GeneratedFile[] {
  const files = [{ path: GENERATED_FILE, content: generatedFile(compiled.model, compiled.applications, source, fingerprint) }];
  if (config.postgres) {
    const body = postgresSchema(compiled.model, compiled.applications, config.postgres);
    files.push({ path: SCHEMA_FILE, content: `-- Generated by urn-forge from ${source}. Do not edit: change the manifest, then run urn-forge compile.\n-- fingerprint ${fingerprint(body)}\n${body}` });
  }
  return files;
}

/** The name of the Postgres schema file. */
export const SCHEMA_FILE = 'schema.generated.sql';
