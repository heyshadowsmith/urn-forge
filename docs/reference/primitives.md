# Primitives and constraints

Each field has one primitive. A primitive sets the kind of value and the constraints that the field can have. urn-forge 0.1.0 has eight primitives: `boolean`, `date`, `decimal`, `enum`, `float`, `integer`, `string` and `timestamp`.

The set is MECE: each kind of value has one primitive, and each constraint restricts one aspect of a value. For the reasons, refer to [The MECE model of primitives](../explanation/primitives-model).

## Primitives

| Primitive | Value | TypeScript type | Valibot start of the pipe | Constraints |
| --- | --- | --- | --- | --- |
| `boolean` | True or false | `boolean` | `v.boolean()` | `mustBe` |
| `date` | A calendar day, `YYYY-MM-DD` | `string` | `v.string()`, `v.check(isCalendarDate, …)` | `min`, `max` |
| `decimal` | An exact fraction, such as money | `string` | `v.string()`, `v.regex(DECIMAL, …)` | `min`, `max`, `exclusiveMin`, `exclusiveMax`, `scale`, `notIn` |
| `enum` | One of a fixed set of names | The union of the names | `v.picklist([<values>])` | `values` (necessary) |
| `float` | An approximate measurement | `number`, finite | `v.number()`, `v.finite()` | `min`, `max`, `exclusiveMin`, `exclusiveMax`, `notIn` |
| `integer` | An exact whole number | `number`, a safe integer | `v.number()`, `v.safeInteger()` | `min`, `max`, `multipleOf`, `notIn` |
| `string` | Free text | `string` | `v.string()` | `minLength`, `maxLength`, `regex`, `format` |
| `timestamp` | An instant, ISO 8601 in UTC | `string` | `v.string()`, `v.check(isUtcTimestamp, …)` | `min`, `max`, `exclusiveMin`, `exclusiveMax` |

- A finite number is not `Infinity`, `-Infinity` or `NaN`.
- A safe integer is an integer from `-(2^53 − 1)` to `2^53 − 1`.
- A `decimal` is a string of digits with an optional point and fraction, and an optional `-` at the start: `^-?(0|[1-9][0-9]*)(\.[0-9]+)?$`. It has no exponent, no `+` and no leading zeros. The core gets the string, so no binary float holds the value.
- A `date` names a real day of the Gregorian calendar. `2024-02-29` is correct. `2023-02-29` is not.
- A `timestamp` has the form `YYYY-MM-DDTHH:MM:SSZ`, with an optional fraction of 1 to 3 digits after the seconds. It must end with `Z`. An offset such as `+02:00` is not correct.
- The output type of each field schema is the TypeScript type with a brand: `v.InferOutput` of the schema. The input type has no brand. Refer to [The generated schemas](./generated-schemas).
- A list of values is not a primitive. A field reference with `many` makes a list. Refer to [The manifest](./manifest).

urn-forge 0.1.0 does not have the primitives `record` and `ref`. A field reference with `ref` to an entity embeds the entity, and a field reference with `link` points at an entity by its key. urn-forge does not have a `record` at this time. Refer to [Scope](./scope).

## Aspects

Each constraint restricts one aspect of a value. A constraint has the same aspect on each primitive that has it.

| Aspect | What it restricts | Constraints |
| --- | --- | --- |
| Range | The lowest and the highest value | `min`, `max`, `exclusiveMin`, `exclusiveMax` |
| Step | The distance between two values | `multipleOf`, `scale` |
| Size | The length of a value | `minLength`, `maxLength` |
| Shape | The form of a value | `regex`, `format` |
| Membership | A set that contains the value | `mustBe`, `values` |
| Exclusion | A set that does not contain the value | `notIn` |

A field can set at most one constraint for one side of one aspect. These pairs cause `conflicting-constraints`:

| Pair | Both set |
| --- | --- |
| `min` and `exclusiveMin` | A lower bound |
| `max` and `exclusiveMax` | An upper bound |
| `regex` and `format` | The shape |

