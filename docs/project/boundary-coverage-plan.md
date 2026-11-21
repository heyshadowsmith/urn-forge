# urn-forge boundary coverage plan

Nov 21, 2026 · @Shadow Smith

Boundary coverage is the main part of Milestone 3 (spec §8, gate 3 check 3). Today gate 3 shows that every operation has a scenario and that its tables use real field names. It does not show that the scenarios test the edges: a `min: 0` field with only the value `5` in its examples passes. This plan adds the check that the boundary cases are *present* in the examples. Whether they *pass* stays the job of the test run.

## What changes for a user

**Before**: `verify` passes whatever values the scenarios use.

**After**: for each constrained input field of each operation, gate 3 reads the values the scenarios send and reports each missing boundary case:

```
gate 3  gherkin  PASS  3 feature(s), 11 scenario(s), 3/3 operations tagged, 3/3 errors expected, strict: 0/3 features
    self/features  warning  uncovered-boundary  urn:urn_forge:toolchain:naming:field:namespace in the input of …:to_urn has no invalid value for regex [a-z][a-z0-9_]{0,62}
verify passed with 6 warning(s) (gates 1, 3, 4; …)
```

Gaps are warnings by default. A feature tagged `@urn-forge:strict` makes the gaps of its operations errors, and `boundaryCoverage: 'error'` in the config makes every gap an error: the warn-then-ratchet adoption of spec §8.

## The rules

For each operation, gate 3 collects the values of each input field from the tables of `When I run the operation with:` in every scenario tagged with the operation. A `<placeholder>` in a Scenario Outline takes each value of its `Examples` column. A cell becomes a value with the field's primitive, as the steps convert it. Each constraint then requires these values:

| Constraint | Required values | Source |
| --- | --- | --- |
| `min` on `integer` | `min − 1` and `min` | Spec §8 |
| `max` on `integer` | `max` and `max + 1` | Spec §8 |
| `min` on `float` | `min`, and a value below it | Spec §8 names only `integer` and `decimal`; this is the `float` form |
| `max` on `float` | `max`, and a value above it | As above |
| `notEqual` | The excluded value | Not in spec §8; see decision 3 |
| `minLength` | A string of length `minLength` and, when `minLength > 0`, one of length `minLength − 1` | Spec §8 |
| `maxLength` | A string of length `maxLength` and one of length `maxLength + 1` | Spec §8 |
| `oneOf` | Every listed value, and one value outside the list | Spec §8 |
| `regex` | One value that matches and one that does not | Spec §8 |
| `mustBe` on `boolean` | The required value and the other one | Not in spec §8; it follows `oneOf` |

