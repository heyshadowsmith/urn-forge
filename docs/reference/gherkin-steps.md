# Gherkin steps

urn-forge gives the Cucumber steps of every domain. The steps read the definitions and the operations from the generated file, so they work for any manifest. You write only the `.feature` files.

## Register the steps

In `features/support/steps.ts`:

<<< @/../packages/urn-forge/templates/starter/features/support/steps.ts

`registerSteps` comes from `urn-forge/cucumber`. Its options:

| Option | Value |
| --- | --- |
| `Definitions` | The generated `Definitions` |
| `Operations` | The generated `Operations` |
| `check` | The generated `check` |
| `run` | A function from an operation and an input to a result. Use `runOperation` with your core |

Call `registerSteps` one time.

## The steps

| Step | What it does |
| --- | --- |
| `When I run "<operation>" with:` | Makes the input of the operation from the table, and runs it through `run` |
| `When I check a "<definition>" with:` | Makes a value of the definition from the table, and checks it with `check`. `an` is also correct: `When I check an "invalid_state" with:` |
| `Then the output is "<object>"` | The operation answered with this output |
| `Then the output is "<object>":` | The operation answered with this output, and the output has the values of the table |
| `Then the input is rejected by "<rule>" of "<definition>"` | The harness refused the input before the core ran, and one failure has this rule and this definition |
| `Then the value is rejected by "<rule>" of "<definition>"` | The check refused the value, and one failure has this rule and this definition |
| `Then the value is accepted` | The check accepted the value |

A `Then` step reads the result of the last `When` step of its scenario. `Then the output is …` and `Then the input is rejected …` need `When I run`. `Then the value is …` needs `When I check`.

`<rule>` can also be `type` or `properties`, the rules of the structure of a value.

## Tables

A table has a header row and one row of values.

- The header names the properties of the input, the value or the output.
- A path with a dot names a property of an embedded object, for example `stored_booking.state`.
- An empty cell gives no value: the property is absent.
- `Then the output is "<object>":` compares only the properties of its table. It compares lists and objects by value. It compares a time as text.

## Cells

The step reads each cell by the type of its definition:

| Type | Cell | Value |
| --- | --- | --- |
| `string` | `domestic` | `"domestic"` |
| `string` | `""` | The empty string |
| `string` | `"a, b"` | A cell in double quotes is read as JSON: `"a, b"` |
| `integer`, `number` | `5001`, `-1`, `2.5` | The number |
| `boolean` | `true`, `false` | The boolean |
| `array` | `[1, 2]`, `[{"course": "main", "amount": 1500}]` | JSON |
| `array` | `[Ada, Grace, Alan]` | The items between commas, each read by the type of the item |
| `array` | `[]` | An empty list |
| `object` | `{"email": "ada@example.com"}` | JSON |

A cell that is not a value of its type is given as text, so that the check reports it. For example, `abc` in an `integer` column gives a failure of the rule `type`.

## Errors of a step

| Message | Cause |
| --- | --- |
| `<name> is not an operation; the operations are …` | The operation is not in the manifest |
| `<name> is not a definition` | The definition is not in the manifest |
| `<path> is not a property of <definition>` | A column of the table names a property that is not there |
| `the table must have a header row and one row of values; it has <n> rows` | The table has the wrong number of rows |
| `<operation> did not answer: <kind>: …` | The harness gave `InputRejected` or `ContractViolation` where the step expected an output |
| `<operation> answered <output>, not <object>` | The core gave another output |
| `<object>.<property> is <actual>, not <expected>` | A value of the output is different |
| `<operation> accepted the input; expected it to break <rule> of <definition>` | The input broke no rule |
| `the input does not break <rule> of <definition>; it breaks …` | The input broke other rules |
| `run an operation first: When I run "<operation>" with:` | A `Then` step for an operation has no `When I run` before it |

For example, a core that breaks the rule `fits_express` gives:

```
Error: quote_shipping did not answer: ContractViolation: fits_express of quote_shipping: An express parcel can weigh 5000 grams at most
```

## Coverage

Gate 3 of `verify` reads the same steps, and asks for a scenario for each operation, each output and each rule of a definition. Refer to [Verification gates](./verification-gates).

## Related pages

- [Write scenarios](../how-to/write-scenarios)
- [Verification gates](./verification-gates)
- [The generated code](./generated-code)
