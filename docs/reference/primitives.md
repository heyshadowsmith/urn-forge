# Primitives and constraints

Each field has one primitive. A primitive sets the TypeScript type of the value and the constraints that the field can have. urn-forge 0.1.0 has four primitives: `boolean`, `float`, `integer` and `string`.

## Primitives

| Primitive | TypeScript type | Valibot start of the pipe | Constraints |
| --- | --- | --- | --- |
| `boolean` | `boolean` | `v.boolean()` | `mustBe` |
| `float` | `number`, finite | `v.number()`, `v.finite()` | `min`, `max`, `notEqual` |
| `integer` | `number`, a safe integer | `v.number()`, `v.safeInteger()` | `min`, `max`, `notEqual` |
| `string` | `string` | `v.string()` | `minLength`, `maxLength`, `regex`, `oneOf` |

- A finite number is not `Infinity`, `-Infinity` or `NaN`.
- A safe integer is an integer from `-(2^53 − 1)` to `2^53 − 1`.
- The output type of each field schema is the TypeScript type with a brand: `v.InferOutput` of the schema. The input type has no brand. Refer to [The generated schemas](./generated-schemas).
- For a `string` field with `oneOf`, the output type is the union of the listed values, with the brand. The input type stays `string`.

urn-forge 0.1.0 does not have the primitives `decimal`, `timestamp`, `list`, `record` and `ref` at this time. Refer to [Scope](./scope).

## Constraints

| Constraint | Primitive | Value type | Rules for the value (pass 1) | Valibot action |
| --- | --- | --- | --- | --- |
| `mustBe` | `boolean` | boolean | — | `v.value(<value>)` |
| `min` | `float` | number | Finite | `v.minValue(<value>)` |
| `min` | `integer` | number | A safe integer | `v.minValue(<value>)` |
| `max` | `float` | number | Finite | `v.maxValue(<value>)` |
| `max` | `integer` | number | A safe integer | `v.maxValue(<value>)` |
| `notEqual` | `float` | number | Finite | `v.notValue(<value>)` |
| `notEqual` | `integer` | number | A safe integer | `v.notValue(<value>)` |
| `minLength` | `string` | number | A safe integer, `0` or more | `v.minLength(<value>)` |
| `maxLength` | `string` | number | A safe integer, `0` or more | `v.maxLength(<value>)` |
| `regex` | `string` | string | Not empty. A valid JavaScript regular expression with the `u` flag | `v.regex(/^(?:<value>)$/u)` |
| `oneOf` | `string` | list of strings | One or more items. No item two times | `v.picklist([<values>])` |

All constraints are optional. A constraint of a different primitive causes `constraint-not-allowed`. A key that is a constraint of no primitive causes `unknown-property`. A value of the wrong type or form causes `invalid-value`.

### Valid values for each constraint

| Constraint | A value is valid if |
| --- | --- |
| `mustBe` | It is equal to the constraint value |
| `min` | It is equal to or more than the constraint value |
| `max` | It is equal to or less than the constraint value |
| `notEqual` | It is not equal to the constraint value |
| `minLength` | Its `length` is equal to or more than the constraint value |
| `maxLength` | Its `length` is equal to or less than the constraint value |
| `regex` | The pattern matches the full value |
| `oneOf` | It is equal to one of the listed values |

