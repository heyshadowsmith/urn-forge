# Fix a gate that fails

`urn-forge verify` runs gates 1, 3 and 4. A gate fails when it reports one error or more. This guide gives the symptom and the fix for each code that a gate can report. The output on this page comes from the domain of [tutorial 3](../tutorials/strict-coverage), with one part broken on purpose for each example. The examples for invariants, embedded entities and links come from the insurance domain in `packages/urn-forge/insurance/`.

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

### If a rule of an invariant is not correct

Pass 6 examines the `rule` of each invariant. A problem in a rule also stops `verify` before the gates:

```
insurance/domain.manifest.yaml:127:9  error  unguarded-field  urn:acme:insurance:policy:invariant:deductible_below_premium: rule: "deductible" is optional, so the rule must guard it: write "deductible is present and …" or "deductible is absent or …" (at column 1 of the rule)
verify failed: the manifest does not compile
```

The line and column give the start of the rule. The message gives the column in the rule. Each code has one fix:

| Code | Cause | Fix |
| --- | --- | --- |
| `rule-syntax` | The rule is not complete, or it has a word that the language does not know | Correct the rule at the column in the message |
| `unknown-rule-field` | The rule names a field that the `on` entity does not have | Use a name from the `fields` list in the message |
| `rule-type` | The two sides of a comparison have different primitives, or a literal is not a value of the other side | Compare values of one primitive |
| `unguarded-field` | The rule uses an optional field without a guard | Start with `x is present and …` or `x is absent or …` |
| `wrong-ref-kind` | `on` names an atom that is not an entity | Set `on` to an entity |

[Add an invariant](add-an-invariant) shows the real message of each code.

### If an entity reference is not correct

Passes 1, 3 and 5 examine the `fields` list and the `key` of each entity. A problem there also stops `verify` before the gates. Here the coverage embeds the policy, and the policy embeds the coverage:

```
insurance/domain.manifest.yaml:77:5  error  embedding-cycle  urn:acme:insurance:policy:entity:coverage: urn:acme:insurance:policy:entity:coverage embeds urn:acme:insurance:policy:entity:policy embeds urn:acme:insurance:policy:entity:coverage, so its type would never end; use a link for one of them
verify failed: the manifest does not compile
```

Each code has one fix:

| Code | Cause | Fix |
| --- | --- | --- |
| `invalid-value` with `must have either ref or link` | A field reference has both `ref` and `link`, or neither | Keep one of the two |
| `invalid-entity-key` | The `key` is not a field of the entity, or the field is optional or a list | Set `key` to a required, single-valued field of the entity |
| `missing-key` | A `link` names an entity without a `key`, a `unique` list embeds one, or the `tables` of the `postgres` plugin list one | Add `key` to the target entity |
| `embedding-cycle` | Entities embed each other in a cycle | Change one `ref` in the cycle to `link` |
| `duplicate-ref` | The `fields` list has one target two times with one name | Give one of them a different name with `as` |
| `duplicate-property` | Two different targets become one property name | Give one of them a different name with `as` |

These are the real messages of the other codes:

```
insurance/domain.manifest.yaml:91:7  error  invalid-value  policy.entity.policy.fields.1: must have either ref or link
insurance/domain.manifest.yaml:75:8  error  invalid-entity-key  urn:acme:insurance:policy:entity:coverage: key urn:acme:insurance:policy:field:note is optional; a key must be required
insurance/domain.manifest.yaml:90:13  error  missing-key  urn:acme:insurance:policy:entity:policy: fields[1].link urn:acme:insurance:customer:entity:customer has no key, so a link to it holds nothing; set key on it
insurance/domain.manifest.yaml:92:13  error  duplicate-ref  urn:acme:insurance:policy:entity:policy: fields[2].link lists urn:acme:insurance:customer:entity:customer more than once; give one of them another name with as
insurance/domain.manifest.yaml:84:1  error  missing-key  urn:acme:insurance:policy:entity:policy: is a table in the postgres config, so it needs a key: one of its own required, single-valued fields
```

Each line comes from a different change to the manifest. [Add an entity](add-an-entity) shows each change and its fix. For the last line, refer to [Store entities in Postgres](store-in-postgres).

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

### `undeclared-invariant`

A scenario expects an invariant that is not on the input entity of its operation:

```
gate 3  gherkin       FAIL  2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 3/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features/issue_policy.feature:79:5  error  undeclared-invariant  "urn:acme:insurance:policy:invariant:cancellation_within_term" is not an invariant of the input of urn:acme:insurance:policy:operation:issue_policy (invariants: urn:acme:insurance:policy:invariant:deductible_below_premium, urn:acme:insurance:policy:invariant:term_is_positive, urn:acme:insurance:policy:invariant:limit_is_positive)
    insurance/features  error  uncovered-invariant  invariant urn:acme:insurance:policy:invariant:term_is_positive on the input of urn:acme:insurance:policy:operation:issue_policy has no scenario that breaks it; add one with Then the input is rejected by "urn:acme:insurance:policy:invariant:term_is_positive"
```

