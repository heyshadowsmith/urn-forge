# The package API

The package `urn-forge` has three entry points. `packages/urn-forge/package.json` declares them in `exports`:

| Entry point | Module | Contents |
| --- | --- | --- |
| `urn-forge` | `src/index.ts` | Compile, verify, diagnostics, the IR types, the plugins, the registries and the name functions |
| `urn-forge/config` | `src/config.ts` | `defineConfig` and the loader of the configuration file |
| `urn-forge/cucumber` | `src/gherkin/steps.ts` | The generic Cucumber steps and their helper functions |
| `urn-forge/register-tsx` | `src/gherkin/register-tsx.mjs` | No exports. When Node.js loads it, it registers `tsx`, for example with `NODE_OPTIONS="--import urn-forge/register-tsx"` |

## Runtime

- The entry points are TypeScript source files. urn-forge 0.1.0 has no build step and no compiled JavaScript.
- Code that imports an entry point must run through a TypeScript loader, for example tsx or Vitest. The CLI and the Cucumber profiles of the repository use tsx.
- The package is private. You install it from a tarball. urn-forge 0.1.0 is not on the npm registry at this time. Refer to [Install urn-forge](../how-to/install) and [Scope](./scope).
- `tests/public-api.test.ts` lists the value exports of `urn-forge` and `urn-forge/cucumber`. If an export changes, this test fails.

## `urn-forge`

### Compile and verify

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `compile` | Function | `compile(manifestSource: string, plugins?: readonly PluginEntry[]): CompileResult` | Runs the [compiler passes](./compiler-passes) and the plugins on the YAML text. It does not read or write files. The default for `plugins` is `DEFAULT_PLUGINS` |
| `CompileResult` | Type | `{ files: readonly GeneratedArtifact[]; diagnostics: readonly Diagnostic[]; ir?: UniversalIR; fingerprint?: string }` | The result of `compile`. `files` is empty if `diagnostics` has an error. `files` is in path order |
| `PluginEntry` | Type | `{ plugin: CodegenPlugin<any>; config: unknown }` | One plugin and its configuration, in run order |
| `unsupportedConstructs` | Function | `unsupportedConstructs(ir: UniversalIR, plugin: CodegenPlugin<unknown>): PluginDiagnostic[]` | The `unsupported-construct` diagnostics for each kind, primitive and constraint of the IR that the plugin does not declare in `supports` |
| `verify` | Function | `verify(options: VerifyOptions): Promise<VerifyResult>` | Reads the manifest, compiles it in memory and runs the gates |
| `VerifyOptions` | Type | `{ cwd; manifestPath; outDir; corePath; featuresDir; tsconfigPath: string; plugins?; boundaryCoverage?; gates? }` | The input of `verify`. The paths are absolute. The defaults are all plugins, `'warn'` and `GATES` |
| `VerifyResult` | Type | `{ ok: boolean; diagnostics: readonly Diagnostic[]; gates: readonly GateResult[] }` | `ok` is `true` if there is no error. If `diagnostics` has an error, `gates` is empty |
| `GATES` | Constant | `readonly Gate[]` | The gates that `verify` runs, in sequence: `completeness` (1), `gherkin` (3), `drift` (4) |
| `Gate` | Type | `{ number: GateNumber; name: string; run(context: GateContext): GateOutcome \| Promise<GateOutcome> }` | One gate |
| `GateContext` | Type | `{ cwd; ir; files; outDir; corePath; tsconfigPath; featuresDir; features; boundaryCoverage }` | The data that each gate can read. `verify` makes it one time |
| `GateNumber` | Type | `1 \| 2 \| 3 \| 4 \| 5` | The number of a gate |
| `GateOutcome` | Type | `{ summary: string; problems: readonly Diagnostic[] }` | What a gate returns |
| `GateResult` | Type | `GateOutcome & { gate: GateNumber; name: string; ok: boolean }` | The result of one gate. `ok` is `true` if no problem is an error |

