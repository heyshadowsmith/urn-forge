# JSON output

The option `--format json` changes the output of `urn-forge compile`, `urn-forge verify` and `urn-forge diff` to JSON lines. Each line is one JSON object. The `type` property of the object gives the kind of line. This page gives each kind of line, its properties and the sequence of the lines.

```bash
npx urn-forge compile --format json
npx urn-forge verify --format json
npx urn-forge diff old.manifest.yaml domain.manifest.yaml --format json
```

## Streams and exit codes

| Item | `--format text` | `--format json` |
| --- | --- | --- |
| Diagnostics of the configuration and the manifest | stderr | stdout |
| Gate problems, gate lines, file lines and the change lines of `diff` | stdout | stdout |
| The last line of `verify` or `diff` when it fails | stderr | stdout, as the `result` line |
| A usage error | stderr, as text | stderr, as text. urn-forge writes no JSON line |
| Exit codes | `0`, `1`, `2` | The same |

With `--format json`, urn-forge writes all JSON lines to stdout and nothing to stderr. The one exception is a usage error, for example `--format xml` or an unknown option. Then urn-forge writes the error and the usage text to stderr as text, and stops with exit code `2`.

| Exit code | Description |
| --- | --- |
| `0` | The command is correct. For `verify`, all gates passed. For `diff`, no change is breaking, or the old manifest is experimental. Warnings and notes do not change the exit code |
| `1` | An error diagnostic, a configuration or manifest that urn-forge cannot read, a gate that failed, or a breaking change |
| `2` | A usage error |

## The kinds of line

| `type` | Command | Number of lines | Description |
| --- | --- | --- | --- |
| `diagnostic` | `compile`, `verify`, `diff` | Zero or more | One diagnostic: a problem in the configuration, the manifest, a plugin or a gate, or a breaking change |
| `change` | `diff` | One for each compatible change and each lifecycle change, or zero | One change that is not breaking |
| `file` | `compile` | One for each generated file and each removed file, or zero | One file that `compile` wrote, did not change, or removed |
| `gate` | `verify` | One for each gate that ran, or zero | The result of one gate |
| `result` | `compile`, `verify`, `diff` | Exactly one, always the last line | The result of the command |

## `diagnostic`

The properties occur in this sequence. urn-forge leaves out a property that has no value.

| Property | Type | Present | Description |
| --- | --- | --- | --- |
| `type` | `"diagnostic"` | Always | The kind of line |
| `gate` | `1`, `2`, `3` or `4` | `verify`, for a gate problem only | The gate that found the problem. A diagnostic of the configuration or the manifest has no `gate` |
| `severity` | `"error"`, `"warning"` or `"note"` | Always | Refer to [Diagnostics](./diagnostics) |
| `code` | string | Always | The stable code. Each code is in [Diagnostics](./diagnostics) |
| `file` | string | Always | The file that has the problem, relative to the current directory, with forward slashes. For a manifest diagnostic, this is the `--manifest` path. For some gate 3 problems, this is the `--features` directory. For `breaking-change`, this is the new manifest of `diff` |
| `line` | number | If the diagnostic has a position | The line, from 1 |
| `column` | number | If the diagnostic has a position | The column, from 1 |
| `urn` | string | If the diagnostic is about one atom | The URN of the atom |
| `message` | string | Always | The same message as in the text format. A message with more than one line contains `\n` |

## `file`

| Property | Type | Description |
| --- | --- | --- |
| `type` | `"file"` | The kind of line |
| `path` | string | The generated file, relative to the current directory, with forward slashes |
| `changed` | boolean | `true` if `compile` wrote or removed the file. `false` if the file had the same content, so `compile` did not write it |
| `removed` | `true` | Only for a removed file: a `*.generated.*` file from an earlier compile that this compile does not make |

## `change`

| Property | Type | Description |
| --- | --- | --- |
| `type` | `"change"` | The kind of line |
| `class` | `"compatible"` or `"lifecycle"` | The class of the change. A breaking change is a `diagnostic` line with the code `breaking-change` |
| `urn` | string | The URN that changed, or `urn:<namespace>:<domain>` for a change to the manifest itself |
| `message` | string | The same message as in the text format |

## `gate`

| Property | Type | Description |
| --- | --- | --- |
| `type` | `"gate"` | The kind of line |
| `gate` | `1`, `2`, `3` or `4` | The number of the gate |
| `name` | `"completeness"`, `"boundary"`, `"gherkin"` or `"drift"` | The name of the gate |
| `ok` | boolean | `true` if the gate found no error. Warnings and notes do not make it `false` |
| `summary` | string | One line that tells what the gate examined. Refer to [Verification gates](./verification-gates) |

## `result`

