# Gherkin steps

The module `urn-forge/cucumber` has generic Cucumber steps for all domains. The steps read the operation from the tags of the scenario. They read the field names and primitives from the generated `DispatchMap`. Gate 3 reads the same step texts.

## The steps

| Step text | Table | Passes if |
| --- | --- | --- |
| `the current <entity> is:` | Fields of the entity that the operation changes | The operation has `changes` on this entity. The record goes to `execute` as `{ current }` |
| `I run the operation with:` | Input fields | Always. It calls `execute` and keeps the result |
| `the output is:` | Output fields | The operation succeeded, and the output agrees with the table |
| `the input is rejected on "<field>"` | None | The result is `InputRejected`, with an issue on the property or inside it |
| `the input is rejected by "<invariant URN>"` | None | The invariant is an input invariant, and the result is `InputRejected` with an issue of it |
| `the operation fails with "<error URN>"` | None | The result is the declared error with this URN |
| `the operation fails with "<error URN>":` | Error fields | The same, and the error fields agree with the table |
| `the operation emits "<event URN>"` | None | The operation emits the event, and the result is a success with one or more events with this URN |
| `the operation emits "<event URN>":` | Event fields | The same, and one event with this URN agrees with the table |
| `the operation emits no event` | None | The result is a success with no events, or a `DomainError` |
| `the refusal is recorded as "<event URN>"` | None | The result is a `DomainError` whose `record` is this event |
| `the refusal is recorded as "<event URN>":` | Event fields | The same, and the record agrees with the table |

- `the current <entity> is:` is registered with `Given`, `I run the operation with:` with `When`, the others with `Then`. Cucumber also matches `Given`, `And` and `But`.
- A quoted value can use double or single quotes.
- `<field>` is a property of the input entity, not of an embedded entity.
- `<entity>` is the identifier of the entity in `changes`, for example `booking`. Each scenario of an operation with `changes` gives the record before the operation runs. Refer to [Declare states and moves](../how-to/declare-states).
- `<error URN>`, `<event URN>` and `<invariant URN>` are full URNs.
- An issue of an invariant is on its `reportOn` property, else on the first field of its rule. Use `the input is rejected by` to name the rule.
- `the operation emits` does not examine the count or the sequence of the events.

```gherkin
    Then the operation fails with "urn:acme:insurance:policy:error:refund_below_minimum":
      | refund |
      | 0.00   |
    And the operation emits no event
    And the refusal is recorded as "urn:acme:insurance:policy:event:refund_refused":
      | refund |
      | 0.00   |
```

## The operation tag

| Rule | Value |
| --- | --- |
| Form | `@urn:<namespace>:<domain>:<context>:operation:<identifier>` |
| Where | On the feature, the `Rule` block, the scenario or the `Examples` block |
| Number | Exactly one operation URN. The same URN two times counts one time |
| Other tags | Ignored, for example `@wip`, `@urn-forge:strict` or an entity URN |

The `Then` steps examine the last result of the scenario. A second `I run the operation with:` replaces the result.

## Tables

A step table has exactly two rows: a header row and one data row. Each header is a property name of the input, the output, the error or the event of the step.

### Cell conversion

A cell converts with the primitive of its field. A cell with no value puts no key in the object.

| Primitive | Cell | Value |
| --- | --- | --- |
| All | Empty | No value. The key is absent |
| `integer`, `float` | A number literal, for example `10`, `-9`, `.5`, `1e3`, `Infinity`, `NaN` | The number |
| `integer`, `float` | Other text, for example `1,000` | The text. The schema refuses it |
| `string`, `enum` | `""` | The empty string |
| `string`, `enum` | Other text | The text, with no change |
| `decimal`, `date`, `timestamp` | All text | The text, with no change. `12.50` stays `"12.50"` |
| `boolean` | `true` or `false` | The boolean |
| `boolean` | Other text | The text. The schema refuses it |

A link is a plain cell with the value of the key field of the linked entity. To put a `|` in a cell, write `\|`.

### List and object cells

