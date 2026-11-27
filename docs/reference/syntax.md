# The rule syntax

The `rule` of each rule in the `rules` section of [the manifest](./manifest) is an expression in a small language with no loops and no side effects. It gives `true` when the value keeps the rule.

If a form is not in the language, `compile` stops with `rule-syntax`.

| Type | From | Literals |
| --- | --- | --- |
| `int`, `double` | An `integer`, a `number` | `5000`, `-1`, `0x1F`, `0.5`, `.5`, `1e3` |
| `string` | A `string` | `'confirmed'`, `"confirmed"`, raw `r'^[0-9]{4}$'`, `'''three quotes'''`, escapes such as `\n` and `\u00e9` |
| `bool` | A `boolean` | `true`, `false` |
| `list(T)` | An `array` | `['main', 'dessert']`, `[]` |
| An object | An `object` | none; read its properties with `.` |
| `timestamp`, `duration` | `timestamp(s)`, `duration(s)` | |

These are the operators, in the order in which they apply, the last first: `c ? a : b`; `||`; `&&`; `==` `!=` `<` `<=` `>` `>=` `in`; `+` `-`; `*` `/` `%`; `!` and unary `-`; `a.b` and `l[i]`. Parentheses change the sequence.

- `==` compares lists and objects by value. `in` tests an item of a list, or a property name of an object.
- `<` and the other comparisons order numbers, strings, bools (`false < true`), timestamps and durations.
- `+` joins strings and lists, and adds a duration to a timestamp.
- `/` of two ints rounds toward 0. A division by 0 breaks the rule, and so does an int larger than 2^53 − 1.
- `*` and `/` do not mix an int and a double. For a `number`, write `2.0`, or convert with `double()`.
- `c ? a : b` is `a` when `c` is true, and `b` when it is false. `a` and `b` have one type.
- `l[i]` is the item of the list `l` at the position `i`, from 0. An index out of the list breaks the rule.
- `&&` is false when one side is false, even if the other side breaks. `||` is true when one side is true, even if the other side breaks. `all` and `exists` work the same way for each item.

A position in a string counts characters, as `size()` does, from 0. A position out of the string breaks the rule.

### Conversions

| Form | Gives |
| --- | --- |
| `int(x)` | An int from a double (toward 0), from a string such as `'12'`, or from a timestamp (its seconds since 1970). A string that is not an integer breaks the rule |
| `double(x)` | A double from an int, or from a string such as `'2.5'`, `'NaN'` or `'Infinity'`. Any other string breaks the rule |
| `string(x)` | A string from an int, a double, a bool, a timestamp (`'2026-11-24T19:00:00Z'`) or a duration (`'90s'`) |
| `bool(s)` | `true` from `'true'`, `'True'`, `'TRUE'`, `'t'` or `'1'`; `false` from `'false'`, `'False'`, `'FALSE'`, `'f'` or `'0'`. Any other string breaks the rule |
| `timestamp(s)` | A timestamp from a time string such as `'2026-11-24T19:00:00Z'`, or from an int of seconds since 1970 |
| `duration(s)` | A duration such as `'2h'`, `'30m'`, `'-1h30m'` (units `h`, `m`, `s`, `ms`, `us`, `ns`) |

### Strings

| Form | Gives |
| --- | --- |
| `size(s)`, `s.size()` | The number of characters |
| `s.matches(re)` | Whether the regular expression matches part of the string |
| `s.startsWith(t)`, `s.endsWith(t)`, `s.contains(t)` | Whether the string starts with, ends with or contains `t` |
| `s.charAt(i)` | The character at the position `i`, or `''` at the end |
| `s.indexOf(t)`, `s.indexOf(t, i)` | The first position of `t`, from the position `i`, or `-1` |
| `s.lastIndexOf(t)`, `s.lastIndexOf(t, i)` | The last position of `t`, up to the position `i`, or `-1` |
| `s.substring(a)`, `s.substring(a, b)` | The characters from the position `a`, up to the position `b` (not included) |
| `s.split(t)`, `s.split(t, n)` | The parts of the string between each `t`, at most `n` parts |
| `l.join()`, `l.join(t)` | The strings of a list, joined, with `t` between them |
| `s.lowerAscii()`, `s.upperAscii()` | The string with the letters A to Z in lower or upper case. Other letters do not change |

