# The rule language

The `rule` of an invariant is text in the rule language. Pass 6 parses the rule and examines its types against the fields of the `on` entity. The Valibot plugin then translates the rule to TypeScript. This page gives the grammar, the types, the checks, the canonical text and the translation. The code is in `src/rules/index.ts` and `src/rules/emit.ts`. For the invariant entry, refer to [The manifest](./manifest).

The insurance domain has three invariants. Each rule is valid:

| Invariant | `on` | `rule` |
| --- | --- | --- |
| `policy.invariant.term_is_positive` | `policy.entity.policy` | `expiry_date > effective_date` |
| `policy.invariant.deductible_below_premium` | `policy.entity.policy` | `deductible is absent or deductible < premium` |
| `policy.invariant.cancellation_within_term` | `policy.entity.cancellation` | `cancellation_date >= effective_date and cancellation_date <= expiry_date` |

The full manifest is `packages/urn-forge/insurance/domain.manifest.yaml`. CI compiles and verifies it.

## Grammar

```
or      := and ('or' and)*
and     := unary ('and' unary)*
unary   := 'not' unary | compare
compare := sum (('<' | '<=' | '=' | '!=' | '>=' | '>') sum)?
sum     := primary (('+' | '-') primary)*
primary := '(' or ')' | field 'is' ('present' | 'absent') | field | number | text | 'true' | 'false'
```

A rule is one `or` expression. After it, the rule must end.

### Tokens

| Token | Form | Notes |
| --- | --- | --- |
| Field | `[a-z][a-z0-9_]*` | A property name of the `on` entity. A keyword is not a field. An uppercase letter causes `rule-syntax`: `unexpected character "T"` |
| Number | `[0-9]+`, with an optional `.` and digits | Examples: `0`, `120`, `0.5`, `0.10`. No exponent, no `+` and no `.` at the start |
| Negative number | `-` and then a number, where a value starts | Examples: `-1`, `-0.5`. Only a number literal can have a `-` in front. `-present` causes `rule-syntax` |
| Text | `'` … `'` | Single quotes. The text has no escape, so it cannot contain `'`. A text with no quote at the end causes `rule-syntax` |
| Keyword | `and`, `or`, `not`, `is`, `present`, `absent`, `true`, `false` | A field with one of these names cannot occur in a rule |
| Symbol | `<`, `<=`, `=`, `!=`, `>=`, `>`, `+`, `-`, `(`, `)` | Any other character causes `rule-syntax`: `unexpected character "<c>"` |

Spaces between tokens are optional. A space, a tab and a line break are the same.

In YAML, put a rule that starts with `'` in double quotes, for example `rule: "'gold' = tier"`. Without the double quotes, YAML reads `'gold'` as the value, and the result is `yaml-syntax`.

## Elements

