# Adopt strict coverage

Gate 3 finds coverage gaps: an input boundary that no scenario sends, and a declared error that no scenario expects. By default, a gap is a warning. This guide makes every gap an error, one feature at a time, and then for the full project. This is the warn-then-ratchet path.

The output on this page comes from the domain of [tutorial 2](../tutorials/declared-errors), which has gaps, and [tutorial 3](../tutorials/strict-coverage), which has none.

## Before you start

- `urn-forge verify` passes on your project, possibly with warnings.
- The config does not set `boundaryCoverage`, or sets it to `'warn'`.
- You know how to write scenarios and Scenario Outlines. Refer to [Write scenarios](write-scenarios).

## Read the warnings

1. Run `verify`:

   ```bash
   npx urn-forge verify --config tutorial/2-declared-errors/urn-forge.config.ts
   ```

   ```
   gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/2-declared-errors/core.ts; `core` satisfies DomainCoreImplementation
   gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
       tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
       tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside oneOf
   gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/2-declared-errors/generated
   verify passed with 2 warning(s) (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
   ```

2. Read the gate 3 summary. `strict: 0/1 features` shows that no feature is strict yet.
3. Read each warning. There is one `uncovered-boundary` warning for each field and operation. The message lists each value that is not there. An `uncovered-error` warning names an error that no scenario expects.

[Primitives and constraints](../reference/primitives) lists the boundary cases of each constraint.

## Close the gaps of one feature

Do these steps for one feature at a time. Start with a feature whose operation has few gaps.

1. For each value in an `uncovered-boundary` message, add a row to an `Examples` table, or add a scenario.
   - A value inside the limits must succeed. Use `Then the output is:`.
   - A value outside the limits must fail at the boundary. Use `Then the input is rejected on "<field>"`.
   - To send the empty string to a `string` field, write `""` in the cell. An empty cell sends no value.
2. For each `uncovered-error` message, add a scenario with `Then the operation fails with "<error URN>"`.
3. Run Cucumber, and make sure that the new scenarios pass. Gate 3 shows only that the values are present. The test run shows that they give the correct result.
4. If a scenario cannot test a boundary, [waive the boundary](waive-a-boundary) and give the reason.

Tutorial 3 closes the four gaps of tutorial 2 with the three scenarios at the end of its feature file (highlighted). Line 1 is the strict tag of the next section:

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/features/quote_shipping.feature{1,34-57 gherkin}

## Make the feature strict

1. Add the tag `@urn-forge:strict` to the feature itself, above the `Feature:` line, as line 1 of the file above shows. A tag on a scenario or a rule has no effect on strictness.

2. Run `verify`. The gaps of each operation that the feature tags are now errors.

   If you tag a feature before you close its gaps, gate 3 fails:

   ```
   gate 3  gherkin       FAIL  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features
       tutorial/2-declared-errors/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
       tutorial/2-declared-errors/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside oneOf
       tutorial/2-declared-errors/features  note  ratchet-ready  every feature is @urn-forge:strict; set boundaryCoverage: 'error' in the config so new features are strict too
   ```

   Close the gaps, or remove the tag again.

3. Read the summary. `strict: N/M features` shows the progress: `N` features of `M` are strict.
4. Do the steps for the next feature.

An operation is strict when one or more of the features that it tags is strict. Coverage counts the scenarios of all features that tag the operation. Thus a strict tag on one feature can make gaps errors for an operation whose other scenarios are in a different file.

## Ratchet the project

1. When every feature is strict, run `verify`. Gate 3 shows the note `ratchet-ready`:

   ```
   gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features
       tutorial/3-strict-coverage/features  note  ratchet-ready  every feature is @urn-forge:strict; set boundaryCoverage: 'error' in the config so new features are strict too
   ```

   The note can show while strict features still have errors. Fix the errors first.

2. Set `boundaryCoverage` to `'error'` in the config:

   <<< @/../packages/urn-forge/tutorial/3-strict-coverage/urn-forge.config.ts{9}

3. Run `verify`.

## Result

The summary shows `(boundaryCoverage: error)`, and `verify` passes with no warnings:

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/3-strict-coverage/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/3-strict-coverage/generated
verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
```

From now on, each gap is an error, also in a new feature that has no strict tag. You can keep the `@urn-forge:strict` tags or remove them. They have no more effect.

## Related pages

- [Tutorial: make the domain strict](../tutorials/strict-coverage)
- [Waive a boundary](waive-a-boundary)
- [The configuration file](../reference/configuration)
- [Verification gates](../reference/verification-gates)
- [Boundary coverage and the ratchet](../explanation/boundary-coverage)
