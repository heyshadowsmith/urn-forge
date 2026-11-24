# The package API

| Entry point | Contents |
| --- | --- |
| `urn-forge` | Read and compile a manifest, the rule language, and the types of the model |
| `urn-forge/config` | `defineConfig` and the types of the config |
| `urn-forge/cucumber` | `registerSteps`, the Cucumber steps of every domain |
| `urn-forge/register-tsx` | No exports. It registers `tsx`, so that Cucumber can load TypeScript |

The entry points are TypeScript source files. Code that imports them must run through a TypeScript loader, for example `tsx` or Vitest.

Your core and your shell do not import urn-forge. They import the generated file. Refer to [The generated code](./generated-code).

## `urn-forge`

### Manifests

| Export | Signature | Description |
| --- | --- | --- |
| `loadManifest` | `loadManifest(text: string): { model: Model \| undefined; diagnostics: readonly Diagnostic[] }` | Reads and checks the YAML text of a manifest. `model` is `undefined` if a diagnostic is an error |
| `compileManifest` | `compileManifest(text: string): Compiled` | The same, with the uses of the rules (`applications`) that `generate` needs |
| `generate` | `generate(compiled, source: string, config?: UrnForgeConfig): GeneratedFile[]` | The generated files of a compiled manifest, as `{ path, content }`. `source` is the path of the manifest in the header |
| `fingerprint` | `fingerprint(body: string): string` | `sha256:` and the SHA-256 of a text |
| `GENERATED_FILE` | `'domain.generated.ts'` | The name of the generated TypeScript file |
| `standard` | `standard(): Model` | The standard set of rules, as a model |

These functions do not read or write files.

### The rule language

| Export | Signature | Description |
| --- | --- | --- |
| `parseRule` | `parseRule(text: string): Expr` | Parses a rule. It throws a `CelSyntaxError` if the rule does not parse, or uses a form outside the subset |
| `CelSyntaxError` | `class CelSyntaxError extends Error { at: number }` | `at` is the offset of the problem in the text, from 0 |
| `print` | `print(expr: Expr): string` | The text of a parsed rule |
| `checkRule` | `checkRule(expr: Expr, scope: Scope): { type; problems; types }` | Types a rule in a scope. `problems` has the codes `rule-type`, `rule-guard` and `rule-scope` |

### Types

| Export | Description |
| --- | --- |
| `Model` | The checked manifest: `header`, `definitions`, `rules` and `operations` |
| `Definition` | A definition, with its `base` (one of the six types) and its `root` (the definition that declares its structure) |
| `Rule` | A rule, with its parsed `expr` |
| `RuleUse` | A rule applied by name, with its argument |
| `BaseType` | `'string' \| 'number' \| 'integer' \| 'boolean' \| 'object' \| 'array'` |
| `Diagnostic` | `{ code; severity: 'error' \| 'warning'; path; message; line? }` |
| `Path` | The place in the manifest, as a list of keys and indexes |
| `Failure` | `{ definition; rule; path; message }`: a failure of the generated checks |
| `Expr`, `CelType`, `Scope`, `PropertyType`, `RuleProblem` | The types of the rule language |
| `Compiled` | The result of `compileManifest` |

### Example

```ts
import { readFileSync } from 'node:fs';
import { loadManifest, parseRule, print } from 'urn-forge';

const { model, diagnostics } = loadManifest(readFileSync('domain.manifest.yaml', 'utf8'));
console.log(Object.keys(model?.operations ?? {}), diagnostics.length);
console.log(print(parseRule("has(input.express) && input.express && input.weight_grams > 5000")));
```

Run with `tsx` in the folder of tutorial 3, it shows:

```
[ 'quote_shipping' ] 0
has(input.express) && input.express && input.weight_grams > 5000
```

## `urn-forge/config`

| Export | Description |
| --- | --- |
| `defineConfig(config)` | Returns the config unchanged, with its type |
| `UrnForgeConfig` | The type of the config. Refer to [The configuration file](./configuration) |
| `PostgresConfig` | The type of `postgres` |
| `CONFIG_FILE` | `'urn-forge.config.ts'` |
| `configProblems(config: unknown): string[]` | The problems of a config, as messages |
| `loadConfig(path: string)` | Imports a config file and checks it |

## `urn-forge/cucumber`

| Export | Description |
| --- | --- |
| `registerSteps(options: StepOptions): void` | Registers the steps. Refer to [Gherkin steps](./gherkin-steps) |
| `StepOptions` | `{ Definitions; Operations; check; run }` |
| `STEPS` | The regular expressions of the steps. Gate 3 reads them too |

## Related pages

- [The generated code](./generated-code)
- [Gherkin steps](./gherkin-steps)
- [Install urn-forge](../how-to/install)
