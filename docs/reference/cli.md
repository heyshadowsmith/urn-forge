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
| `--help`, `-h`, `help` | Writes the usage text to stdout | `0` |
| `--version` | Writes the version, `0.1.0`, to stdout | `0` |
| No command | Writes the usage text to stdout | `2` |
| A different word | Writes `unknown command "<word>"` and the usage text to stderr | `2` |

`--help` and `--version` are commands. They are correct only as the first argument. After `compile` or `verify`, they are unknown options.

urn-forge 0.1.0 does not have the `diff`, `inspect` and `graph` commands at this time. Refer to [Scope](./scope).

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
urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--format text|json]
```

| Option | Value | Default | Setting in the configuration file |
| --- | --- | --- | --- |
| `--config` | A file | `urn-forge.config.ts`, if it is in the current directory | None |
| `--manifest` | A file | `domain.manifest.yaml` | `manifest` |
| `--out` | A directory | `src/generated` | `out` |
| `--format` | `text` or `json` | `text` | None |

The `compile` command does these steps:

1. It loads the configuration file, if there is one.
2. It reads the manifest and runs the [compiler passes](./compiler-passes).
3. It runs the plugins in the sequence of the `plugins` setting.
4. It writes each generated file in the `--out` directory.

The files that the default plugins make are `domain.schemas.generated.ts` and `domain.runtime.generated.ts`.

- If the `--out` directory does not exist, `compile` makes it.
- If a file has the same content as the new output, `compile` does not write it. The modification time of the file does not change.
- If there is an error diagnostic, `compile` writes no files.
- `compile` removes each `*.generated.*` file in `--out` and its subdirectories that it does not make, if the file starts with the urn-forge header. For example, it removes the file of a plugin that you removed from the configuration. It does not remove other files. Gate 4 reports a `*.generated.*` file that the compile does not make as `generated-orphan`.

## `verify`

```
urn-forge verify [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--format text|json]
```

| Option | Value | Default | Setting in the configuration file | Used by |
| --- | --- | --- | --- | --- |
| `--config` | A file | `urn-forge.config.ts`, if it is in the current directory | None | All |
| `--manifest` | A file | `domain.manifest.yaml` | `manifest` | All |
| `--out` | A directory | `src/generated` | `out` | Gates 1 and 4 |
| `--core` | A file | `src/core.ts` | `core` | Gate 1 |
| `--features` | A directory | `features` | `features` | Gate 3. `verify` also reads its subdirectories |
| `--tsconfig` | A file | `tsconfig.json` | `tsconfig` | Gate 1 |
| `--format` | `text` or `json` | `text` | None | All |

The `verify` command compiles the manifest in memory. It does not write files. If the manifest has an error diagnostic, no gate runs. Then it runs the gates in this sequence:

| Gate | Name | Examines |
| --- | --- | --- |
| 1 | `completeness` | The core has a handler of the generated type for each operation |
| 3 | `gherkin` | The tags, tables, declared errors and boundary cases of the feature files |
| 4 | `drift` | The files in `--out` are the same as a new compile, byte for byte |

A gate fails if one or more of its problems is an error. Warnings and notes do not make a gate fail. urn-forge does not have gates 2 and 5 at this time. For the checks of each gate, refer to [Verification gates](./verification-gates).

## Settings from options, the configuration file and defaults

Each path setting comes from the first of these sources that has a value:

| Sequence | Source | A relative path starts from |
| --- | --- | --- |
| 1 | The option on the command line | The current directory |
| 2 | The setting in the configuration file | The directory of the configuration file |
| 3 | The default | The current directory |

The `boundaryCoverage` and `plugins` settings do not have an option. They come only from the configuration file, or from their defaults. For each setting, refer to [The configuration file](./configuration).

Examples:

| Command | Manifest that `compile` reads |
| --- | --- |
| `urn-forge compile` with no `urn-forge.config.ts` | `./domain.manifest.yaml` |
| `urn-forge compile --config example/urn-forge.config.ts` | `example/../tests/fixtures/math/domain.manifest.yaml`, from the `manifest` setting |
| `urn-forge compile --config example/urn-forge.config.ts --manifest other.yaml` | `./other.yaml`. The option overrides the setting |

## Options

- An option takes its value as the next argument (`--out gen`) or after `=` (`--out=gen`).
- An option that the command does not have is a usage error. For example, `compile --core x` stops with `Unknown option '--core'` and exit code `2`.
- A positional argument is a usage error. For example, `compile domain.manifest.yaml` stops with exit code `2`.
- A `--format` value other than `text` or `json` is a usage error: `--format must be text or json, not "<value>"`.

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
fingerprint sha256:afc8912f125ce7b717f20352840a661f02f48258d3cf84d8f1eb426b1ff3b7ce
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

`verify` writes the manifest and configuration diagnostics to stderr. Then it writes one line for each gate to stdout. Below the line of a gate, it writes each problem of the gate, with an indent of four spaces. Then it writes one result line. This is the output of `urn-forge verify --config tutorial/1-first-domain/urn-forge.config.ts`:

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/1-first-domain/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, strict: 0/1 features
    tutorial/1-first-domain/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    tutorial/1-first-domain/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/1-first-domain/generated
verify passed with 2 warning(s) (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
```

