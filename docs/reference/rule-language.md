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
timed   := primary ('minutes' | 'hours' | 'days' | 'months')?
primary := '(' or ')' | over | day | field 'is' ('present' | 'absent') | field | number | text | 'true' | 'false'
over    := 'sum' '(' field 'in' field ':' sum ')' | ('all' | 'any') '(' field 'in' field ':' or ')'
day     := 'date' '(' sum ')'
```

A rule is one `or` expression, and then the end of the rule.

| Token | Form | Notes |
| --- | --- | --- |
| Field | `[a-z][a-z0-9_]*`, and `.` and another name for each step of a path | A property name of the `on` entity, or a path into an embedded entity: `total.amount_minor`. Not a keyword |
| Number | `[0-9]+`, with an optional `.` and digits | `0`, `0.5`, `0.10`. No exponent, no `+`, no `.` at the start |
| Negative number | `-` and a number, where a value starts | `-1`, `-0.5` |
| Text | `'` … `'` | No escape, so it cannot contain `'` |
| Keyword | `and`, `or`, `not`, `is`, `present`, `absent`, `true`, `false` | `sum`, `all`, `any` and `date` are keywords only before `(`, and `in` only inside `sum`, `all` and `any` |
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
| Every item | `all(line in lines: line.amount > 0)` | A list, and a condition on each item | A condition: true when the condition holds for each item. Refer to [Lists and embedded entities](#lists-and-embedded-entities) |
| One item | `any(line in lines: line.sku = 'A1')` | A list, and a condition on each item | A condition: true when the condition holds for one item or more |
| Days | `d + n`, `d - n`, `d1 - d2` | Refer to [Days](#days) | A `date` or an `integer` |
| Date of a time | `date(starts_at)` | A `timestamp` | Its date in UTC, a `date`. Refer to [Time](#time) |
| Time | `t + 2 hours`, `t - 15 minutes`, `t + n days` | A `timestamp`, and an `integer` with a unit. Refer to [Time](#time) | A `timestamp` |
| Months | `t + 1 months`, `d - 3 months` | A `timestamp` or a `date`, and an `integer` of months. Refer to [Calendar months](#calendar-months) | A value of the primitive of the left |
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
- The unit is the day. For calendar months, write `d + n months`. Refer to [Calendar months](#calendar-months). There are no years: write `12 months`.
- In a rule of an operation, `today` is the date of the call: `input.resume_on <= today + 90`.
- `date(t)` changes a `timestamp` to its date in UTC. A rule cannot change a `date` to a `timestamp`.
- The arithmetic is exact, in the schemas and in the Postgres `CHECK`. Give an `integer` field that counts days a `max`.

## Time

| Form | Left | Right | Result | Example |
| --- | --- | --- | --- | --- |
| `t + n <unit>` | `timestamp` | `integer`, and `minutes`, `hours` or `days` | The instant after `t` | `now <= current.captured_at + 180 days` |
| `t - n <unit>` | `timestamp` | The same | The instant before `t` | `now < current.starts_at - 48 hours` |

- `n` is a number with no fraction, an `integer` field or an `integer` expression: `input.trial_days days`.
- A day is 24 hours: every time is UTC, so the arithmetic is exact.
- A `timestamp` with no unit causes `rule-type`: `"+" on a timestamp needs a unit: write 2 hours, 15 minutes or 180 days`.
- `minutes`, `hours` or `days` on a `date` cause `rule-type`. A date counts days: write `today + 1`.
- There is no time between two timestamps.
- `date(t)` is the date of `t` in UTC: `date(alt.starts_at) = input.date`. It can count days: `date(t) + 1`. A date in another time zone is not in the language.
- `now` and `today` come from the shell. Refer to [Declare preconditions and postconditions](../how-to/declare-conditions#a-window-of-time).

## Calendar months

| Form | Left | Right | Result | Example |
| --- | --- | --- | --- | --- |
| `t + n months`, `t - n months` | `timestamp` | `integer` | The same time of day, `n` calendar months on or back, in UTC | `output.period_end = output.period_start + 1 months` |
| `d + n months`, `d - n months` | `date` | `integer` | The day `n` calendar months on or back | `ends_on = starts_on + 1 months` |

- A day that the target month lacks is that month's last day: `2026-01-31` + 1 month is `2026-02-28`, and `2028-01-31` + 1 month is `2028-02-29`.
- Months are not reversible: `2026-01-31 + 1 months - 1 months` is `2026-01-28`.
- Every month is in UTC, in the schemas, in the runtime and in Postgres, whatever the time zone of the machine or of the database session.

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
| Every item | `all(alt in error.alternatives: alt.party_size = input.party_size)` | A condition: true when it holds for each item. It is true for an empty or absent list |
| One item | `any(line in input.lines: line.sku = 'A1')` | A condition: true when it holds for one item or more. It is false for an empty or absent list |
| A product | `item.quantity * item.unit_amount` | `integer × integer` is an `integer`; `integer × decimal` is an exact `decimal`. `decimal × decimal` causes `rule-type` |
| A path | `total.amount_minor`, `line.amount.amount_minor` | The property of an embedded entity that is not a list. It is optional when the entity or the property is optional |
| Presence | `lines is present` | A condition |
| Equality of two embedded entities | `output.plan = current.plan` | A condition: each property, with the comparison of its primitive. An optional property is equal when both are absent |

- Inside `sum`, `all` and `any`, the item has the name before `in`. For a list of embedded entities, write `<item>.<property>`; for a list of values, write `<item>`. The name of the item must not be a name of the rule.
- `*` binds tighter than `+` and `-`.
- `=` and `!=` compare two embedded entities of one entity only. An entity that holds a list causes `rule-type`.
- A path reads into an embedded entity that is not a list, at any depth. It cannot read into a list: use a sum.
- A rule cannot use a list or an embedded entity in any other way.
- `all` and `any` can pair the items of two lists: `all(s in error.lines: any(l in input.lines: l.sku = s.sku))` says that each listed line is a line of the request. They cannot count the pairs, for example "exactly one answer line for each requested line".
- A rule compares the key value of a link. It does not read the linked object.
- In SQL, a rule with `sum`, `all`, `any` or an equality of embedded entities is not a `CHECK`: `unenforced-in-sql`, because the items are rows of a child table. `date(t)` is: `(t AT TIME ZONE 'UTC')::DATE`.

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
