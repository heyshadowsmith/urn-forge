# Add a constraint

This guide is for contributors who change urn-forge itself. A constraint limits the values of a field, such as `min` on `integer` or `format` on `string`. A constraint belongs to the descriptor of one primitive, and it restricts one aspect of the value. When you add it, `tsc` names each plugin table that cannot translate it yet.

The example is the real addition of `format` to `string` (commit `087c5da`, "Primitives steps 2 to 5: notIn, exclusive bounds, multipleOf, format"). `format` restricts the shape of a value, as `regex` does. Thus a field can set only one of the two. It took the constraint in the `string` descriptor and one entry in the Valibot plugin.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You know the primitive that gets the constraint. To add a primitive, refer to [Add a primitive](./add-a-primitive.md).
- You know the aspect that the constraint restricts: `range`, `step`, `size`, `shape`, `membership` or `exclusion`. [The MECE model of primitives](../docs/explanation/primitives-model.md) gives the rules.
- You know the boundary cases of the constraint. [Boundary coverage and the ratchet](../docs/explanation/boundary-coverage.md) gives the rules.

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Choose the name

1. Look for the aspect on the other primitives. If a primitive already has a constraint for the same aspect and the same side, use its name. For example, an inclusive lower bound is `min` on each primitive.
2. If the aspect is new to all primitives, choose a new name. Make sure that no primitive uses the name for a different aspect.
3. Do not add a second constraint for an aspect that one constraint already covers. For example, `notIn: [0]` excludes one value, so urn-forge has no `notEqual`.

## Add the constraint to the descriptor

The highlighted lines of the `string` descriptor are the parts of `format`. The steps refer to them:

<<< @/../packages/urn-forge/src/primitives/string.ts{41-61,66-67,72-74,96-99}

1. Write a `ConstraintSpec` for the value (lines 58 to 61). Its `schema` refuses an incorrect value in pass 1, with the message that you give. Its `aspect` puts it in the MECE model. A format that is not in the list gives this problem:

   ```
   bad-format.yaml:8:11  error  invalid-value  order.field.email.format: must be one of uuid, email, uri
   ```

   If each field of the primitive must set the constraint, add `required: true`. A field without it then gets `missing-property`. `values` of `enum` is the only one at this time.

2. Add the key to `constraints` of the descriptor (line 66). The key order is the order in which plugins write the constraints.
3. If the primitive has a constraint for the same side of the same aspect, add an `exclusive` group (line 67). `format` and `regex` both set the shape:

   ```
   bad-format.yaml:9:11  error  conflicting-constraints  urn:demo:shop:order:field:email: regex and format both set the shape; keep one
   ```

4. Add the rules of the new constraint to `coherence` (lines 72 to 74). For each combination of constraints that admits no value, return a problem that names the constraint to point at. A UUID always has 36 characters, so `format: uuid` with `maxLength: 10` admits no value:

   ```
   bad-format.yaml:8:11  error  incoherent-constraints  urn:demo:shop:order:field:id: a uuid has 36 characters, which the length constraints exclude, so no value is valid
   ```

5. Add the boundary cases of the new constraint to `boundaries` (lines 96 to 99). Give each case a label that completes the sentence "has no …", and a `covers` function.

::: warning
`tsc` does not make sure that `coherence` and `boundaries` read the new constraint. If you forget them, an incoherent field compiles, and gate 3 does not ask for its boundary values.
:::

If the descriptor has no `aspect` for the constraint, `tsc` fails:

```
src/primitives/string.ts(58,7): error TS2741: Property 'aspect' is missing in type '{ schema: v.PicklistSchema<readonly ["uuid", "email", "uri"], `must be one of ${string}`>; }' but required in type 'ConstraintSpec<"uuid" | "email" | "uri">'.
```

## Follow tsc to each plugin

1. Run the type check from the root folder:

   ```bash
   npm run typecheck
   ```

2. Read each error. If the Valibot table has no `format` entry, `tsc` shows:

   ```
   src/plugins/valibot.plugin.ts(110,5): error TS2741: Property 'format' is missing in type '{ minLength: (n: number) => string; maxLength: (n: number) => string; regex: (pattern: string) => string; }' but required in type '{ readonly regex: (value: string) => string; readonly minLength: (value: number) => string; readonly maxLength: (value: number) => string; readonly format: (value: NonNullable<"uuid" | "email" | "uri" | undefined>) => string; }'.
   ```

   `tsc` also gives the value type of the function: `"uuid" | "email" | "uri"` for `format`.

