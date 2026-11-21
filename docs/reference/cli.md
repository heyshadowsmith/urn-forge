# The CLI

```
urn-forge <command> [options]
```

The `urn-forge` command is `bin/urn-forge.js` in `packages/urn-forge`. It runs the TypeScript source with tsx, so it does not need a build step. It needs Node.js 22 or later.

## Commands

| Command | Function | Exit code |
| --- | --- | --- |
| [`init`](#init) | Writes a starter project in the current directory, then compiles it | `0`, `1` or `2` |
| [`compile`](#compile) | Examines the manifest and writes the generated files | `0`, `1` or `2` |
| [`verify`](#verify) | Compiles the manifest in memory and runs gates 1, 3 and 4 | `0`, `1` or `2` |
| [`diff`](#diff) | Compares two manifests and gives each change a class. This is gate 5 | `0`, `1` or `2` |
| `--help`, `-h`, `help` | Writes the usage text to stdout | `0` |
| `--version` | Writes the version, `0.1.0`, to stdout | `0` |
| No command | Writes the usage text to stdout | `2` |
| A different word | Writes `unknown command "<word>"` and the usage text to stderr | `2` |

`--help` and `--version` are commands. They are correct only as the first argument. After `compile`, `verify` or `diff`, they are unknown options.

urn-forge 0.1.0 does not have the `inspect` and `graph` commands at this time. Refer to [Scope](./scope).

## `init`

```
urn-forge init [--namespace <name>] [--domain <name>]
```

| Option | Value | Default |
| --- | --- | --- |
| `--namespace` | A URN segment: lowercase snake_case that starts with a letter, 63 characters at most | `app` |
| `--domain` | A URN segment | `starter` |

The `init` command does these steps:

1. It makes sure that no starter file is in the current directory. If one is there, it writes no file.
2. It writes the starter files: `domain.manifest.yaml`, `src/core.ts`, `features/split.feature`, `features/support/steps.ts`, `urn-forge.config.ts`, `tsconfig.json`, `cucumber.json` and `register-tsx.mjs`. It puts `--namespace` and `--domain` in the manifest header and in each URN.
3. It writes `package.json`, or updates the file that is there. It sets `"type": "module"`. It adds the scripts `compile`, `verify` and `test:features` if they are not there. It keeps all other values.
4. It runs `compile`, which writes `src/generated/`.

| Output line | Meaning |
| --- | --- |
| `wrote      <path>` | `init` wrote a starter file, or the `compile` step wrote a generated file |
| `updated    package.json` | `package.json` was there, and `init` added values to it |
| `next: npm run verify, then npm run test:features` | The last line, if all steps succeed |

| Problem | Message on stderr | Exit code |
| --- | --- | --- |
| A value that is not a URN segment | `urn-forge: --namespace "<value>" must be lowercase snake_case that starts with a letter (max 63 characters)` | `2` |
| A starter file is there | `urn-forge: init writes no file, because these files exist: <paths>` | `1` |
| `package.json` has a `type` other than `module` | `urn-forge: init needs an ES module package, but package.json has "type": "commonjs"; the generated code and the steps use import` | `1` |
| `package.json` is not valid JSON | `urn-forge: init cannot read package.json: <reason>` | `1` |

For the steps after `init`, refer to [Set up a project](../how-to/set-up-a-project).

## `compile`

```
urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--reference-date <YYYY-MM-DD>] [--format text|json]
```

| Option | Value | Default | Setting in the configuration file |
| --- | --- | --- | --- |
| `--config` | A file | `urn-forge.config.ts`, if it is in the current directory | None |
| `--manifest` | A file | `domain.manifest.yaml` | `manifest` |
| `--out` | A directory | `src/generated` | `out` |
| `--reference-date` | A date `YYYY-MM-DD` | None. Pass 8 then does not compare sunset dates | `referenceDate` |
| `--format` | `text` or `json` | `text` | None |

The `compile` command does these steps:

1. It loads the configuration file, if there is one.
2. It reads the manifest and runs the [compiler passes](./compiler-passes). Pass 8 compares each `sunsetDate` with the reference date.
3. It runs the plugins in the sequence of the `plugins` setting. The plugins get the IR with no sunset atoms, so a sunset atom makes no code.
4. It writes each generated file in the `--out` directory.

The files that the default plugins make are `domain.schemas.generated.ts` and `domain.runtime.generated.ts`.

- If the `--out` directory does not exist, `compile` makes it.
- If a file has the same content as the new output, `compile` does not write it. The modification time of the file does not change.
- If there is an error diagnostic, `compile` writes no files.
- `compile` removes each `*.generated.*` file in `--out` and its subdirectories that it does not make, if the file starts with the urn-forge header. For example, it removes the file of a plugin that you removed from the configuration. It does not remove other files. Gate 4 reports a `*.generated.*` file that the compile does not make as `generated-orphan`.

## `verify`

```
urn-forge verify [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--reference-date <YYYY-MM-DD>] [--format text|json]
```

| Option | Value | Default | Setting in the configuration file | Used by |
| --- | --- | --- | --- | --- |
| `--config` | A file | `urn-forge.config.ts`, if it is in the current directory | None | All |
| `--manifest` | A file | `domain.manifest.yaml` | `manifest` | All |
| `--out` | A directory | `src/generated` | `out` | Gates 1 and 4 |
| `--core` | A file | `src/core.ts` | `core` | Gate 1 |
| `--features` | A directory | `features` | `features` | Gate 3. `verify` also reads its subdirectories |
| `--tsconfig` | A file | `tsconfig.json` | `tsconfig` | Gate 1 |
| `--reference-date` | A date `YYYY-MM-DD` | None | `referenceDate` | Pass 8 of the compile |
| `--format` | `text` or `json` | `text` | None | All |

The `verify` command compiles the manifest in memory. It does not write files. If the manifest has an error diagnostic, no gate runs. Then it runs the gates in this sequence:

| Gate | Name | Examines |
| --- | --- | --- |
| 1 | `completeness` | The core has a handler of the generated type for each operation |
| 3 | `gherkin` | The tags, tables, declared errors and boundary cases of the feature files |
| 4 | `drift` | The files in `--out` are the same as a new compile, byte for byte |

A gate fails if one or more of its problems is an error. Warnings and notes do not make a gate fail. The gates examine the IR with no sunset atoms, so a sunset operation needs no handler and no scenario. urn-forge does not have gate 2 at this time. Gate 5 is the separate command [`urn-forge diff`](#diff). For the checks of each gate, refer to [Verification gates](./verification-gates).

## `diff`

```
urn-forge diff <old manifest> <new manifest> [--config <file>] [--format text|json]
```

| Argument or option | Value | Default |
| --- | --- | --- |
| `<old manifest>` | The manifest before the change, for example the manifest at the merge base | Necessary |
| `<new manifest>` | The manifest after the change | Necessary |
| `--config` | A file. `diff` reads only the `tables` of the `postgres` plugin from it | `urn-forge.config.ts`, if it is in the current directory |
| `--format` | `text` or `json` | `text` |

The `diff` command does these steps:

1. It loads the configuration file, if there is one. If the file is not valid, it shows the diagnostics and stops with exit code `1`.
2. It reads the two manifests and compiles each one in memory. Pass 8 runs with no reference date. `diff` writes no files.
3. If a manifest does not compile, it shows the diagnostics of that manifest and stops with exit code `1`.
4. It finds the uses of each URN in the old manifest: In, Out and Stored. The Stored use comes from the `tables` of the `postgres` plugin.
5. It gives each change a class: `compatible`, `breaking` or `lifecycle`. For the rules, refer to [Verification gates](./verification-gates).

A breaking change is the diagnostic `breaking-change`. Its severity is `error`, or `warning` if the old manifest has `stability: experimental`. Compatible and lifecycle changes are report lines, not diagnostics.

| Result | Last line | Stream | Exit code |
| --- | --- | --- | --- |
| No breaking change | `diff passed: <b> breaking, <c> compatible, <l> lifecycle change(s)` | stdout | `0` |
| One or more breaking changes, and the old manifest is experimental | `diff passed: <b> breaking, <c> compatible, <l> lifecycle change(s); the breaking changes are warnings, because <old manifest> is experimental` | stdout | `0` |
| One or more breaking changes | `diff failed: <b> breaking, <c> compatible, <l> lifecycle change(s)` | stderr | `1` |
| A manifest does not compile | `diff failed: <manifest> does not compile` | stderr | `1` |
| A manifest cannot be read | `diff failed: a manifest cannot be read`, after the `manifest-unreadable` diagnostics | stderr | `1` |
| The configuration file is not valid | `diff failed: the config is not valid`, after the diagnostics of the configuration | stderr | `1` |
| Not two manifests | `diff needs two manifests: <old manifest> <new manifest>`, and the usage text | stderr | `2` |

`diff` does not read git. To compare with the manifest of a different commit, write that manifest to a file first, for example with `git show`. Refer to [Check compatibility in CI](../how-to/check-compatibility).

## Settings from options, the configuration file and defaults

Each path setting comes from the first of these sources that has a value:

| Sequence | Source | A relative path starts from |
| --- | --- | --- |
| 1 | The option on the command line | The current directory |
| 2 | The setting in the configuration file | The directory of the configuration file |
| 3 | The default | The current directory |

The `boundaryCoverage` and `plugins` settings do not have an option. They come only from the configuration file, or from their defaults. The reference date comes from `--reference-date`, else from `referenceDate`. It has no default: urn-forge never uses the clock. For each setting, refer to [The configuration file](./configuration).

Examples:

| Command | Manifest that `compile` reads |
| --- | --- |
| `urn-forge compile` with no `urn-forge.config.ts` | `./domain.manifest.yaml` |
| `urn-forge compile --config example/urn-forge.config.ts` | `example/../tests/fixtures/math/domain.manifest.yaml`, from the `manifest` setting |
| `urn-forge compile --config example/urn-forge.config.ts --manifest other.yaml` | `./other.yaml`. The option overrides the setting |

## Options

- An option takes its value as the next argument (`--out gen`) or after `=` (`--out=gen`).
- An option that the command does not have is a usage error. For example, `compile --core x` stops with `Unknown option '--core'` and exit code `2`.
- A positional argument is a usage error, except the two manifests of `diff`. For example, `compile domain.manifest.yaml` stops with exit code `2`.
- A `--format` value other than `text` or `json` is a usage error: `--format must be text or json, not "<value>"`.
- A `--reference-date` value that is not a day of the calendar is a usage error: `--reference-date must be a date YYYY-MM-DD, not "<value>"`.

A usage error writes its message, an empty line and the usage text to stderr.

## Text output

The default format is `text`. All paths are relative to the current directory, with forward slashes. As a result, the output is the same on all computers.

### Diagnostics

urn-forge writes each diagnostic on one line, with two spaces between the parts:

```
<file>:<line>:<column>  <severity>  <code>  <message>
```

If the diagnostic has no position, the line starts with `<file>` only. Each message starts with the manifest key or the URN of the problem. For each code, refer to [Diagnostics](./diagnostics).

```
tests/fixtures/broken-references/domain.manifest.yaml:39:10  error  wrong-ref-kind  urn:demo:broken:order:operation:place: input "order.field.quantity" must name an entity, but urn:demo:broken:order:field:quantity is a field
```

### Output of `compile`

`compile` writes the diagnostics to stderr. If there is no error, it writes one line for each file to stdout, then the fingerprint:

```
unchanged  example/generated/domain.runtime.generated.ts
unchanged  example/generated/domain.schemas.generated.ts
fingerprint sha256:e69e1912890b626f5d271fdf69961f88eb5848e7928186ab788ce9f150ec1002
```

This is the output of `urn-forge compile --config example/urn-forge.config.ts` when the files are current.

| Line | Description |
| --- | --- |
| `wrote      <path>` | `compile` wrote the file, because it was not there or its content changed |
| `unchanged  <path>` | The file had the same content. `compile` did not write it |
| `removed    <path>` | `compile` removed a generated file from an earlier compile that it no longer makes |
| `fingerprint sha256:<hex>` | The fingerprint in the header of each generated file |

If there is an error, `compile` writes only the diagnostics.

### Output of `verify`

`verify` writes the manifest and configuration diagnostics to stderr. If the manifest has a `sunsetDate` and there is no reference date, it then writes `note: sunset dates are not checked: set --reference-date or referenceDate in the config` to stdout. Then it writes one line for each gate to stdout. Below the line of a gate, it writes each problem of the gate, with an indent of four spaces. Then it writes one result line. This is the output of `urn-forge verify --config tutorial/1-first-domain/urn-forge.config.ts`:

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/1-first-domain/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, strict: 0/1 features
    tutorial/1-first-domain/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    tutorial/1-first-domain/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/1-first-domain/generated
verify passed with 2 warning(s) (gates 1, 3, 4; gate 2 is not built; gate 5 is urn-forge diff)
```

The line of a gate has this form:

```
gate <number>  <name>  PASS|FAIL  <summary>
```

| Result line | Stream | Cause |
| --- | --- | --- |
| `verify passed (gates 1, 3, 4; gate 2 is not built; gate 5 is urn-forge diff)` | stdout | All gates pass, with no warnings |
| `verify passed with <n> warning(s) (gates 1, 3, 4; …)` | stdout | All gates pass. `<n>` is the number of warnings. Notes are not in this number |
| `verify failed: gate <numbers>` | stderr | One or more gates fail, for example `verify failed: gate 1, 4` |
| `verify failed: the manifest cannot be read` | stderr | The manifest file is not there, or urn-forge cannot read it. No gate ran |
| `verify failed: the manifest does not compile` | stderr | The manifest has an error diagnostic. No gate ran |
| `verify failed: the config is not valid` | stderr | The configuration file has an error. No gate ran |

### Output of `diff`

`diff` writes one line for each change to stdout, in URN order, then the last line. A line has this form:

```
<class>  <URN>  <message>
```

The class has 10 characters, with spaces at the end. A change to the manifest itself, for example to `stability`, has the URN `urn:<namespace>:<domain>`. The insurance manifest of this branch, compared with its version on `main`:

```bash
git show origin/main:packages/urn-forge/insurance/domain.manifest.yaml > old.manifest.yaml
urn-forge diff old.manifest.yaml insurance/domain.manifest.yaml --config insurance/urn-forge.config.ts
```

```
compatible  urn:acme:insurance:policy:entity:coverage  adds the optional property "remark"
lifecycle   urn:acme:insurance:policy:field:note  status active → deprecated
compatible  urn:acme:insurance:policy:field:remark  is new
diff passed: 0 breaking, 2 compatible, 1 lifecycle change(s)
```

A case from `tests/diff/`. The exit code is `1`:

```
breaking    urn:demo:shop:order:field:qty  max 10 → 5 narrows a value that callers send, which breaks callers that send it
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

## JSON output

With `--format json`, urn-forge writes JSON lines to stdout and nothing to stderr. A usage error still writes text to stderr. The exit codes do not change. For each type of line, refer to [JSON output](./json-output).

## Exit codes

| Exit code | Cause |
| --- | --- |
| `0` | The command is correct. `verify` can have warnings and notes. `diff` found no breaking change, or the old manifest is experimental |
| `1` | An error diagnostic: in the configuration file, in the manifest, from a plugin, or in a gate. For `diff`, a breaking change to a manifest that is not experimental. Also a file that urn-forge cannot read |
| `2` | A usage error: no command, an unknown command, an unknown option, a positional argument, an incorrect `--format` or `--reference-date` value, or a `diff` with a number of manifests other than two |

## Scripts in this repository

### From the root of the repository

| Script | Function |
| --- | --- |
| `npm test` | Runs the Vitest tests of `packages/urn-forge` |
| `npm run typecheck` | Runs `tsc --noEmit` on `packages/urn-forge` |
| `npm run verify:example` | Runs `urn-forge verify` on the math example (`example/urn-forge.config.ts`) |
| `npm run verify:self` | Runs `urn-forge verify` on the domain of urn-forge (`self/urn-forge.config.ts`) |
| `npm run verify:tutorial` | Runs `urn-forge verify` on each of the three tutorial snapshots, in sequence. It stops at the first snapshot that fails |
| `npm run verify:insurance` | Runs `urn-forge verify` on the insurance domain (`insurance/urn-forge.config.ts`) |
| `npm run test:features` | Runs `cucumber-js` on the features of the math example |
| `npm run test:features:self` | Runs `cucumber-js --profile self` on the features of the domain of urn-forge |
| `npm run test:features:tutorial` | Runs `cucumber-js` with the profiles `tutorial-1`, `tutorial-2` and `tutorial-3`, in sequence |
| `npm run test:features:insurance` | Runs `cucumber-js --profile insurance` on the features of the insurance domain |
| `npm run docs:dev` | Starts this documentation site, with live reload |
| `npm run docs:build` | Builds this site as static files |
| `npm run docs:preview` | Shows the static site that `docs:build` made |
| `npm run pack:tarball` | Makes `urn-forge-0.1.0.tgz` in the root folder. Refer to [Install urn-forge](../how-to/install) |
| `npm run test:tarball` | Packs urn-forge, installs the tarball in a new project, and runs `init`, `verify` and Cucumber there. It needs the npm registry |

The root scripts other than the `docs:` scripts and `pack:tarball` run the script with the same name in `packages/urn-forge`.

### From `packages/urn-forge`

`packages/urn-forge` has the same `test`, `typecheck`, `verify:` and `test:features` scripts. It also has these scripts:

| Script | Function |
| --- | --- |
| `npm run compile:example` | Runs `urn-forge compile --config example/urn-forge.config.ts`. It makes the files in `example/generated/` again |
| `npm run compile:self` | Runs `urn-forge compile --config self/urn-forge.config.ts`. It makes the files in `self/generated/` again |
| `npm run compile:insurance` | Runs `urn-forge compile --config insurance/urn-forge.config.ts`. It makes the files in `insurance/generated/` again |
| `npm run diff:base -- <git ref>` | Runs `urn-forge diff` for each domain of this repository, from its manifest at `<git ref>` to the manifest in the work tree. A domain with no manifest at `<git ref>` is new, and it has nothing to compare. CI runs it with `HEAD^1` in the `compatibility` job |

The tutorial snapshots are in `tutorial/1-first-domain`, `tutorial/2-declared-errors` and `tutorial/3-strict-coverage`. Each snapshot has its own `urn-forge.config.ts`. The Cucumber profiles are in `cucumber.json`.

## Related pages

- [The configuration file](./configuration)
- [JSON output](./json-output)
- [Diagnostics](./diagnostics)
- [Run verify in CI](../how-to/run-verify-in-ci)
- [Regenerate the code after a manifest change](../how-to/regenerate-code)
