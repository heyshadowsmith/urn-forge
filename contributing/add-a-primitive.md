# Add a primitive

This guide is for contributors who change urn-forge itself. A primitive is the kind of one value of a field, such as `integer` or `date`. Each primitive is one descriptor module in `src/primitives/`. When you add a primitive to the registry, `tsc` names each place that does not handle it yet.

The example is the real addition of `date` with its constraints `min` and `max` (commit `2435783`, "Primitives steps 7 to 9: decimal, date and timestamp"). It took one new module, one line in the registry, one entry in the Valibot plugin and one helper function for the generated schemas.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You read `src/primitives/README.md`, [Primitives and constraints](../docs/reference/primitives.md) and [The MECE model of primitives](../docs/explanation/primitives-model.md).
- You know that the new kind of value needs a primitive. A kind is new only if its value space or its comparison is different from that of each primitive. For example, a duration is an `integer` with the unit in its name.
- You know which constraints the primitive accepts, the aspect of each one, and the boundary cases of each one. [Boundary coverage and the ratchet](../docs/explanation/boundary-coverage.md) gives the rules.

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Write the descriptor

1. Make the file `src/primitives/<name>.ts`.
2. Export a descriptor made with `definePrimitive`. It has these members:

   | Member | What it gives | Used by |
   | --- | --- | --- |
   | `name` | The `primitive:` value in the manifest | The meta-schema, `FieldInfo` in the generated runtime |
   | `constraints` | Each constraint key, with its `ConstraintSpec`. The key order is the order in which plugins write the constraints | Pass 1, and the test of the MECE model |
   | `exclusive` | Optional. The groups of constraints of which a field can set only one | Pass 7 (`conflicting-constraints`) |
   | `coherence` | The combinations of constraints that no value can satisfy | Pass 7 (`incoherent-constraints`) |
   | `parseCell` | The value of a Gherkin table cell that is not empty | The steps, and gate 3 |
   | `boundaries` | The values that the examples of a field must include, for the constraints that the field sets | Gate 3 (`uncovered-boundary`) |

3. Write a `ConstraintSpec` for each constraint. It has these members:

   | Member | What it gives |
   | --- | --- |
   | `schema` | A Valibot schema for the value of the constraint in the manifest. Pass 1 refuses an incorrect value with `invalid-value` and the message of the schema |
   | `aspect` | The aspect of the value that the constraint restricts: `range`, `step`, `size`, `shape`, `membership` or `exclusion` |
   | `required` | Optional. If `true`, each field of the primitive must set the constraint. If not, pass 1 gives `missing-property`. `values` of `enum` is the only one at this time |

   This is the descriptor of `date`:

   <<< @/../packages/urn-forge/src/primitives/date.ts{5-8,17}

4. Use the name that the aspect has on the other primitives. For example, `min` is an inclusive lower bound on each primitive with a range. Thus a `date` uses `min` and `max`, not `after` and `before`.
5. Give each aspect one constraint for each side. A discrete kind, such as `date` or `integer`, has no exclusive bounds, because an exclusive bound is an inclusive bound one step away.
6. If two constraints restrict the same side of one aspect, put them in an `exclusive` group. `float`, `decimal` and `timestamp` use `BOUND_GROUPS` from `src/primitives/numeric.ts`: `min` with `exclusiveMin`, and `max` with `exclusiveMax`. `string` has a group for `regex` and `format`. If a field sets two constraints of one group, pass 7 reports `conflicting-constraints` and does not run `coherence` for that field.
7. Keep plugin details out of the descriptor. A member belongs there only if a part of urn-forge that is not a plugin uses it.
8. Make `parseCell` return the cell text unchanged when it is not a valid value. The schema then refuses it, and the scenario fails at the boundary with the field name.
9. If two primitives share rules, put the rules in a shared module. `integer` and `float` share `src/primitives/numeric.ts`. `decimal`, `date` and `timestamp` share `src/primitives/exact.ts`.

`src/primitives/types.ts` has the full types of the descriptor. The smallest descriptor is `src/primitives/boolean.ts`.

## Add it to the registry

1. Import the descriptor in `src/primitives/index.ts`.
2. Add it to `PRIMITIVES`, in alphabetical order. The order is the order in which messages list the primitives.

   This is the change for `date`:

   ```diff
    import { boolean } from './boolean.js';
   +import { date } from './date.js';
    import { decimal } from './decimal.js';
   …
   -export const PRIMITIVES = { boolean, decimal, enum: enumPrimitive, float, integer, string, timestamp } as const;
   +export const PRIMITIVES = { boolean, date, decimal, enum: enumPrimitive, float, integer, string, timestamp } as const;
   ```

   If the name is a reserved word of JavaScript, give the export a different name. The `enum` descriptor is `enumPrimitive`.

The meta-schema, `FieldInfo`, the cell conversion and the support check of the engine read the registry. They need no change.

## Follow tsc to each plugin

1. Run the type check from the root folder:

   ```bash
   npm run typecheck
   ```