An empty cell means "absent", so it never counts as a value. `decimal` and `format` arrive with their primitives.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Which values count? | **The input table of `When I run the operation with:`**, with Outline placeholders resolved from `Examples`. Output tables do not count | Boundaries are about what the operation accepts. Output values are results, not cases |
| 2 | Where do the rules live? | **In each primitive's descriptor**, as `boundaries(constraints)`. The foundations plan left this slot for this check | The same place that owns the constraint owns its edges, and a new primitive brings its own rules |
| 3 | Do `notEqual` and `mustBe` need cases? | **Yes**: the excluded value, and both booleans | Spec §8 is silent. The excluded value is the one case the constraint exists for (the math example's `divisor: 0`) |
| 4 | How does a table say "the empty string"? | **A cell of `""`** sends an empty string to a `string` field. An empty cell still means absent | Without this, `minLength: 1` can never be covered: its outside case is the empty string. Today no cell can send one |
| 5 | How many diagnostics? | **One `uncovered-boundary` per field and operation**, listing every missing case | One per case would bury the output. A field is the unit someone fixes |
| 6 | Where does the setting live? | **`boundaryCoverage: 'warn' \| 'error'` at the top of `urn-forge.config.ts`**, default `warn` | Spec §7.5 puts it on a `gherkin` plugin that does not exist here. Gate 3 is not a plugin |
| 7 | What does `@urn-forge:strict` cover? | **The operations its feature is tagged with**: their gaps are errors. An operation is strict if any feature tagged with it is strict | Coverage is counted per operation across every feature. The tag must reach the gaps it is meant to fail |
| 8 | Does `uncovered-error` follow the same mode? | **Yes.** It is the error-coverage part of the same check | Spec §8 lists error coverage under check 3. Today it is always a warning |
| 9 | How is a boundary waived? | **A comment, not a tag**: `# urn-forge:waive <field URN> <reason…>` anywhere in the feature file. It waives that field's gaps for the operations the feature is tagged with | Spec §8's tag `@urn-forge:waive(<field URN>, <reason>)` is not valid Gherkin: a tag cannot contain whitespace, so any real reason makes the parser reject the file. Comments keep free text and their line |
| 10 | How do waivers stay visible? | **A third severity, `note`**: each waiver is a note in `verify` output, with its reason. Notes never fail a gate and are not counted as warnings | Spec §8 wants waivers in the output. As warnings they would never let the count reach zero; as nothing they would hide |
| 11 | How is progress shown? | Gate 3's summary gains `strict: N/M features`. When every feature is strict and the mode is still `warn`, `verify` adds a note that it is time to ratchet | Spec §8: print the strict and non-strict counts. The ratchet trigger is "as soon as every feature is strict" |

## The target, written first

As with the error kind, the expected result comes before the code. Applying the rules by hand to the repository today gives exactly these gaps:

| Domain | Operation | Field | Constraint | Missing |
| --- | --- | --- | --- | --- |
| math | — | — | — | Nothing. `radius` has `0` and `-1`; `divisor` has `0` |
| `self/` | `to_brand_identifier` | `identifier` | `regex` | An invalid value |
| `self/` | `to_urn` | `namespace` | `regex` | An invalid value |
| `self/` | `to_urn` | `domain` | `regex` | An invalid value |
| `self/` | `to_urn` | `context` | `regex` | An invalid value (it has one under `to_brand_identifier`, but coverage is per operation) |
| `self/` | `to_urn` | `identifier` | `regex` | An invalid value |
| `self/` | `parse_short_key` | `short_key` | `minLength: 1` | A value of length 1, and the empty string (needs decision 4) |

The check is right when it reports exactly these six gaps and nothing for the math example. Then `self/` closes them with real scenarios, and both domains become strict.

## Build order

Each step leaves the repository green and ends with a check you can run.

- [x] **1. Boundaries in the descriptors.**
  - Each primitive gains `boundaries(constraints)`: a list of required cases, each with a label (`at min 0`, `an invalid value for regex …`) and a test for a value.
  - The steps read a `""` cell as the empty string for `string` fields.
  - *Check:* unit tests per primitive and constraint; a step test sends `""`.
  - *Done.* `boundaries` is a required member of the descriptor type, so `tsc` named all four primitives until each had its rules. The rules follow *The rules* above. `-0` covers a bound of `0`, as the schema treats them alike, and a string that is not a number never covers a numeric case. `""` is parsed in the `string` descriptor, so the steps and gate 3 (which converts cells the same way) agree. Boundaries are not a fingerprint input, because they do not change generated code; the generated files are byte-identical.
- [x] **2. Values per operation.**
  - The feature index, or a function over it, gives each operation's input values per field, with Outline placeholders resolved and cells converted.
  - *Check:* the values match the table above for `self/` and the math example.
  - *Done* as `inputValues(ir, features)` in `src/verify/input-values.ts`. Placeholders are substituted anywhere in a cell, as Cucumber does, once per `Examples` row, and an `Examples` block's own tags can choose the operation. On the real features it returns exactly the values the target was computed from (`tests/input-values.test.ts`); writing that test also corrected a hand count, without changing which values exist, so the six gaps stand.
- [x] **3. The check.**
  - Gate 3 reports `uncovered-boundary` as a warning, one per field and operation.
  - *Check:* exactly the six gaps of the target table, and none for the math example; `verify:self` passes with 6 warnings.
  - *Done*, met on the first run: `verify:self` prints the six gaps and `verify passed with 6 warning(s)`; `verify:example` prints none. `tests/gates.test.ts` pins both lists. An operation without scenarios is skipped, because `untagged-operation` already fails it.
- [x] **4. Strictness.**
  - `boundaryCoverage` in the config; `@urn-forge:strict`; `uncovered-error` follows the same mode.
  - The summary shows `strict: N/M features`, and a note appears when it is time to ratchet.
  - *Check:* a strict feature turns its operations' gaps into errors; `boundaryCoverage: 'error'` turns all of them.
  - *Done.* The `note` severity arrived here rather than in step 5, because the ratchet note needs it: notes never fail a gate and are not counted as warnings. `@urn-forge:strict` counts on the feature itself (its own tags), and makes strict every operation the feature tags anywhere in it. On `self/`, tagging `to_urn.feature` strict turned exactly `to_urn`'s four gaps into errors and failed gate 3, while the other two stayed warnings.
- [x] **5. Waivers.**
  - `# urn-forge:waive <field URN> <reason…>`, and the `note` severity in text and JSON output.
  - A waiver that names no constrained input field of the feature's operations is an error, so a stale waiver cannot linger.
  - *Check:* a waiver removes its field's gaps and appears as a note with its reason.
  - *Done.* The feature index keeps comments with their lines. Four outcomes, all tried on `self/` through the CLI: an applied waiver is a `waived-boundary` note with its reason; a waiver without a reason is `invalid-waiver`; one for a field the feature's operations do not constrain is `unknown-waiver` (errors); and one whose field has no gap is `unused-waiver`, a warning, so it is removed rather than left to hide a future gap. The summary counts waivers. A waiver waives the whole field, not single cases.
- [ ] **6. Close the gaps, then ratchet.**
  - `self/` gains scenarios for the six gaps. They should all pass already, since the handlers and schemas exist; a failure is a real bug.
  - Every feature in both domains gets `@urn-forge:strict`, then both configs set `boundaryCoverage: 'error'`.
  - The docs gain the rules, the `""` cell, strictness and waivers.

## Done

Boundary coverage is done when CI is green, both domains run with `boundaryCoverage: 'error'`, and CI turns red on each of these sabotages:

| Sabotage | What catches it |
| --- | --- |
| Remove the `-1` example from `compute_area` | Gate 3, `uncovered-boundary` on `radius` (`below min 0`) |
| Remove the `event`, `widget` and `Field` examples from `to_urn` | Gate 3, `uncovered-boundary` on `kind` (`a value outside oneOf`) |
| Remove an error scenario of `parse_short_key` | Gate 3, `uncovered-error`, now an error |
| A waiver for a field the feature does not use | Gate 3, an unknown waiver |

## Risks

- **Coverage that is satisfied but meaningless.** A value of `-1` in a scenario that expects success still counts as covered; the test run, not gate 3, says it fails. That is spec §8's stated limit: gate 3 shows the cases are present.
- **Floats.** "A value below `min`" is any smaller value, not one step below, because floats have no step. `decimal` gets the spec's "one step outside at the declared scale" when it exists.
- **Shared fields.** A field used by two operations needs its cases in each. That is more scenarios, but it is what per-operation coverage means; the table above already shows one case (`context`).