## Constraints

| Constraint | Primitive | Aspect | Value type | Rules for the value (pass 1) | Valibot action |
| --- | --- | --- | --- | --- | --- |
| `mustBe` | `boolean` | Membership | boolean | — | `v.value(<value>)` |
| `min` | `date` | Range | string | A real calendar day | `v.minValue("<value>")` |
| `max` | `date` | Range | string | A real calendar day | `v.maxValue("<value>")` |
| `min` | `decimal` | Range | string | A decimal in quotes | `v.check(… compareDecimal(value, "<value>") >= 0 …)` |
| `max` | `decimal` | Range | string | A decimal in quotes | `v.check(… compareDecimal(value, "<value>") <= 0 …)` |
| `exclusiveMin` | `decimal` | Range | string | A decimal in quotes | `v.check(… compareDecimal(value, "<value>") > 0 …)` |
| `exclusiveMax` | `decimal` | Range | string | A decimal in quotes | `v.check(… compareDecimal(value, "<value>") < 0 …)` |
| `scale` | `decimal` | Step | number | A safe integer, `0` or more | `v.check(… decimalFraction(value) <= <value> …)` |
| `notIn` | `decimal` | Exclusion | list of strings | One or more decimals in quotes. No value two times | `v.check(… ![<values>].some(…) …)` |
| `values` | `enum` | Membership | list of strings | Necessary. One or more items. No empty item. No item two times | `v.picklist([<values>])` |
| `min` | `float` | Range | number | Finite | `v.minValue(<value>)` |
| `max` | `float` | Range | number | Finite | `v.maxValue(<value>)` |
| `exclusiveMin` | `float` | Range | number | Finite | `v.gtValue(<value>)` |
| `exclusiveMax` | `float` | Range | number | Finite | `v.ltValue(<value>)` |
| `notIn` | `float` | Exclusion | list of numbers | One or more finite numbers. No value two times | `v.notValues([<values>])` |
| `min` | `integer` | Range | number | A safe integer | `v.minValue(<value>)` |
| `max` | `integer` | Range | number | A safe integer | `v.maxValue(<value>)` |
| `multipleOf` | `integer` | Step | number | A safe integer, `1` or more | `v.multipleOf(<value>)` |
| `notIn` | `integer` | Exclusion | list of numbers | One or more safe integers. No value two times | `v.notValues([<values>])` |
| `minLength` | `string` | Size | number | A safe integer, `0` or more | `v.check(…)` that counts code points |
| `maxLength` | `string` | Size | number | A safe integer, `0` or more | `v.check(…)` that counts code points |
| `regex` | `string` | Shape | string | Not empty. A valid JavaScript regular expression with the `u` flag | `v.regex(/^(?:<value>)$/u)` |
| `format` | `string` | Shape | string | `uuid`, `email` or `uri` | `v.uuid()`, `v.email()` or `v.url()` |
| `min` | `timestamp` | Range | string | A timestamp in quotes | `v.check(… Date.parse(value) >= Date.parse("<value>") …)` |
| `max` | `timestamp` | Range | string | A timestamp in quotes | `v.check(… Date.parse(value) <= Date.parse("<value>") …)` |
| `exclusiveMin` | `timestamp` | Range | string | A timestamp in quotes | `v.check(… Date.parse(value) > Date.parse("<value>") …)` |
| `exclusiveMax` | `timestamp` | Range | string | A timestamp in quotes | `v.check(… Date.parse(value) < Date.parse("<value>") …)` |

