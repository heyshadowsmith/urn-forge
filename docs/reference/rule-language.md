# Rules and the rule language

Every rule has a name, and its text is in one place: the top-level `rules` section, or the standard set that urn-forge ships. Definitions, outputs and operations apply rules by name.

## A rule

```yaml
rules:
  at_least:
    description: The value is the bound or more
    parameters: [limit]
    rule: self >= limit
    message: Must be at least {limit}
```

| Key | Required | Value |
| --- | --- | --- |
| `description` | Yes | What the rule states, for a reader |
| `rule` | Yes | An expression that gives `true` when the value keeps the rule |
| `message` | Yes | The text of a failure. `{name}` puts in the argument of a parameter; a list argument is joined with `, ` |
| `parameters` | No | Names of definitions. Each is a parameter, with the type of its definition |
| `deprecated` | No | `true` or `false` |

### Applying a rule

| The rule has | Apply it as |
| --- | --- |
| No parameter | `- uniqueItems` |
| One parameter | `- minimum: 1` |
| Two or more | `- between: { low: 1, high: 9 }` |

The argument must be a valid value of the parameter's definition: `- minLength: -1` stops `compile` with `rule-argument`.

| Applied to | The rule can read |
| --- | --- |
| A definition | `self`: the value |
| An output: `- quote: [fits_express]` | `input`, and `output`: that object |
| An operation's `rules` | `input`, and `output` if the operation has one output |

A rule that reads a name that does not exist where it is applied stops `compile` with `rule-scope`.

## The standard rules

The standard rules are JSON Schema's keywords, declared like any rule in `src/standard.manifest.yaml` of the package.

| Rule | For | Parameter | Rule text | Message |
| --- | --- | --- | --- | --- |
| `enum` | `string` | `choices`: a list of strings | `self in choices` | `Must be one of {choices}` |
| `const` | `string` | `choice`: a string | `self == choice` | `Must be {choice}` |
| `minimum` | `integer`, `number` | `bound`: a number | `self >= bound` | `Must be at least {bound}` |
| `maximum` | `integer`, `number` | `bound`: a number | `self <= bound` | `Must be at most {bound}` |
| `exclusiveMinimum` | `integer`, `number` | `bound`: a number | `self > bound` | `Must be more than {bound}` |
| `exclusiveMaximum` | `integer`, `number` | `bound`: a number | `self < bound` | `Must be less than {bound}` |
| `multipleOf` | `integer` | `factor`: an integer of 1 or more | `self % factor == 0` | `Must be a multiple of {factor}` |
| `minLength` | `string` | `count`: an integer of 0 or more | `size(self) >= count` | `Must have at least {count} characters` |
| `maxLength` | `string` | `count`: an integer of 0 or more | `size(self) <= count` | `Must have at most {count} characters` |
| `pattern` | `string` | `regular_expression`: a string | `self.matches(regular_expression)` | `Must match {regular_expression}` |
| `format` | `string` | `date_format`: `date` or `date-time` | A pattern for each format | `Must be a {date_format}` |
| `minItems` | `array` | `count`: an integer of 0 or more | `size(self) >= count` | `Must have at least {count} items` |
| `maxItems` | `array` | `count`: an integer of 0 or more | `size(self) <= count` | `Must have at most {count} items` |
| `uniqueItems` | `array` | none | `self.all(x, self.exists_one(y, y == x))` | `Must not have an item two times` |
| `required` | `object` | `property_names`: a list of names | `property_names.all(p, p in self)` | `Must have {property_names}` |

- A standard rule on another type stops `compile` with `rule-type`.
- `enum` and `const` are for strings. For a choice of numbers, use `minimum` and `maximum`, or a rule of your own.
- `pattern` matches part of the text; anchor it with `^…$` to match the whole.
- `format: date-time` accepts fractions of a second and an offset such as `+02:00` in place of `Z`.

## The language

