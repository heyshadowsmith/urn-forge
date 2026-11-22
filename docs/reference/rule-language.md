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
sum     := primary (('+' | '-') primary)*
primary := '(' or ')' | field 'is' ('present' | 'absent') | field | number | text | 'true' | 'false'
```

A rule is one `or` expression, and then the end of the rule.

| Token | Form | Notes |
| --- | --- | --- |
| Field | `[a-z][a-z0-9_]*` | A property name of the `on` entity. Not a keyword |
| Number | `[0-9]+`, with an optional `.` and digits | `0`, `0.5`, `0.10`. No exponent, no `+`, no `.` at the start |
| Negative number | `-` and a number, where a value starts | `-1`, `-0.5` |
| Text | `'` … `'` | No escape, so it cannot contain `'` |
| Keyword | `and`, `or`, `not`, `is`, `present`, `absent`, `true`, `false` | |
| Symbol | `<`, `<=`, `=`, `!=`, `>=`, `>`, `+`, `-`, `(`, `)` | Any other character causes `rule-syntax` |

- Spaces, tabs and line breaks between tokens are optional.
- In YAML, put a rule that starts with `'` in double quotes: `rule: "'gold' = tier"`.

## Elements

| Element | Form | Operands | Result |
| --- | --- | --- | --- |
| Field | `expiry_date` | — | A value of the primitive of the field |
| Literal | `0`, `-3`, `'gold'`, `true` | — | A value. Refer to [Literals](#literals) |
| Comparison | `<`, `<=`, `=`, `!=`, `>=`, `>` | Two values of one primitive | A condition |
| Arithmetic | `a + b`, `a - b` | Two `integer` or two `decimal` values | A value of that primitive |
| Days | `d + n`, `d - n`, `d1 - d2` | Refer to [Days](#days) | A `date` or an `integer` |
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
- There is no "today". To compare with today, send it as a `date` field of the input.
- A `timestamp` has no arithmetic, and a rule cannot change it to a `date`.
- The arithmetic is exact, in the schemas and in the Postgres `CHECK`. Give an `integer` field that counts days a `max`.

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

- A rule can use a list or an embedded entity only in `is present` and `is absent`.
- A rule cannot name a property inside an embedded entity. Put the invariant on the embedded entity.
- A rule cannot compare a property with a property inside a list item. Put such a rule in the core, with a declared error.
- A rule compares the key value of a link. It does not read the linked object.

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
