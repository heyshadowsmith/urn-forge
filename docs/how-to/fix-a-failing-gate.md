# Fix a gate that fails

`urn-forge verify` runs gates 1, 3 and 4. A gate fails when it reports one error or more. This guide gives the symptom and the fix for each code that a gate can report. The output on this page comes from the domain of [tutorial 3](../tutorials/strict-coverage), with one part broken on purpose for each example.

## Before you start

- You have a project that `urn-forge verify` examines. Refer to [Set up a project](set-up-a-project).
- Commands run from `packages/urn-forge`. In your project, use your own config path.

## Find the problem

1. Run `verify`:

   ```bash
   npx urn-forge verify --config tutorial/3-strict-coverage/urn-forge.config.ts
   ```

2. Find each gate line that shows `FAIL`.
3. Read the indented lines below that gate. Each line is one problem, in this form:

   ```
   <file>:<line>:<column>  <severity>  <code>  <message>
   ```

4. Fix the problems that have the severity `error`. A `warning` and a `note` do not fail a gate.
5. If one change causes more than one problem, fix the first problem. The others often go away with it.
6. Run `verify` again.

The last line shows which gates failed, for example `verify failed: gate 3`. The command then stops with exit code 1. For each code, [Diagnostics](../reference/diagnostics) gives the full description.

### If no gate runs

If the manifest does not compile, `verify` runs no gate. It shows the manifest problems and stops:

```
tutorial/3-strict-coverage/domain.manifest.yaml:45:10  error  unresolved-ref  urn:demo:shipping:quote:operation:quote_shipping: input "parcel.entity.parcels" does not resolve (no atom urn:demo:shipping:parcel:entity:parcels in this manifest)
verify failed: the manifest does not compile
```

Correct the manifest at the line and column that the problem gives. [Diagnostics](../reference/diagnostics) lists every manifest code.

If urn-forge cannot read the manifest, the last line is `verify failed: the manifest cannot be read`. Make sure that `--manifest`, or `manifest` in the configuration, gives the correct file.

## Gate 1: completeness

Gate 1 type-checks the core with `tsc`. It also makes sure that the core has an export that uses `satisfies DomainCoreImplementation`.

### `type-error`

A handler is not there. The core has no key for an operation of the manifest:

```
gate 1  completeness  FAIL  tsc: 1 error(s) over tutorial/3-strict-coverage/core.ts; `core` satisfies DomainCoreImplementation
    tutorial/3-strict-coverage/core.ts:7:24  error  type-error  TS1360: Type '{}' does not satisfy the expected type 'DomainCoreImplementation'.
      Property ''urn:demo:shipping:quote:operation:quote_shipping'' is missing in type '{}' but required in type 'DomainCoreImplementation'.
```

To fix it, add a handler for the URN that the message names. Refer to [Add an operation](add-an-operation).

A key in the core has an incorrect URN:

```
gate 1  completeness  FAIL  tsc: 4 error(s) over tutorial/3-strict-coverage/core.ts; `core` satisfies DomainCoreImplementation
    tutorial/3-strict-coverage/core.ts:8:3  error  type-error  TS2353: Object literal may only specify known properties, and ''urn:demo:shipping:quote:operation:quote_shiping'' does not exist in type 'DomainCoreImplementation'.
    tutorial/3-strict-coverage/core.ts:8:57  error  type-error  TS7031: Binding element 'weight_grams' implicitly has an 'any' type.
    tutorial/3-strict-coverage/core.ts:8:71  error  type-error  TS7031: Binding element 'zone' implicitly has an 'any' type.
    tutorial/3-strict-coverage/core.ts:8:77  error  type-error  TS7031: Binding element 'express' implicitly has an 'any' type.
```

To fix it, copy the operation URN from the manifest or from the generated runtime. The `TS7031` errors go away with the first one.

A handler returns a plain object, not a `Result`:

```
gate 1  completeness  FAIL  tsc: 1 error(s) over tutorial/3-strict-coverage/core.ts; `core` satisfies DomainCoreImplementation
    tutorial/3-strict-coverage/core.ts:8:3  error  type-error  TS2322: Type '({ weight_grams, zone, express }: { weight_grams: number & Brand<"urn:demo:shipping:parcel:field:weight_grams">; zone: ("domestic" | "international") & Brand<"urn:demo:shipping:parcel:field:zone">; express?: (boolean & Brand<...>) | undefined; }) => Failure<...> | { ...; }' is not assignable to type 'QuoteQuoteShippingHandler'.
      Type 'Failure<{ kind: "urn:demo:shipping:quote:error:too_heavy_for_express"; weight_grams: number; }> | { price_cents: number; }' is not assignable to type 'Result<{ price_cents: number; }, { kind: "urn:demo:shipping:quote:error:too_heavy_for_express"; weight_grams: number; }>'.
        Type '{ price_cents: number; }' is not assignable to type 'Result<{ price_cents: number; }, { kind: "urn:demo:shipping:quote:error:too_heavy_for_express"; weight_grams: number; }>'.
```

