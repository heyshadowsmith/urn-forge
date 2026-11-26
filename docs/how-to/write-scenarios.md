# Scenarios

The agent writes the scenarios. Read this page to review them: the gates make sure that a scenario exists, but only you can say that its expected values are correct.

Scenarios are `.feature` files of plain sentences. urn-forge gives the steps for all manifests, so a project writes only the scenarios. Each step names an operation, an output, a definition or a rule. Gate 3 of `verify` reads the same names to find gaps.

## The steps

| Step | What it does |
| --- | --- |
| `When I run "<operation>" with:` | Makes the input from the table, and runs the operation through the harness |
| `When I check a "<definition>" with:` | Makes a value from the table, and checks it against the definition. You can also write `an` |
| `Then the output is "<object>"` | The operation answered this output |
| `Then the output is "<object>":` | The same, and the output has the values of the table. The step compares only the properties in the table |
| `Then the input is rejected by "<rule>" of "<definition>"` | The harness rejected the input, with this rule of this definition |
| `Then the value is rejected by "<rule>" of "<definition>"` | The check rejected the value, with this rule of this definition |
| `Then the value is accepted` | The check accepted the value |

`the output` and `the input` come after `When I run`. `the value` comes after `When I check`. `<rule>` can also be `type` or `properties`, which are the rules of the structure of a value.

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

A table has a header row of properties and one row of values. A header with a dot, such as `stored_booking.state`, is a property of an embedded object. An empty cell gives no value. The steps read each cell by the type of its definition:

| Type | Cells |
| --- | --- |
| `string` | `domestic`; `""` for the empty string; a cell in double quotes is JSON: `"a, b"` |
| `integer`, `number` | `5001`, `-1`, `2.5` |
| `boolean` | `true`, `false` |
| `array` | JSON (`[{"course": "main", "amount": 1500}]`), or items with commas between them: `[Ada, Grace]`; `[]` is empty |
| `object` | JSON: `{"email": "ada@example.com"}` |

If a cell is not a value of its type, the step sends it as text. For example, `abc` in an `integer` column breaks the rule `type`.

## Break the rules of the input

A `Scenario Outline` breaks many rules in one place. This is from the starter:

<<< @/../packages/urn-forge/templates/starter/features/split.feature{19-32 gherkin}

The definition in the step is the definition that applies the rule. For example, `minLength` is a rule of `person`, the item of the list `people`.

## Break a rule that no input reaches

The rules of the definition of an output apply only to answers. An example is the `required` rule of a refusal. To break such a rule, check a value directly:

```gherkin
  Scenario: A refusal needs the weight
    When I check a "too_heavy_for_express" with:
      | weight_grams |
      |              |
    Then the value is rejected by "required" of "too_heavy_for_express"
```

## Cover the manifest, then test the edges

Gate 3 asks for a scenario that runs each operation, and a scenario that ends with each output. It also asks for a scenario that breaks each rule that a definition applies. Scenarios for the rules of outputs and operations are not necessary, because the harness checks these rules on each answer. A gap is always an error.

Gate 3 does not ask for the values at the edges of a rule, where a core is wrong most frequently. For a weight from 1 to 30000, send `1` and `30000`. For a limit of 5000 grams, send `5000`. [Part 4 of the tutorial](../tutorials/first-domain#_4-test-the-edges) shows a bug that only a scenario at an edge finds.

## Run them

`npx cucumber-js` runs the scenarios through the harness, and finds a wrong value. A failed step tells what is different, such as `quote.price_cents is 601, not 600`. `npx urn-forge verify` reads the scenarios but does not run them, and finds a scenario that is not there. CI runs the two commands.

## The step file

`urn-forge init` writes `features/support/steps.ts`, which connects the steps to your generated file and your core. Call `registerSteps` one time:

<<< @/../packages/urn-forge/templates/starter/features/support/steps.ts

`npx cucumber-js` must load TypeScript first. For this reason, the `cucumber.json` of the starter imports `register-tsx.mjs` before the steps.