| Form | Syntax | Example |
| --- | --- | --- |
| List, for a property with `many` | `[` and `]`, values separated by commas | `[fire, flood]`, `[]` |
| Object, for an embedded entity | `{` and `}`, pairs `name: value` separated by commas | `{ peril: fire, limit: 1000.00 }` |
| List of objects | A list of objects | `[{ peril: fire, limit: 1 }, { peril: flood, limit: 2 }]` |
| Bare value | Text up to the next `,`, `]` or `}`, with no spaces at the ends. No comma, bracket, brace or double quote | `fire`, `Smith Ada` |
| Quoted value | A JSON string literal | `"Smith, Ada"`, `"a \"quoted\" word"`, `""` |

- Each value converts with the primitive of its field. A quoted `"3"` for an `integer` is `3`.
- An object can leave out a property. It cannot give a property two times.
- A cell that does not start with the correct bracket stays text, and the schema refuses it.
- A malformed cell makes the step fail with a message that gives the column, for example `expected "," or "]" (at column <n> of the cell)`. Gate 3 reports it as `invalid-cell`.

### Formula cells

A cell that starts with `=` is a formula. A value inside a list or object cell can also be a formula.

| Form | Example | Value |
| --- | --- | --- |
| `repeat(n, "text")` | `=repeat(3, "ab")` | `ababab` |
| `repeat(n, value)`, for a list | `=repeat(2, fire)` | `[fire, fire]` |
| `a + b` | `="a@" + repeat(3, "b") + ".io"`, `=[fire] + repeat(2, flood)` | `a@bbb.io`, `[fire, flood, flood]` |
| A quoted text, a list or an object | `="=x"` | `=x` |

- `n` is from 0 to 10 000. A formula makes at most 1 000 000 characters or items.
- A formula cannot hold another formula.
- A text length counts code points.
- Gate 3 reads formulas in the same way.

### Comparison

`the output is:`, and the table forms of `fails with`, `emits` and `is recorded as`, compare only the columns of the table.

- An empty cell means that the property must be absent.
- Values must be equal by `===`. `NaN` equals `NaN`.
- Lists are equal if they have the same items in the same sequence.
- Embedded objects are equal if they have the same properties with equal values.
- A `decimal` is text. `12.5` is not equal to `12.50`.
- A message shortens a text of more than 60 characters and a list of more than 10 items.

## Failure messages

| Step | Condition | Message |
| --- | --- | --- |
| All `Then` steps | No operation has run | `no operation has run yet; start with "When I run the operation with:"` |
| Steps with a table | Not two rows | `expected a header row and exactly one data row, got <n> row(s)` |
| `I run the operation with:` | No operation tag | `no @urn:<namespace>:<domain>:<context>:operation:<identifier> tag on this scenario or its feature` |
| `I run the operation with:` | Two operation tags | `more than one operation tag on this scenario: <URN>, <URN>` |
| `I run the operation with:` | Not in `DispatchMap` | `<operation URN> is not an operation of this domain` |
| `I run the operation with:`, `the output is:`, `rejected on` | Unknown header or field | `"<header>" is not a field of the <input \| output> of <operation URN> (fields: <names>)` |
| `the output is:` | No success | `<operation URN> did not succeed: <failure>` |
| `the output is:` | Values differ | `<operation URN> output differs: <name>: expected <value>, got <value>; …` |
| `rejected on` | Success | `<operation URN> accepted the input; expected it to be rejected on "<field>"` |
| `rejected on` | Not `InputRejected` | `<operation URN> failed with <failure>; expected InputRejected on "<field>"` |
| `rejected on` | No issue on the property | `<operation URN> rejected the input, but not on "<field>": <failure>` |
| `rejected by` | Not an input invariant | `<invariant URN> is not an invariant of the input of <operation URN> (invariants: <invariant URNs>)` |
| `rejected by` | Success | `<operation URN> accepted the input; expected it to be rejected by <invariant URN>` |
| `rejected by` | Not `InputRejected` | `<operation URN> failed with <failure>; expected InputRejected by <invariant URN>` |
| `rejected by` | No issue of the invariant | `<operation URN> rejected the input, but not by <invariant URN>: <failure>` |
| `fails with` | Not declared | `<error URN> is not a declared error of <operation URN> (errors: <error URNs>)` |
| `fails with` | Success | `<operation URN> succeeded; expected it to fail with <error URN>` |
| `fails with` | Not a `DomainError` | `<operation URN> failed with <failure>; expected the declared error <error URN>` |
| `fails with` | Another error | `<operation URN> failed with <other error URN> (<message>); expected <error URN>` |
| `fails with`, `emits`, `is recorded as` | Fields differ | `<URN> fields differ: <name>: expected <value>, got <value>; …` |
| `fails with`, `emits`, `is recorded as` | Unknown header | `"<header>" is not a field of <URN> (fields: <names>)` |
| `emits` | Not in `emits` | `<event URN> is not an event of <operation URN> (emits: <event URNs>)` |
| `emits` | No success | `<operation URN> did not succeed: <failure>; expected it to emit <event URN>` |
| `emits` | No such event | `<operation URN> did not emit <event URN> (emitted: <event URNs>)` |
| `emits no event` | Not a success or a `DomainError` | `<operation URN> failed with <failure>; expected it to emit no event` |
| `emits no event` | Events | `<operation URN> emitted <event URNs>; expected no event` |
| `is recorded as` | Not a `recordAs` event | `<event URN> records no declared error of <operation URN> (records: <event URNs>)` |