To fix it, return `ok(…)` for a success and `fail(…)` for a declared error. Refer to [Use branded values in the core](use-branded-values) and [Declare an error](declare-an-error).

If the error is in a generated file, a generated file is possibly not there. Fix gate 4 first.

### `missing-satisfies`

No export of the core uses `satisfies DomainCoreImplementation`:

```
gate 1  completeness  FAIL  tsc: 3 error(s) over tutorial/3-strict-coverage/core.ts; no `satisfies DomainCoreImplementation`
    tutorial/3-strict-coverage/core.ts:8:58  error  type-error  TS7031: Binding element 'weight_grams' implicitly has an 'any' type.
    tutorial/3-strict-coverage/core.ts:8:72  error  type-error  TS7031: Binding element 'zone' implicitly has an 'any' type.
    tutorial/3-strict-coverage/core.ts:8:78  error  type-error  TS7031: Binding element 'express' implicitly has an 'any' type.
    tutorial/3-strict-coverage/core.ts  error  missing-satisfies  no export uses `satisfies DomainCoreImplementation` from tutorial/3-strict-coverage/generated/domain.runtime.generated.ts; declare the core as `export const core = { … } satisfies DomainCoreImplementation;`
```

To fix it, declare the core as the message shows. Import `DomainCoreImplementation` from the generated runtime, not from a different file.

::: warning
Do not remove the `satisfies` clause to make `tsc` pass. Without it, `tsc` cannot find a handler that is not there. Gate 1 thus fails with `missing-satisfies`.
:::

### `core-not-found`

The `core` path of the config, or the `--core` flag, names a file that does not exist:

```
gate 1  completeness  FAIL  core entry missing
    tutorial/3-strict-coverage/src/core.ts  error  core-not-found  core entry not found
```

To fix it, correct the path. A path in the config is relative to the config file. Refer to [The configuration file](../reference/configuration).

### `tsconfig-unreadable`

Gate 1 cannot read the tsconfig:

```
gate 1  completeness  FAIL  tsconfig unreadable
    tutorial/3-strict-coverage/tsconfig.json  error  tsconfig-unreadable  Cannot read file 'tutorial/3-strict-coverage/tsconfig.json'.
```

To fix it, correct the `tsconfig` path in the config or the `--tsconfig` flag. The default is `tsconfig.json` in the current folder.

## Gate 3: Gherkin traceability

Gate 3 reads the feature files. It does not run them.

### `unresolved-tag` and `untagged-operation`

A tag has an incorrect URN. As a result, no feature has the tag of the operation:

```
gate 3  gherkin       FAIL  1 feature(s), 6 scenario(s), 0/1 operations tagged, 0/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features/quote_shipping.feature:2:1  error  unresolved-tag  tag @urn:demo:shipping:quote:operation:quote_shiping does not resolve to a URN in the manifest
    tutorial/3-strict-coverage/features  error  untagged-operation  operation urn:demo:shipping:quote:operation:quote_shipping has no feature or scenario tagged @urn:demo:shipping:quote:operation:quote_shipping
```

To fix it, correct the tag. The other problem goes away with it. An untagged operation gets no coverage diagnostics, so `untagged-operation` is the only problem for that operation.

If only `untagged-operation` shows, the operation is new and has no scenario. Tag a feature or a scenario with `@` and the operation URN. Refer to [Write scenarios](write-scenarios).

### `unknown-header`

A table header is not a field key of the operation:

```
gate 3  gherkin       FAIL  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features/quote_shipping.feature:55:24  error  unknown-header  table header "zones" is not a field key of the input or output of urn:demo:shipping:quote:operation:quote_shipping (allowed: weight_grams, zone, express, price_cents)
    tutorial/3-strict-coverage/features/quote_shipping.feature:55:7  error  missing-column  the table of "I run the operation with:" has no column for required input field(s) "zone" of urn:demo:shipping:quote:operation:quote_shipping; to test a missing value, keep the column and leave the cell empty
    tutorial/3-strict-coverage/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
```

To fix it, use a key from the `allowed` list. The two other problems go away with it. Every `Examples` header must also be a field key, even a column that only the step text uses.

### `missing-column`

The table of `When I run the operation with:` has no column for a required input field:

```
gate 3  gherkin       FAIL  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features/quote_shipping.feature:49:7  error  missing-column  the table of "I run the operation with:" has no column for required input field(s) "zone" of urn:demo:shipping:quote:operation:quote_shipping; to test a missing value, keep the column and leave the cell empty
```

To fix it, add the column. To send no value for the field, leave its cell empty.

### `ambiguous-tag`

A scenario has the tags of more than one operation or entity. A tag on the feature applies to each scenario in it:

```
gate 3  gherkin       FAIL  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features/quote_shipping.feature:54:3  error  ambiguous-tag  scenario is tagged with more than one operation or entity: urn:demo:shipping:quote:operation:quote_shipping, urn:demo:shipping:parcel:entity:parcel
```

To fix it, remove one of the tags. Put the scenarios of a different operation in their own feature file.

### `undeclared-error`

A scenario expects an error that its operation does not declare:

```
gate 3  gherkin       FAIL  1 feature(s), 6 scenario(s), 1/1 operations tagged, 0/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features/quote_shipping.feature:30:5  error  undeclared-error  "urn:demo:shipping:quote:error:too_heavy" is not a declared error of urn:demo:shipping:quote:operation:quote_shipping (errors: urn:demo:shipping:quote:error:too_heavy_for_express)
    tutorial/3-strict-coverage/features  error  uncovered-error  error urn:demo:shipping:quote:error:too_heavy_for_express of urn:demo:shipping:quote:operation:quote_shipping has no scenario that expects it; add one with Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express"
```

Do one of these:

- If the URN in the step is incorrect, use a URN from the `errors` list in the message.
- If the operation must refuse with a new error, add the error to `errors` of the operation in the manifest. Refer to [Declare an error](declare-an-error).

### `features-unreadable`

The `features` folder does not exist, or `verify` cannot read it:

```
gate 3  gherkin       FAIL  0 feature(s), 0 scenario(s), 0/1 operations tagged, 0/1 errors expected, strict: 0/0 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/feature  error  features-unreadable  cannot read features: ENOENT: no such file or directory, scandir 'tutorial/3-strict-coverage/feature'
    tutorial/3-strict-coverage/feature  error  untagged-operation  operation urn:demo:shipping:quote:operation:quote_shipping has no feature or scenario tagged @urn:demo:shipping:quote:operation:quote_shipping
```

To fix it, correct the `features` path in the config or the `--features` flag.

### `feature-parse-error`

A feature file is not valid Gherkin. Gate 3 gives one problem for each parser error, at its line and column. The file then counts as no feature, so the problems of a file with no tags come after it:

```
gate 3  gherkin       FAIL  0 feature(s), 0 scenario(s), 0/1 operations tagged, 0/1 errors expected, strict: 0/0 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features/quote_shipping.feature:20:3  error  feature-parse-error  expected: #EOF, #TableRow, #TagLine, #ExamplesLine, #ScenarioLine, #RuleLine, #Comment, #Empty, got 'Scenari: A parcel without weight is rejected at the boundary'
    tutorial/3-strict-coverage/features/quote_shipping.feature:21:5  error  feature-parse-error  expected: #EOF, #TableRow, #TagLine, #ExamplesLine, #ScenarioLine, #RuleLine, #Comment, #Empty, got 'When I run the operation with:'
    tutorial/3-strict-coverage/features/quote_shipping.feature:24:5  error  feature-parse-error  expected: #EOF, #TableRow, #TagLine, #ExamplesLine, #ScenarioLine, #RuleLine, #Comment, #Empty, got 'Then the input is rejected on "weight_grams"'
    tutorial/3-strict-coverage/features/quote_shipping.feature:22:7  error  feature-parse-error  inconsistent cell count within the table
    tutorial/3-strict-coverage/features  error  untagged-operation  operation urn:demo:shipping:quote:operation:quote_shipping has no feature or scenario tagged @urn:demo:shipping:quote:operation:quote_shipping
```

One error can cause more errors on the lines after it. Correct the first one, then run `verify` again. In this example, line 20 has `Scenari:` in place of `Scenario:`.

### Coverage: `uncovered-boundary` and `uncovered-error`

A coverage gap is an error when the feature has the tag `@urn-forge:strict`, or when the config sets `boundaryCoverage: 'error'`. Otherwise it is a warning, and the gate passes.

An input field has no example at one of its boundaries:

```
gate 3  gherkin       FAIL  1 feature(s), 5 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at max + 1 (30001)
```

A declared error has no scenario that expects it. Here it is a warning:

```
gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, 0/1 errors expected, strict: 0/1 features
    tutorial/2-declared-errors/features  warning  uncovered-error  error urn:demo:shipping:quote:error:too_heavy_for_express of urn:demo:shipping:quote:operation:quote_shipping has no scenario that expects it; add one with Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express"
```