### Configuration

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `defineConfig` | Function | `defineConfig(config: UrnForgeConfig): UrnForgeConfig` | Returns the object without a change. It gives the type only. The same function as in `urn-forge/config` |
| `UrnForgeConfig` | Type | `{ manifest?; out?; core?; features?; tsconfig?: string; boundaryCoverage?: 'warn' \| 'error'; plugins?: readonly PluginSpec[] }` | The configuration object. Refer to [The configuration file](./configuration) |
| `PluginSpec` | Type | `'valibot' \| 'fcis' \| readonly ['valibot', {}] \| readonly ['fcis', {}]` | One entry of the `plugins` setting |

### Diagnostics

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `Diagnostic` | Type | `{ code: DiagnosticCode; severity: Severity; message: string; urn?: string; file?: string; location?: SourceLocation }` | One problem. If there is no `file`, the problem is in the manifest |
| `DiagnosticCode` | Type | A union of string literals | Each code. Refer to [Diagnostics](./diagnostics) |
| `DIAGNOSTIC_CODES` | Constant | `Record<DiagnosticCode, string>` | Each code, with a summary of one line |
| `Severity` | Type | `'error' \| 'warning' \| 'note'` | An error fails the command. A warning does not, and `verify` counts it. A note does not, and `verify` does not count it |
| `SourceLocation` | Type | `{ line: number; column: number }` | A position. The two numbers start at 1 |
| `formatDiagnostic` | Function | `formatDiagnostic(diagnostic: Diagnostic, file?: string): string` | The text form: `<file>[:<line>:<column>]  <severity>  <code>  <message>`. `file` is used if the diagnostic has no `file`. Default: `''` |
| `diagnosticJson` | Function | `diagnosticJson(diagnostic: Diagnostic, file?: string, extra?: Record<string, unknown>): string` | The JSON line with `"type":"diagnostic"`. The properties of `extra` come after `type`. Refer to [JSON output](./json-output) |

### The IR

| Export | Kind | Description |
| --- | --- | --- |
| `UniversalIR` | Type | The IR: `meta`, `fields`, `entities`, `invariants`, `operations` and `errors`. Each record has URNs as keys, in URN order |
| `IRField` | Type | `{ urn; brandIdentifier; primitive; constraints; description? }` |
| `IREntity` | Type | `{ urn; brandIdentifier; description; fields: readonly IRFieldRef[] }` |
| `IRFieldRef` | Type | `{ field: Urn; name: string; required: boolean; many?: ListRule }`. `name` is the property name. `many` is present only for a list, and `many: true` in the manifest is `{}` |
| `ListRule` | Type | `{ minItems?: number; maxItems?: number; unique?: boolean }`. The item count and uniqueness of a list |
| `IRInvariant` | Type | `{ urn; brandIdentifier; description; on: Urn; rule: RuleExpr; ruleText: string; message: string }`. `on` is the URN of the entity. `ruleText` is the canonical text of the rule |
| `RuleExpr` | Type | The parsed rule of an invariant: a tree of nodes with an `op`. Refer to [The rule language](./rule-language) |
| `invariantsOf` | Function | `invariantsOf(ir: UniversalIR, entity: Urn): IRInvariant[]`. The invariants whose `on` is the entity, in URN order. An `IREntity` does not list its invariants |
| `IROperation` | Type | `{ urn; brandIdentifier; description; input: Urn; output: Urn; errors: readonly Urn[] }` |
| `IRError` | Type | `{ urn; brandIdentifier; description; category: ErrorCategory; retryable: boolean; message: readonly MessagePart[]; fields: readonly IRFieldRef[] }` |
| `ErrorCategory` | Type | `'validation' \| 'conflict' \| 'not_found' \| 'forbidden' \| 'precondition'` |
| `MessagePart` | Type | `{ text: string } \| { field: string }`. One part of a parsed message template: text, or a placeholder with a property name |
| `Urn` | Type | A `string` with a brand, for the URNs in the IR |

### Plugins

