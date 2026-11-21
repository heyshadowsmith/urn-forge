# Gherkin steps

urn-forge has five generic Cucumber steps. They operate for all domains. They read the operation from the tags of the scenario, and the field names and primitives from the generated `DispatchMap`. The module is `urn-forge/cucumber` (`src/gherkin/steps.ts`). For examples of scenarios, refer to [Write scenarios](../how-to/write-scenarios).

## The steps

The texts come from `src/gherkin/phrases.ts`. Gate 3 reads the same texts.

| Step text | Cucumber expression | Table | Function |
| --- | --- | --- | --- |
| `I run the operation with:` | `I run the operation with:` | Input fields | Makes a payload from the table and calls `execute`. It keeps the result for the steps after it |
| `the output is:` | `the output is:` | Output fields | Makes sure that the operation succeeded, and that the output agrees with the table |
| `the input is rejected on "<field>"` | `the input is rejected on {string}` | None | Makes sure that the result is `InputRejected`, with an issue on the field |
| `the operation fails with "<error URN>"` | `the operation fails with {string}` | None | Makes sure that the result is the declared error with this URN |
| `the operation fails with "<error URN>":` | `the operation fails with {string}:` | Error fields | The same, and the fields of the error agree with the table |

- The library registers the first step with `When` and the other steps with `Then`. Cucumber does not compare the keyword, so `Given`, `And` and `But` also match.
- `{string}` accepts text in double quotes or in single quotes. Gate 3 reads both forms of `the operation fails with`.
- The `<field>` is a property name of the input entity, for example `weight_grams`. The `<error URN>` is the full URN of the error.

## The operation tag

The steps find the operation in the tags of the scenario. These tags include the tags of the feature, of the `Rule` block, of the scenario and of the `Examples` block.

| Rule | Value |
| --- | --- |
| Form of the tag | `@urn:<namespace>:<domain>:<context>:operation:<identifier>` |
| Form of each segment | A lowercase letter, then lowercase letters, digits or `_` |
| Number of operation URNs | Exactly one. The same URN in two tags counts one time |
| Other tags | The steps ignore them, for example `@wip`, `@urn-forge:strict` or an entity URN |

The steps do not compare the tag with the manifest. If `DispatchMap` has no entry for the URN, the step `I run the operation with:` fails. Gate 3 finds the same problems without a test run. Refer to [Verification gates](./verification-gates).

## The state of a scenario

| Item | Behavior |
| --- | --- |
| Start of a scenario | A `Before` hook keeps the tags of the scenario. The state has no result |
| `I run the operation with:` | Finds the operation, calls `execute`, and keeps the URN and the result. The step itself does not fail on a failure result. A second run in the same scenario replaces the first result |
| The `Then` steps | Examine the last result. If no operation has run in the scenario, they fail |

## Tables

A step table has exactly two rows: a header row and one data row.

| Step | Each header must be |
| --- | --- |
| `I run the operation with:` | A property name of the input entity of the operation |
| `the output is:` | A property name of the output entity of the operation |
| `the operation fails with "<error URN>":` | A field name of the error. The step makes sure that the operation declares the error before it reads the table |

The step converts each cell with the primitive of its field, and puts the value in an object with the header as the key. A cell with no value puts no key in the object. A Scenario Outline operates as usual: Cucumber puts the `Examples` values in the `<placeholders>` before the step starts.

### Cell conversion

| Primitive | Cell | Value |
| --- | --- | --- |
| All | Empty | No value. The key is absent |
| `integer`, `float` | A number literal: an optional `+` or `-`, digits with an optional decimal part or a decimal part only, and an optional exponent. Examples: `10`, `-9`, `0.5`, `.5`, `+3`, `1e3`, `-0` | The number |
| `integer`, `float` | `Infinity`, `+Infinity`, `-Infinity` or `NaN` | The number |
| `integer`, `float` | Other text, for example `abc`, `1,000` or `0x10` | The text, without a change. The schema refuses it |
| `string` | `""` (two double quotes) | The empty string |
| `string` | Other text | The text, without a change. For example, `"a"` stays `"a"`, with the quotes |
| `boolean` | `true` or `false` | The boolean |
| `boolean` | Other text, for example `yes` or `True` | The text, without a change. The schema refuses it |

You cannot send the text `""` itself to a `string` field. Gate 3 converts the cells in the same way when it reads the values for boundary coverage.

### Comparison of the output and the error fields

The steps `the output is:` and `the operation fails with "<error URN>":` compare only the columns of the table:

- A property that is not in the table is not compared.
- An empty cell means that the property must be absent. If the property has a value, the step fails with `<name>: expected absent, got <value>`. To expect the empty string, write `""`.
- The values must be equal by `===`. Also, `NaN` is equal to `NaN`. Thus `0` and `-0` are equal.
- The step compares the parsed output or the parsed error fields. These values are the result of the schema parse.

## Failure messages

Each step fails with one of these messages. The messages are in the sequence in which the step examines the conditions.

### `I run the operation with:`

| Condition | Message |
| --- | --- |
| No operation tag | `no @urn:<namespace>:<domain>:<context>:operation:<identifier> tag on this scenario or its feature` |
| Two or more operation tags | `more than one operation tag on this scenario: <URN>, <URN>` |
| The URN is not in `DispatchMap` | `<operation URN> is not an operation of this domain` |
| The table does not have two rows | `expected a header row and exactly one data row, got <n> row(s)` |
| A header is not an input property | `"<header>" is not a field of the input of <operation URN> (fields: <names>)` |

### `the output is:`

| Condition | Message |
| --- | --- |
| No operation has run | `no operation has run yet; start with "When I run the operation with:"` |
| The table does not have two rows | `expected a header row and exactly one data row, got <n> row(s)` |
| A header is not an output property | `"<header>" is not a field of the output of <operation URN> (fields: <names>)` |
| The operation did not succeed | `<operation URN> did not succeed: <failure>` |
| One or more values are different | `<operation URN> output differs: <name>: expected <value>, got <value>; …`. An absent value shows as `absent` |

### `the input is rejected on "<field>"`

| Condition | Message |
| --- | --- |
| No operation has run | `no operation has run yet; start with "When I run the operation with:"` |
| The field is not an input property | `"<field>" is not a field of the input of <operation URN> (fields: <names>)` |
| The operation succeeded | `<operation URN> accepted the input; expected it to be rejected on "<field>"` |
| The result is not `InputRejected` | `<operation URN> failed with <failure>; expected InputRejected on "<field>"` |
| No issue has the URN of the field as its `fieldUrn` | `<operation URN> rejected the input, but not on "<field>": <failure>` |

### `the operation fails with "<error URN>"` and `the operation fails with "<error URN>":`

| Condition | Message |
| --- | --- |
| No operation has run | `no operation has run yet; start with "When I run the operation with:"` |
| The operation does not declare the error | `<error URN> is not a declared error of <operation URN> (errors: <error URNs>)`. If the operation declares no errors, the list is `none` |
| The table does not have two rows (form with `:` only) | `expected a header row and exactly one data row, got <n> row(s)` |
| A header is not a field of the error (form with `:` only) | `"<header>" is not a field of <error URN> (fields: <names>)` |
| The operation succeeded | `<operation URN> succeeded; expected it to fail with <error URN>` |
| The result is not a `DomainError` | `<operation URN> failed with <failure>; expected the declared error <error URN>` |
| The result is a different declared error | `<operation URN> failed with <other error URN> (<message>); expected <error URN>` |
| One or more fields are different (form with `:` only) | `<error URN> fields differ: <name>: expected <value>, got <value>; …` |

### The `<failure>` text

| Result | `<failure>` |
| --- | --- |
| `DomainError` | `DomainError <error URN> (<message of the error>)` |
| `InputRejected`, `ContractViolation` or `UnknownOperation` | `<kind> (<path>: <message>; <path>: <message>; …)`. An issue with an empty path shows `(payload)` as its path. With no issues, only `<kind>` |

### Examples

These messages come from a real Cucumber run on the domain of tutorial 2:

```
urn:demo:shipping:quote:operation:quote_shipping output differs: price_cents: expected 1, got 600
urn:demo:shipping:quote:operation:quote_shipping output differs: price_cents: expected absent, got 600
urn:demo:shipping:quote:operation:quote_shipping did not succeed: InputRejected (weight_grams: Invalid value: Expected >=1 but received 0)
"weight" is not a field of the input of urn:demo:shipping:quote:operation:quote_shipping (fields: weight_grams, zone, express)
expected a header row and exactly one data row, got 3 row(s)
urn:demo:shipping:quote:operation:quote_shipping accepted the input; expected it to be rejected on "weight_grams"
urn:demo:shipping:quote:operation:quote_shipping rejected the input, but not on "zone": InputRejected (weight_grams: Invalid value: Expected >=1 but received 0)
urn:demo:shipping:quote:operation:quote_shipping failed with DomainError urn:demo:shipping:quote:error:too_heavy_for_express (An express parcel can weigh 5000 grams at most, not 6000); expected InputRejected on "weight_grams"
urn:demo:shipping:quote:operation:quote_shipping succeeded; expected it to fail with urn:demo:shipping:quote:error:too_heavy_for_express
urn:demo:shipping:quote:operation:quote_shipping failed with InputRejected (weight_grams: Invalid value: Expected >=1 but received 0); expected the declared error urn:demo:shipping:quote:error:too_heavy_for_express
urn:demo:shipping:quote:error:other is not a declared error of urn:demo:shipping:quote:operation:quote_shipping (errors: urn:demo:shipping:quote:error:too_heavy_for_express)
urn:demo:shipping:quote:error:too_heavy_for_express fields differ: weight_grams: expected 6001, got 6000
"weight" is not a field of urn:demo:shipping:quote:error:too_heavy_for_express (fields: weight_grams)
no operation has run yet; start with "When I run the operation with:"
no @urn:<namespace>:<domain>:<context>:operation:<identifier> tag on this scenario or its feature
more than one operation tag on this scenario: urn:demo:shipping:quote:operation:quote_shipping, urn:demo:shipping:quote:operation:other
urn:demo:shipping:quote:operation:other is not an operation of this domain
```

