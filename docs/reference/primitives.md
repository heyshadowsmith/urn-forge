# Primitives and constraints

Each field has one primitive. The primitive sets the kind of value and the constraints that the field can have. For the SQL type and the SQL check of each, refer to [The Postgres schema](./postgres-schema).

## Primitives

| Primitive | Value | TypeScript type | Constraints |
| --- | --- | --- | --- |
| `boolean` | True or false | `boolean` | `mustBe` |
| `date` | A calendar day, `YYYY-MM-DD` | `string` | `min`, `max` |
| `decimal` | An exact fraction, such as money | `string` | `min`, `max`, `exclusiveMin`, `exclusiveMax`, `scale`, `notIn` |
| `enum` | One of a fixed set of names | The union of the names | `values` (necessary) |
| `float` | An approximate measurement | `number`, finite | `min`, `max`, `exclusiveMin`, `exclusiveMax`, `notIn` |
| `integer` | An exact whole number | `number`, a safe integer | `min`, `max`, `multipleOf`, `notIn` |
| `string` | Free text | `string` | `minLength`, `maxLength`, `regex`, `format` |
| `timestamp` | An instant, ISO 8601 in UTC | `string` | `min`, `max`, `exclusiveMin`, `exclusiveMax`, `precision` |

- A finite number is not `Infinity`, `-Infinity` or `NaN`. A safe integer is from `-(2^53 − 1)` to `2^53 − 1`.
- A `decimal` matches `^-?(0|[1-9][0-9]*)(\.[0-9]+)?$`. It has no exponent, no `+` and no leading zeros.
- A `date` is a real day of the Gregorian calendar. `2024-02-29` is correct. `2023-02-29` is not.
- A `timestamp` has the form `YYYY-MM-DDTHH:MM:SSZ`, with an optional fraction of 1 to 3 digits. It must end with `Z`. An offset such as `+02:00` is not correct. With `precision: 3`, it has exactly 3 digits after the second: `2026-01-31T09:30:00.000Z`.
- The parsed type of each field has a brand. The input type has no brand.
- A list is not a primitive. Use `many` on a field reference. To hold a different entity, use `ref` or `link` on a field reference. Refer to [The manifest](./manifest).

## Aspects

Each constraint restricts one aspect of a value.

| Aspect | What it restricts | Constraints |
| --- | --- | --- |
| Range | The lowest and the highest value | `min`, `max`, `exclusiveMin`, `exclusiveMax` |
| Step | The distance between two values | `multipleOf`, `scale` |
| Size | The length of a value | `minLength`, `maxLength` |
| Shape | The form of a value | `regex`, `format` |
| Membership | A set that contains the value | `mustBe`, `values` |
| Exclusion | A set that does not contain the value | `notIn` |

A field can set only one of each pair: `min` or `exclusiveMin`, `max` or `exclusiveMax`, `regex` or `format`. Two cause `conflicting-constraints`.

## Constraints

| Constraint | Primitive | Aspect | Value |
| --- | --- | --- | --- |
| `mustBe` | `boolean` | Membership | A boolean |
| `min` | `date` | Range | A real calendar day |
| `max` | `date` | Range | A real calendar day |
| `min` | `decimal` | Range | A decimal in quotes |
| `max` | `decimal` | Range | A decimal in quotes |
| `exclusiveMin` | `decimal` | Range | A decimal in quotes |
| `exclusiveMax` | `decimal` | Range | A decimal in quotes |
| `scale` | `decimal` | Step | A safe integer, `0` or more |
| `notIn` | `decimal` | Exclusion | One or more decimals in quotes, each one time |
| `values` | `enum` | Membership | Necessary. One or more names, not empty, each one time |
| `min` | `float` | Range | A finite number |
| `max` | `float` | Range | A finite number |
| `exclusiveMin` | `float` | Range | A finite number |
| `exclusiveMax` | `float` | Range | A finite number |
| `notIn` | `float` | Exclusion | One or more finite numbers, each one time |
| `min` | `integer` | Range | A safe integer |
| `max` | `integer` | Range | A safe integer |
| `multipleOf` | `integer` | Step | A safe integer, `1` or more |
| `notIn` | `integer` | Exclusion | One or more safe integers, each one time |
| `minLength` | `string` | Size | A safe integer, `0` or more |
| `maxLength` | `string` | Size | A safe integer, `0` or more |
| `regex` | `string` | Shape | A JavaScript regular expression, not empty, valid with the `u` flag |
| `format` | `string` | Shape | `uuid`, `email` or `uri` |
| `min` | `timestamp` | Range | A timestamp in quotes |
| `max` | `timestamp` | Range | A timestamp in quotes |
| `exclusiveMin` | `timestamp` | Range | A timestamp in quotes |
| `exclusiveMax` | `timestamp` | Range | A timestamp in quotes |
| `precision` | `timestamp` | Shape | `0`, `1`, `2` or `3`: exactly that many digits after the second |

