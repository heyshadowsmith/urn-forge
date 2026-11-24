# The rule language

The text of a rule is an expression in a subset of CEL, the Common Expression Language. Kubernetes and Buf's protovalidate use CEL with schemas in the same way. Each rule that urn-forge accepts is valid CEL. urn-forge parses the subset itself, so that it can type each rule, translate it to TypeScript and SQL, and compare it in `diff`. A form of CEL that is not in the subset stops `compile` with `rule-syntax`, and the message names the form.

A rule must give a `bool`. `true` means that the value keeps the rule.

## Names

| Name | Where | Type |
| --- | --- | --- |
| `self` | A rule of a definition | The type of the definition |
| `input` | A rule of an output or an operation | The input object |
| `output` | A rule of an output: that object. A rule of an operation with one output: that output | The output object |
| A parameter, such as `bound` | A rule with `parameters` | The type of the definition of the parameter |
| The variable of a macro, such as `x` in `self.all(x, …)` | The body of the macro | The type of an item |

A name that does not exist where the rule applies stops `compile` with `rule-scope`.

## Types

| CEL type | Comes from |
| --- | --- |
| `int` | An `integer` definition, or an integer literal such as `5000` |
| `double` | A `number` definition, or a literal with a point or an exponent, such as `0.5` |
| `string` | A `string` definition, or a string literal |
| `bool` | A `boolean` definition, `true` or `false` |
| `list(T)` | An `array` definition, or a list literal such as `[1, 2]` |
| An object | An `object` definition |
| `timestamp` | `timestamp(s)` |
| `duration` | `duration(s)` |

## Literals

| Literal | Example | Notes |
| --- | --- | --- |
| Integer | `5000`, `-1` | No leading `0`, no hexadecimal, no `u` suffix. It must be a safe integer |
| Double | `0.5`, `1e3`, `2.5e-1` | |
| String | `'confirmed'`, `"confirmed"` | The escapes are `\\`, `\'`, `\"`, `\n`, `\t` and `\r`. No triple quotes |
| Raw string | `r'^[0-9]{4}$'` | A backslash is a plain character. Use it for a regular expression |
| Bool | `true`, `false` | |
| List | `['main', 'dessert']` | The items have one type. An empty list `[]` has no type, and is not allowed |

## Operators

From the lowest precedence to the highest:

| Operators | Takes | Gives |
| --- | --- | --- |
| `\|\|` | Two bools | `bool` |
| `&&` | Two bools | `bool` |
| `==`, `!=` | Two values of one type, or two numbers | `bool` |
| `<`, `<=`, `>`, `>=` | Two numbers, two strings, two timestamps or two durations | `bool` |
| `in` | A value and a list of its type, or a name (a string) and an object | `bool` |
| `+` | Two ints, two doubles, two strings, two lists or two durations; a timestamp and a duration | The same type; a timestamp |
| `-` | Two ints, two doubles or two durations; a timestamp and a duration | The same type; a timestamp |
| `-` | Two timestamps | `duration` |
| `*`, `/` | Two ints or two doubles | The same type |
| `%` | Two ints | `int` |
| `!` | A bool | `bool` |
| `-` (unary) | An int, a double or a duration | The same type |
| `a.b` | An object | The type of the property `b` |

Parentheses change the precedence. A chain of comparisons, such as `0 < self < 10`, is not in the subset. Write `0 < self && self < 10`.

`/` of two ints goes toward 0, as in CEL. A division by 0 breaks the rule. `*` and `/` do not mix an int and a double: for a `number`, write `2.0`, not `2`.

`==` compares lists item by item, and objects property by property.

## Functions and macros