| Export | Kind | Description |
| --- | --- | --- |
| `PLUGINS` | Constant | `{ valibot, fcis }`: each plugin, by name |
| `PluginName` | Type | `'valibot' \| 'fcis'` |
| `DEFAULT_PLUGINS` | Constant | `readonly PluginEntry[]`: `valibot` and then `fcis`, each with `{}` |
| `CodegenPlugin<C>` | Type | `{ name; version; configSchema; supports: PluginSupport; requires?: readonly string[]; emit(ir, config: C): PluginOutput }` |
| `PluginSupport` | Type | `{ kinds: readonly KindName[]; constraints?: { [P in Primitive]?: readonly string[] } }`: what a plugin can use |
| `PluginOutput` | Type | `{ artifacts: readonly GeneratedArtifact[]; diagnostics: readonly PluginDiagnostic[] }` |
| `GeneratedArtifact` | Type | `{ relativePath: string; content: string }`. `relativePath` is a POSIX path relative to the output directory |
| `PluginDiagnostic` | Type | `{ code: DiagnosticCode; severity: 'error' \| 'warning'; urn?: Urn; message: string }` |

For the steps to write a plugin, refer to [Contributor: add a plugin](../how-to/add-a-plugin).

### Registries and names

| Export | Kind | Signature or value | Description |
| --- | --- | --- | --- |
| `KIND_NAMES` | Constant | `['field', 'entity', 'invariant', 'operation', 'error']` | The kinds |
| `KindName` | Type | `'field' \| 'entity' \| 'invariant' \| 'operation' \| 'error'` | A kind |
| `PRIMITIVE_NAMES` | Constant | `['boolean', 'date', 'decimal', 'enum', 'float', 'integer', 'string', 'timestamp']` | The primitives |
| `Primitive` | Type | `'boolean' \| 'date' \| 'decimal' \| 'enum' \| 'float' \| 'integer' \| 'string' \| 'timestamp'` | A primitive |
| `ConstraintValue` | Type | `number \| string \| boolean \| null \| readonly ConstraintValue[]` | The value of a constraint |
| `toUrn` | Function | `toUrn(parts: UrnParts): string` | `urn:<namespace>:<domain>:<context>:<kind>:<identifier>` |
| `UrnParts` | Type | `{ namespace; domain; context; kind; identifier: string }` | The segments of a URN |
| `toBrandIdentifier` | Function | `toBrandIdentifier(context: string, identifier: string): string` | The brand identifier. Refer to [URNs and names](./naming) |
| `schemaNames` | Function | `schemaNames(brandIdentifier: string): { schema; output; input }` | `<Brand>Schema`, `<Brand>` and `<Brand>Input` |
| `handlerName` | Function | `handlerName(brandIdentifier: string): string` | `<Brand>Handler` |
| `ruleName` | Function | `ruleName(brandIdentifier: string): string` | `<Brand>Rule`, the rule function of an invariant |
| `GENERATOR_VERSION` | Constant | `'0.1.0'` | The version of urn-forge. It is in the header of each generated file and in the fingerprint |