Do one of these:

- If the URN in the step is incorrect, use a URN from the `invariants` list in the message. The `uncovered-invariant` problem goes away with it. The list also has the invariants of the entities that the input embeds, such as `limit_is_positive` of the coverage.
- If the rule must apply to the input, set `on` of the invariant to the input entity of the operation. Refer to [Add an invariant](add-an-invariant).

### `invalid-cell`

Gate 3 reads each list cell and each object cell of the input tables. If a cell is malformed, or it names a property that its entity does not have, gate 3 reports `invalid-cell`. Here a note holds a comma without quotes:

```
gate 3  gherkin       FAIL  2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 4/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features/issue_policy.feature:7:145  error  invalid-cell  coverages: expected ":" after "see" (at column 91 of the cell): [{ peril: flood, limit: 500 }, { peril: theft, limit: 250.5, note: Basement excluded, see {clause 4} }]
```

Here a brace is not closed:

```
    insurance/features/issue_policy.feature:7:145  error  invalid-cell  coverages: expected "," or "}" (at column 32 of the cell): [{ peril: fire, limit: 1000.00 ]
```

The line and column give the header of the column. The message gives the property, the column in the cell, and the cell. To fix it, do one of these:

- If a value holds a comma, a bracket, a brace or a double quote, put the value in double quotes.
- If a bracket or a brace is not closed, close it.
- If a name is not a property of the entity, use a name from the `properties` list in the message.

The scenario fails with the same message when Cucumber runs it. Refer to [Write scenarios](write-scenarios).

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

### Coverage: `uncovered-boundary`, `uncovered-error` and `uncovered-invariant`

A coverage gap is an error when the feature has the tag `@urn-forge:strict`, or when the config sets `boundaryCoverage: 'error'`. Otherwise it is a warning, and the gate passes.

An input field has no example at one of its boundaries:

```
gate 3  gherkin       FAIL  1 feature(s), 5 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
    tutorial/3-strict-coverage/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at max + 1 (30001)
```

A value inside an embedded entity has no example at a boundary. The message gives the path of the value after `at`. A list of entities also needs its item counts and a list with a repeated key:

```
gate 3  gherkin       FAIL  2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 4/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features  error  uncovered-boundary  urn:acme:insurance:policy:field:peril at coverages.peril in the input of urn:acme:insurance:policy:operation:issue_policy has no value outside values
    insurance/features  error  uncovered-boundary  urn:acme:insurance:policy:field:limit at coverages.limit in the input of urn:acme:insurance:policy:operation:issue_policy has no value with 3 digits after the point (above scale)
```

```
    insurance/features  error  uncovered-boundary  urn:acme:insurance:policy:entity:coverage at coverages in the input of urn:acme:insurance:policy:operation:issue_policy has no list of 4 item(s) (above maxItems), no list with a repeated peril (unique)
```

A declared error has no scenario that expects it. Here it is a warning:

```
gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, 0/1 errors expected, strict: 0/1 features
    tutorial/2-declared-errors/features  warning  uncovered-error  error urn:demo:shipping:quote:error:too_heavy_for_express of urn:demo:shipping:quote:operation:quote_shipping has no scenario that expects it; add one with Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express"
```

An invariant of the input entity has no scenario that breaks it. The insurance features are strict, so it is an error:

```
gate 3  gherkin       FAIL  2 feature(s), 12 scenario(s), 2/2 operations tagged, 1/1 errors expected, 3/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features  error  uncovered-invariant  invariant urn:acme:insurance:policy:invariant:term_is_positive on the input of urn:acme:insurance:policy:operation:issue_policy has no scenario that breaks it; add one with Then the input is rejected by "urn:acme:insurance:policy:invariant:term_is_positive"
```

To fix a gap, add a scenario for it:

- For a boundary, send each value that the message names. For a path such as `coverages.limit`, send the value inside an object of the list.
- For an error, expect it with `Then the operation fails with "<error URN>"`.
- For an invariant, break it and expect `Then the input is rejected by "<invariant URN>"`.

Refer to [Adopt strict coverage](adopt-strict-coverage). If a scenario cannot test a boundary, [waive the boundary](waive-a-boundary).

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
verify passed (gates 1, 3, 4; gate 2 is not built; gate 5 is urn-forge diff)
```

## Related pages

- [Verification gates](../reference/verification-gates)
- [Diagnostics](../reference/diagnostics)
- [What the gates show](../explanation/what-the-gates-show)
- [Run verify in CI](run-verify-in-ci)
