# The rule language

The `rule` of an invariant is a condition in the rule language. It names the properties of the `on` entity. For the invariant entry, refer to [The manifest](./manifest).

| Invariant of the insurance domain | `rule` |
| --- | --- |
| `policy.invariant.term_is_positive` | `expiry_date > effective_date` |
| `policy.invariant.deductible_below_premium` | `deductible is absent or deductible < premium` |
| `policy.invariant.term_at_most_a_year` | `expiry_date - effective_date <= 366` |
| `policy.invariant.cancellation_within_term` | `cancellation_date >= effective_date and cancellation_date <= expiry_date` |

## Grammar

```
or      := and ('or' and)*
and     := unary ('and' unary)*
unary   := 'not' unary | compare
compare := sum (('<' | '<=' | '=' | '!=' | '>=' | '>') sum)?
sum     := product (('+' | '-') product)*
product := timed ('*' timed)*
timed   := primary ('minutes' | 'hours' | 'days')?
primary := '(' or ')' | total | field 'is' ('present' | 'absent') | field | number | text | 'true' | 'false'
total   := 'sum' '(' field 'in' field ':' sum ')'
```

A rule is one `or` expression, and then the end of the rule.

| Token | Form | Notes |
| --- | --- | --- |
| Field | `[a-z][a-z0-9_]*`, and `.` and another name for each step of a path | A property name of the `on` entity, or a path into an embedded entity: `total.amount_minor`. Not a keyword |
| Number | `[0-9]+`, with an optional `.` and digits | `0`, `0.5`, `0.10`. No exponent, no `+`, no `.` at the start |
| Negative number | `-` and a number, where a value starts | `-1`, `-0.5` |
| Text | `'` … `'` | No escape, so it cannot contain `'` |
| Keyword | `and`, `or`, `not`, `is`, `present`, `absent`, `true`, `false` | `sum` is a keyword only before `(`, and `in` only inside a total |
| Symbol | `<`, `<=`, `=`, `!=`, `>=`, `>`, `+`, `-`, `*`, `(`, `)`, `:` | Any other character causes `rule-syntax` |

- Spaces, tabs and line breaks between tokens are optional.
- In YAML, put a rule that starts with `'` in double quotes: `rule: "'gold' = tier"`.

## Elements