- All constraints are optional, but an `enum` must have `values`. Without it, pass 1 reports `missing-property`.
- A constraint of a different primitive causes `constraint-not-allowed`, for example `exclusiveMin` on an `integer`. A key that is a constraint of no primitive causes `unknown-property`. A value of the wrong type or form causes `invalid-value`.
- `integer` and `date` have no exclusive bounds. Their values are discrete, so an exclusive bound is an inclusive bound one step further. Write `min: 1`, not `exclusiveMin: 0`.
- Write a `decimal` literal in quotes: `min: "0.01"`. YAML reads `0.10` without quotes as a binary float, so pass 1 refuses it: `must be a decimal in quotes, such as "0.01": a YAML number is not exact`.
- Write a `timestamp` literal in quotes. A `date` literal can be in quotes or not, because YAML keeps `2026-01-31` as text.
- `oneOf` and `notEqual` are not constraints. The message for each one names the replacement: `primitive: enum` with `values`, and `notIn`.

### Valid values for each constraint

| Constraint | A value is valid if |
| --- | --- |
| `mustBe` | It is equal to the constraint value |
| `values` | It is equal to one of the listed names |
| `min` | It is equal to or more than the constraint value |
| `max` | It is equal to or less than the constraint value |
| `exclusiveMin` | It is more than the constraint value |
| `exclusiveMax` | It is less than the constraint value |
| `multipleOf` | It divides by the constraint value with no remainder |
| `scale` | It has the constraint value or fewer digits after the point |
| `notIn` | It is equal to none of the listed values |
| `minLength` | Its length is equal to or more than the constraint value |
| `maxLength` | Its length is equal to or less than the constraint value |
| `regex` | The pattern matches the full value |
| `format` | It is a valid UUID, email address or URI |

- The length of a string is its number of Unicode code points, as in Postgres `char_length`. Thus one emoji counts as 1, although its JavaScript `length` is 2.
- `decimal` values compare as exact numbers. `"1.10"` is equal to `"1.1"`, and `"-0"` is equal to `"0"`. Thus `notIn: ["13.00"]` also refuses `"13"`.
- `date` values compare as text. In the form `YYYY-MM-DD`, the text order is the date order.
- `timestamp` values compare as instants. `"2026-01-01T00:00:00Z"` is equal to `"2026-01-01T00:00:00.000Z"`.
- No constraint can mean "now". A bound is always a fixed value, so `verify` does not depend on the clock.

### `regex`

- urn-forge puts the pattern in `^(?:` and `)$`. Thus the pattern must match the full value. `[a-z]+` accepts `abc` but not `abc1`. Do not write `^` and `$`.
- The pattern uses the `u` flag (Unicode mode). It has no other flags.
- The generated regular expression literal escapes each `/` in the pattern.
- In YAML, a pattern in double quotes changes backslashes. Use single quotes: `regex: '[A-Z]{3}-[0-9]{4}'`.

### The generated pipe

The Valibot plugin makes one `v.pipe(…)` for each field. The pipe has these actions, in this sequence:

1. The start of the pipe for the primitive.
2. One action for each constraint that the field sets, in the sequence of the constraint table. The sequence of the keys in the manifest has no effect.
3. `v.brand("<field URN>")`.

This manifest line:

```yaml
order.field.quantity:  { primitive: integer, min: 1, max: 99, notIn: [13] }
```

makes this schema:

```ts
/** urn:demo:shop:order:field:quantity */
export const OrderQuantitySchema = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(1),
  v.maxValue(99),
  v.notValues([13]),
  v.brand("urn:demo:shop:order:field:quantity"),
);
```

A `decimal` field gets checks that call helper functions. This line:

```yaml
value.field.price: { primitive: decimal, min: "0.01", max: "9999.99", scale: 2, notIn: ["13.00"] }
```

makes this schema:

```ts
/** urn:demo:kinds:value:field:price */
export const ValuePriceSchema = v.pipe(
  v.string(),
  v.regex(DECIMAL, 'Invalid decimal: Expected digits with an optional fraction, such as 12.50'),
  v.check((value) => !DECIMAL.test(value) || compareDecimal(value, "0.01") >= 0, "Invalid value: Expected >=0.01"),
  v.check((value) => !DECIMAL.test(value) || compareDecimal(value, "9999.99") <= 0, "Invalid value: Expected <=9999.99"),
  v.check((value) => !DECIMAL.test(value) || decimalFraction(value) <= 2, "Invalid decimal: Expected at most 2 digit(s) after the point"),
  v.check((value) => !DECIMAL.test(value) || !["13.00"].some((excluded) => compareDecimal(value, excluded) === 0), "Invalid value: Expected none of 13.00"),
  v.brand("urn:demo:kinds:value:field:price"),
);
```

