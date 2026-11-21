# Add a test fixture

This guide is for contributors who change urn-forge itself. A fixture is a manifest and the exact output that `compile` gives for it. The harness in `tests/fixtures.test.ts` compiles each fixture and compares the result with the expected files, byte for byte. Thus any change to the output of urn-forge shows as a diff that a reviewer can read.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` passes.
- You know what the fixture must show: a manifest that compiles, or a manifest with problems.

Commands run from `packages/urn-forge`.

## Know the layout

Each folder below `tests/fixtures/` is one fixture:

| File | Content |
| --- | --- |
| `domain.manifest.yaml` | The manifest. Necessary |
| `urn-forge.config.ts` | A config whose `plugins` list replaces the default plugins. Optional |
| `expected/ir.json` | The canonical IR, if the manifest compiles |
| `expected/<file>.generated.ts` | Each generated file, with its header and fingerprint, if the manifest compiles |
| `expected/diagnostics.json` | The diagnostics, if the manifest does not compile. Then `expected/` has no other file |

The folders at this time are `math`, `shop`, `primitives`, `errors-valibot`, `invalid-structure`, `broken-references`, `conflicting-constraints` and `replaced-constraints`. Add to a fixture that has the same purpose before you make a new one. For example:

- `primitives` has one field for each primitive and each constraint, and an entity with lists. Tests parse values through its generated schemas.
- `invalid-structure` has structure problems that pass 1 finds.
- `conflicting-constraints` has fields that pass 7 refuses.
- `replaced-constraints` has constraints that pass 1 refuses, such as `oneOf` and `notEqual`.

## Add a fixture that compiles

1. Make the folder `tests/fixtures/<name>/`.
2. Write `domain.manifest.yaml` in it.
3. Run the harness with `-u`. It writes the files in `expected/`:

   ```bash
   npx vitest run tests/fixtures.test.ts -u
   ```

   The first run fails, because it cannot see the files that it writes. The test that compares the file list shows an empty list. This is the output for a fixture named `shipping`, with the manifest of tutorial 3:

   ```
    FAIL  tests/fixtures.test.ts > fixture shipping > compiles without diagnostics to the expected IR and files
   AssertionError: expected [] to deeply equal [ 'domain.runtime.generated.ts', …(2) ]

   - Expected
   + Received

   - [
   -   "domain.runtime.generated.ts",
   -   "domain.schemas.generated.ts",
   -   "ir.json",
   - ]
   + []
   ```

4. Run the harness again, without `-u`:

   ```bash
   npx vitest run tests/fixtures.test.ts
   ```

   All tests pass.

5. Examine each file in `expected/`. From now on, a change to these files is a change to the output of urn-forge.

The determinism test (`tests/determinism.test.ts`) also compiles each fixture that compiles. It runs the CLI with a Turkish locale and the time zone `Pacific/Chatham`, and compares the bytes with `expected/`. You do not have to do more for it.

## Add a fixture with a plugin config

To test one plugin alone, or a plugin with options, add `urn-forge.config.ts` to the fixture folder. The harness loads it with the real config loader and reads only its `plugins` list.

The `errors-valibot` fixture runs the Valibot plugin alone. It tested the error schemas before the FCIS plugin supported errors:

<<< @/../packages/urn-forge/tests/fixtures/errors-valibot/urn-forge.config.ts

A plugin with options uses the tuple form. This is the config for the example plugin of [Add a plugin](add-a-plugin):

```ts
export default { plugins: [['urn-list', { exportName: 'SHIPPING_URNS' }]] };
```

Then run the harness twice, as in the steps above.

## Add a fixture that fails

1. Write a manifest that has the problems to test.
2. Run the harness with `-u`, then without `-u`, as above.
3. Examine `expected/diagnostics.json`. It has each diagnostic with its code, its line and column, its URN and its message.

   For a `weight_grams` field with `min: 40000` and `max: 30000`, the file is:

   ```json
   [
     {
       "code": "incoherent-constraints",
       "location": {
         "column": 8,
         "line": 9
       },
       "message": "urn:demo:shipping:parcel:field:weight_grams: min (40000) is greater than max (30000), so no value is valid",
       "severity": "error",
       "urn": "urn:demo:shipping:parcel:field:weight_grams"
     }
   ]
   ```

A fixture fails if `compile` gives one error or more. A plugin error, such as `unsupported-construct`, counts too. A fixture that fails has no generated files in `expected/`. The harness needs at least one fixture that compiles and one that fails.

## Update a fixture after a change

1. Change the manifest, or change urn-forge.
2. If the fixture changes from a pass to a failure, or back, delete its `expected/` folder first. `-u` writes files, but it does not delete a file that is no longer correct.
3. Run the harness with `-u`, then without `-u`.
4. Examine the diff with `git diff tests/fixtures`. Make sure that each change is a change that you intended.

## Result

`npx vitest run tests/fixtures.test.ts` passes, and `expected/` holds exactly what `compile` gives for the manifest.

## Related pages

- [Add a primitive](add-a-primitive)
- [Add a plugin](add-a-plugin)
- [Diagnostics](../reference/diagnostics)
- [Determinism and the fingerprint](../explanation/determinism)