| Problem | Code |
| --- | --- |
| An `enum` with no `values` | `missing-property` |
| A constraint of a different primitive, for example `exclusiveMin` on an `integer` | `constraint-not-allowed` |
| A key that is a constraint of no primitive, for example `oneOf` or `notEqual` | `unknown-property` |
| A value of the wrong type or form | `invalid-value` |
| A `decimal` bound without quotes, for example `min: 0.10` | `invalid-value`: `must be a decimal in quotes, such as "0.01": a YAML number is not exact` |

- `integer` and `date` have no exclusive bounds. Write `min: 1`, not `exclusiveMin: 0`.
- Write a `timestamp` bound in quotes. A `date` bound can have quotes or not.
- No constraint can mean "now". A bound is always a fixed value.

### Valid values

| Constraint | A value is valid if |
| --- | --- |
| `mustBe` | It is equal to the constraint value |
| `values` | It is one of the listed names |
| `min`, `max` | It is equal to or more than `min`, and equal to or less than `max` |
| `exclusiveMin`, `exclusiveMax` | It is more than `exclusiveMin`, and less than `exclusiveMax` |
| `multipleOf` | It divides by the value with no remainder |
| `scale` | It has the value or fewer digits after the point |
| `notIn` | It is equal to none of the listed values |
| `minLength`, `maxLength` | Its length is in the limits |
| `regex` | The pattern matches the full value |
| `format` | It is a valid UUID, email address or URI |

- The length of a string is its number of Unicode code points. One emoji counts as 1.
- `decimal` values compare as exact numbers. `"1.10"` equals `"1.1"`, and `"-0"` equals `"0"`. Thus `notIn: ["13.00"]` also refuses `"13"`.
- `date` values compare as text. `timestamp` values compare as instants: `"2026-01-01T00:00:00Z"` equals `"2026-01-01T00:00:00.000Z"`.
- urn-forge puts a `regex` pattern in `^(?:` and `)$`, with the `u` flag only. Do not write `^` and `$`.
- In YAML, write a `regex` in single quotes, because double quotes change backslashes: `regex: '[A-Z]{3}-[0-9]{4}'`.
- The generated `decimal` helpers use `BigInt`. Your tsconfig needs the `ES2020` library or later.

## Coherence

`compile` reports `incoherent-constraints` if no value can be valid. The diagnostic position is the constraint in the "At" column.

| Primitive | Rule | At |
| --- | --- | --- |
| `float`, `integer`, `decimal` | The lower bound is not more than the upper bound | The upper bound |
| `date`, `timestamp` | `min` is not after `max` | The upper bound |
| `float`, `decimal`, `timestamp` | Equal bounds are both inclusive | The upper bound |
| `float`, `decimal` | If `min` equals `max`, `notIn` does not list that value | `notIn` |
| `integer` | A multiple of `multipleOf` is between `min` and `max` | `multipleOf` |
| `integer` | `notIn` does not list each value that `min`, `max` and `multipleOf` allow | `notIn` |
| `decimal` | A value with at most `scale` digits after the point is between the bounds | `scale` |
| `decimal` | `notIn` does not list each value that the bounds and `scale` allow | `notIn` |
| `string` | `minLength` is not more than `maxLength` | `maxLength` |
| `string` | With `format: uuid`, the length constraints allow 36 characters | `format` |

