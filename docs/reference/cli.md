# The CLI, the config and the gates

The `urn-forge` command has four commands. Run it with `npx urn-forge` in a project that has urn-forge installed.

```
urn-forge 0.2.0

Usage:
  urn-forge init    [--namespace <name>] [--domain <name>]
  urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>]
  urn-forge verify  [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>]
  urn-forge diff    <old manifest> <new manifest> [--report]

Options:
  --namespace <name> init: the namespace of the starter manifest (default: app)
  --domain <name>    init: the domain of the starter manifest (default: starter)
  --config <file>    The config (default: urn-forge.config.ts, when it exists). Flags override it
  --manifest <file>  The manifest (default: domain.manifest.yaml)
  --out <dir>        The directory of the generated files (default: src/generated)
  --core <file>      verify: the core, which exports … satisfies DomainCore (default: src/core.ts)
  --features <dir>   verify: the directory of the .feature files (default: features)
  --tsconfig <file>  verify: the tsconfig of gate 1 (default: tsconfig.json)
  --report           diff: list the changes, and do not fail on a breaking change
```

| Exit code | Meaning |
| --- | --- |
| `0` | Passed. Warnings do not change the code |
| `1` | Failed: an error in the config or the manifest, a failed gate, or a breaking change that the versions do not allow |
| `2` | The command line is wrong |

A problem in the config or the manifest is one line, `<file>:<line>  <severity>  <code>  <message>`. An `error` stops the command; a `warning` does not. Refer to [Diagnostics](./diagnostics).

## The config file

`urn-forge.config.ts` sets the paths and options. The CLI reads it from the working folder, or from `--config`. A path in it is relative to the file; a flag overrides it. Without the file, each option has its default.

```ts
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  coverage: 'error',
});
```

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

## init

`init` writes a starter project into the working folder: a manifest, a core, a feature, the step file, `cucumber.json`, `register-tsx.mjs`, `tsconfig.json` and `urn-forge.config.ts`. It sets `"type": "module"` in `package.json` and adds the scripts `compile`, `verify` and `test:features`. If one of its files exists, it writes nothing and exits with `1`. The starter splits a bill, and `verify` passes on it with `coverage: 'error'`.

## compile

`compile` reads the manifest, shows its diagnostics, and writes the generated files, one line for each: `wrote`, `unchanged`, or `removed` for a generated file it no longer makes. It writes nothing if the manifest has an error. In the folder of the booking example, which has `out: 'generated'` and `postgres` in its config:

```
domain.manifest.yaml:124  warning  deprecated-use  booking uses the deprecated definition note
unchanged  generated/domain.generated.ts
unchanged  generated/schema.generated.sql
unchanged  generated/domain.store.generated.ts
```

## verify and the gates

`verify` compiles the manifest in memory and runs four gates. It writes nothing, and it does not run the scenarios; `cucumber-js` does.

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 15 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

Each problem of a gate is an indented line under it. The last line is `verify passed …`, or `verify failed: gate <numbers>`, or says that the config or the manifest is not valid, in which case no gate runs.

| Gate | It checks | Codes |
| --- | --- | --- |
| 1. Completeness | `tsc` passes over the core with the project's tsconfig, and the core exports a value that `satisfies DomainCore` | `type-error`, `core-not-satisfying`, `core-not-found`, `tsconfig-unreadable` |
| 2. Boundary | No shell file reads a function of the core directly; no core or shell file has `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` | `direct-call`, `suppressed-check` |
| 3. Gherkin | Every step names a real operation, output, definition or rule. A scenario runs each operation, ends with each output, and breaks each rule of each definition | `unknown-name`, `feature-syntax`, and the gaps `uncovered-operation`, `uncovered-output`, `uncovered-rule` |
| 4. Drift | Each generated file equals a fresh compile, byte for byte, and no stale generated file is left | `drift` |

A gap is a warning, or an error with `coverage: 'error'`. Gate 3 counts an `Examples` row as one scenario. A rule counts as broken for a definition when a scenario ends with `Then the input is rejected by` or `Then the value is rejected by` that rule and definition. The rules of outputs and operations need no breaking scenario: the harness checks them on every answer.

## diff

`diff` compiles two manifests, lists each change as `breaking` or `compatible`, and judges the breaking ones by the two versions. It does not read the config.

```
breaking    definitions.weight_grams  maximum is now 20000, not 30000: it accepts less
compatible  definitions.zone  enum is now ["domestic","international","regional"], not ["domestic","international"]: it accepts more
diff failed: 2 change(s), 1 breaking, 1.0.0 → 1.1.0: 1.0.0 → 1.1.0 keeps the major version 1; a breaking change needs a new major version
```

A breaking change is allowed when the new version is `0.x`, a pre-release (`2.0.0-alpha.1`), or a new major version. With `--report`, a breaking change that is not allowed is listed and the exit code is `0`.

Callers send the input and every definition inside it, and receive the outputs and every definition inside them. A definition on both sides takes the stricter verdict.

| Change of a definition | Sent | Received |
| --- | --- | --- |
| New definition, or `deprecated: true` added | compatible | compatible |
| Removed definition or property; changed `type`, `items` or `identifier` | breaking | breaking |
| New property | compatible | breaking ¹ |
| New rule, or a narrower argument: accepts less | breaking | compatible |
| Removed rule, or a wider argument: accepts more | compatible | breaking ¹ |
| An argument that is neither narrower nor wider | breaking | breaking |

¹ Compatible with `compatibility: { callers: ignore-unknown }` in the new header. A definition that no input or output uses is compatible for any change, except an argument that is neither narrower nor wider.

An argument's direction: more `enum` choices or fewer `required` properties is wider. For a rule of the form `self <op> parameter` or `size(self) <op> parameter`, a larger argument is narrower with `>=` or `>`, and wider with `<=` or `<`; this covers `minimum`, `maximum`, the lengths and counts, and your own rules of that form. A rule of the manifest whose text changed is breaking wherever it is used; spaces and redundant parentheses do not count.

| Change of an operation or the header | Class |
| --- | --- |
| New operation; removed output; new rule of an output or operation | compatible |
| Removed operation; changed `input`; removed or changed rule of an output or operation | breaking |
| New output | breaking, or compatible with `callers: ignore-unknown` |
| Changed `namespace` or `domain`; `compatibility` removed | breaking |
| `compatibility` added; `deprecated: true` added | compatible |

## Package entry points

Your core and shell import only the generated file. A project also uses:

| Import | Contents |
| --- | --- |
| `urn-forge/config` | `defineConfig` and the type of the config |
| `urn-forge/cucumber` | `registerSteps` |
| `urn-forge/register-tsx` | Registers `tsx`, so that Cucumber loads TypeScript |
| `urn-forge` | `loadManifest`, `compileManifest`, `generate` and the rule parser, for tools of your own |

The entry points are TypeScript source; run code that imports them through a loader such as `tsx`.
