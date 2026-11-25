# Write rules and refusals

A rule states a condition that must be true. You apply a rule by its name to a definition or an output. A refusal is an output that says no. The [manifest reference](../reference/manifest#rules) gives the full language. After each change, run `npx urn-forge compile`, then `npx urn-forge verify`. Gate 3 names each new rule or output that does not have a scenario.

## Write a rule

A standard rule is one of the keywords of JSON Schema. Put it in the `rules` of a definition, with no argument (`- uniqueItems`) or with an argument (`- minimum: 1`). For other conditions, declare your own rule one time, in the top-level `rules` section. Then apply it by its name. In a rule of a definition, `self` is the value. This is from the booking example:

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

- Because `deposit` is optional, the rule reads it only after `has(self.deposit)`. If the rule does not have this guard, `compile` stops with `rule-guard`.
- A time is a string. `timestamp(...)` reads it, and `duration('30m')` is 30 minutes.
- If a rule starts with `!`, put the rule in quotes: `rule: '!has(self.dishes) || …'`.
- A failure has the `message` and the name of the rule, so that an application can show its own text.
- A rule can have parameters. The name of each parameter is the name of a definition. For example, a rule `at_least` has `parameters: [limit]`, `rule: self >= limit` and `message: Must be at least {limit}`. You apply it as `- at_least: 0`.

## Relate the answer to the input

If you put a rule after an output, the rule reads `input` and `output` (the object of that output). It does not read `self`. The `split` operation of the starter has the output `- share: [shares_add_up]`, with this rule:

```yaml
    rule: output.share_cents * size(input.people) == input.total_cents
```

The harness checks these rules on each answer. If the answer of a core breaks one of these rules, the result is a `ContractViolation`.

## Declare a refusal

urn-forge has no special construct for an error. A refusal is an ordinary object in the `output` list of the operation:

1. Add an object for the refusal. Give it the properties that the caller must have to understand the refusal.
2. Add it to the `output` list.
3. Give it a rule that says when the core can give the refusal.
4. Give the other outputs the opposite rule, so that each input allows one output.
5. If the refusal repeats a value of the input, add a rule that connects the two values, such as `names_the_weight`.
6. In the core, return `answer('<refusal>', value)`.
7. Add a scenario that ends with `Then the output is "<refusal>"`.
8. Add a scenario that breaks the `required` rule of the refusal, with `When I check a "<refusal>" with:`.

[Part 3 of the tutorial](../tutorials/first-domain#_3-add-a-refusal) uses these steps. Give a refusal a name that tells what occurred (`too_heavy_for_express`, `invalid_state`). Do not use the name of an HTTP status. The shell gives the HTTP status.

A refusal is not a rejected input. The core gives a refusal when the input is valid, but the business says no. `runOperation` returns the refusal with `ok: true`. If an input breaks a rule of a definition, the harness rejects it before the core runs. The result has `kind: 'InputRejected'`.

## Put a stored record, the caller or the time in the input

The core reads no database, no session and no clock. If an operation uses one of these, the shell loads the data into the input. The manifest declares the data as a property with rules.

**A stored record.** The input of the booking example contains the booking as the shell loaded it:

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

`type: booking` gives `stored_booking` all the rules of a booking. `names_the_booking` connects it to the request. A shell that loads the wrong booking gets `InputRejected`.

The record is the state before the call, and the output is the state after the call. A rule of an output can compare them, as `keeps_the_party` does. If the record can be absent, do not put it in `required`. Then add an output whose rule reads `!has(input.stored_booking)`.

**The time.** Declare the time as a `string` with `format: date-time`. Compare it in rules: `timestamp(input.now) <= timestamp(input.stored_booking.starts_at) - duration('2h')`. A scenario gives the time in a cell, so that the core and the scenarios are deterministic.

**The caller.** Make an object for the caller, as the shell authenticated the caller. Put the object in the input. Write rules that tell who can do the operation. Add an output, such as `forbidden`, for a caller who cannot do it.

## Return a record and an event

An output is one object. To return two objects, make an object that contains the two. An example is `issued`, with the properties `policy` and `policy_issued`. The shell stores one of the two, and publishes the other.
