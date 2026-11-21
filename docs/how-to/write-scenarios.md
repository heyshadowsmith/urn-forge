# Write scenarios

A scenario runs one operation with one input and checks the result. urn-forge gives five generic steps, so you do not write step code. This guide writes scenarios for outputs, rejections and declared errors.

## Before you start

- You have a Cucumber support file that calls `registerOperationSteps`. Refer to [Set up a project](set-up-a-project).
- You have the URN of the operation. Refer to [URNs and names](../reference/naming).

## 1. Tag the feature

Put the URN of the operation, with `@`, on the line above `Feature:`. All scenarios of the feature then run that operation.

```gherkin
@urn:demo:shipping:quote:operation:quote_shipping
Feature: Shipping quotes
```

- A tag on a scenario also works. Use it if one feature tests more than one operation.
- A scenario must have exactly one operation tag, from the feature or from itself.
- Each `@urn:…` tag must name an atom of the manifest. Gate 3 checks this.

## 2. Use the five steps

| Step | Use |
| --- | --- |
| `When I run the operation with:` | Runs the operation. A table gives the input |
| `Then the output is:` | Checks the output. A table gives the expected values |
| `Then the input is rejected on "<field>"` | Checks that the shell rejected the input, with an issue on the named input field |
| `Then the operation fails with "<error URN>"` | Checks that the handler returned this declared error |
| `Then the operation fails with "<error URN>":` | The same, and a table gives the expected fields of the error |

Start each scenario with `When I run the operation with:`, then add one `Then` step. For the exact text and the failure messages, refer to [Gherkin steps](../reference/gherkin-steps).

## 3. Write the tables

Each table has two rows: a header row and one data row.

- The header row has property names: fields of the input, the output or the error.
- The input table must have a column for each required input field. If not, gate 3 fails with `missing-column`.
- In the output table and the error table, list only the values that you want to check. Other values are not checked. An empty cell in these tables means that the value must be absent.

The step converts each cell with the primitive of its field:

| Primitive | Cell | Value |
| --- | --- | --- |
| `integer`, `float` | `2500` | The number `2500` |
| `boolean` | `true`, `false` | The boolean |
| `string`, `enum` | `domestic` | The string `domestic` |
| `string`, `enum` | `""` | The empty string |
| `decimal` | `12.50` | The string `12.50`, unchanged, so that the digits stay exact |
| `date` | `2026-03-01` | The string `2026-03-01` |
| `timestamp` | `2026-03-01T09:30:00Z` | The string `2026-03-01T09:30:00Z` |
| Any | Empty cell | No value. In the input table, the step does not send the property. In the output and error tables, the property must be absent |

A cell that the primitive cannot read stays a string. Then the schema rejects it.

### Write a list in a cell

If the field reference has `many`, the cell is a list. Write the items in square brackets, with a comma between them:

| Cell | Value |
| --- | --- |
| `[Ada, Grace, Alan]` | A list of three items |
| `[]` | The empty list |
| `[Ada, ""]` | A list of two items. The second item is the empty string |

- The step reads each item as a cell of the primitive of the field. For example, `[1, 2]` is a list of two numbers for an `integer` field.
- An item cannot contain a comma.
- A cell without the brackets is not a list, so the schema rejects it.
- In the output table and the error table, the step compares the two lists item by item.

The starter project of `urn-forge init` sends lists of names:

```gherkin
    Examples:
      | people                            |
      | []                                |
      | [A, B, C, D, E, F, G, H, I, J, K] |
      | [Ada, Ada]                        |
      | [Ada, ""]                         |
```

Gate 3 counts each item as a value of the field. It also asks for the item counts of `minItems` and `maxItems`, and a repeated value for `unique`. Refer to [Add an entity](add-an-entity).

## 4. Use a Scenario Outline for many inputs

To run one scenario with many inputs, write a Scenario Outline. Put `<name>` in the cells, and give the values in `Examples`:

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/features/quote_shipping.feature{gherkin}

The headers of `Examples` must also be fields of the input or the output of the operation.

## 5. Send an absent value or an empty string

These two cases are different:

- **An empty cell** sends no property. Use it to test an optional field that is not there, or a required field that is not there. In the outline above, the second example leaves `express` empty.
- **`""`** sends the empty string. Use it to test a `string` field with `minLength`.

This feature sends `""` to a field with `minLength: 1`, and the shell rejects it:

<<< @/../packages/urn-forge/self/features/parse_short_key.feature{gherkin}

To test a required field that is not there, keep its column and leave the cell empty:

```gherkin
  Scenario: A parcel without a zone is rejected at the boundary
    When I run the operation with:
      | weight_grams | zone |
      | 800          |      |
    Then the input is rejected on "zone"
```

## 6. Check an expected output

Use `Then the output is:` with the output values. A number must be equal. For example, the outline in step 4 expects `price_cents` to be `600` for an 800-gram domestic parcel.

## 7. Check a rejection

Use `Then the input is rejected on "<field>"` for a value that the schema refuses. For example:

- A value out of range.
- A value that is not in the `values` of an `enum`.
- A list with too many items.
- An absent required field.

The step passes only if the result is `InputRejected` with an issue on that field.

For a field with constraints, test each boundary value. Gate 3 shows the values that no scenario sends. Refer to [Adopt strict coverage](adopt-strict-coverage).

## 8. Check a declared error

Use `Then the operation fails with "<error URN>"`. To check the fields too, end the step with a colon and add a table. The error must be one that the operation lists. Refer to [Declare an error](declare-an-error).

## Result

1. Run the scenarios. For the feature in step 4, the urn-forge package has the profile `tutorial-3`:

   ```bash
   npx cucumber-js --profile tutorial-3
   ```

   ```
   ..............................

   10 scenarios (10 passed)
   30 steps (30 passed)
   0m 0.014s (0m 0.003s executing your code)
   ```

   In your project, run `npx cucumber-js`.

2. If a value is not correct, the step gives the difference:

   ```
   Error: urn:demo:shipping:quote:operation:quote_shipping output differs: price_cents: expected 700, got 600
   ```

3. Run `npx urn-forge verify`. Gate 3 checks the tags and the table headers without a run of the scenarios.

## Related pages

- [Gherkin steps](../reference/gherkin-steps)
- [Verification gates](../reference/verification-gates)
- [Adopt strict coverage](adopt-strict-coverage)
- [Waive a boundary](waive-a-boundary)
- [The traceability chain](../explanation/traceability)
