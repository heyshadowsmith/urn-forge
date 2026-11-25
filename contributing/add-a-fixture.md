# Add a test fixture

This guide is for contributors who change urn-forge itself. A fixture is a small project in `packages/urn-forge/tests/fixtures/`: a manifest, its committed generated files, a core and features. The tests compile it, run its generated code and run its scenarios. Thus a change to the output of urn-forge shows as a diff that a reviewer can read.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You know what the fixture must show.

Commands run from `packages/urn-forge`.

## Choose: the booking fixture, an inline manifest or a new fixture

The only fixture at this time is `booking`: a restaurant booking. It was the target of the redesign, and it uses each construct of the [redesign notes](../planning/manifest-redesign-notes.md):

- definitions of the six types, and a definition as the type of another;
- an identifier, and lists of values and of objects;
- rules with and without parameters, and standard rules;
- CEL over lists and times;
- a deprecated definition;
- an operation with rules for each output.

Its config has `coverage: 'error'` and a Postgres table.

- **To test a construct that compiles,** add it to the booking fixture. Most tests read it, so a new construct gets the generated code, the scenarios, the gates and the Postgres schema at no extra cost.
- **To test a mistake,** write a small manifest inline in the test, not a fixture. `tests/model.test.ts`, `tests/rules.test.ts` and `tests/diff.test.ts` do this. To break the booking fixture in one place, use the helper `changed` of `tests/target.test.ts`.
- **Make a new fixture** only if the booking fixture cannot hold the case, for example a different config.

## Know the layout

| File | Content |
| --- | --- |
| `domain.manifest.yaml` | The manifest |
| `urn-forge.config.ts` | The config. It imports `defineConfig` from `../../../src/config.js`, sets `out: 'generated'`, `core: 'core.ts'` and `tsconfig: '../../../tsconfig.json'`, and sets `coverage: 'error'` |
| `core.ts` | The core: `export const core = { … } satisfies DomainCore` |
| `features/*.feature` | The scenarios |
| `features/support/steps.ts` | Calls `registerSteps` from `../../../../../src/gherkin/steps.js` with the generated file and the core |
| `generated/` | The files that `compile` writes. They are committed |

The package tsconfig includes `tests`, so `npm run typecheck` type-checks the core and the generated file of each fixture.

## Change the booking fixture

1. Change `tests/fixtures/booking/domain.manifest.yaml`.
2. Compile the fixture:

   ```bash
   node bin/urn-forge.js compile --config tests/fixtures/booking/urn-forge.config.ts
   ```

   The output names each file:

   ```
   wrote      tests/fixtures/booking/generated/domain.generated.ts
   unchanged  tests/fixtures/booking/generated/schema.generated.sql
   unchanged  tests/fixtures/booking/generated/domain.store.generated.ts
   ```

3. If the change adds an operation, an output or a rule of a definition, add a scenario for it to `features/seat.feature`. If the change adds an operation, add its function to `core.ts`.
4. Verify the fixture:

   ```bash
   node bin/urn-forge.js verify --config tests/fixtures/booking/urn-forge.config.ts
   ```

   Gates 1 to 4 must pass. The fixture has one warning, `deprecated-use`, on purpose.

5. Run the tests. Some tests count parts of the fixture, and fail when the count changes:
   - `tests/features.test.ts` expects the number of scenarios;
   - `tests/target.test.ts` expects the diagnostics of the fixture;
   - `tests/gherkin-gate.test.ts` expects the summary of gate 3;
   - `tests/cli.test.ts` expects some lines of the manifest, such as the line of a diagnostic.

   Correct each count to the new value, after you examine that it is correct.

6. Examine the diff of `generated/`. Make sure that each change is a change that you intended.

## Add a new fixture

1. Make the folder `tests/fixtures/<name>/`, with the files of the layout. Copy the config and `features/support/steps.ts` of the booking fixture.
2. Write the manifest, the core and the features.
3. Compile the fixture, then verify it, with `--config tests/fixtures/<name>/urn-forge.config.ts`.
4. Add a test file, `tests/<name>.test.ts`, that does these checks:
   - The committed generated file is the file that `compileManifest` and `generate` give. Copy the first test of `tests/generated.test.ts`.
   - Cucumber runs the features and they pass. Copy `tests/features.test.ts`, with the folder of the new fixture.
   - The generated checks and the harness do what the fixture must show.
5. Run `npm test` and `npm run typecheck` from the root folder.

If you change the generated code later, compile each fixture again with the others. [CONTRIBUTING.md](../CONTRIBUTING.md) gives the list of commands.

## Result

`npm test` compiles the fixture, compares its generated files byte for byte, and runs its scenarios.

## Related pages

- [Add a domain](./add-a-domain.md)
- [Dogfooding](./dogfooding.md)
- [How urn-forge is built](./architecture.md)
- [Diagnostics](../docs/reference/cli.md)