3. Add the entry. It returns the Valibot action as TypeScript text. This is the real entry, with the table of actions that it reads:

   ```ts
   /** The Valibot action of each named format; `matchesFormat` in src/primitives/string.ts uses the same ones. */
   const FORMAT_ACTIONS: { readonly [F in Format]: string } = { uuid: 'v.uuid()', email: 'v.email()', uri: 'v.url()' };
   ```

   ```diff
        constraints: {
          minLength: (n) => codePointLength('>=', n),
          maxLength: (n) => codePointLength('<=', n),
          // The whole-value pattern as a regex literal; `.source` escapes any `/` in it.
          regex: (pattern) => `v.regex(/${wholeValuePattern(pattern).source}/u)`,
   +      format: (name) => FORMAT_ACTIONS[name],
        },
   ```

4. Make sure that the text is a correct literal for each possible value. `JSON.stringify` escapes quotes in a string. `numberLiteral` keeps `-0`. `.source` escapes a `/` in a pattern.
5. If the action calls a function that Valibot does not have, name it in `helpers` of the primitive. Refer to [Add a primitive](./add-a-primitive.md).
6. Run `npm run typecheck` again until it passes.

The Valibot plugin makes its `supports` declaration from its table, so it now accepts the constraint. A plugin that lists constraints in `supports.constraints` by hand needs the key there too. Otherwise a field with the constraint fails with `unsupported-construct`.

## Check the MECE model

Run the test of the MECE model in `tests/primitives.test.ts`:

```bash
npx vitest run tests/primitives.test.ts -t "MECE"
```

The test fails in these conditions:

- A constraint name has two aspects.
- An `exclusive` group has constraints of different aspects.
- The constraint table in [Primitives and constraints](../docs/reference/primitives.md) does not list each constraint of the registry, with its aspect.

For example, a `min` on `string` with the aspect `size` gives this failure:

```
AssertionError: expected [ [ 'min', Set{ 'range', 'size' } ] ] to deeply equal []
```

## Test the constraint

1. Add unit tests to `tests/primitives.test.ts`: the value schema, `coherence` and `boundaries`. Add the key to the test `lists the primitives and their constraints in a fixed order`.
2. Change the fixtures:
   - `primitives`: a field that uses the constraint. `tests/primitives.test.ts` parses values through its generated schema, for a value that passes and a value that the schema refuses. `format` added one field for each format.
   - `conflicting-constraints`: a field with two constraints of one `exclusive` group, and an incoherent combination. `format` added `regex` with `format`, and `format: uuid` with `maxLength: 10`.
   - `replaced-constraints`: the constraint on a primitive that must not accept it, if the MECE model refuses it there.
   - `invalid-structure`: an incorrect value, such as an empty list.
3. If you added a diagnostic code, add a case to `tests/every-code.test.ts`. `format` added `conflicting-constraints`.
4. Write the expected files again, then run the harness a second time:

   ```bash
   npx vitest run tests/fixtures.test.ts -u
   npx vitest run tests/fixtures.test.ts
   ```

5. Examine the diff of each expected file. Refer to [Add a test fixture](./add-a-fixture.md).

## Compile the committed domains again

The fingerprint includes the constraint keys of each primitive. Thus a new constraint changes the fingerprint line of every generated file, and nothing else in a file that does not use the constraint.

1. Compile each domain:

   ```bash
   npm run compile:example
   npm run compile:self
   npx urn-forge compile --config tutorial/1-first-domain/urn-forge.config.ts
   npx urn-forge compile --config tutorial/2-declared-errors/urn-forge.config.ts
   npx urn-forge compile --config tutorial/3-strict-coverage/urn-forge.config.ts
   ```

2. Commit the generated files with the change.

## Document the constraint

1. Add the constraint, its value, its aspect, its coherence rules and its boundary cases to [Primitives and constraints](../docs/reference/primitives.md). Add a row to the constraint table. The test of the MECE model compares the table with the registry.
2. Add the constraint to the primitive in [Add a field](../docs/how-to/add-a-field.md).
3. Update [Scope](../docs/reference/scope.md).
4. If you added a diagnostic code, add it to [Diagnostics](../docs/reference/diagnostics.md).

## Result

`npm test`, `npm run typecheck`, `npm run verify:example`, `npm run verify:self` and `npm run verify:tutorial` pass. A field with the constraint compiles. A scenario that sends a value outside the constraint gets `Then the input is rejected on "<field>"`.

## Related pages

- [Add a primitive](./add-a-primitive.md)
- [Add a test fixture](./add-a-fixture.md)
- [Primitives and constraints](../docs/reference/primitives.md)
- [The MECE model of primitives](../docs/explanation/primitives-model.md)
- [How urn-forge is built](./architecture.md)
