# Fix a gate that fails

Find the cause of a gate that fails, and correct it. This page gives the most common problems of each gate. For every code, refer to [Diagnostics](../reference/diagnostics).

## Before you start

- You have a project that `urn-forge verify` examines. Refer to [Set up a project](set-up-a-project).
- The examples come from tutorial 3 and the insurance domain, with one part broken for each example. They run from `packages/urn-forge`.

## Steps

1. Run `npx urn-forge verify`.
2. Find each gate line that shows `FAIL`.
3. Read the indented lines below that gate. Each line is one problem: `<file>:<line>:<column>  <severity>  <code>  <message>`.
4. Fix the problems with the severity `error`. A `warning` and a `note` do not fail a gate.
5. If one change causes more than one problem, fix the first problem. The others often go away with it.
6. Run `verify` again.

If the manifest does not compile, `verify` runs no gate. Correct the manifest at the line and column that the problem gives:

```
tutorial/3-strict-coverage/domain.manifest.yaml:45:10  error  unresolved-ref  urn:demo:shipping:quote:operation:quote_shipping: input "parcel.entity.parcels" does not resolve (no atom urn:demo:shipping:parcel:entity:parcels in this manifest)
verify failed: the manifest does not compile
```

## Gate 1: completeness

Gate 1 type-checks the core with `tsc`. It also looks for an export that uses `satisfies DomainCoreImplementation`.

| Code | Cause | Fix |
| --- | --- | --- |
| `type-error` with `TS1360` | The core has no handler for an operation | Add a handler for the URN that the message names. Refer to [Add an operation](add-an-operation) |
| `type-error` with `TS2353` | A key in the core has an incorrect URN | Copy the URN from the manifest. The `TS7031` errors go away with it |
| `type-error` with `TS2322` | A handler returns a plain object, not `ok(…)` or `fail(…)` | Return `ok(…)` or `fail(…)` |
| `missing-satisfies` | No export uses `satisfies DomainCoreImplementation` | Declare the core as the message shows |
| `core-not-found` | The `core` path names no file | Correct the path. A path in the config is relative to the config file |

A handler is not there:

```
gate 1  completeness  FAIL  tsc: 1 error(s) over tutorial/3-strict-coverage/src/core.ts; `core` satisfies DomainCoreImplementation
    tutorial/3-strict-coverage/src/core.ts:7:24  error  type-error  TS1360: Type '{}' does not satisfy the expected type 'DomainCoreImplementation'.
      Property ''urn:demo:shipping:quote:operation:quote_shipping'' is missing in type '{}' but required in type 'DomainCoreImplementation'.
```

If the error is in a generated file, a generated file is possibly not there. Fix gate 4 first.

::: warning
Do not remove the `satisfies` clause to make `tsc` pass. Gate 1 then fails with `missing-satisfies`.
:::

## Gate 2: boundary discipline

Gate 2 makes sure that no core file and no shell file makes a branded value without a parse.

| Code | Cause | Fix |
| --- | --- | --- |
| `brand-assertion` | A type assertion to a branded type, such as `'0' as PolicyLimit` | Remove the assertion. Use the plain type, or parse the value in the shell |
| `brand-from-any` | An `any`, such as `JSON.parse(raw)`, where a branded type belongs | Parse the value with its generated schema in the shell |
| `suppressed-check` | `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` | Remove the comment, and correct the type error that gate 1 then shows |
| `core-parser-import` | The core imports `valibot` or the generated schemas as a value | Return the plain value. Use `import type` for the branded types |

Here the insurance core makes branded values with type assertions:

```
gate 2  boundary      FAIL  1 core file(s), 0 shell file(s): 3 problem(s)
    insurance/core.ts:23:25  error  brand-assertion  '0' as PolicyLimit asserts the branded type PolicyLimit; only a generated parser makes a branded value
    insurance/core.ts:24:23  error  brand-assertion  '' as unknown as CustomerCustomerId asserts the branded type CustomerCustomerId; only a generated parser makes a branded value
    insurance/core.ts:25:22  error  brand-assertion  {} as PolicyPolicy asserts the branded type PolicyPolicy; only a generated parser makes a branded value
```

If the summary shows `0 shell file(s)`, gate 2 does not examine your shell. Add `shell` to the config. Refer to [Call an operation from the shell](call-an-operation).

## Gate 3: Gherkin traceability