| Property | Type | Command | Description |
| --- | --- | --- | --- |
| `type` | `"result"` | All | The kind of line |
| `ok` | boolean | All | `true` if the command is correct. The exit code is then `0` |
| `fingerprint` | string | `compile`, only if `ok` is `true` | The fingerprint of the generated files, `sha256:` and 64 hexadecimal digits |
| `failedGates` | array of numbers | `verify` | The numbers of the gates that failed, in gate sequence. It is empty if no gate ran |
| `warnings` | number | `verify` | The number of diagnostics with the severity `warning`. Notes are not counted |
| `sunsetDatesChecked` | boolean | `verify`, if the configuration is valid | `false` if the manifest has a `sunsetDate` and there is no reference date, so pass 8 did not compare sunset dates. Else `true` |
| `breaking` | number | `diff` | The number of breaking changes |
| `compatible` | number | `diff` | The number of compatible changes |
| `lifecycle` | number | `diff` | The number of lifecycle changes |

## The sequence of the lines

### `compile`

1. The `diagnostic` lines of the configuration, the manifest and the plugins.
2. If there is no error: one `file` line for each generated file, in path sequence.
3. One `result` line.

If there is an error, `compile` writes no files and no `file` lines. The `result` line then has `"ok":false` and no `fingerprint`.

### `verify`

1. The `diagnostic` lines of the configuration or the manifest. These lines have no `gate` property.
2. The `diagnostic` lines of the gates: first all the problems of gate 1, then of gate 2, then of gate 3, then of gate 4. Each line has a `gate` property.
3. One `gate` line for each gate, in the sequence 1, 2, 3, 4.
4. One `result` line.

If the configuration is not valid, or if the manifest has an error, no gate runs. Then the output has only the diagnostics of step 1 and the `result` line, with `"failedGates":[]` and `"warnings":0`.

### `diff`

1. If the configuration is not valid: its `diagnostic` lines, and no other lines. If a manifest cannot be read or does not compile: its `diagnostic` lines, then the `result` line, and no other lines.
2. One `change` line for each compatible change and each lifecycle change, in URN order.
3. One `diagnostic` line with the code `breaking-change` for each breaking change, in URN order.
4. One `result` line.

The `breaking-change` lines have the severity `error`, or `warning` if the old manifest is experimental. If a manifest cannot be read or does not compile, the `result` line has `"breaking":0`, `"compatible":0` and `"lifecycle":0`.

## Examples

### `compile`

A correct compile in a project where the files did not change:

```json
{"type":"file","path":"generated/domain.runtime.generated.ts","changed":false}
{"type":"file","path":"generated/domain.schemas.generated.ts","changed":false}
{"type":"result","ok":true,"fingerprint":"sha256:492eef5cf4429536322062da365f080ff6cc4091bb6ae5563c713a73570b3b10"}
```

A manifest with an error. The exit code is `1`:

```json
{"type":"diagnostic","severity":"error","code":"unknown-primitive","file":"domain.manifest.yaml","line":7,"column":14,"urn":"urn:demo:shipping:parcel:field:weight_grams","message":"parcel.field.weight_grams.primitive: unknown primitive \"money\" (MVP primitives: boolean, date, decimal, enum, float, integer, string, timestamp)"}
{"type":"diagnostic","severity":"error","code":"unknown-primitive","file":"domain.manifest.yaml","line":19,"column":14,"urn":"urn:demo:shipping:quote:field:price_cents","message":"quote.field.price_cents.primitive: unknown primitive \"money\" (MVP primitives: boolean, date, decimal, enum, float, integer, string, timestamp)"}
{"type":"result","ok":false}
```

### `verify`

The snapshot of tutorial 2 passes with two warnings. The exit code is `0`:

```bash
npx urn-forge verify --config tutorial/2-declared-errors/urn-forge.config.ts --format json
```

```json
{"type":"diagnostic","gate":3,"severity":"warning","code":"uncovered-boundary","file":"tutorial/2-declared-errors/features","urn":"urn:demo:shipping:parcel:field:weight_grams","message":"urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)"}
{"type":"diagnostic","gate":3,"severity":"warning","code":"uncovered-boundary","file":"tutorial/2-declared-errors/features","urn":"urn:demo:shipping:parcel:field:zone","message":"urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values"}
{"type":"gate","gate":1,"name":"completeness","ok":true,"summary":"tsc: 0 error(s) over tutorial/2-declared-errors/core.ts; `core` satisfies DomainCoreImplementation"}
{"type":"gate","gate":2,"name":"boundary","ok":true,"summary":"1 core file(s), 0 shell file(s): 0 problem(s)"}
{"type":"gate","gate":3,"name":"gherkin","ok":true,"summary":"1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features"}
{"type":"gate","gate":4,"name":"drift","ok":true,"summary":"2 generated file(s) compared byte for byte against tutorial/2-declared-errors/generated"}
{"type":"result","ok":true,"failedGates":[],"warnings":2,"sunsetDatesChecked":true}
```