2. Read each error. Each plugin that must handle every primitive has a table typed with `Primitive`. If the Valibot table has no `date` entry, `tsc` shows:

   ```
   src/plugins/valibot.plugin.ts(60,7): error TS2741: Property 'date' is missing in type '{ boolean: { base: string[]; constraints: { mustBe: (b: NonNullable<boolean | undefined>) => string; }; }; enum: { base: never[]; constraints: { values: (values: string[]) => string; }; }; ... 4 more ...; timestamp: { ...; }; }' but required in type 'ValibotTranslations'.
   ```

3. Add the entry. Give the base Valibot actions, and one function for each constraint. Each function returns the Valibot action as TypeScript text. This is the entry of `date`:

   ```ts
   date: {
     base: ['v.string()', "v.check(isCalendarDate, 'Invalid date: Expected a calendar day YYYY-MM-DD')"],
     helpers: ['date'],
     constraints: {
       // A date in this form sorts as text, so Valibot's own comparisons apply.
       min: (day) => `v.minValue(${text(day)})`,
       max: (day) => `v.maxValue(${text(day)})`,
     },
   },
   ```

4. If the actions call a function that Valibot does not have, name it in `helpers`. Then add the function text to `VALIBOT_HELPERS` in `src/plugins/valibot-helpers.ts`. Also add the helpers that it calls to `HELPER_NEEDS`. `tsc` fails until `HELPER_NEEDS` has an entry for each helper. A generated file gets a helper only if one of its fields needs it.
5. If a helper has the same rules as a function of the descriptor, add a test to `tests/exact.test.ts`. That test runs the helper text and compares it with the descriptor on many values. `isCalendarDate` has a copy in each of the two places.
6. Run `npm run typecheck` again until it passes.

The Valibot plugin makes its `supports` declaration from `TRANSLATIONS`, so the two cannot disagree. The FCIS plugin reads only the name of a primitive, so it needs no change. A new plugin that reads constraints must declare the primitive in `supports.constraints`. Refer to [Add a plugin](./add-a-plugin.md).

## Check the MECE model

The test `the MECE model` in `tests/primitives.test.ts` makes sure that the registry stays MECE. Run it:

```bash
npx vitest run tests/primitives.test.ts -t "MECE"
```

It has three checks:

- **One name, one aspect.** A constraint name has the same aspect on each primitive. For example, if `string` had a `min` with the aspect `size`, the test fails:

  ```
  AssertionError: expected [ [ 'min', Set{ 'range', 'size' } ] ] to deeply equal []
  ```

  To fix it, use the name that the aspect has: `minLength`.

- **The reference table.** Each row of the constraint table in [Primitives and constraints](../docs/reference/primitives.md) is one constraint of the registry, with its aspect. Add a row for each new constraint.
- **The exclusive groups.** Each `exclusive` group names two or more constraints of the primitive, and all of them have one aspect.

## Test the primitive

1. Add unit tests to `tests/primitives.test.ts`: the schema of each constraint value, `coherence`, `parseCell` and `boundaries`. Add the primitive and its constraints to the test `lists the primitives and their constraints in a fixed order`.
2. Add fields with the primitive to the `primitives` fixture. Add one field for each constraint. `tests/primitives.test.ts` parses values through the generated schemas of this fixture.
3. Add the problems to the two conflict fixtures:
   - `conflicting-constraints`: a field with two constraints of one `exclusive` group, and a field with constraints that admit no value.
   - `replaced-constraints`: a constraint that the MECE model refuses on the primitive, such as `exclusiveMin` on a `date`, and a constraint value that pass 1 refuses.
4. Write the expected files again, then run the harness a second time:

   ```bash
   npx vitest run tests/fixtures.test.ts -u
   npx vitest run tests/fixtures.test.ts
   ```

5. Examine the diff of each file below `tests/fixtures/`. The `unknown-primitive` message lists every primitive, so `invalid-structure` changes too.
6. If you added a diagnostic code, add a case to `tests/every-code.test.ts`.

[Add a test fixture](./add-a-fixture.md) gives the details of the harness.

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

1. Add the primitive and its constraints to [Primitives and constraints](../docs/reference/primitives.md), with its boundary cases. Add a row to the constraint table for each constraint. The test of the MECE model compares the table with the registry.
2. Add the primitive to [The manifest](../docs/reference/manifest.md).
3. Add its cell conversion to [Gherkin steps](../docs/reference/gherkin-steps.md).
4. If the primitive changes the table of primitives and aspects, update [The MECE model of primitives](../docs/explanation/primitives-model.md).
5. Update [Scope](../docs/reference/scope.md).
6. If you added a diagnostic code, add it to [Diagnostics](../docs/reference/diagnostics.md). A test in `tests/diagnostics.test.ts` fails until the page lists each code.

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

- [Add a constraint](./add-a-constraint.md)
- [Add a test fixture](./add-a-fixture.md)
- [Primitives and constraints](../docs/reference/primitives.md)
- [The MECE model of primitives](../docs/explanation/primitives-model.md)
- [How urn-forge is built](./architecture.md)
