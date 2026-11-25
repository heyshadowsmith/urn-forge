# The manifest and its rules

The manifest is one YAML file, `domain.manifest.yaml` by default. It has four top-level sections; only `manifest` is required. A key that this page does not list stops `compile` with `manifest-shape`. The [booking example](#example) at the end uses every construct.

| Section | Holds |
| --- | --- |
| `manifest` | The header: `namespace`, `domain`, `version` (semver, read by `diff`), and the optional `compatibility: { callers: ignore-unknown }` (refer to [Change the contract](../how-to/change-the-contract)). The Postgres schema takes the domain's name |
| `definitions` | The values: numbers, strings, objects, lists |
| `rules` | The text of every rule of your own |
| `operations` | Each operation: an input, the outputs, and their rules |

A name is lowercase snake_case: `^[a-z][a-z0-9_]{0,62}$`. Every definition, rule and operation has a `description`, used as a comment in the generated code and the Postgres schema. `deprecated: true` marks it `@deprecated`, and each live use of it gets the warning `deprecated-use`.

## Definitions

| Key | For | Value |
| --- | --- | --- |
| `type` | Every definition, required | One of the six types, or the name of another definition |
| `properties` | `object`, required | The names of the definitions that are its properties |
| `items` | `array`, required | The name of the definition of each item |
| `identifier` | `object` | A required property, not an object or a list, that tells two objects apart. It is the Postgres primary key |
| `rules` | Every definition | The rules the value keeps |

Structure (`type`, `properties`, `items`, `identifier`) is what a value is. Everything that must be true of it, including `required` and `enum`, is a rule.

| `type` | A value | TypeScript |
| --- | --- | --- |
| `string` | Text | `string`, or the union of its `enum` choices |
| `integer` | A safe integer | `number` |
| `number` | A finite number | `number` |
| `boolean` | `true` or `false` | `boolean` |
| `object` | Named properties, and no others | `interface` |
| `array` | A list of items | `readonly T[]` |

There is no date or decimal type. A date is a `string` with `format: date`, a time a `string` with `format: date-time` (`2026-11-24T19:00:00Z`). Money is an `integer` of its smallest unit, such as cents.

- **An object** lists its properties by the names of their definitions, which keep their rules: a property cannot be renamed or narrowed in place. A property that `required` does not list is optional (`?` in TypeScript). An object definition in `properties` embeds that object.
- **A list** has items of its `items` definition, with their rules. The list's own rules, such as `maxItems`, apply to the whole list.
- **A definition as a type**: `type: booking` makes a definition with the structure and rules of `booking`, plus its own rules. This gives one kind of value two roles (`from_account` and `to_account`), or refers to an object by its identifier (`holder` of `type: customer_id`).

## Operations

```yaml
operations:
  seat_booking:
    description: Seat the party of a booking
    input: seat_request
    output:
      - booking: [was_confirmed, is_seated, keeps_the_party]
      - invalid_state: [was_not_confirmed, names_the_request]
```

| Key | Required | Value |
| --- | --- | --- |
| `input` | Yes | One object definition |
| `output` | Yes | One or more entries, `- <object>: [rule names]`: an object the operation can answer, and the rules that hold when it does. `- quote` means an output with no rule |
| `rules` | No | Rules that hold for every answer |

There is no key for errors, states, callers or events. A refusal is an output; a stored record, the caller and the time are properties of the input; an event is a property of an output. The core returns exactly one output per call, so make the rules of the outputs exclude each other.

## Rules

Every rule has a name, and its text is in one place: the top-level `rules` section, or the standard set. Definitions, outputs and operations apply rules by name.

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
| `message` | Yes | The text of a failure. `{name}` puts in a parameter's argument; a list is joined with `, ` |
| `parameters` | No | Names of definitions. Each is a parameter, with the type of its definition |

A rule with no parameter is applied bare (`- uniqueItems`), with one parameter as `- minimum: 1`, with more as a map: `- between: { low: 1, high: 9 }`. The argument must be a valid value of the parameter's definition, or `compile` stops with `rule-argument`. A rule of your own cannot take a standard rule's name.

| Applied to | The rule reads |
| --- | --- |
| A definition | `self`: the value |
| An output: `- quote: [fits_express]` | `input`, and `output`: that object |
| An operation's `rules` | `input`, and `output` if the operation has one output |

### The standard rules

JSON Schema's keywords, declared like any rule. A standard rule on another type stops `compile` with `rule-type`.

| Rule | For | Argument |
| --- | --- | --- |
| `enum`, `const` | `string` | A list of strings; a string |
| `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` | `integer`, `number` | A number |
| `multipleOf` | `integer` | An integer of 1 or more |
| `minLength`, `maxLength` | `string` | An integer of 0 or more |
| `pattern` | `string` | A regular expression. It matches part of the text, so anchor it with `^…$` |
| `format` | `string` | `date` or `date-time` (with fractions of a second, and `Z` or an offset such as `+02:00`) |
| `minItems`, `maxItems` | `array` | An integer of 0 or more |
| `uniqueItems` | `array` | none |
| `required` | `object` | A list of property names |

Each has a message such as `Must be at least {bound}`. For a choice of numbers, use `minimum` and `maximum`, or a rule of your own.

### The rule language

A rule is an expression in a subset of CEL, the Common Expression Language that Kubernetes and protovalidate use with schemas. Every rule that urn-forge accepts is valid CEL. A form outside the subset stops `compile` with `rule-syntax`.

| Type | From | Literals |
| --- | --- | --- |
| `int`, `double` | An `integer`, a `number` | `5000`, `-1`, `0.5`, `1e3` |
| `string` | A `string` | `'confirmed'`, `"confirmed"`, raw `r'^[0-9]{4}$'` |
| `bool` | A `boolean` | `true`, `false` |
| `list(T)` | An `array` | `['main', 'dessert']` (not empty) |
| An object | An `object` | none; read its properties with `.` |
| `timestamp`, `duration` | `timestamp(s)`, `duration(s)` | |

Operators, from the lowest precedence: `||`; `&&`; `==` `!=` `<` `<=` `>` `>=` `in`; `+` `-`; `*` `/` `%`; `!` and unary `-`; `a.b`. Parentheses change the order.

`==` compares lists and objects by value. `in` tests an item of a list, or a property name of an object. `+` joins strings and lists, and adds a duration to a timestamp. `/` of two ints rounds toward 0, and a division by 0 breaks the rule. `*` and `/` do not mix an int and a double: write `2.0` for a `number`.

| Form | Gives |
| --- | --- |
| `has(a.b)` | Whether the property is present |
| `size(x)`, `x.size()` | The characters of a string, or the items of a list |
| `s.matches(re)` | Whether the regular expression matches part of the string |
| `timestamp(s)` | A timestamp from an RFC 3339 string |
| `duration(s)` | A duration such as `'2h'`, `'30m'`, `'1h30m'` (units `h`, `m`, `s`, `ms`, `us`, `ns`) |
| `l.all(x, p)`, `l.exists(x, p)`, `l.exists_one(x, p)` | Whether `p` holds for each, at least one, or exactly one item |
| `l.map(x, e)`, `l.sum()` | A list of the values of `e`; the total of a list of numbers |

**Optional properties.** A rule reads a property that its object does not require only after a guard, `has(self.deposit) && …` or `!has(self.deposit) || …`, or `compile` stops with `rule-guard`. CEL would fail at run time; urn-forge fails at compile time.

**Times.** A time is a string; each rule that compares it calls `timestamp()`: `timestamp(self.ends_at) > timestamp(self.starts_at) + duration('30m')`. A string that is not a valid time breaks the rule. There are no time zones or months: a day is `'24h'`. A `format: date` string compares as text, which is date order.

**Not in the subset:** `a ? b : c`, `null`, an index `a[0]`, maps, chained comparisons, `filter`, `min()`, `max()`, functions not listed above (such as `startsWith()` or `int()`), triple-quoted strings, and unsigned or hexadecimal numbers.

Each rule becomes plain TypeScript in the Valibot schema of its definition, with no CEL library at run time, and, where SQL can say it, a Postgres constraint.

## Example

<<< @/../packages/urn-forge/tests/fixtures/booking/domain.manifest.yaml