- Each check of a `decimal` or a `timestamp` bound examines only a value of the correct form. Thus a value of an incorrect form gets one issue, not one for each bound.
- The schema file has a `// Helpers` section only if a field needs it: `DECIMAL`, `decimalFraction`, `decimalScaled` and `compareDecimal` for `decimal`, `isCalendarDate` for `date`, and `isCalendarDate` and `isUtcTimestamp` for `timestamp`. The helpers compare decimals with `BigInt`, so your tsconfig needs the `ES2020` library or later.
- A numeric constraint value of `-0` stays `-0` in the generated code.

## Coherence rules (pass 7)

After pass 1, pass 7 examines the constraints of each field together. First, it looks for two constraints for one side of one aspect. Then, if no value can be valid, it reports `incoherent-constraints`. The position is the constraint in the column "Diagnostic at".

| Primitive | Rule | Code | Diagnostic at | Message after `<URN>: ` |
| --- | --- | --- | --- | --- |
| `float`, `decimal`, `timestamp` | At most one lower bound and one upper bound | `conflicting-constraints` | The second constraint | `min and exclusiveMin both set a lower bound; keep one` |
| `string` | At most one of `regex` and `format` | `conflicting-constraints` | `format` | `regex and format both set the shape; keep one` |
| `float`, `integer`, `decimal` | The lower bound is not more than the upper bound | `incoherent-constraints` | The upper bound | `min (<a>) is greater than max (<b>), so no value is valid` |
| `float`, `decimal`, `timestamp` | Equal bounds are both inclusive | `incoherent-constraints` | The upper bound | `exclusiveMin and max are both <n>, and one of them excludes it, so no value is valid` |
| `float`, `decimal` | If `min` and `max` are equal, `notIn` does not list that value | `incoherent-constraints` | `notIn` | `min and max are both <n> and notIn lists it, so no value is valid` |
| `integer` | A multiple of `multipleOf` is between `min` and `max` | `incoherent-constraints` | `multipleOf` | `no multiple of <n> is between min (<a>) and max (<b>), so no value is valid` |
| `integer` | `notIn` does not list each value that `min`, `max` and `multipleOf` allow | `incoherent-constraints` | `notIn` | `notIn lists every value that min, max and multipleOf allow, so no value is valid` |
| `decimal` | A value with at most `scale` digits after the point is between the bounds | `incoherent-constraints` | `scale` | `no value with at most <s> digit(s) after the point is between min (<a>) and max (<b>), so no value is valid` |
| `decimal` | `notIn` does not list each value that the bounds and `scale` allow | `incoherent-constraints` | `notIn` | `notIn lists every value that the bounds and scale allow, so no value is valid` |
| `date`, `timestamp` | `min` is not after `max` | `incoherent-constraints` | The upper bound | `min (<a>) is after max (<b>), so no value is valid` |
| `string` | `minLength` is not more than `maxLength` | `incoherent-constraints` | `maxLength` | `minLength (<a>) is greater than maxLength (<b>), so no value is valid` |
| `string` | A `uuid` has 36 characters, which the length constraints allow | `incoherent-constraints` | `format` | `a uuid has 36 characters, which the length constraints exclude, so no value is valid` |