Gate 3 reads the feature files. It does not run them.

| Code | Cause | Fix |
| --- | --- | --- |
| `unresolved-tag` | A tag names no URN of the manifest | Correct the tag |
| `untagged-operation` | No feature or scenario has the tag of an operation | Tag a feature with `@` and the operation URN |
| `unknown-header` | A table header is not a field of the operation | Use a name from the `allowed` list |
| `missing-column` | An input table has no column for a required input field | Add the column. Leave the cell empty to send no value |
| `undeclared-error` | A scenario expects an error that the operation does not list | Use a URN from the `errors` list, or add the error to the operation |
| `undeclared-invariant` | A scenario expects an invariant that is not on the input | Use a URN from the `invariants` list |
| `invalid-cell` | A list or object cell is malformed | Put a value with a comma, a bracket or a brace in double quotes |
| `feature-parse-error` | A file is not valid Gherkin | Correct the first error. The others often go away with it |
| `uncovered-boundary`, `uncovered-error`, `uncovered-invariant` | No scenario tests a boundary, an error or an invariant | Add the scenario. Refer to [Close boundary gaps](close-boundary-gaps) |

A coverage gap is an error in a strict feature, and a warning in other features. Here a tag has an incorrect URN:

```
gate 3  gherkin       FAIL  1 feature(s), 6 scenario(s), 0/1 operations tagged, 0/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features/quote_shipping.feature:2:1  error  unresolved-tag  tag @urn:demo:shipping:quote:operation:quote_shiping does not resolve to a URN in the manifest
    tutorial/3-strict-coverage/features  error  untagged-operation  operation urn:demo:shipping:quote:operation:quote_shipping has no feature or scenario tagged @urn:demo:shipping:quote:operation:quote_shipping
```

Correct the tag. The `untagged-operation` problem goes away with it.

Here a scenario expects an error with an incorrect URN:

```
gate 3  gherkin       FAIL  1 feature(s), 6 scenario(s), 1/1 operations tagged, 0/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features/quote_shipping.feature:30:5  error  undeclared-error  "urn:demo:shipping:quote:error:too_heavy" is not a declared error of urn:demo:shipping:quote:operation:quote_shipping (errors: urn:demo:shipping:quote:error:too_heavy_for_express)
    tutorial/3-strict-coverage/features  error  uncovered-error  error urn:demo:shipping:quote:error:too_heavy_for_express of urn:demo:shipping:quote:operation:quote_shipping has no scenario that expects it; add one with Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express"
```

Use the URN from the `errors` list. The `uncovered-error` problem goes away with it.

## Gate 4: drift

Gate 4 compiles the manifest again in a temporary folder. It compares each file with the committed file, byte for byte.

| Code | Cause | Fix |
| --- | --- | --- |
| `generated-differs` | A person edited a generated file, or the manifest changed and nobody ran `compile` | Run `compile`, and commit the generated files |
| `generated-missing` | A generated file is not in the output folder | Run `compile`. If the file is in `.gitignore`, remove it from there |
| `generated-orphan` | The output folder has a generated file that the compile does not make | Run `compile`. It removes the file |

Here a person edited a generated file. The line number is the first line that is different:

```
gate 4  drift         FAIL  2 generated file(s) compared byte for byte against tutorial/3-strict-coverage/src/generated
    tutorial/3-strict-coverage/src/generated/domain.schemas.generated.ts:21:1  error  generated-differs  differs from a fresh compile (hand-edited or stale); run `urn-forge compile`
```

Run `compile`:

```bash
npx urn-forge compile --config tutorial/3-strict-coverage/urn-forge.config.ts
```

```
unchanged  tutorial/3-strict-coverage/src/generated/domain.runtime.generated.ts
wrote      tutorial/3-strict-coverage/src/generated/domain.schemas.generated.ts
fingerprint sha256:492eef5cf4429536322062da365f080ff6cc4091bb6ae5563c713a73570b3b10
```

To change the generated code, change the manifest, not the file. Refer to [Regenerate the code](regenerate-code).

## Result

`verify` shows `PASS` for each gate, and the last line starts with `verify passed`:

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/3-strict-coverage/src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/3-strict-coverage/src/generated
verify passed (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

## Related pages

- [Diagnostics](../reference/diagnostics)
- [Verification gates](../reference/verification-gates)
- [Run verify in CI](run-verify-in-ci)
