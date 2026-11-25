# The CLI, the config and diagnostics

Run `npx urn-forge <command>` in a project where urn-forge is installed.

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
| `init` | Writes a starter project that splits a bill. This project passes `verify` with `coverage: 'error'`. `init` sets `"type": "module"` in `package.json`, and adds the scripts `compile`, `verify` and `test:features`. If one of its files is already there, it writes nothing. The default values of `--namespace` and `--domain` are `app` and `starter` |
| `compile` | Writes the generated files, and shows one line for each file: `wrote`, `unchanged`, or `removed`. If the manifest has an error, it writes nothing |
| `verify` | Compiles in memory and runs the [four gates](#the-gates). It writes nothing, and it does not run the scenarios. `cucumber-js` runs them |
| `diff` | Compares two manifests. Refer to [Change the contract](../how-to/change-the-contract). It does not read the config |

Each command exits with `0` on a pass (also with warnings), `1` on a failure, and `2` on a wrong command line.

## The config

urn-forge reads `urn-forge.config.ts` from the current folder, or from the file that `--config` names. The file exports `defineConfig({ … })` from `urn-forge/config`. A path in the file is relative to the file. A flag of the same name overrides the path.

| Option | Default | Value |
| --- | --- | --- |
| `manifest` | `domain.manifest.yaml` | The manifest |
| `out` | `src/generated` | The folder of the generated files |
| `core` | `src/core.ts` | The core file, which exports a value that `satisfies DomainCore` |
| `features` | `features` | The folder of the `.feature` files |
| `tsconfig` | `tsconfig.json` | The tsconfig of gate 1 |
| `shell` | none | Files and folders of the shell, for gate 2 |
| `coverage` | `'warn'` | With `'error'`, a gap in the scenarios fails gate 3 |
| `postgres` | none | Writes a Postgres schema and a store file. Refer to [Store objects in Postgres](../how-to/store-in-postgres) |

Your core and your shell import only the generated file. The project also uses `urn-forge/config`, `urn-forge/cucumber` (`registerSteps`) and `urn-forge/register-tsx`. `urn-forge/register-tsx` lets Cucumber load TypeScript. For your own tools, `urn-forge` exports `loadManifest`, `compileManifest`, `generate` and the rule parser. Because the entry points are TypeScript source, run code that imports them through a loader such as `tsx`.

## The gates

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 15 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

Each problem of a gate is an indented line below the gate. The last line is `verify passed …` or `verify failed: gate <numbers>`. If the config or the manifest has an error, no gate runs.

| Gate | It fails when | Codes |
| --- | --- | --- |
| 1. Completeness | `tsc` fails over the core with the tsconfig of the project, or no export of the core `satisfies DomainCore` | `type-error`, `core-not-satisfying`, `core-not-found`, `tsconfig-unreadable` |
| 2. Boundary | A shell file calls a function of the core directly, or a core or shell file has `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` | `direct-call`, `suppressed-check` |
| 3. Gherkin | A step names a part that the manifest does not have. A feature is not valid Gherkin. No scenario runs an operation, ends with an output, or breaks a rule of a definition | `unknown-name`, `feature-syntax`, `uncovered-operation`, `uncovered-output`, `uncovered-rule` |
| 4. Drift | A generated file is not the same as the file that `compile` writes now. A generated file is not there. A generated file is there, but `compile` does not write it now | `drift` |

The `uncovered-` codes are warnings, or errors with `coverage: 'error'`. An `Examples` row counts as one scenario. A `type-error` names the function to correct. `TS1360` is a function that is not there, and `TS2353` is an extra function. `TS2322` is a return that is not `answer('<output>', value)` of the operation. If an error points into a generated file, correct gate 4 first.

## Diagnostics

A problem of the config or the manifest is one line, with the line in the manifest, and a second line with the fix. An `error` stops the command, but a `warning` does not:

```
domain.manifest.yaml:13  error  unknown-rule  positive is not a rule of this manifest or a standard rule
  fix: Add the rule to rules:, or correct the name to a rule of the manifest or a standard rule.
domain.manifest.yaml:75  error  rule-guard  over_express_limit: input.express can be absent: read it after has(input.express) &&, or after !has(input.express) ||
  fix: Read an optional property only after has(): has(self.x) && self.x > 0, or !has(self.x) || self.x > 0.
```

| Code | Cause |
| --- | --- |
| `manifest-unreadable`, `config-unreadable` | The manifest file, or the file that `--config` names, does not exist |
| `config-invalid` | The config does not load, or an option is unknown or of the wrong type |
| `postgres-config` | A table has no identifier, or an entry of `postgres` names a part that is not there |
| `postgres-column` | Two parts give one column name, a name is longer than 63 bytes, or a list contains lists (put the inner list in an object) |
| `yaml-syntax` | The file is not valid YAML, or a map has one key two times |
| `manifest-shape` | A key that is not allowed, a key that is not there, or a value of the wrong shape |
| `unknown-definition`, `unknown-property`, `unknown-rule` | A name that the manifest does not have |
| `type-cycle` | A chain of `type` names goes back to its start |
| `duplicate-property`, `duplicate-output` | A list names a property or an output two times |
| `invalid-identifier` | The identifier is not a required property with one value |
| `not-an-object` | The input or an output is not an object |
| `deprecated-use` (warning) | A live part uses a deprecated part |
| `standard-name` | A rule of the manifest has the name of a standard rule |
| `rule-argument` | An argument does not agree with the parameters of the rule |
| `invalid-message` | A message names `{x}`, but `x` is not a parameter |
| `rule-syntax` | The rule does not parse, or uses CEL that is not in [the subset](./manifest#the-rule-language). urn-forge gives this error at the line of `rule:`, with the column. It gives the other rule errors at the line where you apply the rule |
| `rule-type` | A type in the rule is wrong, the rule does not give a `bool`, or `has()` reads a required property |
| `rule-guard` | The rule reads an optional property without `has()` |
| `rule-scope` | The rule reads a name that is not available where you apply the rule, such as `output` in a rule of a definition |
