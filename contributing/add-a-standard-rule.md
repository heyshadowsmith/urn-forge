# Add a standard rule

This guide is for contributors who change urn-forge itself. A standard rule is a keyword of JSON Schema, such as `minimum` or `required`, that urn-forge ships as a rule. Each manifest can apply it without a declaration. The standard set is a manifest in the package, [`src/standard.manifest.yaml`](../packages/urn-forge/src/standard.manifest.yaml). urn-forge reads it with the same code as a user manifest, so a new standard rule is mostly YAML.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You read [How urn-forge is built](./architecture.md), the section "Rule uses".

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Make sure that the rule belongs in the standard set

The standard set is decision 19 of the [redesign notes](../planning/manifest-redesign-notes.md). Each other rule is a rule that a user declares in the manifest. Add a standard rule only if each of these is true:

1. It is a keyword of JSON Schema. It has the name and the meaning that JSON Schema gives it.
2. It passes the three tests of decision 10 of the [contract completeness roadmap](../planning/contract-completeness-roadmap.md). A keyword for one domain is not a standard rule.
3. No standard rule states it already. For example, a choice of numbers is `minimum` and `maximum`, or a rule of the user. It is not a new keyword.
4. A real manifest needs it. Name the manifest in the pull request.

If the keyword fails a test, the user declares the rule in the manifest. [Add a rule](../packages/urn-forge/AGENTS.md) shows how.

## Make sure that the subset can state it

A standard rule is a rule in the CEL subset, as each rule is. Write the rule in CEL first, with `self` for the value and the parameter names for the arguments.

If the rule needs a form that the rule language does not have, refer to [Change the rule language](./add-a-cel-form.md). For example, `uniqueItems` uses `exists_one`, and `pattern` uses `matches()`. A keyword such as `minProperties` needs `size()` of an object, which is out of the language: the manifest has no maps.

## Declare the parameters

A parameter is a definition in the `definitions` section of the standard set. These definitions are in the namespace `urn_forge`, so they never clash with the names of a user.

1. Use a definition that exists if it has the correct meaning. For example, `count` is an integer of 0 or more, and `minLength`, `maxLength`, `minItems` and `maxItems` all use it.
2. If no definition fits, add one. Give it a `description` that completes the sentence "*parameter* is …". The message of `rule-argument` uses the description in lowercase:

   ```
   domain.manifest.yaml:11  error  rule-argument  minimum: "one" is not a number; bound is a number that a value is compared with
   ```

3. Give the definition the rules that refuse a bad argument. `compile` checks each argument with the generated check of its parameter. For example, `count` has `- minimum: 0`, so `- minLength: -1` gives:

   ```
   domain.manifest.yaml:11  error  rule-argument  minLength: -1 breaks minimum of count: Must be at least 0
   ```

A rule with no argument, such as `uniqueItems`, has no `parameters`.

## Declare the rule

Add the rule to the `rules` section of the standard set. Use the order of decision 19: rules for any value, then numbers, strings, lists and objects. For example, `maxItems` is:

```yaml
  maxItems:
    description: The list has the count of items or fewer
    parameters: [count]
    rule: size(self) <= count
    message: Must have at most {count} items
```

- **The name** is the name in JSON Schema, in camelCase. Only the standard set can use camelCase. A rule of a user is in snake_case.
- **The description** states what is true when the rule holds.
- **The rule** gives a `bool`. It types for the base types where the keyword applies. Where it does not type, the use gets `rule-type`, as `enum` on an integer does.
- **The message** starts with *Must*. `{count}` puts the argument in the text.

## Make the tests pass

1. Run the tests:

   ```bash
   npx vitest run tests/rules.test.ts
   ```

   The test "loads with no problem, and has the keywords of JSON Schema" fails, because it lists each standard rule. Add the name to the list, in the order of the file.

   If the standard set has a problem, each test fails with `the standard set has problems:` and the diagnostics. Correct the YAML.

2. Add the rule to the test "applies to the types that its rule types for". If the rule must refuse a type, add a test such as "refuses a rule that types for another type: enum on an integer".
3. Examine the direction in `diff`. `argumentDirection` in `src/diff/classify.ts` finds it for a rule of the form `self op parameter` or `size(self) op parameter`. `enum` and `required` compare their lists. For each other rule, a new argument breaks both sides. If the keyword has a clear direction that the code does not find, add it, and add a case to `tests/diff.test.ts`.
4. Examine the SQL. `toSql` in `src/generate/postgres.ts` translates the rule to a `CHECK` constraint if it can. If it cannot, the schema names the rule in a comment, and the harness checks it. If the rule translates, add a case to `tests/postgres.test.ts`.

## Use the rule in the booking fixture

The booking fixture is the target of the redesign, and its coverage is `error`. Thus each rule that it applies needs a scenario that breaks it. It does not apply each standard rule at this time, but a new rule must have a real use in it.

1. Apply the rule to a definition in `tests/fixtures/booking/domain.manifest.yaml`.
2. Add a row that breaks it to `tests/fixtures/booking/features/seat.feature`, with the step `Then the value is rejected by "<rule>" of "<definition>"`.
3. Compile the fixture again:

   ```bash
   node bin/urn-forge.js compile --config tests/fixtures/booking/urn-forge.config.ts
   ```

4. Run `npm test` and `npm run typecheck` from the root folder.

## Look for a clash

A manifest rule cannot have the name of a standard rule (`standard-name`). A new name in lowercase, such as `const`, can thus stop a manifest that compiled before. Search the domains, the fixture, the starter and the contracts for a part with the new name. The search also finds definitions, which do not clash:

```bash
grep -rn "^  <name>:" --include=domain.manifest.yaml self templates tests
```

If a manifest has one, rename its rule in the same pull request.

## Update the docs

1. Add a row to the table "The standard rules" in [Rules and the standard rules](../docs/reference/manifest.md): the name, the types, the parameter, the rule and the message.
2. Run `npm run docs:build` from the root folder.

## Result

A manifest can apply the rule with no declaration. `compile` checks each argument, the generated check gives a failure with the name of the rule, and `diff` and the Postgres schema handle it.

## Related pages

- [How urn-forge is built](./architecture.md)
- [Change the rule language](./add-a-cel-form.md)
- [Rules and the standard rules](../docs/reference/manifest.md)
- [JSON Schema and CEL](../docs/methodology.md)