| Form | Takes | Gives |
| --- | --- | --- |
| `has(a.b)` | One property of an object | `true` if the property is present |
| `size(x)`, `x.size()` | A string or a list | `int`: the characters of a string, or the items of a list |
| `s.matches(re)` | A string and a regular expression | `true` if the expression matches a part of the string |
| `timestamp(s)` | A string in the format of RFC 3339, such as `'2026-11-24T19:00:00Z'` | `timestamp` |
| `duration(s)` | A string literal of hours, minutes or seconds, such as `'2h'`, `'30m'` or `'1h30m'` | `duration` |
| `l.sum()` | A list of ints or doubles | Its total |
| `l.all(x, p)` | A list, a name for each item, and a condition | `true` if `p` holds for each item |
| `l.exists(x, p)` | The same | `true` if `p` holds for one item or more |
| `l.exists_one(x, p)` | The same | `true` if `p` holds for exactly one item |
| `l.map(x, e)` | A list, a name for each item, and an expression | A list of the values of `e` |

`sum()` and `map()` come from the list extension of Kubernetes' CEL. Use them together for a total:

```
!has(self.dishes) || (has(self.total) && self.total == self.dishes.map(d, d.amount).sum())
```

The name of the item of a macro cannot be a name that already exists, such as `self`.

## Optional properties and has()

A property that the `required` rule of its object does not list can be absent. A rule reads it only after a guard that shows it is present. Otherwise, `compile` stops with `rule-guard`.

| Guard | The right side can read `self.deposit` |
| --- | --- |
| `has(self.deposit) && …` | Yes |
| `!has(self.deposit) \|\| …` | Yes |

The guard also works through `!`, and in the left side of a longer chain of `&&` or `||`. `has()` of a required property stops `compile` with `rule-type`, because it is always true.

This check is stricter than CEL, and each rule that passes it is still valid CEL.

## Times

A time is a string. A rule makes a timestamp of it with `timestamp(...)`, in each rule that compares it. The rule `format` does not change the type.

```
timestamp(self.ends_at) > timestamp(self.starts_at) + duration('30m')
```

- A timestamp minus a timestamp is a duration: `timestamp(self.expires_at) - timestamp(self.effective_at) <= duration('8784h')`.
- A duration has the units `h`, `m`, `s`, `ms`, `us` and `ns`. There are no days, no months and no calendar arithmetic. A day is `'24h'`.
- A string that is not a valid time breaks the rule.
- A `format: date` string, such as `2026-11-24`, compares as text. Text order is date order for this format.

## Not in the subset

These forms of CEL stop `compile` with `rule-syntax`. The message names the form.

| Form | Message |
| --- | --- |
| `a ? b : c` | `?: is not in the subset; write the rule with && and \|\|` |
| `null` | `null is not in the subset; use has() for a value that can be absent` |
| `a[0]` | `an index [ ] is not in the subset` |
| `{'a': 1}` | `maps are not in the subset` |
| `0 < self < 10` | `a chain of comparisons is not in the subset; join them with &&` |
| A method such as `s.startsWith('a')` | `the method startsWith() is not in the subset` |
| A function such as `int(x)` | `the function int() is not in the subset` |
| `'''text'''` | `a string in triple quotes is not in the subset` |
| `0x1F`, `1u` | `unsigned and hexadecimal numbers are not in the subset` |

Also not in the subset: `filter`, `min()`, `max()`, type conversions, and custom functions. A form is added only for a real need.

## How a rule runs

- In the generated TypeScript, each rule is plain code. There is no CEL library at run time.
- A rule whose evaluation gives an error, such as `timestamp()` of a text that is not a time, or a division by 0, breaks.
- In the Postgres schema, a rule that SQL can say becomes a `CHECK` constraint. A rule with a macro, a list or a path into a `JSONB` column stays in the harness. Refer to [The Postgres schema](./postgres-schema).

## Diagnostics

| Code | Cause |
| --- | --- |
| `rule-syntax` | The rule does not parse, or it uses a form outside the subset |
| `rule-type` | A type is wrong, or the rule does not give a `bool` |
| `rule-guard` | The rule reads an optional property without a guard |
| `rule-scope` | The rule reads a name that does not exist where it is applied |

For examples, refer to [Diagnostics](./diagnostics).

## Related pages

- [Rules and the standard rules](./rules)
- [Add a rule](../how-to/add-a-rule)
- [JSON Schema's words and CEL](../explanation/json-schema-and-cel)
