# The package API

| Entry point | Contents |
| --- | --- |
| `urn-forge` | `compile`, `verify`, `diffManifests`, `defineConfig` and the diagnostics |
| `urn-forge/config` | `defineConfig` and the loader of the configuration file |
| `urn-forge/cucumber` | The generic Cucumber steps and their helpers |
| `urn-forge/exact` | Exact arithmetic on decimals and calendar days, for a core |
| `urn-forge/register-tsx` | No exports. It registers tsx, for example with `NODE_OPTIONS="--import urn-forge/register-tsx"` |

The entry points are TypeScript source files. Code that imports them must run through a TypeScript loader, for example tsx or Vitest.

## `urn-forge`

### Compile, verify and diff

| Export | Signature or shape | Description |
| --- | --- | --- |
| `compile` | `compile(manifestSource: string, plugins?: readonly PluginEntry[], options?: CompileOptions): CompileResult` | Compiles the YAML text and runs the plugins. It does not read or write files. The default plugins are `DEFAULT_PLUGINS`: `valibot` and `fcis` |
| `CompileOptions` | `{ referenceDate?: string }` | The day `YYYY-MM-DD` to compare each `sunsetDate` with |
| `CompileResult` | `{ files: readonly GeneratedArtifact[]; diagnostics: readonly Diagnostic[]; ir?: UniversalIR; fingerprint?: string }` | `files` is empty if there is an error. A file is `{ relativePath, content }` |
| `PluginEntry` | `{ plugin: CodegenPlugin<any>; config: unknown }` | One plugin from `PLUGINS` and its configuration |
| `verify` | `verify(options: VerifyOptions): Promise<VerifyResult>` | Reads the manifest, compiles it in memory and runs gates 1 to 4 |
| `VerifyOptions` | `{ cwd; manifestPath; outDir; corePath; featuresDir; tsconfigPath: string; plugins?; boundaryCoverage?; referenceDate?: string; shellPaths?: readonly string[] }` | Absolute paths. The defaults are `DEFAULT_PLUGINS`, `'warn'` and `[]` |
| `VerifyResult` | `{ ok: boolean; diagnostics: readonly Diagnostic[]; gates: readonly GateResult[]; sunsetDatesChecked: boolean }` | `ok` is `true` if there is no error |
| `GateResult` | `{ gate: 1 \| 2 \| 3 \| 4 \| 5; name: string; ok: boolean; summary: string; problems: readonly Diagnostic[] }` | The result of one gate |
| `diffManifests` | `diffManifests(oldSource: string, newSource: string, options?: DiffOptions): DiffResult` | `urn-forge diff` without the files and the output |
| `DiffOptions` | `{ tables?: readonly string[] }` | The short keys of the `postgres` tables |
| `DiffResult` | `{ ok: true; changes: readonly Change[]; breaking: readonly Diagnostic[]; experimental: boolean } \| { ok: false; which: 'old' \| 'new'; diagnostics: readonly Diagnostic[] }` | `ok` is `false` if a manifest does not compile |
| `Change` | `{ class: 'compatible' \| 'breaking' \| 'lifecycle'; urn: string; message: string }` | One change |

### Configuration and diagnostics

| Export | Signature or shape | Description |
| --- | --- | --- |
| `defineConfig` | `defineConfig(config: UrnForgeConfig): UrnForgeConfig` | Returns the object. It gives the type only |
| `UrnForgeConfig` | `{ manifest?; out?; core?; features?; tsconfig?: string; shell?: readonly string[]; boundaryCoverage?: 'warn' \| 'error'; referenceDate?: string; plugins?: readonly PluginSpec[] }` | Refer to [The configuration file](./configuration) |
| `PluginSpec` | `'valibot' \| 'fcis' \| 'postgres'`, or a pair of a name and its configuration | One entry of `plugins` |
| `Diagnostic` | `{ code: DiagnosticCode; severity: Severity; message: string; urn?: string; file?: string; location?: { line: number; column: number } }` | One problem. With no `file`, it is in the manifest. Lines and columns start at 1 |
| `Severity` | `'error' \| 'warning' \| 'note'` | |
| `DIAGNOSTIC_CODES` | `Record<DiagnosticCode, string>` | Each code, with a summary of one line. Refer to [Diagnostics](./diagnostics) |
| `formatDiagnostic` | `formatDiagnostic(diagnostic: Diagnostic, file?: string): string` | `<file>[:<line>:<column>]  <severity>  <code>  <message>` |
| `diagnosticJson` | `diagnosticJson(diagnostic: Diagnostic, file?: string, extra?: Record<string, unknown>): string` | The JSON line with `"type":"diagnostic"`. Refer to [The CLI](./cli) |

The package also exports the types of the IR (`UniversalIR` and its node types), the plugin interface (`CodegenPlugin`, `PLUGINS`), the gate types, the lists of kinds and primitives, and the name functions. These are the inputs of the plugins and the gates.

## `urn-forge/config`