A project with a problem at each gate. The project is a copy of the snapshot of tutorial 2. It has a handler with an incorrect URN and a type assertion to a branded type. It also has a column name with an error, and a manual edit of a generated file. The exit code is `1`:

```json
{"type":"diagnostic","gate":1,"severity":"error","code":"type-error","file":"core.ts","line":8,"column":3,"message":"TS2353: Object literal may only specify known properties, and ''urn:demo:shipping:quote:operation:quote_shiping'' does not exist in type 'DomainCoreImplementation'."}
{"type":"diagnostic","gate":1,"severity":"error","code":"type-error","file":"core.ts","line":8,"column":57,"message":"TS7031: Binding element 'weight_grams' implicitly has an 'any' type."}
{"type":"diagnostic","gate":1,"severity":"error","code":"type-error","file":"core.ts","line":8,"column":71,"message":"TS7031: Binding element 'zone' implicitly has an 'any' type."}
{"type":"diagnostic","gate":1,"severity":"error","code":"type-error","file":"core.ts","line":8,"column":77,"message":"TS7031: Binding element 'express' implicitly has an 'any' type."}
{"type":"diagnostic","gate":2,"severity":"error","code":"brand-assertion","file":"core.ts","line":21,"column":20,"message":"'mars' as ParcelZone asserts the branded type ParcelZone; only a generated parser makes a branded value"}
{"type":"diagnostic","gate":3,"severity":"error","code":"unknown-header","file":"features/quote_shipping.feature","line":21,"column":9,"urn":"urn:demo:shipping:quote:operation:quote_shipping","message":"table header \"weight\" is not a field key of the input or output of urn:demo:shipping:quote:operation:quote_shipping (allowed: weight_grams, zone, express, price_cents)"}
{"type":"diagnostic","gate":3,"severity":"error","code":"missing-column","file":"features/quote_shipping.feature","line":21,"column":7,"urn":"urn:demo:shipping:quote:operation:quote_shipping","message":"the table of \"I run the operation with:\" has no column for required input field(s) \"weight_grams\" of urn:demo:shipping:quote:operation:quote_shipping; to test a missing value, keep the column and leave the cell empty"}
{"type":"diagnostic","gate":3,"severity":"warning","code":"uncovered-boundary","file":"features","urn":"urn:demo:shipping:parcel:field:weight_grams","message":"urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at min − 1 (0), no value at max 30000, no value at max + 1 (30001)"}
{"type":"diagnostic","gate":3,"severity":"warning","code":"uncovered-boundary","file":"features","urn":"urn:demo:shipping:parcel:field:zone","message":"urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values"}
{"type":"diagnostic","gate":4,"severity":"error","code":"generated-differs","file":"generated/domain.schemas.generated.ts","line":21,"column":1,"message":"differs from a fresh compile (hand-edited or stale); run `urn-forge compile`"}
{"type":"gate","gate":1,"name":"completeness","ok":false,"summary":"tsc: 4 error(s) over core.ts; `core` satisfies DomainCoreImplementation"}
{"type":"gate","gate":2,"name":"boundary","ok":false,"summary":"1 core file(s), 0 shell file(s): 1 problem(s)"}
{"type":"gate","gate":3,"name":"gherkin","ok":false,"summary":"1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features"}
{"type":"gate","gate":4,"name":"drift","ok":false,"summary":"2 generated file(s) compared byte for byte against generated"}
{"type":"result","ok":false,"failedGates":[1,2,3,4],"warnings":2,"sunsetDatesChecked":true}
```

A message with more than one line. The line break is `\n` in the JSON string:

```json
{"type":"diagnostic","gate":1,"severity":"error","code":"type-error","file":"core.ts","line":3,"column":24,"message":"TS1360: Type '{}' does not satisfy the expected type 'DomainCoreImplementation'.\n  Property ''urn:demo:shipping:quote:operation:quote_shipping'' is missing in type '{}' but required in type 'DomainCoreImplementation'."}
```

A manifest with an error. No gate runs:

```json
{"type":"diagnostic","severity":"error","code":"unknown-primitive","file":"domain.manifest.yaml","line":7,"column":14,"urn":"urn:demo:shipping:parcel:field:weight_grams","message":"parcel.field.weight_grams.primitive: unknown primitive \"money\" (MVP primitives: boolean, date, decimal, enum, float, integer, string, timestamp)"}
{"type":"diagnostic","severity":"error","code":"unknown-primitive","file":"domain.manifest.yaml","line":19,"column":14,"urn":"urn:demo:shipping:quote:field:price_cents","message":"quote.field.price_cents.primitive: unknown primitive \"money\" (MVP primitives: boolean, date, decimal, enum, float, integer, string, timestamp)"}
{"type":"result","ok":false,"failedGates":[],"warnings":0,"sunsetDatesChecked":true}
```

