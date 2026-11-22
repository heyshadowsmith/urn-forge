# The CLI

```
urn-forge <command> [options]
```

The `urn-forge` command needs Node.js 22 or later.

## Commands

| Command | Function | Exit code |
| --- | --- | --- |
| [`init`](#init) | Writes a starter project in the current directory, then compiles it | `0`, `1` or `2` |
| [`compile`](#compile) | Examines the manifest and writes the generated files | `0`, `1` or `2` |
| [`verify`](#verify) | Compiles the manifest in memory and runs gates 1 to 4 | `0`, `1` or `2` |
| [`diff`](#diff) | Compares two manifests and gives each change a class | `0`, `1` or `2` |
| `--help`, `-h`, `help` | Writes the usage text to stdout | `0` |
| `--version` | Writes the version, `0.1.0`, to stdout | `0` |
| No command | Writes the usage text to stdout | `2` |
| A different word | Writes `unknown command "<word>"` and the usage text to stderr | `2` |

`--help` and `--version` are correct only as the first argument.

## `init`

```
urn-forge init [--namespace <name>] [--domain <name>]
```

| Option | Value | Default |
| --- | --- | --- |
| `--namespace` | A URN segment: lowercase snake_case that starts with a letter, 63 characters at most | `app` |
| `--domain` | A URN segment | `starter` |

`init` does these steps:

1. It makes sure that no starter file is in the current directory. If one is there, it writes no file.
2. It writes `domain.manifest.yaml`, `src/core.ts`, `features/split.feature`, `features/support/steps.ts`, `urn-forge.config.ts`, `tsconfig.json`, `cucumber.json` and `register-tsx.mjs`.
3. It writes `package.json`, or updates it. It sets `"type": "module"` and adds the scripts `compile`, `verify` and `test:features` if they are not there.
4. It runs `compile`.

| Output line | Meaning |
| --- | --- |
| `wrote      <path>` | `init` or its `compile` step wrote the file |
| `updated    package.json` | `init` added values to the `package.json` that was there |
| `next: npm run verify, then npm run test:features` | The last line, if all steps succeed |

| Problem | Message on stderr | Exit code |
| --- | --- | --- |
| A value that is not a URN segment | `urn-forge: --namespace "<value>" must be lowercase snake_case that starts with a letter (max 63 characters)` | `2` |
| A starter file is there | `urn-forge: init writes no file, because these files exist: <paths>` | `1` |
| `package.json` has a `type` other than `module` | `urn-forge: init needs an ES module package, but package.json has "type": "commonjs"; the generated code and the steps use import` | `1` |
| `package.json` is not valid JSON | `urn-forge: init cannot read package.json: <reason>` | `1` |

## `compile`

```
urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--reference-date <YYYY-MM-DD>] [--format text|json]
```

| Option | Value | Default | Setting in the configuration file |
| --- | --- | --- | --- |
| `--config` | A file | `urn-forge.config.ts`, if it is in the current directory | None |
| `--manifest` | A file | `domain.manifest.yaml` | `manifest` |
| `--out` | A directory | `src/generated` | `out` |
| `--reference-date` | A date `YYYY-MM-DD` | None. Sunset dates are then not compared | `referenceDate` |
| `--format` | `text` or `json` | `text` | None |

- `compile` runs the plugins in the sequence of the `plugins` setting. A sunset atom makes no code.
- If the `--out` directory does not exist, `compile` makes it.
- If a file has the same content as the new output, `compile` does not write it.
- If there is an error diagnostic, `compile` writes no files.
- `compile` removes each `*.generated.*` file in `--out` that it does not make, if the file starts with the urn-forge header.

## `verify`

```
urn-forge verify [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--reference-date <YYYY-MM-DD>] [--format text|json]
```

| Option | Value | Default | Setting in the configuration file | Used by |
| --- | --- | --- | --- | --- |
| `--config` | A file | `urn-forge.config.ts`, if it is in the current directory | None | All |
| `--manifest` | A file | `domain.manifest.yaml` | `manifest` | All |
| `--out` | A directory | `src/generated` | `out` | Gates 1, 2 and 4 |
| `--core` | A file | `src/core.ts` | `core` | Gates 1 and 2 |
| `--features` | A directory, with its subdirectories | `features` | `features` | Gate 3 |
| `--tsconfig` | A file | `tsconfig.json` | `tsconfig` | Gates 1 and 2 |
| `--reference-date` | A date `YYYY-MM-DD` | None | `referenceDate` | The compile |
| `--format` | `text` or `json` | `text` | None | All |

`verify` writes no files. If the manifest has an error diagnostic, no gate runs. For each gate, refer to [Verification gates](./verification-gates).

## `diff`

```
urn-forge diff <old manifest> <new manifest> [--config <file>] [--format text|json]
```

| Argument or option | Value | Default |
| --- | --- | --- |
| `<old manifest>` | The manifest before the change | Necessary |
| `<new manifest>` | The manifest after the change | Necessary |
| `--config` | A file. `diff` reads only the `tables` of the `postgres` plugin from it | `urn-forge.config.ts`, if it is in the current directory |
| `--format` | `text` or `json` | `text` |

- `diff` compiles the two manifests in memory, with no reference date. It writes no files.
- `diff` does not read git. Write the old manifest to a file first, for example with `git show`.
- A breaking change is the diagnostic `breaking-change`. Its severity is `error`, or `warning` if the old manifest has `stability: experimental`.
- Compatible and lifecycle changes are report lines, not diagnostics.

For the classes, refer to [Verification gates](./verification-gates).

## Settings from options, the configuration file and defaults

Each path setting comes from the first source that has a value:

| Sequence | Source | A relative path starts from |
| --- | --- | --- |
| 1 | The option on the command line | The current directory |
| 2 | The setting in the configuration file | The directory of the configuration file |
| 3 | The default | The directory of the configuration file, if urn-forge loads one. Else the current directory |

`boundaryCoverage`, `plugins` and `shell` have no option. The reference date has no default: urn-forge never uses the clock. Refer to [The configuration file](./configuration).

## Options

- An option takes its value as the next argument (`--out gen`) or after `=` (`--out=gen`).
- These are usage errors:
  - An option that the command does not have, for example `compile --core x`: `Unknown option '--core'`.
  - A positional argument, except the two manifests of `diff`.
  - A `--format` value other than `text` or `json`: `--format must be text or json, not "<value>"`.
  - A `--reference-date` value that is not a calendar day: `--reference-date must be a date YYYY-MM-DD, not "<value>"`.
  - A `diff` with a number of manifests other than two: `diff needs two manifests: <old manifest> <new manifest>`.
- A usage error writes its message, an empty line and the usage text to stderr. The exit code is `2`.

## Exit codes

| Exit code | Cause |
| --- | --- |
| `0` | The command is correct. `verify` can have warnings and notes. `diff` found no breaking change, or the old manifest is experimental |
| `1` | An error diagnostic: in the configuration file, in the manifest, from a plugin, or in a gate. A breaking change, if the old manifest is not experimental. A file that urn-forge cannot read |
| `2` | A usage error |

## Text output

All paths are relative to the current directory, with forward slashes.

### Diagnostic lines

```
<file>:<line>:<column>  <severity>  <code>  <message>
```

If the diagnostic has no position, the line starts with `<file>` only. For each code, refer to [Diagnostics](./diagnostics).

```
tests/fixtures/broken-references/domain.manifest.yaml:39:10  error  wrong-ref-kind  urn:demo:broken:order:operation:place: input "order.field.quantity" must name an entity, but urn:demo:broken:order:field:quantity is a field
```

### `compile`

`compile` writes the diagnostics to stderr. If there is no error, it writes one line for each file to stdout, then the fingerprint. The output of `urn-forge compile --config example/urn-forge.config.ts` when the files are current:

```
unchanged  example/generated/domain.runtime.generated.ts
unchanged  example/generated/domain.schemas.generated.ts
fingerprint sha256:e69e1912890b626f5d271fdf69961f88eb5848e7928186ab788ce9f150ec1002
```

| Line | Meaning |
| --- | --- |
| `wrote      <path>` | The file was not there, or its content changed |
| `unchanged  <path>` | The file had the same content. `compile` did not write it |
| `removed    <path>` | `compile` removed a generated file that it no longer makes |
| `fingerprint sha256:<hex>` | The fingerprint in the header of each generated file |

### `verify`

`verify` writes the configuration and manifest diagnostics to stderr. If the manifest has a `sunsetDate` and there is no reference date, it writes `note: sunset dates are not checked: set --reference-date or referenceDate in the config` to stdout. Then it writes one line for each gate to stdout, with the problems of the gate below it, indented four spaces. The output of `urn-forge verify --config tutorial/1-first-domain/urn-forge.config.ts`:

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/1-first-domain/src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, strict: 0/1 features
    tutorial/1-first-domain/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    tutorial/1-first-domain/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/1-first-domain/src/generated
verify passed with 2 warning(s) (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

| Last line | Stream | Cause |
| --- | --- | --- |
| `verify passed (gates 1, 2, 3, 4; gate 5 is urn-forge diff)` | stdout | All gates pass, with no warnings |
| `verify passed with <n> warning(s) (gates 1, 2, 3, 4; gate 5 is urn-forge diff)` | stdout | All gates pass. Notes are not counted |
| `verify failed: gate <numbers>` | stderr | One or more gates fail, for example `verify failed: gate 1, 4` |
| `verify failed: the manifest cannot be read` | stderr | No gate ran |
| `verify failed: the manifest does not compile` | stderr | No gate ran |
| `verify failed: the config is not valid` | stderr | No gate ran |

### `diff`

`diff` writes one line for each change to stdout, in URN order, then the last line:

```
<class>  <URN>  <message>
```

The class has 10 characters. A change to the manifest header has the URN `urn:<namespace>:<domain>`. In this example, the new insurance manifest deprecates `policy.field.note` and adds `policy.field.remark`:

```bash
urn-forge diff old.manifest.yaml insurance/domain.manifest.yaml --config insurance/urn-forge.config.ts
```

```
compatible  urn:acme:insurance:policy:entity:coverage  adds the optional property "remark"; the database needs a migration for it
lifecycle   urn:acme:insurance:policy:field:note  status active → deprecated
compatible  urn:acme:insurance:policy:field:remark  is new
diff passed: 0 breaking, 2 compatible, 1 lifecycle change(s)
```

A breaking change. The exit code is `1`:

```
breaking    urn:demo:shop:order:field:qty  max 10 → 5 narrows a value that callers send, which breaks callers that send it
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

| Result | Last line | Stream | Exit code |
| --- | --- | --- | --- |
| No breaking change | `diff passed: <b> breaking, <c> compatible, <l> lifecycle change(s)` | stdout | `0` |
| Breaking changes, and the old manifest is experimental | `diff passed: …; the breaking changes are warnings, because <old manifest> is experimental` | stdout | `0` |
| Breaking changes | `diff failed: <b> breaking, <c> compatible, <l> lifecycle change(s)` | stderr | `1` |
| A manifest does not compile | `diff failed: <manifest> does not compile` | stderr | `1` |
| A manifest cannot be read | `diff failed: a manifest cannot be read` | stderr | `1` |
| The configuration file is not valid | `diff failed: the config is not valid` | stderr | `1` |

## JSON output

With `--format json`, `compile`, `verify` and `diff` write one JSON object on each line to stdout, and nothing to stderr. A usage error still writes text to stderr. The exit codes do not change.

| `type` | Command | Lines | Description |
| --- | --- | --- | --- |
| `diagnostic` | All | Zero or more | One diagnostic |
| `change` | `diff` | Zero or more | One compatible or lifecycle change |
| `file` | `compile` | One for each generated or removed file | One file |
| `gate` | `verify` | One for each gate that ran | The result of one gate |
| `result` | All | Exactly one, always the last line | The result of the command |

### Properties

urn-forge leaves out a property that has no value.

| Line | Property | Type | Description |
| --- | --- | --- | --- |
| `diagnostic` | `gate` | `1` to `4` | Only for a gate problem of `verify` |
| `diagnostic` | `severity` | `"error"`, `"warning"` or `"note"` | |
| `diagnostic` | `code` | string | Refer to [Diagnostics](./diagnostics) |
| `diagnostic` | `file` | string | The file. For `breaking-change`, the new manifest |
| `diagnostic` | `line`, `column` | number | From 1. Only if the diagnostic has a position |
| `diagnostic` | `urn` | string | Only if the diagnostic is about one atom |
| `diagnostic` | `message` | string | The message of the text format. A line break is `\n` |
| `file` | `path` | string | The generated file |
| `file` | `changed` | boolean | `true` if `compile` wrote or removed the file |
| `file` | `removed` | `true` | Only for a removed file |
| `change` | `class` | `"compatible"` or `"lifecycle"` | |
| `change` | `urn`, `message` | string | As in the text format |
| `gate` | `gate` | `1` to `4` | |
| `gate` | `name` | `"completeness"`, `"boundary"`, `"gherkin"` or `"drift"` | |
| `gate` | `ok` | boolean | `true` if the gate found no error |
| `gate` | `summary` | string | As in the text format |
| `result` | `ok` | boolean | `true` if the exit code is `0` |
| `result` | `fingerprint` | string | `compile`, only if `ok` is `true` |
| `result` | `failedGates` | number array | `verify`. Empty if no gate ran |
| `result` | `warnings` | number | `verify`. Notes are not counted |
| `result` | `sunsetDatesChecked` | boolean | `verify`, if the configuration is valid. `false` if the manifest has a `sunsetDate` and there is no reference date |
| `result` | `breaking`, `compatible`, `lifecycle` | number | `diff` |

### Sequence of the lines

| Command | Sequence |
| --- | --- |
| `compile` | The diagnostics. If there is no error, one `file` line for each file, in path order. The `result` line |
| `verify` | The configuration and manifest diagnostics. The gate diagnostics, gate 1 first. One `gate` line for each gate. The `result` line. If no gate ran: only the diagnostics and the `result` line |
| `diff` | The `change` lines, in URN order. The `breaking-change` diagnostics, in URN order. The `result` line. If the configuration is not valid: only its diagnostics |

### Examples

`urn-forge compile --config example/urn-forge.config.ts --format json`:

```json
{"type":"file","path":"example/generated/domain.runtime.generated.ts","changed":false}
{"type":"file","path":"example/generated/domain.schemas.generated.ts","changed":false}
{"type":"result","ok":true,"fingerprint":"sha256:e69e1912890b626f5d271fdf69961f88eb5848e7928186ab788ce9f150ec1002"}
```

`urn-forge verify --config tutorial/2-declared-errors/urn-forge.config.ts --format json`:

```json
{"type":"diagnostic","gate":3,"severity":"warning","code":"uncovered-boundary","file":"tutorial/2-declared-errors/features","urn":"urn:demo:shipping:parcel:field:weight_grams","message":"urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)"}
{"type":"diagnostic","gate":3,"severity":"warning","code":"uncovered-boundary","file":"tutorial/2-declared-errors/features","urn":"urn:demo:shipping:parcel:field:zone","message":"urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values"}
{"type":"gate","gate":1,"name":"completeness","ok":true,"summary":"tsc: 0 error(s) over tutorial/2-declared-errors/src/core.ts; `core` satisfies DomainCoreImplementation"}
{"type":"gate","gate":2,"name":"boundary","ok":true,"summary":"1 core file(s), 0 shell file(s): 0 problem(s)"}
{"type":"gate","gate":3,"name":"gherkin","ok":true,"summary":"1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features"}
{"type":"gate","gate":4,"name":"drift","ok":true,"summary":"2 generated file(s) compared byte for byte against tutorial/2-declared-errors/src/generated"}
{"type":"result","ok":true,"failedGates":[],"warnings":2,"sunsetDatesChecked":true}
```

`urn-forge diff tests/diff/error-added/old.yaml tests/diff/error-added/new.yaml --config tests/diff/no-config.ts --format json`. The exit code is `1`:

```json
{"type":"change","class":"compatible","urn":"urn:demo:shop:order:error:closed","message":"is new"}
{"type":"diagnostic","severity":"error","code":"breaking-change","file":"tests/diff/error-added/new.yaml","urn":"urn:demo:shop:order:operation:place","message":"urn:demo:shop:order:operation:place: the new declared error urn:demo:shop:order:error:closed widens a value that callers receive, which breaks callers that receive it"}
{"type":"result","ok":false,"breaking":1,"compatible":1,"lifecycle":0}
```

## Related pages

- [The configuration file](./configuration)
- [Diagnostics](./diagnostics)
- [Run verify in CI](../how-to/run-verify-in-ci)