### Numbers

| Form | Gives |
| --- | --- |
| `math.greatest(a, b, …)`, `math.least(a, b, …)` | The largest or the smallest of the numbers, or of the items of a list. The numbers are all ints or all doubles |
| `math.abs(x)`, `math.sign(x)` | The value without its sign; `-1`, `0` or `1` |
| `math.ceil(x)`, `math.floor(x)`, `math.trunc(x)` | A double rounded up, down, or toward 0 |
| `math.isNaN(x)`, `math.isInf(x)`, `math.isFinite(x)` | Whether a double is not a number, infinite, or finite |

### Times

A time is a string. Each rule that compares a time calls `timestamp()`: `timestamp(self.ends_at) > timestamp(self.starts_at) + duration('30m')`. A string that is not a valid time breaks the rule.

| Form | Gives |
| --- | --- |
| `t.getFullYear()` | The year |
| `t.getMonth()` | The month, from 0 for January |
| `t.getDate()`, `t.getDayOfMonth()` | The day of the month, from 1, or from 0 |
| `t.getDayOfWeek()` | The day of the week, from 0 for Sunday |
| `t.getDayOfYear()` | The day of the year, from 0 |
| `t.getHours()`, `t.getMinutes()`, `t.getSeconds()`, `t.getMilliseconds()` | The parts of the time of day |
| `t.getHours(zone)` and each other form above | The same, in a time zone: a name such as `'Europe/Paris'`, or an offset such as `'+02:00'` |
| `d.getHours()`, `d.getMinutes()`, `d.getSeconds()`, `d.getMilliseconds()` | The whole hours, minutes or seconds of a duration, or its milliseconds after the whole seconds |

A timestamp is from the year 1 to the year 9999, to the millisecond, and a duration is at most about 10000 years. A result out of these ranges breaks the rule. A `format: date` string compares as text, which is also the sequence of the dates.

### Lists

| Form | Gives |
| --- | --- |
| `size(l)`, `l.size()` | The number of items |
| `l.all(x, p)`, `l.exists(x, p)`, `l.exists_one(x, p)` | Whether `p` is true for each item, for one or more items, or for exactly one item |
| `l.all(i, x, p)`, `l.exists(i, x, p)`, `l.existsOne(i, x, p)` | The same, where `i` is the position of the item `x` |
| `l.map(x, e)`, `l.filter(x, p)` | A list of the values of `e`; a list of the items for which `p` is true. `size(l.filter(x, p))` counts them |
| `l.transformList(i, x, e)`, `l.transformList(i, x, p, e)` | A list of the values of `e`, for each item, or for the items for which `p` is true, with the position `i` |
| `l.sum()` | The total of a list of numbers |
| `l.flatten()`, `l.flatten(n)` | The items of the lists inside the list, to the depth `n` (a number in the rule) |

### Names

`cel.bind(name, value, rule)` gives a name to a value inside the rule: `cel.bind(parts, self.version.split('.'), size(parts) == 3 && int(parts[0]) >= 1)`.

## Optional properties

 If the object does not require a property, a rule must read it only after a guard. The guard is `has(self.deposit) && …` or `!has(self.deposit) || …`. If not, `compile` stops with `rule-guard`, before the rule can fail at run time.

## Not in the language

The language has no maps, no bytes, no unsigned numbers, no `null`, no optional values, no type values such as `type(x)`, and no list that holds items of more than one type. These are not types of a manifest.

It also leaves out some forms that a rule is unlikely to need: `format()`, `strings.quote()`, `trim()`, `replace()`, `reverse()`, `sort()`, `sortBy()`, `distinct()`, `slice()`, `lists.range()`, `math.round()` and the `math.bit` functions. A form comes back when a rule of a real domain needs it.

Each rule becomes plain TypeScript in the check of its definition, with no interpreter at run time.

| Applied to | The rule reads |
| --- | --- |
| A definition | `self`: the value |
| An output: `- quote: [fits_express]` | `input`, and `output`: that object |
| The `rules` of an operation | `input`, and `output` if the operation has one output |
