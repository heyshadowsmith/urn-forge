# Write scenarios

A scenario runs one operation with one input and checks the result. urn-forge gives six generic steps, so you do not write step code. This guide writes scenarios for outputs, rejections, broken invariants and declared errors.

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

## 2. Use the six steps

| Step | Use |
| --- | --- |
| `When I run the operation with:` | Runs the operation. A table gives the input |
| `Then the output is:` | Checks the output. A table gives the expected values |
| `Then the input is rejected on "<field>"` | Checks that the shell rejected the input, with an issue on the named input property or inside it |
| `Then the input is rejected by "<invariant URN>"` | Checks that the shell rejected the input because this invariant of the input entity does not hold |
| `Then the operation fails with "<error URN>"` | Checks that the handler returned this declared error |
| `Then the operation fails with "<error URN>":` | The same, and a table gives the expected fields of the error |

Start each scenario with `When I run the operation with:`, then add one `Then` step. For the exact text and the failure messages, refer to [Gherkin steps](../reference/gherkin-steps).

## 3. Write the tables

Each table has two rows: a header row and one data row.

- The header row has property names: properties of the input, the output or the error.
- The input table must have a column for each required input property. If not, gate 3 fails with `missing-column`.
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

A link holds the value of the key of its target. Thus, a link cell is a plain cell of the primitive of the key. For example, the `holder` cell of a policy is a customer identifier, `9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d`.

### Write a list in a cell

If the field reference has `many`, the cell is a list. Write the items in square brackets, with a comma between them:

| Cell | Value |
| --- | --- |
| `[Ada, Grace, Alan]` | A list of three items |
| `[]` | The empty list |
| `[Ada, ""]` | A list of two items. The second item is the empty string |

- The step reads each item as a cell of the primitive of the field. For example, `[1, 2]` is a list of two numbers for an `integer` field.
- An item that has a comma, a bracket, a brace or a double quote must be in quotes. Refer to [Quote a value](#quote-a-value).
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

### Write an embedded entity in a cell

If the property holds an embedded entity, write the object in braces. Give each property as `name: value`, with a comma between them:

| Cell | Value |
| --- | --- |
| `{ peril: fire, limit: 1000.00 }` | One object of the embedded entity |
| `[{ peril: fire, limit: 1 }, { peril: flood, limit: 2 }]` | A list of two objects, if the reference has `many` |
| `[]` | The empty list |

- The step reads each value with the primitive of its field. In the examples, `limit` is a `decimal`, so `1000.00` stays exact.
- Each name must be a property of the embedded entity. An object can hold a list or a different object, as deep as the entity goes.
- Leave out an optional property to send no value.
- In the output table and the error table, the step compares the objects property by property. A property that the cell leaves out must be absent.

The insurance feature sends lists of coverages (highlighted). Lines 13 to 18 also expect each list in the output:

<<< @/../packages/urn-forge/insurance/features/issue_policy.feature{13-18,60-67 gherkin}

### Quote a value

Inside `[ … ]` and `{ … }`, a bare value ends at the next comma, bracket or brace. If a value holds one of these characters, or a double quote, write it in double quotes. The quoted value is a JSON string literal:

| Cell | Value |
| --- | --- |
| `["Smith, Ada", Grace]` | A list of two items. The first item is `Smith, Ada` |
| `{ note: "x{y} [z]" }` | An object whose `note` is `x{y} [z]` |
| `["a \"quoted\" word"]` | A list of one item, `a "quoted" word` |

- The step reads a quoted value with the primitive of its field too. For example, `"12"` in an `integer` list is the number `12`.
- A plain cell outside brackets does not change. Do not quote a value there.
- A `|` must be `\|` in each cell, as Gherkin requires.

Line 16 of the insurance feature sends a note that holds a comma and braces: `note: "Basement excluded, see {clause 4}"`.

### Fix a malformed cell

If the step cannot read a list or an object, the step fails and gives the column in the cell. Here the note of line 16 has no quotes:

```
Error: expected ":" after "see" (at column 91 of the cell)
```

Gate 3 reports the same problem as `invalid-cell`, at the header of the column. The message also shows the cell:

```
gate 3  gherkin       FAIL  2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 4/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features/issue_policy.feature:7:145  error  invalid-cell  coverages: expected ":" after "see" (at column 91 of the cell): [{ peril: flood, limit: 500 }, { peril: theft, limit: 250.5, note: Basement excluded, see {clause 4} }]
```

A name that is not a property of the embedded entity also gives `invalid-cell`. The message lists the correct names:

```
    insurance/features/issue_policy.feature:71:128  error  invalid-cell  coverages: "limits" is not a property of urn:acme:insurance:policy:entity:coverage (properties: peril, limit, note, remark) (at column 17 of the cell): [{ peril: fire, limits: 0 }]
```

To fix the cell, do these steps:

1. Find the column in the cell that the message gives.
2. Put quotes around a value that holds a comma, a bracket, a brace or a double quote.
3. Close each `[` with `]` and each `{` with `}`.
4. Use a name from the `properties` list.

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
- A list of objects with a repeated key.

The step passes only if the result is `InputRejected` with an issue on that property. An issue inside the property also counts. For example, `Then the input is rejected on "coverages"` passes for an issue at `coverages.0.limit`. The outline in step 3 uses this for each broken rule of the list. When the step fails, it shows each issue with its path:

```
Error: urn:acme:insurance:policy:operation:issue_policy rejected the input, but not on "premium": InputRejected (coverages.0.limit: Invalid decimal: Expected at most 2 digit(s) after the point)
```

Name a property of the input entity, not a nested name. `Then the input is rejected on "limit"` fails:

```
Error: "limit" is not a field of the input of urn:acme:insurance:policy:operation:issue_policy (fields: policy_id, holder, coverages, effective_date, expiry_date, premium, deductible)
```

For a field with constraints, test each boundary value. Gate 3 shows the values that no scenario sends. Refer to [Adopt strict coverage](adopt-strict-coverage).

## 8. Check a broken invariant

Use `Then the input is rejected by "<invariant URN>"` for an input that breaks an invariant of the input entity. For example, `packages/urn-forge/insurance/features/issue_policy.feature` sends a policy that ends before it starts, and expects `Then the input is rejected by "urn:acme:insurance:policy:invariant:term_is_positive"`.

- The step passes only if the result is `InputRejected` with an issue that carries this invariant URN.
- The invariant must be on the input entity of the operation, or on an entity that the input embeds. If not, gate 3 fails with `undeclared-invariant`.
- An invariant of an embedded entity runs inside each object. For example, the insurance feature sends `[{ peril: fire, limit: 0 }]` and expects `limit_is_positive`.
- Send correct values for the other fields. Then only the invariant refuses the input.

`Then the input is rejected on "<field>"` also passes for a broken invariant, because the issue is on the first field of the rule. But gate 3 counts only the `rejected by` step as a scenario that breaks the invariant. Refer to [Add an invariant](add-an-invariant).

## 9. Check a declared error

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
