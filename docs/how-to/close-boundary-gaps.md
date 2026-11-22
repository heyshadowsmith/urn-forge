# Close boundary gaps

Gate 3 finds coverage gaps: an input boundary that no scenario sends, and a declared error, an event or an invariant that no scenario expects. By default, a gap is a warning. This guide closes the gaps, makes them errors one feature at a time and then for the project, and waives a boundary that no scenario can test.

The output comes from the domains of [tutorial 2](../tutorials/declared-errors), which has gaps, and [tutorial 3](../tutorials/strict-coverage), which has none. The commands ran from `packages/urn-forge`. In your project, run them from the folder of `urn-forge.config.ts`, and leave out `--config`.

## Before you start

- `urn-forge verify` passes, possibly with warnings.
- You know how to write scenarios and Scenario Outlines. Refer to [Write scenarios](write-scenarios).

## 1. Read the gaps

Run `verify`:

```bash
npx urn-forge verify --config tutorial/2-declared-errors/urn-forge.config.ts
```

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/2-declared-errors/src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
    tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/2-declared-errors/src/generated
verify passed with 2 warning(s) (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

- `strict: 0/1 features` shows that no feature is strict yet.
- An `uncovered-boundary` message names a field and an operation, and lists each value that no scenario sends. A field inside an embedded entity or a list has a path after `at`, for example `at coverages.limit`.
- An `uncovered-error`, `uncovered-event` or `uncovered-invariant` message names the declared error, the event or the invariant that no scenario expects.

[Primitives and constraints](../reference/primitives) lists the boundary cases of each constraint.

## 2. Close the gaps of one feature

Do these steps for one feature at a time. Start with a feature whose operation has few gaps.

1. For each value in an `uncovered-boundary` message, add a row to an `Examples` table, or add a scenario.
   - A value inside the limits must succeed. Use `Then the output is:`.
   - A value outside the limits must fail at the boundary. Use `Then the input is rejected on "<field>"`.
   - To send the empty string, write `""` in the cell. An empty cell sends no value.
   - For a long value, write a formula, for example `=repeat(201, "x")`. Refer to [Gherkin steps](../reference/gherkin-steps).
2. For each `uncovered-error` message, add a scenario with `Then the operation fails with "<error URN>"`.
3. For each `uncovered-event` message, add `Then the operation emits "<event URN>"` to a scenario that succeeds.
4. For each `uncovered-invariant` message, add a scenario with `Then the input is rejected by "<invariant URN>"`.
5. Run Cucumber, and make sure that the new scenarios pass. Gate 3 shows only that the values are present.

Tutorial 3 closes the gaps of tutorial 2 with the three scenarios at the end of its feature file (highlighted):

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/features/quote_shipping.feature{1,34-57 gherkin}

## 3. Make the feature strict

1. Add the tag `@urn-forge:strict` above the `Feature:` line, as line 1 of the file above shows. A tag on a scenario or a rule has no effect.
2. Run `verify`. The gaps of each operation that the feature tags are errors. If you tag a feature before you close its gaps, gate 3 fails:

   ```
   gate 3  gherkin       FAIL  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features
       tutorial/2-declared-errors/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
       tutorial/2-declared-errors/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
   ```

3. Do the steps for the next feature. `strict: N/M features` shows the progress.

An operation is strict when one or more of the features that tag it is strict. Coverage counts the scenarios of all features that tag the operation.

## 4. Make the project strict

1. When every feature is strict, run `verify`. Gate 3 shows the note `ratchet-ready`:

   ```
   gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features
       tutorial/3-strict-coverage/features  note  ratchet-ready  every feature is @urn-forge:strict; set boundaryCoverage: 'error' in the config so new features are strict too
   ```

2. Set `boundaryCoverage` to `'error'` in the config (highlighted):

   <<< @/../packages/urn-forge/tutorial/3-strict-coverage/urn-forge.config.ts{7}

3. Run `verify`. Each gap is then an error, also in a new feature with no strict tag.

## 5. Waive a boundary that no scenario can test

A waiver hides a gap. A scenario closes it. Write a scenario if the schema can refuse the value, if the value is the empty string, or if the value is valid but rare. Use a waiver only if no scenario can send the value, or if a different test examines it.

1. Open the feature file that tags the operation.
2. Add a comment line in this form. Use the full URN of the field, not the short key. The reason is free text:

   ```gherkin
   # urn-forge:waive <field URN> <reason>
   ```

   For example:

   ```gherkin
   @urn-forge:strict
   @urn:demo:shipping:quote:operation:quote_shipping
   Feature: Shipping quotes

     # urn-forge:waive urn:demo:shipping:parcel:field:weight_grams The carrier API refuses parcels over 30000 grams before the call
   ```

3. Run `verify`. Gate 3 counts the waiver and shows it as a note, with its reason:

   ```
   gate 3  gherkin       PASS  1 feature(s), 5 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error), 1 waiver(s)
       tutorial/3-strict-coverage/features/quote_shipping.feature:5:1  note  waived-boundary  boundary coverage of urn:demo:shipping:parcel:field:weight_grams is waived: The carrier API refuses parcels over 30000 grams before the call
   ```

The waiver applies to the field in each operation that the file tags, also in strict features.

::: warning
A waiver removes every gap of the field. If you add a constraint to the field later, the waiver also hides the new gaps. Examine each waiver when you change the field.
:::

If gate 3 refuses a waiver, read the code:

| Code | Cause | Fix |
| --- | --- | --- |
| `invalid-waiver` | The comment has no reason, or no full URN | Add the reason after the URN. The URN starts with `urn:` |
| `unknown-waiver` | The field is not a constrained input field of the operations that the file tags | Correct the URN, move the waiver to the correct feature file, or remove it |
| `unused-waiver` (warning) | The field has no gap, so the waiver waives nothing | Remove the waiver |

## Result

`verify` passes with no warnings, and the gate 3 summary shows `strict: N/N features (boundaryCoverage: error)`. Each waiver shows as a note with its reason.

## Related pages

- [Tutorial: make the domain strict](../tutorials/strict-coverage)
- [Verification gates](../reference/verification-gates)
- [How urn-forge proves it](../explanation/how-urn-forge-proves-it)
