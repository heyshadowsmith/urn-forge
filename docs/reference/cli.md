# The CLI, the config and diagnostics

Run `npx urn-forge <command>` in a project that has urn-forge installed.

```
urn-forge 0.2.0

Usage:
  urn-forge init    [--namespace <name>] [--domain <name>]
  urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>]
  urn-forge verify  [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>]
  urn-forge diff    <old manifest> <new manifest> [--report]
```

| Command | What it does |
| --- | --- |
| `init` | Writes a starter project that splits a bill, which `verify` passes with `coverage: 'error'`. It sets `"type": "module"` in `package.json` and adds the scripts `compile`, `verify` and `test:features`. If one of its files exists, it writes nothing. `--namespace` and `--domain` default to `app` and `starter` |
| `compile` | Writes the generated files, with one line for each: `wrote`, `unchanged`, or `removed`. It writes nothing if the manifest has an error |
| `verify` | Compiles in memory and runs the [four gates](#the-gates). It writes nothing, and does not run the scenarios; `cucumber-js` does |
| `diff` | Compares two manifests. Refer to [Change the contract](../how-to/change-the-contract). It does not read the config |

Each command exits with `0` on a pass (warnings included), `1` on a failure, and `2` on a wrong command line.

## The config

`urn-forge.config.ts` is read from the working folder, or from `--config`. It exports `defineConfig({ … })` from `urn-forge/config`. A path in it is relative to the file, and a flag of the same name overrides it.

| Option | Default | Value |
| --- | --- | --- |
| `manifest` | `domain.manifest.yaml` | The manifest |
| `out` | `src/generated` | The folder of the generated files |
| `core` | `src/core.ts` | The core file, which exports a value that `satisfies DomainCore` |
| `features` | `features` | The folder of the `.feature` files |
| `tsconfig` | `tsconfig.json` | The tsconfig of gate 1 |
| `shell` | none | Files and folders of the shell, for gate 2 |
| `coverage` | `'warn'` | `'error'` makes a gap in the scenarios fail gate 3 |
| `postgres` | none | Write a Postgres schema and a store file. Refer to [Store objects in Postgres](../how-to/store-in-postgres) |

Your core and shell import only the generated file. The project also uses `urn-forge/config`, `urn-forge/cucumber` (`registerSteps`) and `urn-forge/register-tsx`, which lets Cucumber load TypeScript. `urn-forge` itself exports `loadManifest`, `compileManifest`, `generate` and the rule parser, for your own tools. The entry points are TypeScript source: run code that imports them through a loader such as `tsx`.

## The gates

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 15 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

Each problem of a gate is an indented line under it. The last line is `verify passed …` or `verify failed: gate <numbers>`. If the config or the manifest has an error, no gate runs.

| Gate | It fails when | Codes |
| --- | --- | --- |
| 1. Completeness | `tsc` fails over the core with the project's tsconfig, or no export of the core `satisfies DomainCore` | `type-error`, `core-not-satisfying`, `core-not-found`, `tsconfig-unreadable` |
| 2. Boundary | A shell file calls a function of the core directly, or a core or shell file has `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` | `direct-call`, `suppressed-check` |
| 3. Gherkin | A step names something the manifest does not have, a feature is not valid Gherkin, or no scenario runs an operation, ends with an output, or breaks a rule of a definition | `unknown-name`, `feature-syntax`, `uncovered-operation`, `uncovered-output`, `uncovered-rule` |
| 4. Drift | A generated file is not what `compile` writes now, is missing, or is no longer made | `drift` |

The `uncovered-` codes are warnings, or errors with `coverage: 'error'`. An `Examples` row counts as one scenario. A `type-error` names the function to fix: `TS1360` is a missing function, `TS2353` an extra one, `TS2322` a return that is not `answer('<output>', value)` of the operation. If an error points into a generated file, fix gate 4 first.

## Diagnostics

A problem of the config or the manifest is one line, with the line in the manifest. An `error` stops the command; a `warning` does not. Each message says what to do:

```
domain.manifest.yaml:13  error  unknown-rule  positive is not a rule of this manifest or a standard rule
domain.manifest.yaml:75  error  rule-guard  over_express_limit: input.express can be absent: read it after has(input.express) &&, or after !has(input.express) ||
```

| Code | Cause |
| --- | --- |
| `manifest-unreadable`, `config-unreadable` | The manifest file, or the file that `--config` names, does not exist |
| `config-invalid` | The config does not load, or an option is unknown or of the wrong type |
| `postgres-config` | A table has no identifier, or an entry of `postgres` names something that is not there |
| `postgres-column` | Two parts give one column name, a name is longer than 63 bytes, or a list holds lists (wrap the inner list in an object) |
| `yaml-syntax` | Not valid YAML, or a key twice in one map |
| `manifest-shape` | A key that is not allowed, a missing key, or a value of the wrong shape |
| `unknown-definition`, `unknown-property`, `unknown-rule` | A name that the manifest does not have |
| `type-cycle` | A chain of `type` names comes back to its start |
| `duplicate-property`, `duplicate-output` | A list names a property or an output twice |
| `invalid-identifier` | The identifier is not a required property with one value |
| `not-an-object` | The input or an output is not an object |
| `deprecated-use` (warning) | A live piece uses a deprecated one |
| `standard-name` | A rule of the manifest has the name of a standard rule |
| `rule-argument` | An argument does not fit the rule's parameters |
| `invalid-message` | A message names `{x}`, but `x` is not a parameter |
| `rule-syntax` | The rule does not parse, or uses CEL outside [the subset](./manifest#the-rule-language). It is reported at the line of `rule:`, with the column; the other rule errors at the line where the rule is applied |
| `rule-type` | A type in the rule is wrong, the rule does not give a `bool`, or `has()` reads a required property |
| `rule-guard` | The rule reads an optional property without `has()` |
| `rule-scope` | The rule reads a name that does not exist where it is applied, such as `output` in a rule of a definition |
