# Add a constraint

This guide is for contributors who change urn-forge itself. A constraint limits the values of a field, such as `min` on `integer` or `oneOf` on `string`. A constraint belongs to the descriptor of one primitive. When you add it, `tsc` names each plugin table that cannot translate it yet.

There are two real examples in the history of `src/primitives/string.ts`:

- `oneOf` (commit `94ae08b`): the first constraint whose value is a list.
- `regex` (commit `0598819`): a constraint whose value must compile as a regular expression.

Each took the constraint in the `string` descriptor and one entry in the Valibot plugin.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You know the primitive that gets the constraint. To add a primitive, refer to [Add a primitive](add-a-primitive).
- You know the boundary cases of the constraint. [Boundary coverage and the ratchet](../explanation/boundary-coverage) gives the rules.

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Add the constraint to the descriptor

The highlighted lines of the `string` descriptor are the parts of `oneOf` and `regex`. The steps refer to them:

<<< @/../packages/urn-forge/src/primitives/string.ts{27-41,46,51-62,78-86}

1. Write a `ConstraintSpec` for the value (lines 27 to 41). Its Valibot schema refuses an incorrect value in pass 1, with the message that you give. An empty `oneOf` list gives this problem:

   ```
   tutorial/3-strict-coverage/domain.manifest.yaml:13:10  error  invalid-value  parcel.field.zone.oneOf: must list at least one value
   ```

2. Add the key to `constraints` of the descriptor (line 46). The key order is the order in which plugins write the constraints. `regex` comes before `oneOf`, so the generated pipe examines the form before the list.
3. Add the rules of the new constraint to `coherence` (lines 51 to 62). For each combination of constraints that admits no value, return a problem that names the constraint to point at. `oneOf` added a check against `minLength` and `maxLength`, and `regex` added a check against `oneOf`:

   ```
   tutorial/3-strict-coverage/domain.manifest.yaml:13:10  error  incoherent-constraints  urn:demo:shipping:parcel:field:zone: oneOf value "international" is longer than maxLength (8), so it is never valid
   ```

4. Add the boundary cases of the new constraint to `boundaries` (lines 78 to 86). Give each case a label that completes the sentence "has no …", and a `covers` function.

::: warning
`tsc` does not make sure that `coherence` and `boundaries` read the new constraint. If you forget them, an incoherent field compiles, and gate 3 does not ask for its boundary values.
:::

## Follow tsc to each plugin

1. Run the type check from the root folder:

   ```bash
   npm run typecheck
   ```

2. Read each error. Before the `oneOf` entry was in the Valibot table, `tsc` showed:

   ```
   src/plugins/valibot.plugin.ts(59,5): error TS2741: Property 'oneOf' is missing in type '{ minLength: (n: number) => string; maxLength: (n: number) => string; regex: (pattern: string) => string; }' but required in type '{ readonly minLength: (value: number) => string; readonly maxLength: (value: number) => string; readonly regex: (value: string) => string; readonly oneOf: (value: string[]) => string; }'.
   ```

   `tsc` also gives the value type of the function: `string[]` for `oneOf`.

3. Add the entry. It returns the Valibot action as TypeScript text. These are the two real entries:

   ```diff
        constraints: {
          minLength: (n) => `v.minLength(${numberLiteral(n)})`,
          maxLength: (n) => `v.maxLength(${numberLiteral(n)})`,
   +      // The whole-value pattern as a regex literal; `.source` escapes any `/` in it.
   +      regex: (pattern) => `v.regex(/${wholeValuePattern(pattern).source}/u)`,
   +      // A picklist schema in the pipe also narrows the type to the listed values.
   +      oneOf: (values) => `v.picklist([${values.map((value) => JSON.stringify(value)).join(', ')}])`,
        },
   ```

4. Make sure that the text is a correct literal for each possible value. `JSON.stringify` escapes quotes in a string. `numberLiteral` keeps `-0`. `.source` escapes a `/` in a pattern.
5. Run `npm run typecheck` again until it passes.

The Valibot plugin makes its `supports` declaration from its table, so it now accepts the constraint. A plugin that lists constraints in `supports.constraints` by hand needs the key there too. Otherwise a field with the constraint fails with `unsupported-construct`.

## Test the constraint

1. Add unit tests to `tests/primitives.test.ts`: the value schema, `coherence` and `boundaries`.
2. Add tests that parse the generated schema at run time, for a value that passes and a value that the schema refuses.
3. Change the fixtures:
   - `shop`: a field that uses the constraint. `oneOf` added a value with a space and an ampersand.
   - `invalid-structure`: an incorrect value, such as an empty list.
   - `broken-references`: an incoherent combination.
4. Write the expected files again, then run the harness a second time:

   ```bash
   npx vitest run tests/fixtures.test.ts -u
   npx vitest run tests/fixtures.test.ts
   ```

5. Examine the diff of each expected file. Refer to [Add a test fixture](add-a-fixture).

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

1. Add the constraint, its value, its coherence rules and its boundary cases to [Primitives and constraints](../reference/primitives).
2. Update [Scope](../reference/scope).
3. If you added a diagnostic code, add it to [Diagnostics](../reference/diagnostics).

## Result

`npm test`, `npm run typecheck`, `npm run verify:example`, `npm run verify:self` and `npm run verify:tutorial` pass. A field with the constraint compiles. A scenario that sends a value outside the constraint gets `Then the input is rejected on "<field>"`.

## Related pages

- [Add a primitive](add-a-primitive)
- [Add a test fixture](add-a-fixture)
- [Primitives and constraints](../reference/primitives)
- [How urn-forge is built](../explanation/architecture)
