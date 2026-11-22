# The contract

A domain makes promises to each party outside its core: to callers, to the systems that read its events, and to the database that keeps its rows. Together, these promises are the contract of the domain. A manifest states the contract, and urn-forge makes sure that the code keeps it. This page tells what a contract is, what it is not, and which promises a manifest cannot state.

## What a contract is

A contract is a set of promises that a party outside can rely on without knowledge of the code. "A parcel weighs from 1 to 30000 grams." "The operation `quote_shipping` takes a parcel and gives a quote." "If a parcel is too heavy for express delivery, the answer is the error `too_heavy_for_express`, and nothing else."

A party outside does not read your handlers. It reads the contract. If the contract is clear and the code keeps it, the party can call the domain, store its values and react to its events with no surprise.

## Contract and business logic

The contract says what **can** happen. The business logic decides what **does** happen.

- The contract is the same for each request. It gives the values that the domain accepts, the operations, each possible answer, and how the contract changes.
- The business logic looks at one request and the current state. It selects one of the possible answers, and it calculates the values.

Two questions sort a rule:

1. Can a party outside rely on the rule without knowledge of the current state? Then it is contract. "A party has at most 12 guests" is true whatever the database holds.
2. Does the rule need a calculation, or data that the request does not hold? Then it is business logic. "There are enough seats for this party" needs the bookings of the evening.

A rule that needs only the request is contract, also if it sounds like logic. "A party of 7 or more pays a deposit" needs only the request, so an invariant can state it.

urn-forge makes sure that the business logic stays inside the contract. The core gets only valid input, and gives only declared answers with valid values. urn-forge does not examine that the logic selects the correct answer. Your scenarios do that.

## The five parts of a contract

| Part | The promise | In the manifest |
| --- | --- | --- |
| Names | Each concept has one name, and the name always has one meaning | Short keys and URNs |
| Valid values | These values, and only these, are valid | Fields and their constraints, entities, invariants on one entity |
| Operations | These operations exist, and each takes this input | `operation` with `input` |
| Answers | An operation answers only with its output, its declared errors and its events | `output`, `errors`, `emits` |
| Change | A change keeps the promises that each party relies on | `status`, `stability` and `urn-forge diff` |

The six kinds of the manifest map to these parts. A `field` and an `entity` give valid values, and an `invariant` gives a rule across the fields of one entity. An `operation` names an input and its answers. An `error` is a refusal that a caller can expect, and an `event` is a fact that a success tells. For the keys, refer to [The manifest](../reference/manifest).

## URNs as permanent names

Every atom has exactly one URN. The manifest, the generated code, the core and the features all refer to the atom by that URN.

```
urn:<namespace>:<domain>:<context>:<kind>:<identifier>
urn:demo:shipping:parcel:field:weight_grams
```

Names in code change often. A person renames a type or moves a function, and a test that refers to the old name loses its link without a sign. A URN is a name outside the code. It does not depend on a file, a type name or a language. Thus it can be the key in each part of the chain: the handler registry, the dispatch map and the tag of a feature. The generated type names, such as `QuoteQuoteShippingHandler`, come from the URN. The URN does not come from them.

You do not write the full URN in the manifest. The header gives `namespace` and `domain` once, and each entry has a short key, such as `parcel.field.weight_grams`. Thus two entries in one file cannot disagree about the namespace or the domain. The short key also gives the brand identifier, `ParcelWeightGrams`. If two atoms give the same brand identifier, the compiler stops with `duplicate-brand`. It does not add a silent suffix, because then a new atom could rename an old type.

A name can only be a key if its meaning does not change. Consumers depend on what a URN accepts and what it returns. If the meaning changes and the name stays, the consumers break, and the name tells them nothing. The correct change is a new URN, and a deprecation of the old URN. [Compatibility and the direction of use](./compatibility) tells how `urn-forge diff` applies this rule.

A manifest declares one namespace and one domain, and it cannot refer to a different manifest. As a result, the manifest is the only authority for its domain, and every diagnostic points at a line in one file. The cost is that two domains cannot share a field.

