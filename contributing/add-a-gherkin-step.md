# Add a Gherkin step

This guide is for contributors who change urn-forge itself. urn-forge gives one set of Gherkin steps for each domain. The steps read the generated `Definitions` and `Operations`, so they work for any manifest. Gate 3 reads the same step texts to find what the scenarios cover.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You know the steps of [Gherkin steps](../docs/how-to/write-scenarios.md).

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Make sure that the step is necessary

A step is a construct of urn-forge, as a rule is. It must pass the three tests of decision 10 of the [contract completeness roadmap](../planning/contract-completeness-roadmap.md). The step must name only general things: an operation, a definition, an output, a rule, an input or a value. A step for one domain belongs in the support code of that domain, not in urn-forge.

The steps at this time are:

| Step | Does |
| --- | --- |
| `When I run "<operation>" with:` | Runs the operation through the harness, with the table as its input |
| `When I check a "<definition>" with:` | Checks the table as a value of the definition |
| `Then the output is "<output>"` | The core answered that output |
| `Then the output is "<output>":` | The same, and the answer has the values of the table |
| `Then the input is rejected by "<rule>" of "<definition>"` | The harness refused the input with that failure |
| `Then the value is rejected by "<rule>" of "<definition>"` | The check refused the value with that failure |
| `Then the value is accepted` | The check accepted the value |

Make sure that a new step does not state what these steps state already.

## Add the step

The steps are in `src/gherkin/steps.ts`.

1. Add the text of the step to `STEPS`, as a regular expression with `^` and `$`. Put each name in double quotes, as the other steps do.
2. Register the step in `registerSteps`, with `When` or `Then`.
   - A step reads the last result through `need('run')` or `need('check')`. Thus a `Then` step that comes before its `When` step gives a clear error.
   - A step that reads a table uses `tableValue` from `src/gherkin/cells.ts`. The cells are read by the type of each definition.
   - A step that can have a table or no table is two steps: one with a colon at the end, and one without. Cucumber gives its callback as the last parameter of a step that has no table, so one step cannot take both.
   - An error message tells what happened and what was expected, with the failures of the result.
3. Add the step to the list in the comment at the top of the file.

## Teach gate 3 the step

Gate 3 (`src/verify/gherkin.ts`) reads each step of each scenario and matches it against `STEPS`.

1. If the step names a part of the manifest, add a branch that checks the name. A name that does not exist is `unknown-name`, at the line of the step.
2. If the step covers a part, add it to the sets of the gate: `ran` for an operation, `answered` for an output, `broken` for a rule of a definition.
3. If the step makes a new kind of coverage necessary, add its gap code, as `uncovered-output` is. A new code is a new diagnostic. Refer to [Add a diagnostic](./add-a-diagnostic.md).

## Test the step

1. Use the step in a scenario of the booking fixture, `tests/fixtures/booking/features/seat.feature`. `tests/features.test.ts` runs Cucumber on it.
2. In `tests/gherkin-gate.test.ts`, add a test that the gate counts the step, and a test of each `unknown-name` that it gives.
3. Run the fixture through `verify`:

   ```bash
   node bin/urn-forge.js verify --config tests/fixtures/booking/urn-forge.config.ts
   ```

   This is the line of gate 3 for the fixture at this time:

   ```
   gate 3  gherkin       PASS  1 feature(s), 29 scenario(s), 1/1 operation(s) run, 23 rule(s) broken
   ```

4. Run `npm test`, `npm run typecheck` and `npm run test:tarball` from the root folder. The tarball test runs the steps from the packed package, through `urn-forge/cucumber`.

## Update the docs

1. Add the step to [Gherkin steps](../docs/how-to/write-scenarios.md), with an example from a real feature.
2. If the step changes how a user writes scenarios, update [Write scenarios](../docs/how-to/write-scenarios.md).
3. Run `npm run docs:build` from the root folder.

## Result

A feature of any domain can use the step. Cucumber runs it, and gate 3 counts what it covers.

## Related pages

- [How urn-forge is built](./architecture.md)
- [Add a diagnostic](./add-a-diagnostic.md)
- [Gherkin steps](../docs/how-to/write-scenarios.md)
- [Write scenarios](../docs/how-to/write-scenarios.md)