- A field with `conflicting-constraints` gets no coherence check.
- The `notIn` rules apply only to a range of 100,000 values or fewer.
- A list has one rule: `minItems` is not more than `maxItems`.

## Boundary cases

Gate 3 examines the values that the scenarios of an operation send for each constrained input field. The values must include both cases of each constraint. A case that is not there causes `uncovered-boundary`, with the label in the message. For the gate, and for the cases of a list and a link, refer to [Verification gates](./verification-gates).

| Constraint | Primitive | Valid case (label) | Invalid case (label) |
| --- | --- | --- | --- |
| `mustBe` | `boolean` | The value: `value <v> (mustBe)` | The other value: `value <v> (not mustBe)` |
| `values` | `enum` | Each name: `value "<name>" (values)` | A string not in the list: `value outside values` |
| `min` | `integer` | `min`: `value at min <min>` | `min − 1`: `value at min − 1 (<n>)` |
| `max` | `integer` | `max`: `value at max <max>` | `max + 1`: `value at max + 1 (<n>)` |
| `min` | `float` | `min`: `value at min <min>` | Less than `min`: `value below min <min>` |
| `max` | `float` | `max`: `value at max <max>` | More than `max`: `value above max <max>` |
| `min` | `decimal` | `min`: `value at min <min>` | With `scale`, one step below: `value one step below min (<v>)`. Else `value below min <min>` |
| `max` | `decimal` | `max`: `value at max <max>` | With `scale`, one step above: `value one step above max (<v>)`. Else `value above max <max>` |
| `exclusiveMin` | `float`, `decimal` | More than the bound: `value above exclusiveMin <n>` | The bound: `value at exclusiveMin <n>` |
| `exclusiveMax` | `float`, `decimal` | Less than the bound: `value below exclusiveMax <n>` | The bound: `value at exclusiveMax <n>` |
| `multipleOf` | `integer` | A multiple: `multiple of <n> (multipleOf)` | A non-multiple: `value that is not a multiple of <n>` |
| `notIn` | `integer`, `float`, `decimal` | — | Each listed value: `value <v> (notIn)` |
| `scale` | `decimal` | `scale` digits: `value with <s> digit(s) after the point (scale)` | `scale + 1` digits: `value with <s + 1> digits after the point (above scale)` |
| `min` | `date` | `min`: `value at min <min>` | The day before: `day before min (<day>)` |
| `max` | `date` | `max`: `value at max <max>` | The day after: `day after max (<day>)` |
| `min` | `timestamp` | `min`: `value at min <min>` | Before: `value before min <min>` |
| `max` | `timestamp` | `max`: `value at max <max>` | After: `value after max <max>` |
| `exclusiveMin` | `timestamp` | After: `value after exclusiveMin <t>` | The bound: `value at exclusiveMin <t>` |
| `exclusiveMax` | `timestamp` | Before: `value before exclusiveMax <t>` | The bound: `value at exclusiveMax <t>` |
| `minLength` | `string` | Length `n`: `value of length <n> (minLength)` | Length `n − 1`, if `n` is more than 0: `value of length <n − 1> (below minLength)` |
| `maxLength` | `string` | Length `n`: `value of length <n> (maxLength)` | Length `n + 1`: `value of length <n + 1> (above maxLength)` |
| `regex` | `string` | A match: `valid value for regex <pattern>` | No match: `invalid value for regex <pattern>` |
| `format` | `string` | A valid value: `valid <format> (format)` | An invalid value: `value that is not a valid <format>` |

- A number covers a case if it is equal with `===`. Thus `0` and `-0` both cover a bound of `0`.
- A `decimal` covers a case if it is equal as an exact number. A `timestamp` covers a case if it is equal as an instant.
- A `string` case needs a string. A `boolean` case needs a boolean.
- Gate 3 reads the values. It does not run the scenarios.

## Related pages

- [The manifest](./manifest)
- [Add a field](../how-to/add-a-field)
- [Verification gates](./verification-gates)