A rule is an expression in a subset of CEL, the Common Expression Language, as Kubernetes and protovalidate use it with schemas. Every rule that urn-forge accepts is valid CEL. A form outside the subset stops `compile` with `rule-syntax`, and the message names the form.

### Values

| Type | From | Literals |
| --- | --- | --- |
| `int` | An `integer` definition | `5000`, `-1` |
| `double` | A `number` definition | `0.5`, `1e3` |
| `string` | A `string` definition | `'confirmed'`, `"confirmed"`, raw `r'^[0-9]{4}$'` |
| `bool` | A `boolean` definition | `true`, `false` |
| `list(T)` | An `array` definition | `['main', 'dessert']` (not empty) |
| An object | An `object` definition | none; read its properties with `.` |
| `timestamp` | `timestamp(s)` | |
| `duration` | `duration(s)` | |

### Operators

From the lowest precedence to the highest: `||`; `&&`; the relations `==` `!=` `<` `<=` `>` `>=` `in`; `+` `-`; `*` `/` `%`; `!` and unary `-`; `a.b`. Parentheses change the order.

- `==` compares lists item by item and objects property by property.
- `<` and the other comparisons take numbers, strings, timestamps or durations. Write `0 < self && self < 10`, not a chain.
- `/` of two ints rounds toward 0. A division by 0 breaks the rule. `*` and `/` do not mix an int and a double: write `2.0` for a `number`.
- `in` tests an item of a list, or a property name of an object.
- `+` joins strings and lists, and adds a duration to a timestamp. A timestamp minus a timestamp is a duration.

### Functions and macros

| Form | Gives |
| --- | --- |
| `has(a.b)` | Whether the property is present |
| `size(x)`, `x.size()` | The characters of a string, or the items of a list |
| `s.matches(re)` | Whether the regular expression matches part of the string |
| `timestamp(s)` | A timestamp from an RFC 3339 string, such as `'2026-11-24T19:00:00Z'` |
| `duration(s)` | A duration from a literal such as `'2h'`, `'30m'` or `'1h30m'` (units `h`, `m`, `s`, `ms`, `us`, `ns`) |
| `l.all(x, p)`, `l.exists(x, p)`, `l.exists_one(x, p)` | Whether `p` holds for each, at least one, or exactly one item |
| `l.map(x, e)` | A list of the values of `e` |
| `l.sum()` | The total of a list of numbers |

For a total: `!has(self.dishes) || (has(self.total) && self.total == self.dishes.map(d, d.amount).sum())`.

### Optional properties

A rule reads a property that its object does not require only after a guard: `has(self.deposit) && …` or `!has(self.deposit) || …`. Otherwise `compile` stops with `rule-guard`. CEL would fail at run time; urn-forge fails at compile time. `has()` of a required property stops `compile` with `rule-type`.

### Times

A time is a string. Each rule that compares it turns it into a timestamp:

```
timestamp(self.ends_at) > timestamp(self.starts_at) + duration('30m')
```

A string that is not a valid time breaks the rule. There are no time zones, days or months: a day is `'24h'`. A `format: date` string compares as text, which is date order.

### Not in the subset

The conditional `a ? b : c`, `null`, an index `a[0]`, maps, a chain of comparisons, methods and functions other than those above (such as `startsWith()` or `int()`), `filter`, `min()`, `max()`, triple-quoted strings, and unsigned or hexadecimal numbers. A form is added only for a real need.

## Where a rule runs

- **In the harness.** Each rule is plain TypeScript in a `v.check` of the Valibot schema of its definition, with no CEL library at run time. A rule that gives an error, such as `timestamp()` of text that is not a time, breaks.
- **In Postgres**, with `postgres` in the config: a rule that SQL can say is a `CHECK` constraint, and the rules of a list are a `UNIQUE` constraint or a trigger. A rule with a macro or `sum()` stays in the harness. Refer to [Store objects in Postgres](../how-to/store-in-postgres).
- **In `diff`**, which compares rules by name and argument. Refer to [the CLI](./cli#diff).