- If a field has `conflicting-constraints`, pass 7 does not examine its coherence.
- The `notIn` rules list the allowed values only if there are 100,000 or fewer. For a larger range, pass 7 does not examine `notIn`.
- The message names the constraints that the field sets. For example, `notIn lists every value that min, max allow` has no `multipleOf`.
- `boolean` and `enum` have no rule. One `mustBe` value or one listed name always gives a valid value.
- A list on a field reference has one rule: `minItems` is not more than `maxItems`. Refer to [The manifest](./manifest).

## Table cells

The [Gherkin steps](./gherkin-steps) and gate 3 change each cell of a table to a value with the primitive of its field. Gherkin removes the spaces at the start and at the end of a cell before this change.

| Cell | `boolean` | `float` and `integer` | `string` and `enum` | `decimal`, `date` and `timestamp` |
| --- | --- | --- | --- | --- |
| Empty | No value | No value | No value | No value |
| `true` | `true` | The string `"true"` | `"true"` | `"true"` |
| `false` | `false` | The string `"false"` | `"false"` | `"false"` |
| A number literal, for example `10`, `-3`, `1.5`, `.5`, `+7` or `1e3` | The string | The number | The text as a string | The text as a string |
| `Infinity`, `-Infinity`, `NaN` | The string | The number `Infinity`, `-Infinity` or `NaN` | The text as a string | The text as a string |
| `""` | The string `'""'` | The string `'""'` | The empty string `""` | The string `'""'` |
| Other text, for example `abc`, `TRUE` or `0x10` | The string | The string | The text as a string | The text as a string |

- An empty cell in an input table sends no key. In an output or error table, it means that the key must be absent.
- The pattern of a number literal is `^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$`, and the words `Infinity`, `-Infinity`, `+Infinity` and `NaN`.
- A cell that does not become the type of the primitive stays a string. The schema of the field then rejects it. As a result, a scenario can send an incorrect value, for example `abc` to a `float` field.
- A `decimal` cell stays text, so it keeps each digit. The output step compares it as text: `"250.00"` is not equal to `"250"`.
- To send an empty string to a `string` field, write `""`. An empty cell sends no value.
- A cell for a list is `[a, b, c]`, and `[]` is the empty list. A cell for an embedded entity is an object, for example `{ peril: fire, limit: 1000.00 }`. The steps convert each value in a list or an object with the primitive of its field, as this table shows. To put a comma, a bracket, a brace or a double quote in a value, write the value as a JSON string literal, for example `"Smith, Ada"`. A cell without the brackets stays text, so the schema rejects it. For the full syntax, refer to [Gherkin steps](./gherkin-steps).
- A cell for a link has the value of the key field of the linked entity, with the primitive of the key field.

## Boundary cases

Gate 3 examines the values that the scenarios of an operation send for each input field. For each constraint, the values must include the boundary cases in this table. A case that is not there causes `uncovered-boundary`. The column "Label" gives the text in the message. For the gate, refer to [Verification gates](./verification-gates).

