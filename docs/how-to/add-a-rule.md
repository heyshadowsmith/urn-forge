# Add a rule

State something that must be true of a value, when no standard rule says it. A rule is an expression in a subset of CEL, the Common Expression Language.

## Before you start

- Look in [Rules and the standard rules](../reference/rules). If a standard rule says what you need, apply it. You do not write it.

## Steps

1. Open `domain.manifest.yaml`. If it has no section `rules`, add it at the top level.
2. Add a key with the name of the rule. A name is lowercase snake_case, for example `ends_after_start`.
3. Add `description`: what the rule states, for a reader.
4. Add `rule`: the expression. In the rule of a definition, `self` is the value. The expression must give `true` or `false`.
5. Add `message`: the text of a failure.
6. In the definition, add the name of the rule to its `rules` list.
7. Run `npx urn-forge compile`.
8. Add a scenario that breaks the rule. Gate 3 asks for one. Refer to [Write scenarios](write-scenarios).

## Example

These rules come from `packages/urn-forge/tests/fixtures/booking/domain.manifest.yaml`:

```yaml
rules:
  large_party_pays_deposit:
    description: A party of 7 or more pays a deposit
    rule: self.party_size < 7 || (has(self.deposit) && self.deposit > 0)
    message: A party of 7 or more pays a deposit

  ends_after_start:
    description: A booking ends after it starts
    rule: timestamp(self.ends_at) > timestamp(self.starts_at) + duration('30m')
    message: A booking lasts more than 30 minutes
```

The object `booking` applies them by name:

```yaml
  booking:
    # …
    rules:
      - required: [reference, party_size, state, starts_at, ends_at, contact]
      - large_party_pays_deposit
      - ends_after_start
      - total_is_the_dishes
```

Examine these points:

- `self.party_size` reads a property of the object.
- `deposit` is optional. A rule reads an optional property only after `has(...)`. Otherwise, `compile` stops with `rule-guard`.
- A time is a string. `timestamp(...)` makes a timestamp of it, and `duration('30m')` is 30 minutes.
- A rule that starts with `!` or has `: ` must be in quotes in YAML, for example `rule: '!has(self.dishes) || …'`.

## Add a rule with a parameter

A rule can take a parameter, as `minimum` does. List the parameters by the names of definitions. The definition gives the type of the argument:

```yaml
definitions:
  limit:
    description: A whole number that a value is compared with
    type: integer

  deposit:
    description: The deposit paid, in cents
    type: integer
    rules:
      - at_least: 0

rules:
  at_least:
    description: The value is the bound or more
    parameters: [limit]
    rule: self >= limit
    message: Must be at least {limit}
```

- The rule reads the argument by the name of the parameter, `limit`.
- The message puts the argument in place of `{limit}`. A failure of `deposit` has the message `Must be at least 0`.
- If the argument is not a value of the definition, `compile` stops with `rule-argument`.
- A rule with two or more parameters takes a map: `- between: { low: 1, high: 9 }`.

A rule of your manifest cannot have the name of a standard rule. `compile` stops with `standard-name`.

## Result

The generated check of the definition runs the rule after the structure of the value is correct. A value that breaks it gives a failure with the name of the rule, the name of the definition, the place of the value and the message. Refer to [The generated code](../reference/generated-code).

## Related pages

- [The rule language](../reference/rule-language)
- [Rules and the standard rules](../reference/rules)
- [Declare a refusal](declare-a-refusal)
