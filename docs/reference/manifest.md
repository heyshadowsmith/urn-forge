# The manifest and its rules

The manifest is one YAML file, `domain.manifest.yaml` by default. It has four top-level sections. Only `manifest` is required. If a key is not on this page, `compile` stops with `manifest-shape`. The [booking example](#example) at the end of this page uses all constructs.

| Section | Holds |
| --- | --- |
| `manifest` | The header: `namespace`, `domain`, `version` (semver, read by `diff`), and the optional `compatibility: { callers: ignore-unknown }` (refer to [Change the contract](../how-to/change-the-contract)). The Postgres schema gets the name of the domain |
| `definitions` | The values: numbers, strings, objects, lists |
| `rules` | The text of each of your own rules |
| `operations` | Each operation: an input, the outputs, and their rules |

A name is lowercase snake_case: `^[a-z][a-z0-9_]{0,62}$`. Each definition, rule and operation has a `description`. The generated code and the Postgres schema use the `description` as a comment. `deprecated: true` marks a part `@deprecated`, and each live use of the part gets the warning `deprecated-use`.

## Definitions

| Key | For | Value |
| --- | --- | --- |
| `type` | All definitions, required | One of the six types, or the name of another definition |
| `properties` | `object`, required | The names of the definitions that are its properties |
| `items` | `array`, required | The name of the definition of each item |
| `identifier` | `object` | A required property that is not an object or a list. It makes each object different from all other objects. It is the Postgres primary key |
| `rules` | All definitions | The rules that the value keeps |

The structure (`type`, `properties`, `items`, `identifier`) tells what a value is. Each condition that must be true of the value is a rule, also `required` and `enum`.

| `type` | A value | TypeScript |
| --- | --- | --- |
| `string` | Text | `string`, or the union of its `enum` choices |
| `integer` | A safe integer | `number` |
| `number` | A finite number | `number` |
| `boolean` | `true` or `false` | `boolean` |
| `object` | Named properties, and no others | `interface` |
| `array` | A list of items | `readonly T[]` |

There is no date type and no decimal type. A date is a `string` with `format: date`. A time is a `string` with `format: date-time` (`2026-11-24T19:00:00Z`). Money is an `integer` of its smallest unit, such as cents.

- **An object** lists its properties by the names of their definitions, and the properties keep the rules of these definitions. You cannot give a property a different name, or make it narrower, in the object. A property that `required` does not list is optional (`?` in TypeScript). An object definition in `properties` embeds that object.
- **A list** has items of its `items` definition, with their rules. The rules of the list, such as `maxItems`, apply to the full list.
- **A definition as a type**: `type: booking` makes a definition with the structure and rules of `booking`, and with its own rules. Use this to give one kind of value two functions (`from_account` and `to_account`). You can also use it to refer to an object by its identifier (`holder` of `type: customer_id`).

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
| `output` | Yes | One or more entries, `- <object>: [rule names]`. Each entry is an object that the operation can give as an answer, and the rules that are true for that answer. `- quote` is an output with no rule |
| `rules` | No | Rules that are true for each answer |

There is no key for errors, states, callers or events. A refusal is an output. A stored record, the caller and the time are properties of the input. An event is a property of an output. Because the core returns exactly one output for each call, make sure that the rules of the outputs exclude each other.

## Rules

Each rule has a name, and its text is in one location: the top-level `rules` section, or the standard set. Definitions, outputs and operations apply rules by their names.

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
| `rule` | Yes | An expression that gives `true` if the value keeps the rule |
| `message` | Yes | The text of a failure. `{name}` puts the argument of a parameter in the text. A list gets `, ` between its items |
| `parameters` | No | Names of definitions. Each is a parameter, with the type of its definition |

Apply a rule with no parameter by its name only (`- uniqueItems`). Apply a rule with one parameter as `- minimum: 1`, and a rule with more parameters as a map: `- between: { low: 1, high: 9 }`. The argument must be a valid value of the definition of the parameter. If not, `compile` stops with `rule-argument`. Your own rule cannot have the name of a standard rule.

| Applied to | The rule reads |
| --- | --- |
| A definition | `self`: the value |
| An output: `- quote: [fits_express]` | `input`, and `output`: that object |
| The `rules` of an operation | `input`, and `output` if the operation has one output |

### The standard rules

The standard rules are the keywords of JSON Schema. They have declarations like all other rules. If you apply a standard rule to a different type, `compile` stops with `rule-type`.

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

Each standard rule has a message, such as `Must be at least {bound}`. For a set of permitted numbers, use `minimum` and `maximum`, or your own rule.

### The rule language

A rule is an expression in a subset of CEL, the Common Expression Language. Kubernetes and protovalidate use CEL with schemas. Each rule that urn-forge accepts is valid CEL. If a form is not in the subset, `compile` stops with `rule-syntax`.

| Type | From | Literals |
| --- | --- | --- |
| `int`, `double` | An `integer`, a `number` | `5000`, `-1`, `0.5`, `1e3` |
| `string` | A `string` | `'confirmed'`, `"confirmed"`, raw `r'^[0-9]{4}$'` |
| `bool` | A `boolean` | `true`, `false` |
| `list(T)` | An `array` | `['main', 'dessert']` (not empty) |
| An object | An `object` | none; read its properties with `.` |
| `timestamp`, `duration` | `timestamp(s)`, `duration(s)` | |

These are the operators, from the lowest precedence: `||`; `&&`; `==` `!=` `<` `<=` `>` `>=` `in`; `+` `-`; `*` `/` `%`; `!` and unary `-`; `a.b`. Parentheses change the sequence.

`==` compares lists and objects by value. `in` tests an item of a list, or a property name of an object. `+` joins strings and lists, and adds a duration to a timestamp. `/` of two ints rounds toward 0, and a division by 0 breaks the rule. `*` and `/` do not mix an int and a double. For a `number`, write `2.0`.

| Form | Gives |
| --- | --- |
| `has(a.b)` | Whether the property is there |
| `size(x)`, `x.size()` | The characters of a string, or the items of a list |
| `s.matches(re)` | Whether the regular expression matches part of the string |
| `timestamp(s)` | A timestamp from an RFC 3339 string |
| `duration(s)` | A duration such as `'2h'`, `'30m'`, `'1h30m'` (units `h`, `m`, `s`, `ms`, `us`, `ns`) |
| `l.all(x, p)`, `l.exists(x, p)`, `l.exists_one(x, p)` | Whether `p` is true for each item, for one or more items, or for exactly one item |
| `l.map(x, e)`, `l.sum()` | A list of the values of `e`; the total of a list of numbers |

**Optional properties.** If the object does not require a property, a rule must read it only after a guard. The guard is `has(self.deposit) && …` or `!has(self.deposit) || …`. If not, `compile` stops with `rule-guard`. CEL fails at run time, but urn-forge fails at compile time.

**Times.** A time is a string. Each rule that compares a time calls `timestamp()`: `timestamp(self.ends_at) > timestamp(self.starts_at) + duration('30m')`. A string that is not a valid time breaks the rule. There are no time zones and no months. A day is `'24h'`. A `format: date` string compares as text, which is also the sequence of the dates.

**Not in the subset.** The subset does not have these forms:

- `a ? b : c` and `null`
- an index `a[0]`, and maps
- chained comparisons
- `filter`, `min()` and `max()`
- functions that the table above does not show, such as `startsWith()` or `int()`
- triple-quoted strings
- unsigned or hexadecimal numbers.

Each rule becomes plain TypeScript in the Valibot schema of its definition, with no CEL library at run time. Where SQL can state the rule, it also becomes a Postgres constraint.

## Example

<<< @/../packages/urn-forge/tests/fixtures/booking/domain.manifest.yaml
