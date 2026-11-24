# Write scenarios

Write Gherkin scenarios that run your operations through the harness, and that break the rules of your definitions. urn-forge gives the steps. You write only the `.feature` files.

## Before you start

- `features/support/steps.ts` calls `registerSteps`. Refer to [Set up a project](set-up-a-project).

## Run an operation

1. Start the scenario with `When I run "<operation>" with:` and a table.
2. In the header row, write the names of the properties of the input. For a property of an embedded object, write a path with a dot, for example `stored_booking.state`.
3. In the second row, write the values. An empty cell sends no value.
4. End the scenario with `Then the output is "<object>"`. To also compare values, add a colon and a table: `Then the output is "<object>":`.

```gherkin
  Scenario: An express parcel over 5000 grams is refused
    When I run "quote_shipping" with:
      | weight_grams | zone     | express |
      | 5001         | domestic | true    |
    Then the output is "too_heavy_for_express":
      | weight_grams |
      | 5001         |
```

The table of the output compares only the properties that it names. A table has a header row and one row of values.

## Break a rule of the input

End the scenario with `Then the input is rejected by "<rule>" of "<definition>"`. The step passes if the harness refused the input before the core ran, and one failure has that rule and that definition.

Use a `Scenario Outline` to break many rules in one scenario:

<<< @/../packages/urn-forge/templates/starter/features/split.feature{19-32 gherkin}

The `<definition>` is the definition that applies the rule. In the example, `minLength` is a rule of `person`, the item of the list `people`.

## Break a rule that no input reaches

Some rules apply only to an output, for example the `required` rule of a refusal. Check a value of the definition, without the core:

```gherkin
  Scenario: A refusal needs the weight
    When I check a "too_heavy_for_express" with:
      | weight_grams |
      |              |
    Then the value is rejected by "required" of "too_heavy_for_express"
```

To show that a value is valid, end with `Then the value is accepted`.

## Write the cells

The step reads each cell by the type of the property:

| Type | Write | Example |
| --- | --- | --- |
| `string` | The text. For an empty string, write `""`. A cell in double quotes is read as JSON | `domestic` |
| `integer`, `number` | The number | `5001` |
| `boolean` | `true` or `false` | `true` |
| `array` | JSON, or the items between commas in brackets | `[Ada, Grace]`, `[1, 2]`, `[{"course": "main", "amount": 1500}]` |
| `object` | JSON, or one column for each property with a dot path | `{"email": "ada@example.com"}` |

A cell that is not a value of its type goes to the harness as text, so the harness reports the failure.

## Cover the manifest

Gate 3 of `verify` reads your features. It asks for:

- a scenario that runs each operation;
- a scenario that ends with each output of each operation;
- a scenario that breaks each rule that each definition applies.

The rules of an output or of an operation need no scenario that breaks them. The harness checks them on each answer of each scenario that runs the operation.

Gate 3 does not ask for the values at the edges of a rule. Add them yourself, for example the weights `1` and `30000` for a weight from 1 to 30000. [Tutorial 3](../tutorials/strict-coverage) shows why.

## Result

`npx cucumber-js` runs the scenarios, and `npx urn-forge verify` shows the coverage on the line of gate 3:

```
gate 3  gherkin       PASS  1 feature(s), 15 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
```

## Related pages

- [Gherkin steps](../reference/gherkin-steps)
- [Verification gates](../reference/verification-gates)
- [Tutorial: make the domain strict](../tutorials/strict-coverage)