| Element | Form | Operands | Result |
| --- | --- | --- | --- |
| Field | `expiry_date` | — | A value of the primitive of the field |
| Literal | `0`, `-3`, `'gold'`, `true` | — | A value. Refer to [Literals](#literals) |
| Comparison | `<`, `<=`, `=`, `!=`, `>=`, `>` | Two values of one primitive | A condition |
| Arithmetic | `a + b`, `a - b` | Two `integer` or two `decimal` values | A value of that primitive |
| Product | `a * b` | Two `integer` values, or an `integer` and a `decimal` | An `integer`, or an exact `decimal` |
| Total | `sum(line in lines: line.amount)` | A list, and an `integer` or `decimal` value of each item | A value of that primitive. Refer to [Lists and embedded entities](#lists-and-embedded-entities) |
| Days | `d + n`, `d - n`, `d1 - d2` | Refer to [Days](#days) | A `date` or an `integer` |
| Time | `t + 2 hours`, `t - 15 minutes`, `t + n days` | A `timestamp`, and an `integer` with a unit. Refer to [Time](#time) | A `timestamp` |
| `and`, `or` | `c and d` | Two conditions | A condition |
| `not` | `not c` | One condition | A condition |
| Presence | `x is present`, `x is absent` | An optional property, a list or an embedded entity | A condition |
| Parentheses | `( … )` | Any expression | The same expression |

A rule must be a condition. Write `flag = true`, not `flag`.

## Precedence

From the operator that binds least tightly:

| Level | Operators | Group |
| --- | --- | --- |
| 1 | `or` | From the left |
| 2 | `and` | From the left |
| 3 | `not` | From the right |
| 4 | `<`, `<=`, `=`, `!=`, `>=`, `>` | None. `a < b < c` causes `rule-syntax` |
| 5 | `+`, `-` | From the left |
| 6 | `*` | From the left |

`a < b or c < d and e < f` reads as `a < b or (c < d and e < f)`. `not a < b` reads as `not (a < b)`.

## Literals

A literal gets the primitive of the other side of its operator. One side must contain a field. Two literals cause `rule-type`.

| Other side | Literal that fits | Example |
| --- | --- | --- |
| `integer` | A number with no fraction | `count + 1 <= 10` |
| `float` | Any number | `ratio > 0.5` |
| `decimal` | A number, or a decimal in quotes | `premium > 0`, `premium + '0.01' > 1` |
| `date` | A calendar day in quotes | `effective_date >= '2026-01-01'` |
| `timestamp` | A UTC instant in quotes | `at < '2027-01-01T00:00:00Z'` |
| `string` | A text | `note != ''` |
| `enum` | A text that is one of the `values` | `tier = 'gold'` |
| `boolean` | `true` or `false` | `flag = true` |

## Names in a condition

In the `requires` and `ensures` rules of an operation, each name has one prefix:

| Prefix | The value | Where |
| --- | --- | --- |
| `input.` | The request, parsed | `requires` and `ensures` |
| `current.` | The record of `changes` | `requires` and `ensures`, with `changes` only |
| `output.` | The answer, parsed | `ensures` only |

Two names have no prefix: `now`, the time of the call, a `timestamp`; and `today`, the date of `now` in UTC. Each rule of an operation can read them. An invariant cannot, because it must hold at any time. Refer to [Time](#time).

`current.version + 1 = output.version` compares values from two prefixes. An invariant rule names the properties of its entity with no prefix. A name with two prefixes causes `rule-syntax`.

## Operators for each primitive

| Primitive | `=`, `!=` | `<`, `<=`, `>=`, `>` | `+`, `-` | Comparison at run time |
| --- | --- | --- | --- | --- |
| `integer` | Yes | Yes | Yes | As numbers |
| `float` | Yes | Yes | No | As numbers |
| `decimal` | Yes | Yes | Yes, exact | As exact numbers. `1.10 = 1.1` is true |
| `date` | Yes | Yes | Days only | As text, or as day numbers in a rule with days |
| `timestamp` | Yes | Yes | No | As instants |
| `string` | Yes | No | No | As text |
| `enum` | Yes | No | No | As text |
| `boolean` | Yes | No | No | As booleans |

The two sides of each operator must have one primitive. A link has the primitive of the key field of the linked entity.

## Days

| Form | Left | Right | Result | Example |
| --- | --- | --- | --- | --- |
| `d + n` | `date` | `integer` | The day `n` days after `d` | `due_date <= loan_date + 28` |
| `d - n` | `date` | `integer` | The day `n` days before `d` | `start_date - 7 < sent_date` |
| `d1 - d2` | `date` | `date` | The days from `d2` to `d1`, an `integer` | `expiry_date - effective_date <= 366` |

- The date is on the left. `28 + loan_date` causes `rule-type`.
- `n` can be a number, an `integer` field or an `integer` expression.
- In `d - '2026-01-01'`, the text is a date.
- The unit is the day. There are no months or years. For one year, write `365` or `366`.
- In a rule of an operation, `today` is the date of the call: `input.resume_on <= today + 90`.
- A rule cannot change a `timestamp` to a `date`, or a `date` to a `timestamp`.
- The arithmetic is exact, in the schemas and in the Postgres `CHECK`. Give an `integer` field that counts days a `max`.

## Time

| Form | Left | Right | Result | Example |
| --- | --- | --- | --- | --- |
| `t + n <unit>` | `timestamp` | `integer`, and `minutes`, `hours` or `days` | The instant after `t` | `now <= current.captured_at + 180 days` |
| `t - n <unit>` | `timestamp` | The same | The instant before `t` | `now < current.starts_at - 48 hours` |

- `n` is a number with no fraction, an `integer` field or an `integer` expression: `input.trial_days days`.
- A day is 24 hours: every time is UTC, so the arithmetic is exact.
- A `timestamp` with no unit causes `rule-type`: `"+" on a timestamp needs a unit: write 2 hours, 15 minutes or 180 days`.
- A unit on a `date` causes `rule-type`. A date counts days: write `today + 1`.
- There is no time between two timestamps, and no months or years.
- `now` and `today` come from the shell. Refer to [Declare preconditions and postconditions](../how-to/declare-conditions#a-window-of-time).

## Guards

A rule can use the value of an optional property only after a guard. Else `unguarded-field`.

| Guard | Effect |
| --- | --- |
| `x is present and …` | The right side can use `x` |
| `x is absent or …` | The right side can use `x`. If `x` is absent, the rule holds |

- The guard is on the left. `deductible < premium or deductible is absent` causes `unguarded-field`.
- A chain of guards is a guard: `a is present and b is present and …`.
- A guard applies to the full right side, also in parentheses.
- `not x is absent` is not a guard.
- `is present` or `is absent` on a required property causes `rule-type`.

## Lists and embedded entities

| Form | Example | Result |
| --- | --- | --- |
| A total | `sum(line in lines: line.amount)` | The total of the value over the items of the list: `integer` or `decimal`, exact. An absent list adds up to 0 |
| A product | `item.quantity * item.unit_amount` | `integer × integer` is an `integer`; `integer × decimal` is an exact `decimal`. `decimal × decimal` causes `rule-type` |
| A path | `total.amount_minor`, `line.amount.amount_minor` | The property of an embedded entity that is not a list. It is optional when the entity or the property is optional |
| Presence | `lines is present` | A condition |
| Equality of two embedded entities | `output.plan = current.plan` | A condition: each property, with the comparison of its primitive. An optional property is equal when both are absent |

- Inside a sum, the item has the name before `in`. For a list of embedded entities, write `<item>.<property>`; for a list of values, write `<item>`. The name of the item must not be a name of the rule.
- `*` binds tighter than `+` and `-`.
- `=` and `!=` compare two embedded entities of one entity only. An entity that holds a list causes `rule-type`.
- A path reads into an embedded entity that is not a list, at any depth. It cannot read into a list: use a sum.
- A rule cannot use a list or an embedded entity in any other way.
- A rule cannot pair the items of two lists, for example "one answer line for each requested line". Put such a rule in the core, with a declared error.
- A rule compares the key value of a link. It does not read the linked object.
- In SQL, a rule with a sum or an equality of embedded entities is not a `CHECK`: `unenforced-in-sql`, because the items are rows of a child table.

## Diagnostics

Each message has this form. The column starts at 1, in the rule as the manifest writes it:

```
<invariant URN>: rule: <problem> (at column <n> of the rule)
```

| Code | Cause | Example problem |
| --- | --- | --- |
| `rule-syntax` | The rule does not agree with the grammar. `compile` stops at the first one | `a comparison cannot follow another comparison; use and` |
| `unknown-rule-field` | A name is not a property of the `on` entity | `"expiry" is not a field of the entity (fields: effective_date, expiry_date, premium, deductible, riders)` |
| `rule-type` | The primitives or the parts do not agree | `">" has a decimal on the left and a date on the right; both sides must have one primitive` |
| `unguarded-field` | An optional property with no guard | `"deductible" is optional, so the rule must guard it: write "deductible is present and …" or "deductible is absent or …"` |

## Canonical text

The generated rule function has the canonical text of the rule in its comment. The canonical text has one space around each operator and after `not`, and only the parentheses that the tree needs.

| Rule in the manifest | Canonical text |
| --- | --- |
| `((a < b)) or (c < d and e < f)` | `a < b or c < d and e < f` |
| `not (a < b)` | `not a < b` |
| `not (a < b and c < d)` | `not (a < b and c < d)` |

## Related pages

- [The manifest](./manifest)
- [Add an invariant](../how-to/add-an-invariant)
- [Generated code](./generated-code)
