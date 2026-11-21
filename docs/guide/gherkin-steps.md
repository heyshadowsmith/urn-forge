# Gherkin steps

urn-forge supplies five generic Cucumber steps. These steps operate for all domains. They read the necessary data from the tag of the feature and from the generated `DispatchMap`.

| Step | Function |
| --- | --- |
| `When I run the operation with:` | Makes a payload from the table and calls `executeOperation` |
| `Then the output is:` | Makes sure that the call is correct and that the output fields in the table agree |
| `Then the input is rejected on "<field>"` | Makes sure that the call returns `InputRejected` with an issue on that field |
| `Then the operation fails with "<error URN>"` | Makes sure that the call returns the declared error with this URN |
| `Then the operation fails with "<error URN>":` | The same, and the error fields in the table agree |

## The tag of a feature

Put the full URN of the operation in a tag. You can put the tag on the feature, on one scenario, on a `Rule` block or on an `Examples` block:

```gherkin
@urn:demo:math:arithmetic:operation:safe_divide
Feature: Safe division
```

Each scenario must have one operation tag, and only one. This count contains the tags that the scenario receives from its feature and its blocks. The steps ignore other tags, for example `@wip`.

## Tables

The two table steps use one header row of **field names** and one data row:

```gherkin
When I run the operation with:
  | dividend | divisor |
  | 10       | 2       |
Then the output is:
  | quotient |
  | 5        |
```

The steps use these rules:

- **Headers.** Each header must be a property name of the input entity (for `When`) or of the output entity (for `Then the output is`). An unknown header makes the step fail. Gate 3 also finds this error without a test run.
- **Cells.** The steps convert each cell with the primitive of its field before the parse:

  | Primitive | Cell | Value that the step sends |
  | --- | --- | --- |
  | `float`, `integer` | A number literal: `10`, `-9`, `0.5`, `1e3`, `Infinity`, `NaN` | The number |
  | `float`, `integer` | A different text, for example `abc` or `1,000` | The text. The schema then refuses it |
  | `string` | Any text | The same text |
  | `string` | `""` (two double quotes) | The empty string |
  | `boolean` | `true` or `false` | The boolean |
  | `boolean` | A different text, for example `yes` | The text. The schema then refuses it |
  | All | An empty cell | No value. The key is absent |

  An empty cell sends no key, and `""` sends the empty string. Use `""` to make a test for `minLength`. You cannot send the text `""` itself to a `string` field.

- **Output checks.** The step compares only the columns in the table. Other output fields do not make the step fail. The values must be equal. `NaN` is equal to `NaN`.

Scenario Outlines operate as usual. Cucumber puts the values in the `<placeholders>` before the step starts.

The table of `When I run the operation with:` must have a column for each mandatory input field. [Gate 3](./verify#gate-3-gherkin-traceability) makes sure of this. To make a test with a missing value, keep the column and leave the cell empty:

```gherkin
When I run the operation with:
  | context  | identifier |
  | geometry |            |
Then the input is rejected on "identifier"
```

## Scenarios at the boundary

The step `the input is rejected on "<field>"` passes only if the schema refused the input at the boundary. Also, one of the issues must be about that field:

```gherkin
Scenario: A zero divisor is rejected at the boundary
  When I run the operation with:
    | dividend | divisor |
    | 1        | 0       |
  Then the input is rejected on "divisor"
```

The step fails in these conditions:

- The operation is correct.
- The result is a `ContractViolation` or a `DomainError`.
- The issue is about a different field.

## Declared errors

The step `Then the operation fails with "<error URN>"` passes only if the handler refused with `fail(…)`, and the error has this URN. Give the full URN of the error:

```gherkin
Scenario: A kind from the spec that is not supported yet is refused
  When I run the operation with:
    | short_key           |
    | policy.event.placed |
  Then the operation fails with "urn:urn_forge:toolchain:naming:error:unsupported_kind":
    | short_key           | kind_segment |
    | policy.event.placed | event        |
```

If you put a colon and a table after the URN, the step also compares the error fields. The headers must be field names of the error. The step compares only the columns in the table.

The step fails in these conditions:

- The operation is correct.
- The result is `InputRejected` or a `ContractViolation`.
- The handler refused with a different error.
- A field in the table has a different value.
- The operation does not declare the error.

## Connect the steps

Register the steps one time in a support file. Give them your generated runtime and your core:

<<< @/../packages/urn-forge/example/features/support/steps.ts

`registerOperationSteps` takes these options:

| Option | Type | Function |
| --- | --- | --- |
| `dispatch` | The generated `DispatchMap` | The field names and primitives of each operation |
| `execute` | `(urn, payload) => ExecuteResult` | Normally `executeOperation` with your core |

Cucumber must register `tsx` before it loads support code in TypeScript. Put the register module first in the `import` list:

<<< @/../packages/urn-forge/cucumber.json

## Failure messages

Each failure message gives the operation and the difference:

```
urn:demo:math:arithmetic:operation:safe_divide output differs: quotient: expected 6, got 5
urn:demo:math:arithmetic:operation:safe_divide rejected the input, but not on "dividend": InputRejected (divisor: Invalid value: Expected !0 but received 0)
"denominator" is not a field of the input of urn:demo:math:arithmetic:operation:safe_divide (fields: dividend, divisor)
```
