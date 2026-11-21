# Add a primitive

This guide is for contributors who change urn-forge itself. A primitive is the value type of a field, such as `integer` or `string`. Each primitive is one descriptor module in `src/primitives/`. When you add a primitive to the registry, `tsc` names each place that does not handle it yet.

The example is the real addition of `boolean` with its constraint `mustBe` (commit `0415fb9`, "Add the boolean primitive"). It took one new module, one line in the registry and one entry in the Valibot plugin.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You read `src/primitives/README.md` and [Primitives and constraints](../reference/primitives).
- You know which constraints the primitive accepts, and which boundary cases each constraint has. [Boundary coverage and the ratchet](../explanation/boundary-coverage) gives the rules.

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Write the descriptor

1. Make the file `src/primitives/<name>.ts`.
2. Export a descriptor made with `definePrimitive`. It has five members:

   | Member | What it gives | Used by |
   | --- | --- | --- |
   | `name` | The `primitive:` value in the manifest | The meta-schema, `FieldInfo` in the generated runtime |
   | `constraints` | Each constraint key, with a Valibot schema for its value. The key order is the order in which plugins write the constraints | Pass 1 |
   | `coherence` | The combinations of constraints that no value can satisfy | Pass 7 (`incoherent-constraints`) |
   | `parseCell` | The value of a Gherkin table cell that is not empty | The steps, and gate 3 |
   | `boundaries` | The values that the examples of a field must include, for the constraints that the field sets | Gate 3 (`uncovered-boundary`) |

   This is the descriptor of `boolean`:

   <<< @/../packages/urn-forge/src/primitives/boolean.ts

3. Keep plugin details out of the descriptor. A member belongs there only if a part of urn-forge that is not a plugin uses it.
4. Make `parseCell` return the cell text unchanged when it is not a valid value. The schema then refuses it, and the scenario fails at the boundary with the field name.
5. If two primitives share rules, put the rules in a shared module. `integer` and `float` share `src/primitives/numeric.ts`.

`src/primitives/types.ts` has the full types of the descriptor.

## Add it to the registry

1. Import the descriptor in `src/primitives/index.ts`.
2. Add it to `PRIMITIVES`, in alphabetical order. The order is the order in which messages list the primitives.

   This is the change for `boolean`:

   ```diff
   +import { boolean } from './boolean.js';
    import { float } from './float.js';
    import { integer } from './integer.js';
    import { string } from './string.js';
   …
   -export const PRIMITIVES = { float, integer, string } as const;
   +export const PRIMITIVES = { boolean, float, integer, string } as const;
   ```

The meta-schema, `FieldInfo`, the cell conversion and the support check of the engine read the registry. They need no change.

## Follow tsc to each plugin

1. Run the type check from the root folder:

   ```bash
   npm run typecheck
   ```

2. Read each error. Each plugin that must handle every primitive has a table typed with `Primitive`. Before the `boolean` entry was in the Valibot table, `tsc` showed:

   ```
   src/plugins/valibot.plugin.ts(53,7): error TS2741: Property 'boolean' is missing in type '{ float: { base: string[]; constraints: { readonly max: (value: number) => string; readonly notEqual: (value: number) => string; readonly min: (value: number) => string; }; }; integer: { base: string[]; constraints: { ...; }; }; string: { ...; }; }' but required in type 'ValibotTranslations'.
   ```

3. Add the entry. Give the base Valibot actions, and one function for each constraint:

   ```diff
    const TRANSLATIONS: ValibotTranslations = {
   +  boolean: { base: ['v.boolean()'], constraints: { mustBe: (b) => `v.value(${b})` } },
      float: { base: ['v.number()', 'v.finite()'], constraints: NUMERIC_ACTIONS },
   ```

4. Run `npm run typecheck` again until it passes.

The Valibot plugin makes its `supports` declaration from `TRANSLATIONS`, so the two cannot disagree. The FCIS plugin reads only the name of a primitive, so it needs no change. A new plugin that reads constraints must declare the primitive in `supports.constraints`. Refer to [Add a plugin](add-a-plugin).

## Test the primitive

1. Add unit tests to `tests/primitives.test.ts`: the schema of each constraint value, `coherence`, `parseCell` and `boundaries`.
2. Add a field with the primitive to the `shop` fixture. Add one field for each constraint.
3. Add an incorrect constraint value to the `invalid-structure` fixture.
4. Write the expected files again, then run the harness a second time:

   ```bash
   npx vitest run tests/fixtures.test.ts -u
   npx vitest run tests/fixtures.test.ts
   ```

5. Examine the diff of each file below `tests/fixtures/`. The `unknown-primitive` message lists every primitive, so `invalid-structure` changes too.

[Add a test fixture](add-a-fixture) gives the details of the harness.

## Compile the committed domains again

The generated runtime lists every primitive in `FieldInfo`. The fingerprint also includes the constraint keys of each primitive. Thus a new primitive changes every generated file in the repository.

1. Compile each domain:

   ```bash
   npm run compile:example
   npm run compile:self
   npx urn-forge compile --config tutorial/1-first-domain/urn-forge.config.ts
   npx urn-forge compile --config tutorial/2-declared-errors/urn-forge.config.ts
   npx urn-forge compile --config tutorial/3-strict-coverage/urn-forge.config.ts
   ```

2. Make sure that each diff changes only the fingerprint line and the `primitive` type of `FieldInfo`.
3. Commit the generated files with the change. Otherwise gate 4 fails with `generated-differs`.

## Document the primitive

1. Add the primitive and its constraints to [Primitives and constraints](../reference/primitives), with its boundary cases.
2. Add its cell conversion to [Gherkin steps](../reference/gherkin-steps).
3. Update [Scope](../reference/scope).
4. If you added a diagnostic code, add it to [Diagnostics](../reference/diagnostics). A test in `tests/diagnostics.test.ts` fails until the page lists each code.

## Result

Run each check of CI from the root folder:

```bash
npm test
npm run typecheck
npm run verify:example
npm run verify:self
npm run verify:tutorial
```

Each command passes. A manifest field with `primitive: <name>` compiles, and its constraints show in the generated schema.

## Related pages

- [Add a constraint](add-a-constraint)
- [Add a test fixture](add-a-fixture)
- [Primitives and constraints](../reference/primitives)
- [How urn-forge is built](../explanation/architecture)
