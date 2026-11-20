# Gherkin steps

urn-forge ships three generic Cucumber steps. They work for any domain, because they read everything they need from the feature's tag and the generated `DispatchMap`.

| Step | Does |
| --- | --- |
| `When I run the operation with:` | Builds a payload from the table and calls `executeOperation` |
| `Then the output is:` | Checks the call succeeded and the listed output fields match |
| `Then the input is rejected on "<field>"` | Checks the call returned `InputRejected` with an issue on that field |

## Tagging a feature

Tag the feature (or a single scenario, a `Rule` or an `Examples` block) with the operation's full URN:

```gherkin
@urn:demo:math:arithmetic:operation:safe_divide
Feature: Safe division
```

A scenario must end up with exactly one operation tag, counting the tags it inherits. Other tags, such as `@wip`, are ignored.

## Tables

Both table steps take a header row of **field names** and exactly one data row:

```gherkin
When I run the operation with:
  | dividend | divisor |
  | 10       | 2       |
Then the output is:
  | quotient |
  | 5        |
```

- **Headers** must be property names of the operation's input entity (for `When`) or output entity (for `Then the output is`). Anything else fails the step, and gate 3 catches it without running anything.
- **Cells** are converted by the field's primitive before parsing:

| Primitive | Cell | Value sent |
| --- | --- | --- |
| `float`, `integer` | A number literal: `10`, `-9`, `0.5`, `1e3`, `Infinity`, `NaN` | The number |
| `float`, `integer` | Anything else, such as `abc` or `1,000` | The string, for the schema to reject |
| `string` | Anything | The text as written |
| any | An empty cell | Nothing: the key is absent |

- **Output checks** compare only the columns you list, so extra output fields don't fail the step. Values must match exactly; `NaN` matches `NaN`.

Scenario Outlines work as usual, since Cucumber substitutes `<placeholders>` before the step runs.

## Boundary scenarios

`the input is rejected on "<field>"` passes only if the input was rejected *at the boundary*, by schema validation, and one of the issues names that field:

```gherkin
Scenario: A zero divisor is rejected at the boundary
  When I run the operation with:
    | dividend | divisor |
    | 1        | 0       |
  Then the input is rejected on "divisor"
```

It fails if the operation succeeded, if the failure was a `ContractViolation`, or if the rejection was about a different field.

## Wiring it up

Register the steps once, in a support file, with your generated runtime and core:

<<< @/../packages/urn-forge/example/features/support/steps.ts

`registerOperationSteps` takes:

| Option | Type | Purpose |
| --- | --- | --- |
| `dispatch` | the generated `DispatchMap` | Field names and primitives per operation |
| `execute` | `(urn, payload) => ExecuteResult` | Usually `executeOperation` bound to your core |

Cucumber needs `tsx` registered before it loads TypeScript support code. List the register module first under `import`:

<<< @/../packages/urn-forge/cucumber.json

## Failure messages

Each failure names the operation and says what differed:

```
urn:demo:math:arithmetic:operation:safe_divide output differs: quotient: expected 6, got 5
urn:demo:math:arithmetic:operation:safe_divide rejected the input, but not on "dividend": InputRejected (divisor: Invalid value: Expected !0 but received 0)
"denominator" is not a field of the input of urn:demo:math:arithmetic:operation:safe_divide (fields: dividend, divisor)
```