## `registerOperationSteps`

```ts
function registerOperationSteps(options: OperationStepsOptions): void;

interface OperationStepsOptions {
  readonly dispatch: Readonly<Record<string, OperationContractLike>>;
  readonly execute: (urn: string, payload: unknown) => ExecuteResultLike;
}
```

| Option | Type | Description |
| --- | --- | --- |
| `dispatch` | `Readonly<Record<string, OperationContractLike>>` | The generated `DispatchMap`. The steps read the input, output and error fields of each operation from it |
| `execute` | `(urn: string, payload: unknown) => ExecuteResultLike` | The function that runs an operation. Usually `executeOperation` of the generated runtime, with your core |

The function registers one `Before` hook and the five steps. Call it one time, in a support file that Cucumber loads. If you call it two times, Cucumber finds two definitions for each step.

The support file of tutorial 2:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/features/support/steps.ts

The types of the options are structural. The generated `DispatchMap` and `executeOperation` of each domain agree with them:

| Type | Properties |
| --- | --- |
| `Primitive` | `'boolean'`, `'float'`, `'integer'` or `'string'` |
| `FieldInfoLike` | `urn: string`, `primitive: Primitive`, `required: boolean` |
| `FieldsLike` | `Readonly<Record<string, FieldInfoLike>>`, keyed by property name |
| `OperationContractLike` | `input: { fields: FieldsLike }`, `output: { fields: FieldsLike }`, `errors: Readonly<Record<string, { fields: FieldsLike }>>`, keyed by error URN |
| `BoundaryIssueLike` | `path: string`, `fieldUrn?: string`, `message: string` |
| `DomainErrorLike` | `urn: string`, `message: string`, `fields: unknown` |
| `ExecuteResultLike` | `{ ok: true; output: unknown }`, or `{ ok: false; kind: 'DomainError'; error: DomainErrorLike }`, or `{ ok: false; kind: string; issues: readonly BoundaryIssueLike[] }` |

## The pure helpers

The module also exports the functions that the steps use. They do not need Cucumber. Each `assert…` function returns nothing if the check passes, and throws an `Error` with the message from [Failure messages](#failure-messages) if it fails.

| Function | Signature | Description |
| --- | --- | --- |
| `operationUrnFromTags` | `(tags: readonly string[]) => string` | Returns the one operation URN in the tags. Throws if there is no operation tag or more than one |
| `coerceCell` | `(cell: string, field: FieldInfoLike) => unknown` | Converts one cell with the primitive of the field. Returns `undefined` for an empty cell |
| `tableToObject` | `(rows: readonly (readonly string[])[], fields: FieldsLike, side, urn: string) => Record<string, unknown>` | Converts a table of two rows to an object. Throws if the table does not have two rows, or if a header is not in `fields`. `side` is `'input'`, `'output'` or `'error'`. `side` and `urn` are for the message only |
| `assertOutput` | `(result: ExecuteResultLike, expected: Record<string, unknown>, urn: string) => void` | The check of `the output is:` |
| `assertRejectedOn` | `(result: ExecuteResultLike, fieldName: string, fields: FieldsLike, urn: string) => void` | The check of `the input is rejected on "<field>"` |
| `assertFailsWith` | `(result: ExecuteResultLike, errorUrn: string, urn: string, expected?: Record<string, unknown>) => void` | The check of `the operation fails with "<error URN>"`. With `expected`, it also compares the error fields. It does not examine whether the operation declares the error |

## Related pages

- [Write scenarios](../how-to/write-scenarios)
- [The generated runtime](./generated-runtime)
- [Verification gates](./verification-gates)
- [The traceability chain](../explanation/traceability)
