# Write scenarios

Write scenarios that run an operation with one input and check the result, with the generic steps of urn-forge and no step code.

## Before you start

- You have a Cucumber support file that calls `registerOperationSteps`. Refer to [Set up a project](set-up-a-project).

## Steps

1. Put `@` and the URN of the operation on the line above `Feature:`. Each scenario must have exactly one operation tag, from the feature or from itself.
2. Start each scenario with `When I run the operation with:` and a table of two rows: the property names, then the values.
3. Give the input table a column for each required input property. Leave a cell empty to send no value. Write `""` to send the empty string.
4. End the scenario with one `Then` step:

   | Step | Checks |
   | --- | --- |
   | `Then the output is:` | The output. A table gives the values to check |
   | `Then the input is rejected on "<field>"` | The shell rejected the input, with an issue on this input property or inside it |
   | `Then the input is rejected by "<invariant URN>"` | The shell rejected the input, because this invariant does not hold |
   | `Then the operation fails with "<error URN>"` | The handler returned this declared error. Add `:` and a table to check its fields |
   | `Then the operation emits "<event URN>"` | The operation succeeded and returned this event. Add `:` and a table to check its fields |
   | `Then the operation emits no event` | The operation returned no event |

5. To run one scenario with many inputs, write a Scenario Outline. Put `<name>` in the cells, and give the values in `Examples`. Each `Examples` header must fill a placeholder in a step, or name a field that a step checks: a field of the input, the output, or an error or event that the outline expects.
6. Run `npx cucumber-js`.

In the output, error and event tables, list only the values to check. An empty cell there means that the value must be absent. For the exact text of each step, refer to [Gherkin steps](../reference/gherkin-steps).

## Write a cell

The step converts each cell with the primitive of its field. `2500` is a number for an `integer`, and `12.50` stays the string `12.50` for a `decimal`. A link cell holds the value of the key of its target.

| Cell | Value |
| --- | --- |
| `[Ada, Grace, Alan]` | A list of three items, for a reference with `many` |
| `[]` | The empty list |
| `{ peril: fire, limit: 1000.00 }` | One object of an embedded entity |
| `[{ peril: fire, limit: 1 }, { peril: flood, limit: 2 }]` | A list of two objects |
| `["Smith, Ada", Grace]` | A value with a comma, a bracket, a brace or a double quote, in double quotes |

A cell that starts with `=` is a formula, for example `=repeat(201, "x")` for a text of 201 characters. If gate 3 cannot read a cell, it reports `invalid-cell` with the column in the cell.

## Example

The feature of `packages/urn-forge/tutorial/3-strict-coverage/` checks outputs, rejections at each boundary and a declared error:

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/features/quote_shipping.feature{gherkin}

## Result

`npx cucumber-js` runs each scenario:

```
..............................

10 scenarios (10 passed)
30 steps (30 passed)
0m 0.014s (0m 0.003s executing your code)
```

If a value is not correct, the step gives the difference:

```
Error: urn:demo:shipping:quote:operation:quote_shipping output differs: price_cents: expected 700, got 600
```

`npx urn-forge verify` checks the tags and the table headers at gate 3, without a run of the scenarios. To close the boundary gaps that it shows, refer to [Close boundary gaps](close-boundary-gaps).

## Related pages

- [Gherkin steps](../reference/gherkin-steps)
- [Tutorial: make the domain strict](../tutorials/strict-coverage)
- [Fix a gate that fails](fix-a-failing-gate)