## `urn-forge/config`

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `defineConfig` | Function | `defineConfig(config: UrnForgeConfig): UrnForgeConfig` | Returns the object without a change. It gives the type only |
| `UrnForgeConfig` | Type | Refer to [Configuration](#configuration) | The configuration object |
| `PluginSpec` | Type | Refer to [Configuration](#configuration) | One entry of the `plugins` setting |
| `CONFIG_FILE` | Constant | `'urn-forge.config.ts'` | The default name of the configuration file |
| `loadConfig` | Function | `loadConfig(path: string, file: string): Promise<ConfigResult>` | Imports the file at `path` and examines its default export. `file` is the path in the diagnostics |
| `ConfigResult` | Type | `{ ok: true; config: UrnForgeConfig } \| { ok: false; diagnostics: readonly Diagnostic[] }` | The result of `loadConfig` |
| `pluginEntries` | Function | `pluginEntries(specs: readonly PluginSpec[], file: string): PluginEntriesResult` | Changes a `plugins` setting to `PluginEntry` items. It reports an unknown name and a name two times as `config-invalid` |
| `PluginEntriesResult` | Type | `{ ok: true; entries: readonly PluginEntry[] } \| { ok: false; diagnostics: readonly Diagnostic[] }` | The result of `pluginEntries` |

## `urn-forge/cucumber`

This support file of the math example uses the entry point:

<<< @/../packages/urn-forge/example/features/support/steps.ts

### Functions

| Export | Signature | Description |
| --- | --- | --- |
| `registerOperationSteps` | `registerOperationSteps(options: OperationStepsOptions): void` | Registers a `Before` hook and the six generic steps with Cucumber. Refer to [Gherkin steps](./gherkin-steps) |
| `operationUrnFromTags` | `operationUrnFromTags(tags: readonly string[]): string` | The one operation URN in the tags. It throws an error if there is no operation tag or more than one |
| `coerceCell` | `coerceCell(cell: string, field: FieldInfoLike): unknown` | Changes a table cell to a value with the primitive of the field. If `field.many` is `true`, the cell is a list. An empty cell gives `undefined`. Refer to [Primitives and constraints](./primitives) |
| `tableToObject` | `tableToObject(rows: readonly (readonly string[])[], fields: FieldsLike, side: 'input' \| 'output' \| 'error', urn: string): Record<string, unknown>` | Changes a table of one header row and one data row to an object. It throws an error for a header that is not a field, or for a different number of rows. `urn` is the operation for `input` and `output`, and the error for `error`. An empty input cell adds no key. An empty output or error cell adds the key with the value `undefined`, which means "absent" |
| `assertOutput` | `assertOutput(result: ExecuteResultLike, expected: Record<string, unknown>, urn: string): void` | Throws an error if the operation did not succeed, or if a property of `expected` is different in the output |
| `assertRejectedOn` | `assertRejectedOn(result: ExecuteResultLike, fieldName: string, fields: FieldsLike, urn: string): void` | Throws an error if the result is not `InputRejected` with an issue on the field |
| `assertRejectedBy` | `assertRejectedBy(result: ExecuteResultLike, invariantUrn: string, urn: string): void` | Throws an error if the result is not `InputRejected` with an issue whose `invariantUrn` is `invariantUrn` |
| `assertFailsWith` | `assertFailsWith(result: ExecuteResultLike, errorUrn: string, urn: string, expected?: Record<string, unknown>): void` | Throws an error if the result is not a `DomainError` with this URN, or if a property of `expected` is different in the error fields |

The assert functions compare values with `===`. They also accept `NaN` as equal to `NaN`. A property that is not in `expected` is not compared. A property of `expected` with the value `undefined` must be absent.

### Types

These types describe the generated runtime by its shape. Thus the step library does not import the code of a domain.

| Export | Shape |
| --- | --- |
| `OperationStepsOptions` | `{ dispatch: Readonly<Record<string, OperationContractLike>>; execute: (urn: string, payload: unknown) => ExecuteResultLike }` |
| `OperationContractLike` | `{ input: { fields: FieldsLike; invariants?: readonly { urn: string }[] }; output: { fields: FieldsLike }; errors: Readonly<Record<string, { fields: FieldsLike }>> }` |
| `FieldsLike` | `Readonly<Record<string, FieldInfoLike>>` |
| `FieldInfoLike` | `{ urn: string; primitive: Primitive; required: boolean; many?: boolean }` |
| `ExecuteResultLike` | `{ ok: true; output: unknown } \| { ok: false; kind: 'DomainError'; error: DomainErrorLike } \| { ok: false; kind: string; issues: readonly BoundaryIssueLike[] }` |
| `DomainErrorLike` | `{ urn: string; message: string; fields: unknown }` |
| `BoundaryIssueLike` | `{ path: string; fieldUrn?: string; invariantUrn?: string; message: string }` |
| `Primitive` | `'boolean' \| 'date' \| 'decimal' \| 'enum' \| 'float' \| 'integer' \| 'string' \| 'timestamp'` |

The generated `DispatchMap` and `executeOperation` agree with these types. Refer to [The generated runtime](./generated-runtime).

## Related pages

- [The configuration file](./configuration)
- [Gherkin steps](./gherkin-steps)
- [Write scenarios](../how-to/write-scenarios)
- [Contributor: add a plugin](../how-to/add-a-plugin)
- [How urn-forge is built](../explanation/architecture)