The line of a gate has this form:

```
gate <number>  <name>  PASS|FAIL  <summary>
```

| Result line | Stream | Cause |
| --- | --- | --- |
| `verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)` | stdout | All gates pass, with no warnings |
| `verify passed with <n> warning(s) (gates 1, 3, 4; …)` | stdout | All gates pass. `<n>` is the number of warnings. Notes are not in this number |
| `verify failed: gate <numbers>` | stderr | One or more gates fail, for example `verify failed: gate 1, 4` |
| `verify failed: the manifest cannot be read` | stderr | The manifest file is not there, or urn-forge cannot read it. No gate ran |
| `verify failed: the manifest does not compile` | stderr | The manifest has an error diagnostic. No gate ran |
| `verify failed: the config is not valid` | stderr | The configuration file has an error. No gate ran |

## JSON output

With `--format json`, urn-forge writes JSON lines to stdout and nothing to stderr. A usage error still writes text to stderr. The exit codes do not change. For each type of line, refer to [JSON output](./json-output).

## Exit codes

| Exit code | Cause |
| --- | --- |
| `0` | The command is correct. `verify` can have warnings and notes |
| `1` | An error diagnostic: in the configuration file, in the manifest, from a plugin, or in a gate. Also a file that urn-forge cannot read |
| `2` | A usage error: no command, an unknown command, an unknown option, a positional argument or an incorrect `--format` value |

## Scripts in this repository

### From the root of the repository

| Script | Function |
| --- | --- |
| `npm test` | Runs the Vitest tests of `packages/urn-forge` |
| `npm run typecheck` | Runs `tsc --noEmit` on `packages/urn-forge` |
| `npm run verify:example` | Runs `urn-forge verify` on the math example (`example/urn-forge.config.ts`) |
| `npm run verify:self` | Runs `urn-forge verify` on the domain of urn-forge (`self/urn-forge.config.ts`) |
| `npm run verify:tutorial` | Runs `urn-forge verify` on each of the three tutorial snapshots, in sequence. It stops at the first snapshot that fails |
| `npm run test:features` | Runs `cucumber-js` on the features of the math example |
| `npm run test:features:self` | Runs `cucumber-js --profile self` on the features of the domain of urn-forge |
| `npm run test:features:tutorial` | Runs `cucumber-js` with the profiles `tutorial-1`, `tutorial-2` and `tutorial-3`, in sequence |
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

The tutorial snapshots are in `tutorial/1-first-domain`, `tutorial/2-declared-errors` and `tutorial/3-strict-coverage`. Each snapshot has its own `urn-forge.config.ts`. The Cucumber profiles are in `cucumber.json`.

## Related pages

- [The configuration file](./configuration)
- [JSON output](./json-output)
- [Diagnostics](./diagnostics)
- [Run verify in CI](../how-to/run-verify-in-ci)
- [Regenerate the code after a manifest change](../how-to/regenerate-code)