## What urn-forge does not own

urn-forge owns the contract and the proof that the code keeps it. Other parts of a system own these promises:

| Promise | Example | Who owns it |
| --- | --- | --- |
| Who can call | "Only the holder can cancel a policy" | The shell, and your authorization tools |
| Time zones | "The start time is on the day of the booking" | The core, with a declared error |
| The delivery of events | "Each event arrives one time, in the sequence of the operations" | Your message tools, after the shell publishes |
| Operations that take a long time | "The claim is checked within two days" | Your workflow tools. Each urn-forge operation gives one answer at once |

urn-forge also does not do the work of the shell. It does not make an HTTP map of the outcomes, read or write rows, or publish events. The core does no I/O, so the shell loads data before a call and stores the result after it. For the Postgres extra, urn-forge makes the tables and their checks. It does not have migrations, code that reads and writes rows, or an event store at this time. A link to an entity does not make sure that the linked object exists. The shell does that.

## What a contract cannot say yet

Some promises are contract by the two questions above, but a manifest cannot state them at this time. For each one, this section gives the promise, why a manifest cannot state it, and what to do.

### Rules between an entity and its list items

**The promise:** "Each receipt date is at most 90 days before the claim date." "The total is the sum of the lines."

**Why:** an invariant names only the properties of its own entity. It cannot name a property inside a list item or an embedded entity, and it cannot count or add the items of a list.

**What to do:** put the rule in the core, with a declared error. Then add the scenarios at the edges yourself, for example 90 days and 91 days. Gate 3 asks for a scenario that expects the error, but it does not know the edges of a rule in the core.

### Rules between the request and the answer

**The promise:** "The refund is never more than the premium."

**Why:** an invariant is on one entity. `executeOperation` examines the output of an operation against its own entity, not against the input.

**What to do:** the core keeps the rule. Show it with scenarios: an output table with the values at the edge, for example a cancellation on the first day of the term.

### Either-or shapes

**The promise:** "A payment is a card payment with a card number, or a transfer with an account, never both."

**Why:** an entity has one set of properties. There is no type for "one of these shapes".

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

**Why:** a manifest has the `key` of an entity and `unique` for the items of one list. It has no rule across the rows of a table.

**What to do:** add a `UNIQUE` constraint in your own migration. Give it a comment that starts with the URN of the field, as the generated constraints have: `COMMENT ON CONSTRAINT "customer_email_key" ON "customer"."customer" IS 'urn:…:field:email';`. Then the query of [Store entities in Postgres](../how-to/store-in-postgres) maps the Postgres error `23505` to that URN. Without the comment, it gives the URN of the table. The core cannot examine this rule, because it needs the stored rows.

### The same request two times

**The promise:** "If a caller sends the same booking two times, the second call gives the same answer, and makes no second booking."

**Why:** an operation has no property for this. `retryable` on an error tells a caller that the same request can succeed later. It does not promise that two calls have the effect of one.

**What to do:** the shell keeps a key for each request, for example from a request header. It gives the stored answer for a key that it already has.

### One domain that refers to a different domain

**The promise:** "The customer of billing is the customer of accounts."

**Why:** a reference goes only to an atom of the same manifest.

**What to do:** declare the field in each manifest, with the same constraints. Keep the two the same by review, or with `urn-forge diff` on each manifest.

### Small gaps

| Gap | What to do |
| --- | --- |
| A unit or a currency, for example "an amount in EUR" | Write it in the description. Nothing examines that two amounts have the same currency |
| More than one declared error for one call | A handler gives one error. Put the most important reason first. The boundary already gives each issue of the input |
| A value that is present and empty, not absent | There is no `nullable`. Use an absent value, or a value that means "none", for example an `enum` value |
| A map from keys to values | Use a list of embedded entities, with `unique` by their key |
| The `version` of the manifest | `urn-forge diff` does not compare the `version` with the changes. Set it yourself from the result of `diff` |

## Related pages

- [Tutorial: build the shipping domain](../tutorials/first-domain)
- [The manifest](../reference/manifest)
- [Core and shell](./core-and-shell)
