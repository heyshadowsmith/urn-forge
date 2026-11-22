# What a contract cannot say yet

A manifest states the contract of a domain: the promises that the domain makes to each party outside its core. This page gives the promises that a manifest cannot state at this time, why each one is out, and what to do in its place.

## Contract and business logic

The contract says what **can** happen. The business logic decides what **does** happen.

- The contract is the same for each request: the values that the domain accepts, the operations, each possible answer, and how the contract changes.
- The business logic looks at one request and the current state. It selects one of the possible answers, and it calculates the values.

Two questions sort a rule:

1. Can a party outside rely on the rule without knowledge of the current state? Then it is contract. "A party has at most 12 guests" is true whatever the database holds.
2. Does the rule need a calculation, or data that the request does not hold? Then it is business logic. "There are enough seats for this party" needs the bookings of the evening.

A rule that only examines the request itself is contract, also if it sounds like logic. "A party of 7 or more pays a deposit" needs only the request, so an invariant can state it.

urn-forge examines that the business logic stays inside the contract: the core gets only valid input, and gives only declared answers with valid values. It does not examine that the logic selects the correct answer. Your scenarios do that.

## The parts that a manifest can state

| Part | The promise | In the manifest |
| --- | --- | --- |
| Names | Each concept has one name, and the name always has one meaning | Short keys and URNs |
| Valid values | These values, and only these, are valid | Fields, constraints, entities, invariants on one entity |
| Operations | These operations exist, and each takes this input | `operation` with `input` |
| Answers | An operation answers only with its output, its declared errors and its events | `output`, `errors`, `emits` |
| Change | A change keeps the promises that each party relies on | Lifecycle keys, `stability`, `urn-forge diff` |

Each hole below is a promise that the contract could make, but that a manifest cannot state at this time.

## Holes in the contract

These rules are contract by the two questions above: they need only the request and the answer, and a party outside can rely on them.

### Rules between an entity and its list items

**The promise:** "Each receipt date is at most 90 days before the claim date." "The list of attendee names has one name for each ticket." "The total is the sum of the lines."

**Why a manifest cannot state it:** an invariant names only the properties of its own entity. It cannot name a property inside a list item or an embedded entity, and it cannot count or add the items of a list.

**What to do:** put the rule in the core, with a declared error. Then add the scenarios at the edges yourself, for example 90 days and 91 days. Gate 3 asks for a scenario that expects the error, but it does not know the edges of a rule in the core.

### Rules between the request and the answer

**The promise:** "The refund is never more than the premium." "The booking that the operation gives has the party size of the request."

**Why a manifest cannot state it:** an invariant is on one entity. The output of an operation is examined against its own entity, not against the input.

**What to do:** the core keeps the rule. Show it with scenarios: an output table with the values at the edge, for example a cancellation on the first day of the term.

### Either-or shapes

**The promise:** "A payment is a card payment with a card number, or a transfer with an account, never both."

**Why a manifest cannot state it directly:** an entity has one set of properties. There is no type for "one of these shapes".

**What to do:** use a field that names the shape, make the properties of each shape optional, and add an invariant for each shape. `reportOn` puts the issue on the property to correct:

```yaml
payment.field.method:
  primitive: enum
  values: [card, transfer]
  description: How the buyer pays
payment.entity.payment:
  description: A payment
  fields:
    - ref: payment.field.method
    - { ref: payment.field.card_number, required: false }
    - { ref: payment.field.account, required: false }
payment.invariant.card_has_number:
  description: A card payment has a card number, and no account
  on: payment.entity.payment
  rule: method != 'card' or card_number is present and account is absent
  reportOn: card_number
  message: A card payment needs a card number and no account
payment.invariant.transfer_has_account:
  description: A transfer has an account, and no card number
  on: payment.entity.payment
  rule: method != 'transfer' or account is present and card_number is absent
  reportOn: account
  message: A transfer needs an account and no card number
```

The generated type of the payment has each property as optional. Thus the core must examine `method` before it reads `card_number`.

### Uniqueness among stored records

**The promise:** "No two customers have the same email."

**Why a manifest cannot state it:** a manifest has the `key` of an entity and `unique` for the items of one list. It has no rule across the rows of a table.

**What to do:** add a `UNIQUE` constraint in your own migration, and give it a comment that starts with the URN of the field, as the generated constraints have: `COMMENT ON CONSTRAINT "customer_email_key" ON "customer"."customer" IS 'urn:…:field:email';`. Then the query of [Store entities in Postgres](../how-to/store-in-postgres) maps the Postgres error `23505` to that URN. Without the comment, it gives the URN of the table. The core cannot examine this rule, because it needs the stored rows.

### The same request two times

**The promise:** "If a caller sends the same booking two times, the second call gives the same answer, and makes no second booking."

**Why a manifest cannot state it:** an operation has no property for this. `retryable` on an error tells a caller that the same request can succeed later. It does not promise that two calls have the effect of one.

**What to do:** the shell keeps a key for each request, for example from a request header, and gives the stored answer for a key that it already has.

### One domain that refers to a different domain

**The promise:** "The customer of billing is the customer of accounts."

**Why a manifest cannot state it:** a manifest has one namespace and one domain. A reference goes only to an atom of the same manifest.

**What to do:** declare the field in each manifest, with the same constraints. Keep the two the same by review, or with `urn-forge diff` on each manifest.

## Promises that urn-forge leaves out on purpose

These are real promises of a contract. The [scope charter](../project/scope-charter) puts them outside urn-forge, because a different part of a system owns them.

| Promise | Example | Who owns it |
| --- | --- | --- |
| Who can call | "Only the holder can cancel a policy" | The shell, and your authorization tools |
| Time zones | "The start time is on the day of the booking" | The core, with a declared error |
| The delivery of events | "Each event arrives one time, in the sequence of the operations" | Your message tools, after the shell publishes |
| Operations that take a long time | "The claim is checked within two days" | Your workflow tools. Each urn-forge operation gives one answer at once |

## Small gaps

| Gap | What to do |
| --- | --- |
| A unit or a currency, for example "an amount in EUR" | Write it in the description. Nothing examines that two amounts have the same currency |
| More than one declared error for one call | A handler gives one error. Put the most important reason first. The boundary already gives each issue of the input |
| A value that is present and empty, not absent | There is no `nullable`. Use an absent value, or a value that means "none", for example an `enum` value |
| A map from keys to values | Use a list of embedded entities, with `unique` by their key |
| The `version` of the manifest | `urn-forge diff` does not compare the `version` with the changes. Set it yourself from the result of `diff` |

## Which hole comes next

urn-forge does not add a feature without the need of a real domain. Refer to the [feature audit](../project/feature-audit). Two holes fit the invariants that urn-forge already has, because each needs only the request and the answer: rules between an entity and its list items, and rules between the request and the answer. Two of the blind trials met the first one.

## Related pages

- [Results and declared errors](./results-and-errors)
- [What the gates show](./what-the-gates-show)
- [The rule language](../reference/rule-language)
- [Scope](../reference/scope)
