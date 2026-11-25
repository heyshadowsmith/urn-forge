# Gherkin steps

urn-forge gives the Cucumber steps for any manifest. They read the definitions and the operations from the generated file. `urn-forge init` writes the file that registers them, `features/support/steps.ts`:

<<< @/../packages/urn-forge/templates/starter/features/support/steps.ts

`registerSteps` takes the generated `Definitions`, `Operations` and `check`, and a `run` function that calls `runOperation` with your core. Call it once. Cucumber must load TypeScript first: the starter's `cucumber.json` imports `register-tsx.mjs` before the steps.

## The steps

| Step | What it does |
| --- | --- |
| `When I run "<operation>" with:` | Makes the input from the table, and runs the operation through `run` |
| `When I check a "<definition>" with:` | Makes a value from the table, and checks it with `check`. `an` also works |
| `Then the output is "<object>"` | The operation answered this output |
| `Then the output is "<object>":` | The same, and the output has the values of the table |
| `Then the input is rejected by "<rule>" of "<definition>"` | The harness refused the input, with a failure of this rule of this definition |
| `Then the value is rejected by "<rule>" of "<definition>"` | The check refused the value, with a failure of this rule of this definition |
| `Then the value is accepted` | The check accepted the value |

A `Then` step reads the last `When` of its scenario: `the output` and `the input` need `When I run`, `the value` needs `When I check`. `<rule>` can also be `type` or `properties`, the rules of a value's structure.

## Tables

A table has a header row and one row of values. A header is a property; a dotted header, such as `stored_booking.state`, is a property of an embedded object. An empty cell gives no value. `Then the output is "<object>":` compares only the properties of its table, lists and objects by value.

Each cell is read by the type of its definition:

| Type | Cells |
| --- | --- |
| `string` | `domestic`; `""` for the empty string; a cell in double quotes is JSON: `"a, b"` |
| `integer`, `number` | `5001`, `-1`, `2.5` |
| `boolean` | `true`, `false` |
| `array` | JSON (`[1, 2]`, `[{"course": "main", "amount": 1500}]`), or items between commas: `[Ada, Grace]`; `[]` is empty |
| `object` | JSON: `{"email": "ada@example.com"}` |

A cell that is not a value of its type is sent as text, so the check reports it: `abc` in an `integer` column fails the rule `type`.

## When a step fails

The message says what differs. The most common:

| Message | Cause |
| --- | --- |
| `<operation> did not answer: <kind>: …` | The harness gave `InputRejected` or `ContractViolation` where an output was expected |
| `<operation> answered <output>, not <object>` | The core gave another output |
| `<object>.<property> is <actual>, not <expected>` | A value of the output differs |
| `<operation> accepted the input; expected it to break <rule> of <definition>` | The input broke no rule |
| `the input does not break <rule> of <definition>; it breaks …` | The input broke other rules |
| `<path> is not a property of <definition>` | A header names a property that does not exist |

For example, a core that breaks the rule `fits_express`:

```
Error: quote_shipping did not answer: ContractViolation: fits_express of quote_shipping: An express parcel can weigh 5000 grams at most
```

Gate 3 of `verify` reads the same steps to find the operations, outputs and rules that no scenario covers. Refer to [the gates](./cli#verify-and-the-gates).