A configuration file with an unknown option. No gate runs, and the `result` line has no `sunsetDatesChecked`:

```json
{"type":"diagnostic","severity":"error","code":"config-invalid","file":"bad.config.ts","message":"config.colour: unknown option \"colour\""}
{"type":"result","ok":false,"failedGates":[],"warnings":0}
```

The insurance domain has a `sunsetDate`, and its configuration sets `referenceDate`, so `sunsetDatesChecked` is `true`. Without a reference date it is `false`. The exit code is `0`:

```bash
npx urn-forge verify --config insurance/urn-forge.config.ts --format json
```

```json
{"type":"diagnostic","severity":"warning","code":"deprecated-ref","file":"insurance/domain.manifest.yaml","line":79,"column":12,"urn":"urn:acme:insurance:policy:entity:coverage","message":"urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, which is deprecated (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30)"}
{"type":"gate","gate":1,"name":"completeness","ok":true,"summary":"tsc: 0 error(s) over insurance/core.ts; `core` satisfies DomainCoreImplementation"}
{"type":"gate","gate":2,"name":"boundary","ok":true,"summary":"1 core file(s), 0 shell file(s): 0 problem(s)"}
{"type":"gate","gate":3,"name":"gherkin","ok":true,"summary":"2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 2/2 events expected, 4/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)"}
{"type":"gate","gate":4,"name":"drift","ok":true,"summary":"3 generated file(s) compared byte for byte against insurance/generated"}
{"type":"result","ok":true,"failedGates":[],"warnings":1,"sunsetDatesChecked":true}
```

### `diff`

The insurance manifest, compared with its version before it had events, with `--config insurance/urn-forge.config.ts`. The new events and the new record are compatible. A new event in `emits` is breaking. The exit code is `1`:

```json
{"type":"change","class":"compatible","urn":"urn:acme:insurance:policy:error:refund_below_minimum","message":"adds the record urn:acme:insurance:policy:event:refund_refused"}
{"type":"change","class":"compatible","urn":"urn:acme:insurance:policy:event:policy_cancelled","message":"is new"}
{"type":"change","class":"compatible","urn":"urn:acme:insurance:policy:event:policy_issued","message":"is new"}
{"type":"change","class":"compatible","urn":"urn:acme:insurance:policy:event:refund_refused","message":"is new"}
{"type":"diagnostic","severity":"error","code":"breaking-change","file":"insurance/domain.manifest.yaml","urn":"urn:acme:insurance:policy:operation:cancel_policy","message":"urn:acme:insurance:policy:operation:cancel_policy: the new event urn:acme:insurance:policy:event:policy_cancelled widens a value that callers receive, which breaks callers that receive it"}
{"type":"diagnostic","severity":"error","code":"breaking-change","file":"insurance/domain.manifest.yaml","urn":"urn:acme:insurance:policy:operation:issue_policy","message":"urn:acme:insurance:policy:operation:issue_policy: the new event urn:acme:insurance:policy:event:policy_issued widens a value that callers receive, which breaks callers that receive it"}
{"type":"result","ok":false,"breaking":2,"compatible":4,"lifecycle":0}
```

A case from `tests/diff/` with a new declared error. The exit code is `1`:

```bash
npx urn-forge diff tests/diff/error-added/old.yaml tests/diff/error-added/new.yaml --config tests/diff/no-config.ts --format json
```

```json
{"type":"change","class":"compatible","urn":"urn:demo:shop:order:error:closed","message":"is new"}
{"type":"diagnostic","severity":"error","code":"breaking-change","file":"tests/diff/error-added/new.yaml","urn":"urn:demo:shop:order:operation:place","message":"urn:demo:shop:order:operation:place: the new declared error urn:demo:shop:order:error:closed widens a value that callers receive, which breaks callers that receive it"}
{"type":"result","ok":false,"breaking":1,"compatible":1,"lifecycle":0}
```

With an old manifest that is experimental, a breaking change is a warning. The exit code is `0`:

```json
{"type":"diagnostic","severity":"warning","code":"breaking-change","file":"tests/diff/experimental/new.yaml","urn":"urn:demo:shop:order:field:qty","message":"urn:demo:shop:order:field:qty: max 10 → 5 narrows a value that callers send, which breaks callers that send it"}
{"type":"result","ok":true,"breaking":1,"compatible":0,"lifecycle":0}
```

## Related pages

- [The CLI](./cli)
- [Diagnostics](./diagnostics)
- [Verification gates](./verification-gates)
- [Run verify in CI](../how-to/run-verify-in-ci)
