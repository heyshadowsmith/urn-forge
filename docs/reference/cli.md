# The CLI

The `urn-forge` command has four commands: `init`, `compile`, `verify` and `diff`. Run it with `npx urn-forge` in a project that has urn-forge installed.

## Usage

`npx urn-forge --help` shows this output:

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
```

`npx urn-forge --version` shows the version:

```
0.2.0
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | The command passed. Warnings do not change the code |
| `1` | The command failed: an error in the config or the manifest, a failed gate, or a breaking change that the versions do not allow |
| `2` | The command line is not correct: an unknown command, an unknown option, or a wrong number of arguments. `npx urn-forge` with no command also gives `2` |

## Diagnostics

A problem in the config or the manifest is a line on stderr:

```
<file>:<line>  <severity>  <code>  <message>
```

For example:

```
domain.manifest.yaml:12  error  unknown-rule  positive is not a rule of this manifest or a standard rule
```

The line is the line of the part of the manifest that has the problem. For each code, refer to [Diagnostics](./diagnostics).

## init

```bash
npx urn-forge init [--namespace <name>] [--domain <name>]
```

`init` writes a starter project into the working folder: a manifest, a core, a feature, the step file, `cucumber.json`, `register-tsx.mjs`, `tsconfig.json` and `urn-forge.config.ts`. It sets `"type": "module"` in `package.json`, and adds the scripts `compile`, `verify` and `test:features`. It does not compile.

```
wrote      cucumber.json
wrote      domain.manifest.yaml
wrote      features/split.feature
wrote      features/support/steps.ts
wrote      register-tsx.mjs
wrote      src/core.ts
wrote      tsconfig.json
wrote      urn-forge.config.ts
updated    package.json
next: npm install, then npx urn-forge compile, then npx urn-forge verify
```

- `--namespace` and `--domain` are the names in the header of the manifest. A name that is not lowercase snake_case gives exit code `2`:

  ```
  --domain "Bad" must be lowercase snake_case that starts with a letter (at most 63 characters)
  ```

- If one of the starter files exists, `init` writes no file and stops with exit code `1`.

## compile

```bash
npx urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>]
```

`compile` reads the manifest, shows its diagnostics, and writes the generated files. It writes no file if the manifest has an error. Each line of the output is one file:

| Status | Meaning |
| --- | --- |
| `wrote` | The file is new, or its content changed |
| `unchanged` | The file has the same content |
| `removed` | The file is a generated file that compile no longer makes |

```
wrote      src/generated/domain.generated.ts
```

With `postgres` in the config, `compile` writes three files. In the root of the urn-forge repository, this command compiles the booking fixture:

```bash
node packages/urn-forge/bin/urn-forge.js compile --config packages/urn-forge/tests/fixtures/booking/urn-forge.config.ts
```

The command shows this output:

```
packages/urn-forge/tests/fixtures/booking/domain.manifest.yaml:124  warning  deprecated-use  booking uses the deprecated definition note
unchanged  packages/urn-forge/tests/fixtures/booking/generated/domain.generated.ts
unchanged  packages/urn-forge/tests/fixtures/booking/generated/schema.generated.sql
unchanged  packages/urn-forge/tests/fixtures/booking/generated/domain.store.generated.ts
```

## verify

```bash
npx urn-forge verify [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>]
```

`verify` compiles the manifest in memory, then runs the four gates. It writes no file. Refer to [Verification gates](./verification-gates).

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 15 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

## diff

```bash
npx urn-forge diff [--report] <old manifest> <new manifest>
```

`diff` compiles both manifests, lists the changes between them, and judges the breaking changes by the versions. With `--report`, a breaking change that the versions do not allow is reported, and the exit code is `0`. Refer to [Diff and versions](./diff).

```
breaking    definitions.weight_grams  maximum is now 20000, not 30000: it accepts less
compatible  definitions.zone  enum is now ["domestic","international","regional"], not ["domestic","international"]: it accepts more
diff failed: 2 change(s), 1 breaking, 1.0.0 → 1.1.0: 1.0.0 → 1.1.0 keeps the major version 1; a breaking change needs a new major version
```

`diff` does not read the config. Its paths are relative to the working folder.

## Related pages

- [The configuration file](./configuration)
- [Diagnostics](./diagnostics)
- [Verification gates](./verification-gates)
