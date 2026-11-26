# The rule syntax

The `rule` of each rule in the `rules` section of [the manifest](./manifest) is an expression in a small language with no loops and no side effects. It gives `true` when the value keeps the rule.

If a form is not in the language, `compile` stops with `rule-syntax`.

| Type | From | Literals |
| --- | --- | --- |
| `int`, `double` | An `integer`, a `number` | `5000`, `-1`, `0.5`, `1e3` |
| `string` | A `string` | `'confirmed'`, `"confirmed"`, raw `r'^[0-9]{4}$'` |
| `bool` | A `boolean` | `true`, `false` |
| `list(T)` | An `array` | `['main', 'dessert']` (not empty) |
| An object | An `object` | none; read its properties with `.` |
| `timestamp`, `duration` | `timestamp(s)`, `duration(s)` | |

These are the operators, in the order in which they apply, the last first: `||`; `&&`; `==` `!=` `<` `<=` `>` `>=` `in`; `+` `-`; `*` `/` `%`; `!` and unary `-`; `a.b`. Parentheses change the sequence.

`==` compares lists and objects by value. `in` tests an item of a list, or a property name of an object. `+` joins strings and lists, and adds a duration to a timestamp. `/` of two ints rounds toward 0, and a division by 0 breaks the rule. `*` and `/` do not mix an int and a double. For a `number`, write `2.0`.

| Form | Gives |
| --- | --- |
| `has(a.b)` | Whether the property is there |
| `size(x)`, `x.size()` | The characters of a string, or the items of a list |
| `s.matches(re)` | Whether the regular expression matches part of the string |
| `timestamp(s)` | A timestamp from a time string such as `2026-11-24T19:00:00Z` |
| `duration(s)` | A duration such as `'2h'`, `'30m'`, `'1h30m'` (units `h`, `m`, `s`, `ms`, `us`, `ns`) |
| `l.all(x, p)`, `l.exists(x, p)`, `l.exists_one(x, p)` | Whether `p` is true for each item, for one or more items, or for exactly one item |
| `l.map(x, e)`, `l.sum()` | A list of the values of `e`; the total of a list of numbers |

## Optional properties

 If the object does not require a property, a rule must read it only after a guard. The guard is `has(self.deposit) && …` or `!has(self.deposit) || …`. If not, `compile` stops with `rule-guard`, before the rule can fail at run time.

## Times

 A time is a string. Each rule that compares a time calls `timestamp()`: `timestamp(self.ends_at) > timestamp(self.starts_at) + duration('30m')`. A string that is not a valid time breaks the rule. There are no time zones and no months. A day is `'24h'`. A `format: date` string compares as text, which is also the sequence of the dates.

## Not in the language

The language does not have these forms:

- `a ? b : c` and `null`
- an index `a[0]`, and maps
- chained comparisons
- `filter`, `min()` and `max()`
- functions that the table above does not show, such as `startsWith()` or `int()`
- triple-quoted strings
- unsigned or hexadecimal numbers.

Each rule becomes plain TypeScript in the schema of its definition, with no interpreter at run time. Where SQL can state the rule, it also becomes a Postgres constraint.

| Applied to | The rule reads |
| --- | --- |
| A definition | `self`: the value |
| An output: `- quote: [fits_express]` | `input`, and `output`: that object |
| The `rules` of an operation | `input`, and `output` if the operation has one output |