| Constraint | Primitive | Necessary value | Label |
| --- | --- | --- | --- |
| `mustBe` | `boolean` | The `mustBe` value | `value <value> (mustBe)` |
| `mustBe` | `boolean` | The other boolean value | `value <other value> (not mustBe)` |
| `values` | `enum` | Each listed name | `value "<name>" (values)` |
| `values` | `enum` | A string that is not in the list | `value outside values` |
| `min` | `integer` | `min` | `value at min <min>` |
| `min` | `integer` | `min − 1` | `value at min − 1 (<min − 1>)` |
| `min` | `float` | `min` | `value at min <min>` |
| `min` | `float` | A value less than `min` | `value below min <min>` |
| `max` | `integer` | `max` | `value at max <max>` |
| `max` | `integer` | `max + 1` | `value at max + 1 (<max + 1>)` |
| `max` | `float` | `max` | `value at max <max>` |
| `max` | `float` | A value more than `max` | `value above max <max>` |
| `exclusiveMin` | `float`, `decimal` | The bound itself, which the schema refuses | `value at exclusiveMin <n>` |
| `exclusiveMin` | `float`, `decimal` | A value more than the bound | `value above exclusiveMin <n>` |
| `exclusiveMax` | `float`, `decimal` | The bound itself, which the schema refuses | `value at exclusiveMax <n>` |
| `exclusiveMax` | `float`, `decimal` | A value less than the bound | `value below exclusiveMax <n>` |
| `multipleOf` | `integer` | A multiple | `multiple of <n> (multipleOf)` |
| `multipleOf` | `integer` | An integer that is not a multiple | `value that is not a multiple of <n>` |
| `notIn` | `integer`, `float`, `decimal` | Each listed value | `value <value> (notIn)` |
| `min` | `decimal` | `min` | `value at min <min>` |
| `min` | `decimal` | With `scale`: one step below `min` at the scale. Without it: a value less than `min` | `value one step below min (<value>)` or `value below min <min>` |
| `max` | `decimal` | `max` | `value at max <max>` |
| `max` | `decimal` | With `scale`: one step above `max` at the scale. Without it: a value more than `max` | `value one step above max (<value>)` or `value above max <max>` |
| `scale` | `decimal` | A value with `scale` digits after the point | `value with <s> digit(s) after the point (scale)` |
| `scale` | `decimal` | A value with `scale + 1` digits after the point | `value with <s + 1> digits after the point (above scale)` |
| `min` | `date` | `min` | `value at min <min>` |
| `min` | `date` | The day before `min` | `day before min (<day>)` |
| `max` | `date` | `max` | `value at max <max>` |
| `max` | `date` | The day after `max` | `day after max (<day>)` |
| `min` | `timestamp` | `min` | `value at min <min>` |
| `min` | `timestamp` | An instant before `min` | `value before min <min>` |
| `max` | `timestamp` | `max` | `value at max <max>` |
| `max` | `timestamp` | An instant after `max` | `value after max <max>` |
| `exclusiveMin` | `timestamp` | The bound itself | `value at exclusiveMin <t>` |
| `exclusiveMin` | `timestamp` | An instant after the bound | `value after exclusiveMin <t>` |
| `exclusiveMax` | `timestamp` | The bound itself | `value at exclusiveMax <t>` |
| `exclusiveMax` | `timestamp` | An instant before the bound | `value before exclusiveMax <t>` |
| `minLength` | `string` | A string of length `minLength` | `value of length <n> (minLength)` |
| `minLength` | `string` | A string of length `minLength − 1`. Only if `minLength` is more than `0` | `value of length <n − 1> (below minLength)` |
| `maxLength` | `string` | A string of length `maxLength` | `value of length <n> (maxLength)` |
| `maxLength` | `string` | A string of length `maxLength + 1` | `value of length <n + 1> (above maxLength)` |
| `regex` | `string` | A string that the pattern matches | `valid value for regex <pattern>` |
| `regex` | `string` | A string that the pattern does not match | `invalid value for regex <pattern>` |
| `format` | `string` | A valid value of the format | `valid <format> (format)` |
| `format` | `string` | A string that is not a valid value of the format | `value that is not a valid <format>` |

- A field with no constraints has no boundary cases.
- A value covers a numeric case only if it is equal with `===`. Thus `0` and `-0` both cover a bound of `0`.
- A `decimal` value covers a case if it is equal as an exact number. Thus `"0.010"` covers `value at min 0.01`.
- A `timestamp` value covers a case if it is equal as an instant.
- A value covers a `string` case only if it is a string. A `boolean` case needs a boolean.
- For a list, the items are the values of the field. The list itself has the cases of `minItems`, `maxItems` and `unique`. Refer to [Verification gates](./verification-gates).
- Gate 3 reads the values. It does not run the scenarios. The test run shows if the scenarios pass.

## Related pages

- [The MECE model of primitives](../explanation/primitives-model)
- [The manifest](./manifest)
- [The generated schemas](./generated-schemas)
- [Add a field](../how-to/add-a-field)
- [Contributor: add a primitive](../how-to/add-a-primitive)