| Element | Form | Operands | Result |
| --- | --- | --- | --- |
| Field | `expiry_date` | — | A value of the primitive of the field. A link is a value of the primitive of the key field of the linked entity |
| Number literal | `0`, `-3`, `1.5` | — | A value. Its primitive comes from the other side. Refer to [Literals](#literals) |
| Text literal | `'2026-01-01'`, `'gold'` | — | A value. Its primitive comes from the other side |
| `true`, `false` | `true` | — | A value of a `boolean` |
| Comparison | `a < b`, `a <= b`, `a = b`, `a != b`, `a >= b`, `a > b` | Two values of one primitive | A condition |
| Arithmetic | `a + b`, `a - b` | Two values of one primitive: `integer` or `decimal` | A value of that primitive |
| `and`, `or` | `c and d`, `c or d` | Two conditions | A condition |
| `not` | `not c` | One condition | A condition |
| Presence | `x is present`, `x is absent` | An optional field, a list or an embedded entity | A condition |
| Parentheses | `( … )` | Any expression | The same expression |

A rule must be a condition. A value alone is not a condition, also a `boolean` field. Write `flag = true`, not `flag`.

## Precedence

The table starts with the operator that binds least tightly:

| Level | Operators | Group |
| --- | --- | --- |
| 1 | `or` | From the left |
| 2 | `and` | From the left |
| 3 | `not` | From the right: `not not c` |
| 4 | `<`, `<=`, `=`, `!=`, `>=`, `>` | None. A comparison cannot follow a comparison |
| 5 | `+`, `-` | From the left: `a - b - c` is `(a - b) - c` |
| 6 | A field, a literal, a presence condition, parentheses | — |

Examples:

| Rule | Reads as |
| --- | --- |
| `a < b or c < d and e < f` | `a < b or (c < d and e < f)` |
| `not a < b` | `not (a < b)` |
| `count + 1 - 2 <= 10` | `((count + 1) - 2) <= 10` |
| `a < b < c` | `rule-syntax`: `a comparison cannot follow another comparison; use and` |

## Literals

A literal has no primitive of its own. It gets the primitive of the other side of its operator. One side of each operator must be a field, or an expression with a field in it. A comparison of two literals causes `rule-type`.

| Primitive of the other side | Literal that fits | Example | Refused, with the message |
| --- | --- | --- | --- |
| `integer` | A number with no fraction | `count + 1 <= 10` | `1.5 is not an integer` |
| `float` | Any number | `ratio > 0.5` | `'1' is not a number` |
| `decimal` | A number, or a text with a decimal in it | `premium > 0`, `premium + '0.01' > premium - 1` | `'abc' is not a decimal` |
| `date` | A text with a calendar day `YYYY-MM-DD` | `effective_date >= '2026-01-01'` | `'2026-02-30' is not a date in quotes, such as '2026-01-31'` |
| `timestamp` | A text with an instant in UTC, as for a field value | `at < '2027-01-01T00:00:00Z'` | `'2026-01-01' is not a timestamp in quotes, such as '2026-01-31T09:30:00Z'` |
| `string` | A text | `note != ''` | `3 is not text in quotes` |
| `enum` | A text that is one of the `values` of the field | `tier = 'gold'` | `'bronze' is not one of the values (gold, silver)` |
| `boolean` | `true` or `false` | `flag = true` | `'yes' is not true or false` |

The message of `rule-type` adds `, so it cannot meet a <primitive> in "<operator>"` after the text of the last column. A decimal literal follows the form of a decimal value: digits, an optional fraction and no exponent. Thus `007` is not a decimal.

## Operators for each primitive

| Primitive | `=`, `!=` | `<`, `<=`, `>=`, `>` | `+`, `-` | How two values compare at run time |
| --- | --- | --- | --- | --- |
| `integer` | Yes | Yes | Yes | As numbers |
| `float` | Yes | Yes | No | As numbers |
| `decimal` | Yes | Yes | Yes | Exactly, with `compareDecimal`. `1.10 = 1.1` is true. `+` and `-` are exact |
| `date` | Yes | Yes | No | As text. A `YYYY-MM-DD` day sorts as text in calendar order |
| `timestamp` | Yes | Yes | No | As instants, with `Date.parse`. `09:00:00Z` and `09:00:00.000Z` are equal |
| `string` | Yes | No | No | As text, with `===` |
| `enum` | Yes | No | No | As text, with `===` |
| `boolean` | Yes | No | No | With `===` |

The two sides of each comparison and each `+` or `-` must have one primitive. `premium > effective_date` causes `rule-type`, because `premium` is a `decimal` and `effective_date` is a `date`.

## Guards for optional fields

A field with `required: false` in the entity can be absent. A rule can use its value only where a guard makes sure that the field is present. If not, pass 6 reports `unguarded-field`.

| Guard | Form | Effect |
| --- | --- | --- |
| Present on the left of `and` | `x is present and …` | The right side can use `x`. It runs only if `x` is present |
| Absent on the left of `or` | `x is absent or …` | The right side can use `x`. It runs only if `x` is present. If `x` is absent, the rule holds |

- The guard must be on the left side. `deductible < premium or deductible is absent` causes `unguarded-field` at column 1.
- A chain of guards is also a guard: `a is present and b is present and …`, and `a is absent or b is absent or …`.
- A guard is in effect in the full right side, also in parentheses: `x is present and (x > 1 or y > 2)`.
- `not x is absent` is not a guard. `x is present or x = 'a'` is not a guard either: the right side runs if `x` is absent.
- `x is present` and `x is absent` on a required field cause `rule-type`, because the result is always the same.

A list is a field reference with `many`. A rule can use a list only in `x is present` and `x is absent`. The language has no functions, so a rule cannot count the items of a list or examine one item. Any other use of a list causes `rule-type`.

## Links and embedded entities

A rule names only the properties of its `on` entity. The rule language has no path, so a rule cannot name a property inside an embedded entity.

| Property | Use in a rule | Example |
| --- | --- | --- |
| A link, `link: <entity>` | A value of the primitive of the key field of the linked entity. A rule can compare it as a value of that primitive | `holder != '9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d'`, for a link to `customer`, whose key `customer_id` is a `string`. The TypeScript is `(p.holder as string) !== "9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d"` |
| An embedded entity, `ref: <entity>` | Only in `x is present` and `x is absent`. Any other use causes `rule-type` | `coverage is present or premium > 100`, for an optional embedded `coverage`. The TypeScript of `coverage is present` is `p.coverage !== undefined` |

- A rule compares the value of a link. It does not read the linked object.
- The invariants of an embedded entity apply inside each embedded object. To restrict a value in an embedded object, put an invariant on the embedded entity. In the insurance domain, `limit_is_positive` is on `coverage`, not on `policy`.
- `x is present` on a required embedded entity causes `rule-type`, as on a required field.

## What pass 6 refuses

Pass 6 parses the rule and then examines its types. The parser stops at the first syntax problem. The type checker reports each type problem that it finds.

Each message has this form:

```
<invariant URN>: rule: <problem> (at column <n> of the rule)
```

The column starts at 1. It counts the characters of the rule as the manifest writes it, not the canonical text. The position of the diagnostic is the `rule` value in the manifest.

| Code | Cause | Problems from real runs |
| --- | --- | --- |
| `rule-syntax` | The rule does not agree with the grammar | `expected a field, a literal or "(", found the end of the rule`<br>`a comparison cannot follow another comparison; use and`<br>`a text literal has no closing quote`<br>`unexpected character "*"`<br>`expected "present" or "absent", found "here"`<br>`expected "and", "or" or the end of the rule, found "count"`<br>`expected ")", found the end of the rule` |
| `unknown-rule-field` | A field name is not a property of the `on` entity | `"expiry" is not a field of the entity (fields: effective_date, expiry_date, premium, deductible, riders)` |
| `rule-type` | The primitives or the parts of the rule do not agree | `">" has a decimal on the left and a date on the right; both sides must have one primitive`<br>`"<" compares two literals; one side must be a field`<br>`"<" needs an order, which string does not have; use = or !=`<br>`"+" works on integer and decimal only, not on float`<br>`"+" needs a value on each side, not a condition`<br>`a rule needs a condition, such as a comparison, not an integer`<br>`not needs a condition, such as a comparison, not an integer`<br>`"riders" is a list; a rule can use it only in "riders is present" or "riders is absent"`<br>`"item" is an embedded entity; a rule can use it only in "item is present" or "item is absent"`<br>`"start" is required, so "start is present" is always true`<br>The literal messages in [Literals](#literals) |
| `unguarded-field` | An optional field is used where no guard is in effect | `"deductible" is optional, so the rule must guard it: write "deductible is present and …" or "deductible is absent or …"` |

Pass 6 examines the types only if `on` resolves to an entity. A field reference of the entity that does not resolve is not a field for the rule, so a rule that names it also gets `unknown-rule-field`. Correct the `unresolved-ref` first, and compile again. Pass 6 parses the rule also if `on` does not resolve, so a `rule-syntax` problem always shows.

This fixture has one problem in each invariant:

<<< @/../packages/urn-forge/tests/fixtures/invalid-rules/domain.manifest.yaml{yaml}

`urn-forge compile --manifest tests/fixtures/invalid-rules/domain.manifest.yaml` writes these diagnostics:

```
tests/fixtures/invalid-rules/domain.manifest.yaml:25:9  error  rule-syntax  urn:acme:rules:policy:invariant:incomplete: rule: expected a field, a literal or "(", found the end of the rule (at column 14 of the rule)
tests/fixtures/invalid-rules/domain.manifest.yaml:45:9  error  rule-type  urn:acme:rules:policy:invariant:list_value: rule: "riders" is a list; a rule can use it only in "riders is present" or "riders is absent" (at column 1 of the rule)
tests/fixtures/invalid-rules/domain.manifest.yaml:35:9  error  rule-type  urn:acme:rules:policy:invariant:mixed_types: rule: ">" has a decimal on the left and a date on the right; both sides must have one primitive (at column 1 of the rule)
tests/fixtures/invalid-rules/domain.manifest.yaml:49:7  error  wrong-ref-kind  urn:acme:rules:policy:invariant:on_a_field: on "policy.field.premium" must name an entity, but urn:acme:rules:policy:field:premium is a field
tests/fixtures/invalid-rules/domain.manifest.yaml:40:9  error  unguarded-field  urn:acme:rules:policy:invariant:unguarded: rule: "deductible" is optional, so the rule must guard it: write "deductible is present and …" or "deductible is absent or …" (at column 1 of the rule)
tests/fixtures/invalid-rules/domain.manifest.yaml:30:9  error  unknown-rule-field  urn:acme:rules:policy:invariant:unknown_field: rule: "expiry" is not a field of the entity (fields: effective_date, expiry_date, premium, deductible, riders) (at column 1 of the rule)
```

`wrong-ref-kind` comes from pass 4, not from pass 6. Refer to [Compiler passes](./compiler-passes).

## The IR form and the canonical text

The IR keeps each rule in two forms. Both are part of the fingerprint.

| Property of `IRInvariant` | Contents |
| --- | --- |
| `rule` | The parsed rule, as a `RuleExpr` tree, with no columns |
| `ruleText` | The canonical text of the rule |

The `RuleExpr` nodes:

| `op` | Other properties |
| --- | --- |
| `field` | `name` |
| `number` | `value`, the text of the literal. Thus `0.10` stays `0.10`, and a decimal stays exact |
| `text` | `value`, without the quotes |
| `boolean` | `value`, `true` or `false` |
| `present`, `absent` | `field` |
| `not` | `operand` |
| `and`, `or`, `<`, `<=`, `=`, `!=`, `>=`, `>`, `+`, `-` | `left`, `right` |

The rule `opt is absent or opt < d1` of the rules test fixture is this node in the IR:

```json
{
  "left": { "field": "opt", "op": "absent" },
  "op": "or",
  "right": {
    "left": { "name": "opt", "op": "field" },
    "op": "<",
    "right": { "name": "d1", "op": "field" }
  }
}
```

The canonical text follows these rules:

- One space comes before and after each operator, and after `not`.
- Parentheses are there only if the tree needs them. `and`, `or`, `+` and `-` group from the left, so a right side of the same level keeps its parentheses.
- A number literal keeps its text. A text literal is in single quotes.

| Rule in the manifest | Canonical text |
| --- | --- |
| `((a < b)) or (c < d and e < f)` | `a < b or c < d and e < f` |
| `(a < b or c < d) and e < f` | `(a < b or c < d) and e < f` |
| `not (a < b)` | `not a < b` |
| `not (a < b and c < d)` | `not (a < b and c < d)` |
| `((count > -1)) and (price - 0.5 >= 0 or at < '2027-01-01T00:00:00Z')` | `count > -1 and (price - 0.5 >= 0 or at < '2027-01-01T00:00:00Z')` |

The canonical text is in the comment of each rule function in the generated schemas. The parse of the canonical text gives the same tree.

## The translation to TypeScript

The Valibot plugin writes one exported function for each invariant, `<Brand>Rule`. The function gets `p`, the parsed object of the entity, and returns a `boolean`. For the place of the function in the file, refer to [The generated schemas](./generated-schemas).

| Element | TypeScript |
| --- | --- |
| A field `x` | `(p.x as <type>)`, with `number`, `string` or `boolean` for the primitive |
| A number literal | The number. For a `decimal`, the text in double quotes, for example `"0.5"` |
| A text literal | The text in double quotes |
| `true`, `false` | `true`, `false` |
| `x is present` | `p.x !== undefined` |
| `x is absent` | `p.x === undefined` |
| `not c` | `!(c)` |
| `c and d`, `c or d` | `(c && d)`, `(c \|\| d)` |
| `=`, `!=` | `===`, `!==` |
| `<`, `<=`, `>=`, `>` | The same operator |
| A `decimal` comparison | `compareDecimal(a, b) <op> 0` |
| A `timestamp` comparison | `Date.parse(a) <op> Date.parse(b)` |
| `+`, `-` on an `integer` | `(a + b)`, `(a - b)` |
| `+`, `-` on a `decimal` | `addDecimal(a, b)`, `subtractDecimal(a, b)` |

- The `as` cast removes the brand of the field. TypeScript does not compare two values with different brands. Pass 6 has already made sure that both sides have one primitive.
- `addDecimal` and `subtractDecimal` are exact. The result has the larger number of digits after the point of the two values.

The rules of the insurance domain, from `insurance/generated/domain.schemas.generated.ts`:

```ts
/** urn:acme:insurance:policy:invariant:deductible_below_premium — A deductible, when there is one, is less than the premium: deductible is absent or deductible < premium */
export const PolicyDeductibleBelowPremiumRule = (p: v.InferOutput<typeof PolicyPolicyFields>): boolean =>
  (p.deductible === undefined || compareDecimal((p.deductible as string), (p.premium as string)) < 0);
/** urn:acme:insurance:policy:invariant:term_is_positive — A policy ends after it starts: expiry_date > effective_date */
export const PolicyTermIsPositiveRule = (p: v.InferOutput<typeof PolicyPolicyFields>): boolean =>
  (p.expiry_date as string) > (p.effective_date as string);
```

The rules test fixture has one invariant for each operator on each primitive. Its generated file is `tests/fixtures/rules/expected/domain.schemas.generated.ts`.

## Related pages

- [The manifest](./manifest)
- [Compiler passes](./compiler-passes)
- [The generated schemas](./generated-schemas)
- [Diagnostics](./diagnostics)
- [The MECE model of primitives](../explanation/primitives-model)
