# Gherkin steps

urn-forge has nine generic Cucumber steps. They operate for all domains. They read the operation from the tags of the scenario, and the field names and primitives from the generated `DispatchMap`. The module is `urn-forge/cucumber` (`src/gherkin/steps.ts`). For examples of scenarios, refer to [Write scenarios](../how-to/write-scenarios).

## The steps

The texts come from `src/gherkin/phrases.ts`. Gate 3 reads the same texts.

| Step text | Cucumber expression | Table | Function |
| --- | --- | --- | --- |
| `I run the operation with:` | `I run the operation with:` | Input fields | Makes a payload from the table and calls `execute`. It keeps the result for the steps after it |
| `the output is:` | `the output is:` | Output fields | Makes sure that the operation succeeded, and that the output agrees with the table |
| `the input is rejected on "<field>"` | `the input is rejected on {string}` | None | Makes sure that the result is `InputRejected`, with an issue on the property or inside it |
| `the input is rejected by "<invariant URN>"` | `the input is rejected by {string}` | None | Makes sure that the invariant is on the input entity of the operation or on an entity that it embeds, and that the result is `InputRejected`, with an issue of the invariant |
| `the operation fails with "<error URN>"` | `the operation fails with {string}` | None | Makes sure that the result is the declared error with this URN |
| `the operation fails with "<error URN>":` | `the operation fails with {string}:` | Error fields | The same, and the fields of the error agree with the table |
| `the operation emits "<event URN>"` | `the operation emits {string}` | None | Makes sure that the operation emits the event, and that the result is a success with one or more events with this URN |
| `the operation emits "<event URN>":` | `the operation emits {string}:` | Event fields | The same, and one event with this URN has fields that agree with the table |
| `the operation emits no event` | `the operation emits no event` | None | Makes sure that the result is a success with no events, or a `DomainError` |
| `the refusal is recorded as "<event URN>"` | `the refusal is recorded as {string}` | None | Makes sure that the result is a `DomainError` whose `record` is this event: the `recordAs` of the error |
| `the refusal is recorded as "<event URN>":` | `the refusal is recorded as {string}:` | Event fields | The same, and the fields of the record agree with the table |

- The library registers the first step with `When` and the other steps with `Then`. Cucumber does not compare the keyword, so `Given`, `And` and `But` also match.
- `{string}` accepts text in double quotes or in single quotes. Gate 3 reads both forms of `the operation fails with`, of `the input is rejected by`, of `the operation emits` and of `the refusal is recorded as`.
- The `<field>` is a property name of the input entity, for example `weight_grams` or `coverages`. It cannot be a property of an embedded entity, for example `limit`. The `<error URN>` is the full URN of the error, and the `<event URN>` is the full URN of the event. The `<invariant URN>` is the full URN of the invariant, for example `urn:acme:insurance:policy:invariant:term_is_positive`.
- An issue of an invariant is on its `reportOn` property, else on the first field that its rule names. Thus `the input is rejected on "expiry_date"` also passes if `term_is_positive` refuses the input. Use `the input is rejected by` to name the rule.
- `the operation emits` does not examine the count or the sequence of the events. If the operation emits two events with one URN, the step passes if one of them agrees with the table.
- `the operation emits no event` passes after a `DomainError`, because a refusal never has events. It fails after `InputRejected`, `ContractViolation` and `UnknownOperation`. The `record` of a `DomainError` is not an emitted event.

From the insurance domain:

```gherkin
    And the operation emits "urn:acme:insurance:policy:event:policy_cancelled":
      | cancellation_date   | refund   |
      | <cancellation_date> | <refund> |
```

```gherkin
    Then the operation fails with "urn:acme:insurance:policy:error:refund_below_minimum":
      | refund |
      | 0.00   |
    And the operation emits no event
    And the refusal is recorded as "urn:acme:insurance:policy:event:refund_refused":
      | refund |
      | 0.00   |
```

- `the refusal is recorded as` names an event that a declared error of the operation has as `recordAs`. Another URN fails the step: `urn:acme:insurance:policy:event:policy_issued records no declared error of urn:acme:insurance:policy:operation:cancel_policy (records: urn:acme:insurance:policy:event:refund_refused)`.
- A field that differs fails the step: `urn:acme:insurance:policy:event:refund_refused fields differ: refund: expected 0.01, got 0.00`.

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
| `the operation emits "<event URN>":` | A field name of the event. The step makes sure that the operation emits the event before it reads the table |
| `the refusal is recorded as "<event URN>":` | A field name of the event |