To fix a gap, add a scenario that sends each value that the message names, or that expects the error. Refer to [Adopt strict coverage](adopt-strict-coverage). If a scenario cannot test a boundary, [waive the boundary](waive-a-boundary).

### Waivers: `invalid-waiver`, `unknown-waiver` and `unused-waiver`

A `# urn-forge:waive` comment has an incorrect form, names an incorrect field, or waives nothing. [Waive a boundary](waive-a-boundary) shows each problem and its fix. The `waived-boundary` and `ratchet-ready` notes are not problems.

## Gate 4: drift

Gate 4 compiles the manifest again in a temporary folder. It then compares each file with the file in the output folder, byte for byte.

### `generated-differs`

Somebody edited a generated file:

```
gate 4  drift         FAIL  2 generated file(s) compared byte for byte against tutorial/3-strict-coverage/generated
    tutorial/3-strict-coverage/generated/domain.schemas.generated.ts:21:1  error  generated-differs  differs from a fresh compile (hand-edited or stale); run `urn-forge compile`
```

The line number is the first line that is different. To fix it, run `compile`:

```bash
npx urn-forge compile --config tutorial/3-strict-coverage/urn-forge.config.ts
```

```
unchanged  tutorial/3-strict-coverage/generated/domain.runtime.generated.ts
wrote      tutorial/3-strict-coverage/generated/domain.schemas.generated.ts
fingerprint sha256:b48297b4537c103460a0d8c21ae9ae155f0bd5b185c94813eb2a78c92b66c4bf
```

::: warning
Do not edit a generated file to change its behavior. `compile` replaces your change, and gate 4 fails until it does. Change the manifest, then compile.
:::

The manifest changed, but nobody ran `compile`. Line 2 is the fingerprint line:

```
gate 3  gherkin       FAIL  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at max 50000, no value at max + 1 (50001)
gate 4  drift         FAIL  2 generated file(s) compared byte for byte against tutorial/3-strict-coverage/generated
    tutorial/3-strict-coverage/generated/domain.runtime.generated.ts:2:1  error  generated-differs  differs from a fresh compile (hand-edited or stale); run `urn-forge compile`
    tutorial/3-strict-coverage/generated/domain.schemas.generated.ts:2:1  error  generated-differs  differs from a fresh compile (hand-edited or stale); run `urn-forge compile`
```

To fix it, run `compile` and commit the generated files with the manifest. Gate 3 reads the manifest, not the generated files, so it shows the new `max` at once. Refer to [Regenerate the code after a manifest change](regenerate-code).

### `generated-missing`

A generated file is not in the output folder:

```
gate 1  completeness  FAIL  tsc: 1 error(s) over tutorial/3-strict-coverage/core.ts; `core` satisfies DomainCoreImplementation
    tutorial/3-strict-coverage/generated/domain.runtime.generated.ts:5:20  error  type-error  TS2307: Cannot find module './domain.schemas.generated.js' or its corresponding type declarations.
gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
gate 4  drift         FAIL  2 generated file(s) compared byte for byte against tutorial/3-strict-coverage/generated
    tutorial/3-strict-coverage/generated/domain.schemas.generated.ts  error  generated-missing  missing; run `urn-forge compile`
verify failed: gate 1, 4
```

To fix it, run `compile`. The gate 1 error goes away with it. If the file is in `.gitignore`, remove it from there and commit the file.

### `generated-orphan`

The output folder has a `*.generated.*` file that the compile does not make:

```
gate 4  drift         FAIL  2 generated file(s) compared byte for byte against tutorial/3-strict-coverage/generated
    tutorial/3-strict-coverage/generated/old.schemas.generated.ts  error  generated-orphan  generated file has no source in the current compile; run `urn-forge compile`, which removes it
```

To fix it, run `compile`. It removes each generated file that it no longer makes:

```
unchanged  tutorial/3-strict-coverage/generated/domain.runtime.generated.ts
unchanged  tutorial/3-strict-coverage/generated/domain.schemas.generated.ts
removed    tutorial/3-strict-coverage/generated/old.schemas.generated.ts
```

If urn-forge did not write the file, the message tells you to rename or delete it. `compile` does not remove a file without the urn-forge header.

## Result

`verify` shows `PASS` for each gate, and the last line starts with `verify passed`:

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/3-strict-coverage/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/3-strict-coverage/generated
verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
```

## Related pages

- [Verification gates](../reference/verification-gates)
- [Diagnostics](../reference/diagnostics)
- [What the gates show](../explanation/what-the-gates-show)
- [Run verify in CI](run-verify-in-ci)