| Export | Signature | Description |
| --- | --- | --- |
| `defineConfig`, `UrnForgeConfig`, `PluginSpec` | As in `urn-forge` | |
| `CONFIG_FILE` | `'urn-forge.config.ts'` | The default file name |
| `loadConfig` | `loadConfig(path: string, file: string, cwd?: string): Promise<{ ok: true; config: UrnForgeConfig } \| { ok: false; diagnostics: readonly Diagnostic[] }>` | Imports the file at `path` and examines its default export. `file` is the path in the diagnostics |

## `urn-forge/exact`

A `decimal` is a string and a `date` is a `YYYY-MM-DD` string, so JavaScript operators do not calculate with them exactly. These functions do. Each one takes plain or branded values and returns a plain value. Gate 2 lets a core import this module.

| Function | Result |
| --- | --- |
| `compareDecimal(a, b)` | `-1`, `0` or `1`. `"1.10"` equals `"1.1"` |
| `addDecimal(a, b)`, `subtractDecimal(a, b)` | The exact sum or difference |
| `sumDecimal(values)` | The exact sum of a list. `"0"` for an empty list |
| `multiplyDecimal(a, b)` | The exact product |
| `divideDecimal(a, b, scale, rounding)` | `a ÷ b` with `scale` digits after the point. A `RangeError` if `b` is 0 |
| `roundDecimal(value, scale, rounding)` | The value with `scale` digits after the point |
| `epochDay(date)` | The days from `1970-01-01` |
| `addDays(date, days)` | The day `days` after the date. Negative `days` go back |
| `daysBetween(from, to)` | The days from `from` to `to`, as `to - from` in a rule |

`rounding` is a `Rounding`: `'half-up'` (half away from zero), `'half-even'`, `'floor'` or `'ceil'`.

```ts
import { addDays, compareDecimal, daysBetween, multiplyDecimal, roundDecimal, sumDecimal } from 'urn-forge/exact';

const total = sumDecimal(['19.99', '45.00', '120.50']); // '185.49'
const overLimit = compareDecimal(total, '150.00') > 0; // true
const fee = roundDecimal(multiplyDecimal('25.05', '0.5'), 2, 'half-up'); // '12.53'
const age = daysBetween('2026-08-01', '2026-11-21'); // 112
const due = addDays('2026-11-21', 28); // '2026-12-19'
```

## `urn-forge/cucumber`

<<< @/../packages/urn-forge/example/features/support/steps.ts

| Export | Signature | Description |
| --- | --- | --- |
| `registerOperationSteps` | `registerOperationSteps(options: { dispatch; execute: (urn: string, payload: unknown, options) => ExecuteResultLike; caller? }): void` | Registers a `Before` hook and the generic steps. `execute` gets `{ current?, caller?, now? }` from the Given steps. `idempotency` takes the generated `idempotencyOf` and `idempotencyConflict`, for a repeat. `caller` is the generated `CallerContract`, for `Given the caller is:`. Refer to [Gherkin steps](./gherkin-steps) |
| `operationUrnFromTags` | `(tags: readonly string[]): string` | The one operation URN in the tags. Throws if there is none or more than one |
| `coerceCell` | `(cell: string, field: PropertyInfoLike): unknown` | A table cell as a value of the primitive of the field |
| `tableToObject` | `(rows, fields, side: 'input' \| 'output' \| 'error' \| 'event', urn: string): Record<string, unknown>` | A table of one header row and one data row as an object |
| `assertOutput` | `(result, expected, urn): void` | Throws if the operation failed, or if a property of `expected` is different |
| `assertRejectedOn` | `(result, fieldName, fields, urn): void` | Throws if the result is not `InputRejected` on the property |
| `assertRejectedBy` | `(result, invariantUrn, urn): void` | Throws if the result is not `InputRejected` by the invariant |
| `assertFailsWith` | `(result, errorUrn, urn, expected?): void` | Throws if the result is not this `DomainError` with these fields |
| `assertRecordedAs` | `(result, eventUrn, urn, expected?): void` | Throws if the result is not a `DomainError` whose `record` is this event with these fields |
| `assertEmits` | `(result, eventUrn, urn, expected?): void` | Throws if the operation failed or returned no such event |
| `assertEmitsNone` | `(result, urn): void` | Throws if the operation succeeded with events, or failed with no `DomainError` |
| `assertEmitsNoneOf` | `(result, eventUrn, urn): void` | Throws if the operation failed, or succeeded with this event |
| `assertNotDue` | `(result, urn): void` | Throws if the result is not a `ContractViolation` of a timed change called for a record that is not due |

- The assert functions compare with `===`, and `NaN` equals `NaN`. Lists compare item by item, and objects property by property.
- A property that is not in `expected` is not compared. A property of `expected` with the value `undefined` must be absent.
- The shape types are `OperationStepsOptions`, `OperationContractLike`, `FieldsLike`, `PropertyInfoLike`, `FieldInfoLike`, `EmbeddedInfoLike`, `EmittedEventLike`, `ExecuteResultLike`, `DomainErrorLike`, `BoundaryIssueLike` and `Primitive`. The generated `DispatchMap` and `executeOperation` agree with them.

## Related pages

- [The configuration file](./configuration)
- [Gherkin steps](./gherkin-steps)
- [Call an operation](../how-to/call-an-operation)