The step converts each cell with the primitive of its field, and puts the value in an object with the header as the key. A cell for a list or for an embedded entity has its own syntax. Refer to [List and object cells](#list-and-object-cells). A cell with no value puts no key in the object. A Scenario Outline operates as usual: Cucumber puts the `Examples` values in the `<placeholders>` before the step starts.

### Cell conversion

| Primitive | Cell | Value |
| --- | --- | --- |
| All | Empty | No value. The key is absent |
| `integer`, `float` | A number literal: an optional `+` or `-`, digits with an optional decimal part or a decimal part only, and an optional exponent. Examples: `10`, `-9`, `0.5`, `.5`, `+3`, `1e3`, `-0` | The number |
| `integer`, `float` | `Infinity`, `+Infinity`, `-Infinity` or `NaN` | The number |
| `integer`, `float` | Other text, for example `abc`, `1,000` or `0x10` | The text, without a change. The schema refuses it |
| `string`, `enum` | `""` (two double quotes) | The empty string. No `enum` lists it, so the schema of an `enum` refuses it |
| `string`, `enum` | Other text | The text, without a change. For example, `"a"` stays `"a"`, with the quotes |
| `decimal` | All text | The text, without a change. A decimal stays a string, so its digits stay exact. For example, `12.50` stays `"12.50"` |
| `date` | All text | The text, without a change, for example `2026-01-31` |
| `timestamp` | All text | The text, without a change, for example `2026-01-31T09:30:00Z` |
| `boolean` | `true` or `false` | The boolean |
| `boolean` | Other text, for example `yes` or `True` | The text, without a change. The schema refuses it |

You cannot send the text `""` itself to a `string` or an `enum` field. Thus a `decimal`, `date` or `timestamp` field cannot get the empty string from a cell. Gate 3 converts the cells in the same way when it reads the values for boundary coverage.

A link is a plain cell. Its value is the value of the key field of the linked entity, and the step converts it with the primitive of the key field. For example, the cell of `holder` in the insurance domain is a customer identifier.

### List and object cells

A cell for a property with `many` is a list. A cell for an embedded entity is an object. A list of an embedded entity is a list of objects. The syntax:

| Form | Syntax | Example |
| --- | --- | --- |
| List | `[` and `]` around zero or more values, with a comma between two values | `[fire, flood]`, `[]` |
| Object | `{` and `}` around zero or more pairs, with a comma between two pairs. A pair is a property name, `:` and a value | `{ peril: fire, limit: 1000.00 }` |
| List of objects | A list whose values are objects | `[{ peril: fire, limit: 1 }, { peril: flood, limit: 2 }]` |
| Bare value | Text up to the next `,`, `]` or `}`. The step removes the spaces at its start and end. It cannot contain a comma, a bracket, a brace or a double quote | `fire`, `1000.00`, `Smith Ada` |
| Quoted value | A JSON string literal: double quotes, with the escapes of JSON | `"Smith, Ada"`, `"x{y}"`, `"a \"quoted\" word"`, `""` |

- The step converts each value with the primitive of its field, in the same way as a plain cell. A quoted value is also converted. Thus a quoted `"3"` for an `integer` field is the number `3`. For a `string` or an `enum` field, a quoted value is its text, without the quotes.
- An empty bare value is the empty text, for example the middle value of `[a, , b]`. For a `string` field, it is the empty string. For an `integer` field, it stays text, and the schema refuses it.
- An object can leave out a property. The key is then absent from the object. An object cannot give one property two times.
- A value in an object can be a list or an object, as deep as the entity goes. The syntax of a value follows its property.
- Spaces between the parts are permitted.

These cells come from the insurance domain:

```gherkin
| [{ peril: fire, limit: 1000.00 }]                                                                         |
| [{ peril: flood, limit: 500 }, { peril: theft, limit: 250.5, note: "Basement excluded, see {clause 4}" }] |
```

A cell that does not start with the correct bracket stays text, without a change. The schema then refuses it. For example, the cell `{ peril: fire, limit: 1 }` for the list `coverages` gives `coverages: Invalid type: Expected Array but received "{ peril: fire, limit: 1 }"`.

A cell that starts with the correct bracket and is malformed makes the step fail. The message gives the column in the cell. A name in an object that is not a property of the entity also makes the step fail. The message names the entity and its properties. Gate 3 finds the same problems without a test run, as `invalid-cell`.

| Problem | Message |
| --- | --- |
| A list has no `,` or `]` after a value | `expected "," or "]" (at column <n> of the cell)` |
| An object has no `,` or `}` after a pair | `expected "," or "}" (at column <n> of the cell)` |
| An object has no property name where one must be | `expected a property name (at column <n> of the cell)` |
| A property name has no `:` after it | `expected ":" after "<name>" (at column <n> of the cell)` |
| An object gives a property two times | `property "<name>" occurs more than once (at column <n> of the cell)` |
| A quoted value has no quote at its end | `a quoted value has no closing quote (at column <n> of the cell)` |
| A quoted value is not a valid JSON string, for example `"\q"` | `a quoted value is not a valid JSON string (at column <n> of the cell)` |
| Text after the end of the list or the object | `unexpected "<character>" (at column <n> of the cell)` |
| A name that is not a property of the entity | `"<name>" is not a property of <entity URN> (properties: <names>) (at column <n> of the cell)` |

Gherkin uses `|` to separate the cells. To put a `|` in a value, write `\|`.

### Comparison of the output, the error fields and the event fields

The steps `the output is:`, `the operation fails with "<error URN>":` and `the operation emits "<event URN>":` compare only the columns of the table:

- A property that is not in the table is not compared.
- An empty cell means that the property must be absent. If the property has a value, the step fails with `<name>: expected absent, got <value>`. To expect the empty string, write `""`.
- The values must be equal by `===`. Also, `NaN` is equal to `NaN`. Thus `0` and `-0` are equal.
- Two lists are equal if they have the same length, and each item is equal to the item at the same position. Thus `[1, 2]` is not equal to `[2, 1]`. A message shows a list as `[<item>, <item>]`.
- Two embedded objects are equal if they have the same properties, and each property is equal. The actual object must not have a property that the expected object does not give. Thus an object cell must give each property that the output has. A message shows an object as `{ <name>: <value>, … }`.
- A `decimal` value is text, so the comparison is a text comparison. Thus `12.5` is not equal to `12.50`.
- The step compares the parsed output, the parsed error fields or the parsed event fields. These values are the result of the schema parse.

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
| One or more values are different | `<operation URN> output differs: <name>: expected <value>, got <value>; …`. An absent value shows as `absent`. A list shows as `[<item>, <item>]`. An object shows as `{ <name>: <value>, … }` |

### `the input is rejected on "<field>"`

| Condition | Message |
| --- | --- |
| No operation has run | `no operation has run yet; start with "When I run the operation with:"` |
| The field is not an input property | `"<field>" is not a field of the input of <operation URN> (fields: <names>)` |
| The operation succeeded | `<operation URN> accepted the input; expected it to be rejected on "<field>"` |
| The result is not `InputRejected` | `<operation URN> failed with <failure>; expected InputRejected on "<field>"` |
| No issue has a path whose first segment is the property name | `<operation URN> rejected the input, but not on "<field>": <failure>` |

An issue inside the property counts. Thus `the input is rejected on "coverages"` passes for an issue at `coverages.0.peril` or at `coverages.1.limit`.

### `the input is rejected by "<invariant URN>"`

| Condition | Message |
| --- | --- |
| No operation has run | `no operation has run yet; start with "When I run the operation with:"` |
| The invariant is not on the input entity of the operation | `<invariant URN> is not an invariant of the input of <operation URN> (invariants: <invariant URNs>)`. If the input has no invariants, the list is `none` |
| The operation succeeded | `<operation URN> accepted the input; expected it to be rejected by <invariant URN>` |
| The result is not `InputRejected` | `<operation URN> failed with <failure>; expected InputRejected by <invariant URN>` |
| No issue has the URN of the invariant as its `invariantUrn` | `<operation URN> rejected the input, but not by <invariant URN>: <failure>` |

The invariants of an embedded entity are invariants of the input. Thus `the input is rejected by "urn:acme:insurance:policy:invariant:limit_is_positive"` is correct for `issue_policy`. The checks of the invariants run only if each input field is valid. Thus an input with an incorrect field value gets the last message, also if it breaks the invariant. Refer to [The generated schemas](./generated-schemas).

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

### `the operation emits "<event URN>"` and `the operation emits "<event URN>":`

| Condition | Message |
| --- | --- |
| No operation has run | `no operation has run yet; start with "When I run the operation with:"` |
| The operation does not emit the event | `<event URN> is not an event of <operation URN> (emits: <event URNs>)`. If the operation emits no events, the list is `none` |
| The table does not have two rows (form with `:` only) | `expected a header row and exactly one data row, got <n> row(s)` |
| A header is not a field of the event (form with `:` only) | `"<header>" is not a field of <event URN> (fields: <names>)` |
| The operation did not succeed | `<operation URN> did not succeed: <failure>; expected it to emit <event URN>` |
| No event has the URN | `<operation URN> did not emit <event URN> (emitted: <event URNs>)`. If there are no events, the list is `nothing` |
| No event with the URN has the fields of the table (form with `:` only) | `<event URN> fields differ: <name>: expected <value>, got <value>; …`. With two or more events of the URN, ` \| ` separates the differences of each event |

### `the operation emits no event`

| Condition | Message |
| --- | --- |
| No operation has run | `no operation has run yet; start with "When I run the operation with:"` |
| The result is not a success and not a `DomainError` | `<operation URN> failed with <failure>; expected it to emit no event` |
| The operation succeeded with one or more events | `<operation URN> emitted <event URNs>; expected no event` |

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

These messages come from a real Cucumber run on the insurance domain:

```
urn:acme:insurance:policy:invariant:cancellation_within_term is not an invariant of the input of urn:acme:insurance:policy:operation:issue_policy (invariants: urn:acme:insurance:policy:invariant:deductible_below_premium, urn:acme:insurance:policy:invariant:term_at_most_a_year, urn:acme:insurance:policy:invariant:term_is_positive, urn:acme:insurance:policy:invariant:limit_is_positive)
urn:acme:insurance:policy:operation:issue_policy accepted the input; expected it to be rejected by urn:acme:insurance:policy:invariant:term_is_positive
urn:acme:insurance:policy:operation:issue_policy rejected the input, but not by urn:acme:insurance:policy:invariant:term_is_positive: InputRejected (deductible: The deductible must be less than the premium)
urn:acme:insurance:policy:operation:issue_policy rejected the input, but not by urn:acme:insurance:policy:invariant:term_is_positive: InputRejected (policy_id: Invalid UUID: Received "policy-1")
urn:acme:insurance:policy:operation:cancel_policy failed with DomainError urn:acme:insurance:policy:error:refund_below_minimum (A refund of 0.00 is below the minimum of 1.00); expected InputRejected by urn:acme:insurance:policy:invariant:cancellation_within_term
```

These messages come from a real Cucumber run on the insurance domain, with nested values. The first scenario sends a coverage with a `note`, and its output table leaves out the `note`:

```
urn:acme:insurance:policy:operation:issue_policy output differs: coverages: expected [{ peril: fire, limit: 1000.00 }], got [{ peril: fire, limit: 1000.00, note: a, b }]
"lmit" is not a property of urn:acme:insurance:policy:entity:coverage (properties: peril, limit, note) (at column 17 of the cell)
expected "," or "]" (at column 33 of the cell)
a quoted value has no closing quote (at column 33 of the cell)
urn:acme:insurance:policy:operation:issue_policy rejected the input, but not on "premium": InputRejected (coverages.0.peril: Invalid type: Expected ("fire" | "flood" | "theft") but received "hail")
```

These messages come from a real Cucumber run on the insurance domain, with steps for events. The steps follow `I run the operation with:` for `issue_policy`, with a valid policy or with the `policy_id` `p`. The last message comes from `cancel_policy` with a refund below the minimum:

```
urn:acme:insurance:policy:event:policy_cancelled is not an event of urn:acme:insurance:policy:operation:issue_policy (emits: urn:acme:insurance:policy:event:policy_issued)
urn:acme:insurance:policy:event:policy_issued fields differ: premium: expected 121.00, got 120.00
"premum" is not a field of urn:acme:insurance:policy:event:policy_issued (fields: policy_id, holder, premium)
urn:acme:insurance:policy:operation:issue_policy emitted urn:acme:insurance:policy:event:policy_issued; expected no event
urn:acme:insurance:policy:operation:issue_policy did not succeed: InputRejected (policy_id: Invalid UUID: Received "p"); expected it to emit urn:acme:insurance:policy:event:policy_issued
urn:acme:insurance:policy:operation:issue_policy failed with InputRejected (policy_id: Invalid UUID: Received "p"); expected it to emit no event
urn:acme:insurance:policy:operation:cancel_policy did not succeed: DomainError urn:acme:insurance:policy:error:refund_below_minimum (A refund of 0.00 is below the minimum of 1.00); expected it to emit urn:acme:insurance:policy:event:policy_cancelled
```

This message comes from a real Cucumber run on a domain with a list in the output. The core sorts the list:

```
urn:demo:shop:order:operation:sort_items output differs: sku: expected [ABC-0002, ABC-0001], got [ABC-0001, ABC-0002]
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
| `dispatch` | `Readonly<Record<string, OperationContractLike>>` | The generated `DispatchMap`. The steps read the input, output, error and event fields, and the input invariants, of each operation from it |
| `execute` | `(urn: string, payload: unknown) => ExecuteResultLike` | The function that runs an operation. Usually `executeOperation` of the generated runtime, with your core |

The function registers one `Before` hook and the nine steps. Call it one time, in a support file that Cucumber loads. If you call it two times, Cucumber finds two definitions for each step.

The support file of tutorial 2:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/features/support/steps.ts

The types of the options are structural. The generated `DispatchMap` and `executeOperation` of each domain agree with them:

| Type | Properties |
| --- | --- |
| `Primitive` | `'boolean'`, `'date'`, `'decimal'`, `'enum'`, `'float'`, `'integer'`, `'string'` or `'timestamp'` |
| `FieldInfoLike` | `urn: string`, `primitive: Primitive`, `required: boolean`, `many?: boolean`, `link?: string` |
| `EmbeddedInfoLike` | `entity: string`, `required: boolean`, `many?: boolean`, `fields: Readonly<Record<string, PropertyInfoLike>>` |
| `PropertyInfoLike` | `FieldInfoLike` or `EmbeddedInfoLike` |
| `FieldsLike` | `Readonly<Record<string, PropertyInfoLike>>`, keyed by property name |
| `OperationContractLike` | `input: { fields: FieldsLike; invariants?: readonly { urn: string }[] }`, `output: { fields: FieldsLike }`, `errors: Readonly<Record<string, { fields: FieldsLike }>>`, keyed by error URN, `events?: Readonly<Record<string, { fields: FieldsLike }>>`, keyed by event URN |
| `BoundaryIssueLike` | `path: string`, `fieldUrn?: string`, `invariantUrn?: string`, `message: string` |
| `DomainErrorLike` | `urn: string`, `message: string`, `fields: unknown` |
| `EmittedEventLike` | `urn: string`, `fields: unknown` |
| `ExecuteResultLike` | `{ ok: true; output: unknown; events?: readonly EmittedEventLike[] }`, or `{ ok: false; kind: 'DomainError'; error: DomainErrorLike }`, or `{ ok: false; kind: string; issues: readonly BoundaryIssueLike[] }` |

## The pure helpers

The module also exports the functions that the steps use. They do not need Cucumber. Each `assert…` function returns nothing if the check passes, and throws an `Error` with the message from [Failure messages](#failure-messages) if it fails.

| Function | Signature | Description |
| --- | --- | --- |
| `operationUrnFromTags` | `(tags: readonly string[]) => string` | Returns the one operation URN in the tags. Throws if there is no operation tag or more than one |
| `coerceCell` | `(cell: string, field: PropertyInfoLike) => unknown` | Converts one cell with the primitive of the field. If `field.many` is `true`, it converts the cell as a list. For an embedded entity, it converts the cell as an object. Returns `undefined` for an empty cell. Throws if a list or object cell is malformed |
| `tableToObject` | `(rows: readonly (readonly string[])[], fields: FieldsLike, side, urn: string) => Record<string, unknown>` | Converts a table of two rows to an object. Throws if the table does not have two rows, or if a header is not in `fields`. `side` is `'input'`, `'output'`, `'error'` or `'event'`. `side` and `urn` are for the message only |
| `assertOutput` | `(result: ExecuteResultLike, expected: Record<string, unknown>, urn: string) => void` | The check of `the output is:` |
| `assertRejectedOn` | `(result: ExecuteResultLike, fieldName: string, fields: FieldsLike, urn: string) => void` | The check of `the input is rejected on "<field>"` |
| `assertRejectedBy` | `(result: ExecuteResultLike, invariantUrn: string, urn: string) => void` | The check of `the input is rejected by "<invariant URN>"`. It does not examine whether the invariant is on the input entity |
| `assertFailsWith` | `(result: ExecuteResultLike, errorUrn: string, urn: string, expected?: Record<string, unknown>) => void` | The check of `the operation fails with "<error URN>"`. With `expected`, it also compares the error fields. It does not examine whether the operation declares the error |
| `assertEmits` | `(result: ExecuteResultLike, eventUrn: string, urn: string, expected?: Record<string, unknown>) => void` | The check of `the operation emits "<event URN>"`. With `expected`, one event with the URN must have these fields. It does not examine whether the operation emits the event. A result with no `events` key counts as no events |
| `assertEmitsNone` | `(result: ExecuteResultLike, urn: string) => void` | The check of `the operation emits no event` |

## Related pages

- [Write scenarios](../how-to/write-scenarios)
- [The generated runtime](./generated-runtime)
- [Verification gates](./verification-gates)
- [Emit an event](../how-to/emit-an-event)
- [The traceability chain](../explanation/traceability)
