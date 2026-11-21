# Adopt strict coverage

Gate 3 finds coverage gaps: an input boundary that no scenario sends, a declared error that no scenario expects, and an invariant that no scenario breaks. By default, a gap is a warning. This guide makes every gap an error, one feature at a time, and then for the full project. This is the warn-then-ratchet path.

The output on this page comes from the domain of [tutorial 2](../tutorials/declared-errors), which has gaps, and [tutorial 3](../tutorials/strict-coverage), which has none.

The commands on this page ran in a clone of the urn-forge repository, from `packages/urn-forge`. In your project, run them from the folder of `urn-forge.config.ts`, and leave out `--config`.

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
   gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/2-declared-errors/src/core.ts; `core` satisfies DomainCoreImplementation
   gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
   gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
       tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
       tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
   gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/2-declared-errors/src/generated
   verify passed with 2 warning(s) (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
   ```

2. Read the gate 3 summary. `strict: 0/1 features` shows that no feature is strict yet.
3. Read each warning. There is one `uncovered-boundary` warning for each field and operation. The message lists each value that is not there. An `uncovered-error` warning names an error that no scenario expects. An `uncovered-event` warning names an event that no scenario expects. An `uncovered-invariant` warning names an invariant of the input entity that no scenario breaks.

   For example, take a copy of the insurance domain without `boundaryCoverage: 'error'`. Remove the strict tag of `issue_policy.feature` and the scenario that breaks `term_is_positive`. Gate 3 then shows this:

   ```
   gate 3  gherkin       PASS  2 feature(s), 14 scenario(s), 2/2 operations tagged, 1/1 errors expected, 2/2 events expected, 1/1 records expected, 4/5 invariants broken, strict: 1/2 features
       insurance/features  warning  uncovered-invariant  invariant urn:acme:insurance:policy:invariant:term_is_positive on the input of urn:acme:insurance:policy:operation:issue_policy has no scenario that breaks it; add one with Then the input is rejected by "urn:acme:insurance:policy:invariant:term_is_positive"
   ```

   `4/5 invariants broken` shows that a scenario breaks four invariants of five. The count includes `limit_is_positive`, an invariant of the coverage that the policy embeds.

4. Read the path after `at`, if a message has one. A value inside an embedded entity has the boundary cases of its field, at any depth. A list of entities also needs its item counts, and a list with a repeated key if it is `unique`. Remove the rows of the list that is too long and of the repeated peril from the strict insurance feature. Gate 3 then shows this:

   ```
   insurance/features  error  uncovered-boundary  urn:acme:insurance:policy:entity:coverage at coverages in the input of urn:acme:insurance:policy:operation:issue_policy has no list of 4 item(s) (above maxItems), no list with a repeated peril (unique)
   ```

   A message for a nested field names the field and its path, for example `urn:acme:insurance:policy:field:limit at coverages.limit`.

[Primitives and constraints](../reference/primitives) lists the boundary cases of each constraint.

## Close the gaps of one feature

Do these steps for one feature at a time. Start with a feature whose operation has few gaps.

1. For each value in an `uncovered-boundary` message, add a row to an `Examples` table, or add a scenario.
   - A value inside the limits must succeed. Use `Then the output is:`.
   - A value outside the limits must fail at the boundary. Use `Then the input is rejected on "<field>"`.
   - To send the empty string to a `string` field, write `""` in the cell. An empty cell sends no value.
   - For a path such as `coverages.limit`, send the value inside an object, for example `[{ peril: fire, limit: 1.005 }]`. For a repeated key, send two objects with one key, for example `[{ peril: fire, limit: 1 }, { peril: fire, limit: 2 }]`. Refer to [Write scenarios](write-scenarios).
   - For a long value, such as a text of 201 characters or a list of 21 items, write a formula: `=repeat(201, "x")`, `=repeat(21, { … })`. Refer to [Formula cells](../reference/gherkin-steps#formula-cells).
2. For each `uncovered-error` message, add a scenario with `Then the operation fails with "<error URN>"`.
3. For each `uncovered-event` message, add `Then the operation emits "<event URN>"` to a scenario that succeeds. Refer to [Emit an event](emit-an-event).
4. For each `uncovered-invariant` message, add a scenario that breaks the rule, with `Then the input is rejected by "<invariant URN>"`. Refer to [Add an invariant](add-an-invariant).
5. Run Cucumber, and make sure that the new scenarios pass. Gate 3 shows only that the values are present. The test run shows that they give the correct result.
6. If a scenario cannot test a boundary, [waive the boundary](waive-a-boundary) and give the reason.

Tutorial 3 closes the four gaps of tutorial 2 with the three scenarios at the end of its feature file (highlighted). Line 1 is the strict tag of the next section:

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/features/quote_shipping.feature{1,34-57 gherkin}

## Make the feature strict

1. Add the tag `@urn-forge:strict` to the feature itself, above the `Feature:` line, as line 1 of the file above shows. A tag on a scenario or a rule has no effect on strictness.

2. Run `verify`. The gaps of each operation that the feature tags are now errors.

   If you tag a feature before you close its gaps, gate 3 fails:

   ```
   gate 3  gherkin       FAIL  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features
       tutorial/2-declared-errors/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
       tutorial/2-declared-errors/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
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

   The note shows only when gate 3 passes. While a strict feature has a gap, gate 3 fails and the note does not show.

2. Set `boundaryCoverage` to `'error'` in the config:

   <<< @/../packages/urn-forge/tutorial/3-strict-coverage/urn-forge.config.ts{9}

3. Run `verify`.

## Result

The summary shows `(boundaryCoverage: error)`, and `verify` passes with no warnings:

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/3-strict-coverage/src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/3-strict-coverage/src/generated
verify passed (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

From now on, each gap is an error, also in a new feature that has no strict tag. You can keep the `@urn-forge:strict` tags or remove them. They have no more effect.

## Related pages

- [Tutorial: make the domain strict](../tutorials/strict-coverage)
- [Waive a boundary](waive-a-boundary)
- [The configuration file](../reference/configuration)
- [Verification gates](../reference/verification-gates)
- [Boundary coverage and the ratchet](../explanation/boundary-coverage)
