# Write rules and refusals

A rule states something that must be true; you apply it by name to a definition or an output. A refusal is an output that says no. The [manifest reference](../reference/manifest#rules) has the full language. After each change, run `npx urn-forge compile`, then `npx urn-forge verify`: gate 3 names each new rule or output that still needs a scenario.

## Write a rule

A standard rule is one of JSON Schema's keywords: list it in the `rules` of a definition, bare (`- uniqueItems`) or with an argument (`- minimum: 1`). For anything else, declare a rule of your own once in the top-level `rules` section, and apply it by name. In a rule of a definition, `self` is the value. From the booking example:

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

definitions:
  booking:
    # …
    rules:
      - required: [reference, party_size, state, starts_at, ends_at, contact]
      - large_party_pays_deposit
      - ends_after_start
      - total_is_the_dishes
```

- `deposit` is optional, so the rule reads it only after `has(self.deposit)`. Without the guard, `compile` stops with `rule-guard`.
- A time is a string; `timestamp(...)` reads it, and `duration('30m')` is 30 minutes.
- Quote a rule that starts with `!`: `rule: '!has(self.dishes) || …'`.
- A failure carries the `message` and the rule's name, so an application can show its own text.
- A rule can take parameters, named by definitions: with `parameters: [limit]`, `rule: self >= limit` and `message: Must be at least {limit}`, you apply it as `- at_least: 0`.

## Relate the answer to the input

List a rule after an output, and it reads `input` and `output` (that object), never `self`. The starter's `split` answers `- share: [shares_add_up]`, with:

```yaml
    rule: output.share_cents * size(input.people) == input.total_cents
```

The harness checks these rules on every answer; a core that breaks one gets a `ContractViolation`.

## Declare a refusal

urn-forge has no special kind for an error. A refusal is an ordinary object in the operation's `output` list:

1. Add an object for the refusal, with what the caller needs to understand it.
2. Add it to the `output` list.
3. Give it a rule that says when it comes back, and give the other outputs the opposite rule, so that each input allows one output.
4. If it repeats a value of the input, add a rule that ties them, such as `names_the_weight`.
5. In the core, return `answer('<refusal>', value)`.
6. Add a scenario that ends with `Then the output is "<refusal>"`, and one that breaks its `required` rule with `When I check a "<refusal>" with:`.

[Part 3 of the tutorial](../tutorials/first-domain#_3-add-a-refusal) follows these steps. Name a refusal for what happened (`too_heavy_for_express`, `invalid_state`), not for an HTTP status; the shell maps it.

A refusal is not a rejected input. The core gives a refusal when the input is valid but the business says no, and `runOperation` returns it with `ok: true`. The harness rejects an input that breaks a rule of a definition, before the core runs, with `kind: 'InputRejected'`.

## Put a stored record, the caller or the time in the input

The core reads no database, session or clock. When an operation depends on one, the shell loads it into the input, and the manifest declares it as a property with rules.

**A stored record.** The booking example's input holds the booking as loaded:

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

`type: booking` gives `stored_booking` all the rules of a booking, and `names_the_booking` ties it to the request, so a shell that loads the wrong booking gets `InputRejected`. The record is the state before the call and the output the state after, so a rule of an output can compare them, as `keeps_the_party` does. If the record may not exist, leave it out of `required` and add an output whose rule reads `!has(input.stored_booking)`.

**The time.** Declare it as a `string` with `format: date-time`, and compare it in rules: `timestamp(input.now) <= timestamp(input.stored_booking.starts_at) - duration('2h')`. A scenario gives the time as a cell, so the core and the scenarios are deterministic.

**The caller.** Make an object for the caller as the shell authenticated them, put it in the input, and write rules for who may act, with an output such as `forbidden` for who may not.

## Return a record and an event

An output is one object. To return two things, make an object that holds both, such as `issued` with the properties `policy` and `policy_issued`. The shell stores one and publishes the other.
