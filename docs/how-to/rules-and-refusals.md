# Write rules and refusals

A rule states something that must be true. You apply it to a definition, to an output or to an operation. A refusal is an output that says no. This page shows the common cases; the [rules reference](../reference/rule-language) has the full language.

After each change to the manifest, run `npx urn-forge compile`, then `npx urn-forge verify`. Gate 3 tells you which new rule or output still needs a scenario.

## Apply a standard rule

The standard rules are JSON Schema's keywords. Apply them by name in the `rules` list of a definition:

```yaml
  party_size:
    description: The number of guests
    type: integer
    rules:
      - minimum: 1
      - maximum: 12
```

A rule with no parameter is its bare name (`- uniqueItems`). A rule with one parameter takes the argument (`- minimum: 1`). The list of standard rules is in [the reference](../reference/rule-language#the-standard-rules).

## Write a rule of your own

Declare the rule once, in the top-level `rules` section, then apply it by name. In a rule of a definition, `self` is the value. These rules come from the booking example:

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

```yaml
  booking:
    # …
    rules:
      - required: [reference, party_size, state, starts_at, ends_at, contact]
      - large_party_pays_deposit
      - ends_after_start
      - total_is_the_dishes
```

- `deposit` is optional, so the rule reads it only after `has(self.deposit)`. Without the guard, `compile` stops with `rule-guard`.
- A time is a string. `timestamp(...)` reads it, and `duration('30m')` is 30 minutes.
- Quote a rule that starts with `!` in YAML: `rule: '!has(self.dishes) || …'`.
- The `message` is the text of a failure. A failure also carries the rule's name, so an application can show its own text.

## Give a rule a parameter

List the parameters by the names of definitions. The definition gives the type of the argument, and `{name}` puts the argument in the message:

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

A deposit of `-1` fails with `Must be at least 0`. A rule with two or more parameters takes a map: `- between: { low: 1, high: 9 }`.

## Relate the answer to the input

A rule of an output reads `input` and `output`, never `self`. Put it in the list of the output that it applies to; there, `output` is that object. From the starter:

```yaml
rules:
  shares_add_up:
    description: The shares add up to the total
    rule: output.share_cents * size(input.people) == input.total_cents
    message: The shares do not add up to the total

operations:
  split:
    description: Split a bill into equal shares
    input: split_request
    output:
      - share: [shares_add_up]
      - uneven_split: [total_does_not_divide, names_the_total]
```

The harness checks these rules on every answer. A core that breaks one gives a `ContractViolation`, so these rules need no scenario that breaks them.

## Declare a refusal

A refusal is an output, an ordinary object. urn-forge has no special kind for an error.

1. Add an object for the refusal, with what the caller needs to understand it.
2. Add it to the `output` list of the operation.
3. Give it a rule that says when it comes back, and give the other outputs the opposite rule, so that each input allows one output.
4. If the refusal repeats a value of the input, add a rule that ties them.
5. In the core, return `answer('<refusal>', value)`.
6. Add a scenario that ends with `Then the output is "<refusal>"`, and one that breaks the refusal's `required` rule with `When I check a "<refusal>" with:`.

The refusal of the tutorial:

```yaml
      - quote: [fits_express]
      - too_heavy_for_express: [over_express_limit, names_the_weight]
```

Name a refusal for what happened (`too_heavy_for_express`, `invalid_state`), not for a transport. Mapping it to an HTTP status is the shell's choice.

A refusal is not a rejected input:

| | A refusal | A rejected input |
| --- | --- | --- |
| Decided by | The core | The harness, before the core runs |
| When | The input is valid, but the business says no | The input breaks a rule of a definition |
| `runOperation` gives | `ok: true`, with the output | `ok: false`, `kind: 'InputRejected'` |
| A scenario ends with | `Then the output is "<refusal>"` | `Then the input is rejected by "<rule>" of "<definition>"` |

## Put a stored record, the caller or the time in the input

The core is a function of its input: it reads no database, session or clock. When an operation depends on one of these, the shell loads it into the input, and the manifest declares it as a property with rules.

**A stored record.** The booking example's input holds the booking as loaded, and a rule ties it to the request:

```yaml
  stored_booking:
    description: The booking as it is stored, before the call
    type: booking

  seat_request:
    description: A request to seat a booking, with the booking as stored
    type: object
    properties: [reference, stored_booking]
    rules:
      - required: [reference, stored_booking]
      - names_the_booking
```

`type: booking` makes `stored_booking` a booking, with all its rules. A shell that loads the wrong booking gets `InputRejected`. The record in the input is the state before the call and the output is the state after, so a rule of an output can compare them, as `keeps_the_party` does. If the record may not exist, leave it out of `required` and add an output whose rule reads `!has(input.stored_booking)`.

**The time.** Declare it as a `string` with `format: date-time`, and compare it in rules. From `contracts/bookings/domain.manifest.yaml`:

```yaml
  two_hours_before_start:
    description: The call is 2 hours or more before the start of the booking
    rule: has(input.stored_booking) && timestamp(input.now) <= timestamp(input.stored_booking.starts_at) - duration('2h')
    message: The booking starts in less than 2 hours
```

A scenario gives the time as a cell of the input, so the core and the scenarios are deterministic.

**The caller.** Make an object for the caller as the shell authenticated them, add it to the input, and write rules for who may act, with an output such as `forbidden` for who may not.

## Return a record and an event

An output is one object. To return two things, make an object that holds both. From the insurance domain:

```yaml
  issued:
    description: The policy as issued, with its event
    type: object
    properties: [policy, policy_issued]
    rules:
      - required: [policy, policy_issued]
```

The shell stores `policy` and publishes `policy_issued`.