The `length` of a string is the JavaScript `length`: the number of UTF-16 code units.

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
order.field.quantity:  { primitive: integer, min: 1, max: 99, notEqual: 13 }
```

makes this schema:

```ts
/** urn:demo:shop:order:field:quantity */
export const OrderQuantitySchema = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(1),
  v.maxValue(99),
  v.notValue(13),
  v.brand("urn:demo:shop:order:field:quantity"),
);
```

A numeric constraint value of `-0` stays `-0` in the generated code.

## Coherence rules (pass 7)

After pass 1, pass 7 examines the constraints of each field together. If no value can be valid, or if a listed value can never be valid, pass 7 reports `incoherent-constraints`. The position is the constraint in the column "Diagnostic at".

| Primitive | Rule | Diagnostic at | Message after `<URN>: ` |
| --- | --- | --- | --- |
| `boolean` | No rule. One `mustBe` value always accepts a value | — | — |
| `float`, `integer` | `min` is not more than `max` | `max` | `min (<min>) is greater than max (<max>), so no value is valid` |
| `float`, `integer` | If `min` and `max` are equal, `notEqual` is not that value | `notEqual` | `min and max are both <n> and notEqual is <n>, so no value is valid` |
| `string` | `minLength` is not more than `maxLength` | `maxLength` | `minLength (<a>) is greater than maxLength (<b>), so no value is valid` |
| `string` | Each `oneOf` value is not shorter than `minLength` | `oneOf` | `oneOf value "<v>" is shorter than minLength (<n>), so it is never valid` |
| `string` | Each `oneOf` value is not longer than `maxLength` | `oneOf` | `oneOf value "<v>" is longer than maxLength (<n>), so it is never valid` |
| `string` | Each `oneOf` value matches `regex` | `oneOf` | `oneOf value "<v>" does not match regex <pattern>, so it is never valid` |

- For a numeric field, if `min` is more than `max`, pass 7 does not examine `notEqual`.
- For a `string` field, if `minLength` is more than `maxLength`, pass 7 does not examine the `oneOf` values.
- Pass 7 reports one problem for each `oneOf` value that is never valid. It examines the rules in the sequence of the table and reports the first rule that the value does not obey.
- A `notEqual` value outside `min` to `max` is correct.

## Table cells

The [Gherkin steps](./gherkin-steps) and gate 3 change each cell of a table to a value with the primitive of its field. Gherkin removes the spaces at the start and at the end of a cell before this change.

| Cell | `boolean` | `float` and `integer` | `string` |
| --- | --- | --- | --- |
| Empty | No value. The payload does not have the key | No value. The payload does not have the key | No value. The payload does not have the key |
| `true` | `true` | The string `"true"` | `"true"` |
| `false` | `false` | The string `"false"` | `"false"` |
| A number literal, for example `10`, `-3`, `1.5`, `.5`, `+7` or `1e3` | The string | The number | The text as a string |
| `Infinity`, `-Infinity`, `NaN` | The string | The number `Infinity`, `-Infinity` or `NaN` | The text as a string |
| `""` | The string `'""'` | The string `'""'` | The empty string `""` |
| Other text, for example `abc`, `TRUE` or `0x10` | The string | The string | The text as a string |

- The pattern of a number literal is `^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$`, and the words `Infinity`, `-Infinity`, `+Infinity` and `NaN`.
- A cell that does not become the type of the primitive stays a string. The schema of the field then rejects it. As a result, a scenario can send an incorrect value, for example `abc` to a `float` field.
- An `integer` cell such as `1.5` becomes the number `1.5`. The schema rejects it because it is not a safe integer.
- To send an empty string to a `string` field, write `""`. An empty cell sends no value.

## Boundary cases

Gate 3 examines the values that the scenarios of an operation send for each input field. For each constraint, the values must include the boundary cases in this table. A case that is not there causes `uncovered-boundary`. The column "Label" gives the text in the message. For the gate, refer to [Verification gates](./verification-gates).

| Constraint | Primitive | Necessary value | Label |
| --- | --- | --- | --- |
| `min` | `integer` | `min` | `value at min <min>` |
| `min` | `integer` | `min − 1` | `value at min − 1 (<min − 1>)` |
| `min` | `float` | `min` | `value at min <min>` |
| `min` | `float` | A value less than `min` | `value below min <min>` |
| `max` | `integer` | `max` | `value at max <max>` |
| `max` | `integer` | `max + 1` | `value at max + 1 (<max + 1>)` |
| `max` | `float` | `max` | `value at max <max>` |
| `max` | `float` | A value more than `max` | `value above max <max>` |
| `notEqual` | `float`, `integer` | The `notEqual` value | `value equal to notEqual <value>` |
| `minLength` | `string` | A string of length `minLength` | `value of length <n> (minLength)` |
| `minLength` | `string` | A string of length `minLength − 1`. Only if `minLength` is more than `0` | `value of length <n − 1> (below minLength)` |
| `maxLength` | `string` | A string of length `maxLength` | `value of length <n> (maxLength)` |
| `maxLength` | `string` | A string of length `maxLength + 1` | `value of length <n + 1> (above maxLength)` |
| `regex` | `string` | A string that the pattern matches | `valid value for regex <pattern>` |
| `regex` | `string` | A string that the pattern does not match | `invalid value for regex <pattern>` |
| `oneOf` | `string` | Each listed value | `value "<value>" (oneOf)` |
| `oneOf` | `string` | A string that is not in the list | `value outside oneOf` |
| `mustBe` | `boolean` | The `mustBe` value | `value <value> (mustBe)` |
| `mustBe` | `boolean` | The other boolean value | `value <other value> (not mustBe)` |

- A field with no constraints has no boundary cases.
- A value covers a numeric case "at" a number, "equal to" a number or "min − 1" and "max + 1" only if it is equal with `===`. Thus `0` and `-0` both cover a bound of `0`.
- A value covers a `string` case only if it is a string. A `boolean` case needs a boolean.
- Gate 3 reads the values. It does not run the scenarios. The test run shows if the scenarios pass.

## Related pages

- [The manifest](./manifest)
- [The generated schemas](./generated-schemas)
- [Add a field](../how-to/add-a-field)
- [Contributor: add a primitive](../how-to/add-a-primitive)
- [Boundary coverage and the ratchet](../explanation/boundary-coverage)