An empty list in a message is `none`, or `nothing` for `emitted`.

| Result | `<failure>` |
| --- | --- |
| `DomainError` | `DomainError <error URN> (<message>)` |
| `InputRejected`, `ContractViolation`, `UnknownOperation` | `<kind> (<path>: <message>; …)`. An empty path is `(payload)` |

```
urn:demo:shipping:quote:operation:quote_shipping did not succeed: InputRejected (weight_grams: Invalid value: Expected >=1 but received 0)
```

## `registerOperationSteps`

```ts
function registerOperationSteps(options: OperationStepsOptions): void;

interface OperationStepsOptions {
  readonly dispatch: Readonly<Record<string, OperationContractLike>>;
  readonly execute: (urn: string, payload: unknown, options: { readonly current?: unknown }) => ExecuteResultLike;
}
```

| Option | Description |
| --- | --- |
| `dispatch` | The generated `DispatchMap` |
| `execute` | The function that runs an operation, usually `executeOperation` with your core. `options.current` is the record of `the current <entity> is:`. A domain with `changes` passes `options` on: `executeOperation(urn, payload, core, options)` |

Call it one time, in a support file that Cucumber loads. It registers one `Before` hook and the steps. The support file of tutorial 2:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/features/support/steps.ts

The option types are structural. The generated `DispatchMap` and `executeOperation` agree with them.

## Helpers

The module also exports the functions that the steps use. They do not need Cucumber. Each `assert…` function throws an `Error` with the failure message.

| Function | Signature |
| --- | --- |
| `operationUrnFromTags` | `(tags: readonly string[]) => string` |
| `coerceCell` | `(cell: string, field: PropertyInfoLike) => unknown` |
| `tableToObject` | `(rows: readonly (readonly string[])[], fields: FieldsLike, side, urn: string) => Record<string, unknown>` |
| `assertOutput` | `(result: ExecuteResultLike, expected: Record<string, unknown>, urn: string) => void` |
| `assertRejectedOn` | `(result: ExecuteResultLike, fieldName: string, fields: FieldsLike, urn: string) => void` |
| `assertRejectedBy` | `(result: ExecuteResultLike, invariantUrn: string, urn: string) => void` |
| `assertFailsWith` | `(result: ExecuteResultLike, errorUrn: string, urn: string, expected?: Record<string, unknown>) => void` |
| `assertEmits` | `(result: ExecuteResultLike, eventUrn: string, urn: string, expected?: Record<string, unknown>) => void` |
| `assertEmitsNone` | `(result: ExecuteResultLike, urn: string) => void` |

## Related pages

- [Write scenarios](../how-to/write-scenarios)
- [Generated code](./generated-code)
- [Verification gates](./verification-gates)
