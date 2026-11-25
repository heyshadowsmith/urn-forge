# Write scenarios

Scenarios are Gherkin `.feature` files. urn-forge gives the steps for any manifest, so you write only the features. Each step names an operation, an output, a definition or a rule, and gate 3 of `verify` reads the same names to find gaps.

## The steps

| Step | What it does |
| --- | --- |
| `When I run "<operation>" with:` | Makes the input from the table, and runs the operation through the harness |
| `When I check a "<definition>" with:` | Makes a value from the table, and checks it against the definition. `an` also works |
| `Then the output is "<object>"` | The operation answered this output |
| `Then the output is "<object>":` | The same, and the output has the values of the table. Only the properties in the table are compared |
| `Then the input is rejected by "<rule>" of "<definition>"` | The harness refused the input, with this rule of this definition |
| `Then the value is rejected by "<rule>" of "<definition>"` | The check refused the value, with this rule of this definition |
| `Then the value is accepted` | The check accepted the value |

`the output` and `the input` follow `When I run`; `the value` follows `When I check`. `<rule>` can also be `type` or `properties`, the rules of a value's structure.

## Run an operation

```gherkin
  Scenario: An express parcel over 5000 grams is refused
    When I run "quote_shipping" with:
      | weight_grams | zone     | express |
      | 5001         | domestic | true    |
    Then the output is "too_heavy_for_express":
      | weight_grams |
      | 5001         |
```

A table has a header row of properties and one row of values. A dotted header, such as `stored_booking.state`, is a property of an embedded object. An empty cell gives no value. Each cell is read by the type of its definition:

| Type | Cells |
| --- | --- |
| `string` | `domestic`; `""` for the empty string; a cell in double quotes is JSON: `"a, b"` |
| `integer`, `number` | `5001`, `-1`, `2.5` |
| `boolean` | `true`, `false` |
| `array` | JSON (`[{"course": "main", "amount": 1500}]`), or items between commas: `[Ada, Grace]`; `[]` is empty |
| `object` | JSON: `{"email": "ada@example.com"}` |

A cell that is not a value of its type is sent as text, so `abc` in an `integer` column fails the rule `type`.

## Break the rules of the input

A `Scenario Outline` breaks many rules in one place. From the starter:

<<< @/../packages/urn-forge/templates/starter/features/split.feature{19-32 gherkin}

The definition is the one that applies the rule: `minLength` is a rule of `person`, the item of the list `people`.

## Break a rule that no input reaches

The rules of an output's definition, such as the `required` rule of a refusal, apply only to answers. Check a value directly:

```gherkin
  Scenario: A refusal needs the weight
    When I check a "too_heavy_for_express" with:
      | weight_grams |
      |              |
    Then the value is rejected by "required" of "too_heavy_for_express"
```

## Cover the manifest, then test the edges

Gate 3 asks for a scenario that runs each operation, one that ends with each output, and one that breaks each rule that a definition applies. The rules of outputs and operations need none: the harness checks them on every answer. A gap is a warning until you set `coverage: 'error'` in `urn-forge.config.ts`.

Gate 3 does not ask for the values at a rule's edges, where a core is most often wrong. For a weight from 1 to 30000, send `1` and `30000`; for a limit of 5000 grams, send `5000`. [Part 4 of the tutorial](../tutorials/first-domain#test-the-edges) shows a bug that only an edge scenario catches.

## Run them

`npx cucumber-js` runs the scenarios through the harness and finds a wrong value; a failed step says what differs, such as `quote.price_cents is 601, not 600`. `npx urn-forge verify` reads them without a run and finds a missing scenario. CI runs both.

## The step file

`urn-forge init` writes `features/support/steps.ts`, which connects the steps to your generated file and your core. Call `registerSteps` once:

<<< @/../packages/urn-forge/templates/starter/features/support/steps.ts

Cucumber must load TypeScript first: the starter's `cucumber.json` imports `register-tsx.mjs` before the steps.
