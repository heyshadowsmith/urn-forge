# urn-forge lists plan

Nov 22, 2026 · @Shadow Smith

After [conditions](./conditions-plan.md), the corpus is at 40 of 143 promises (28.0%). A1, "rules between an entity and its list items", has 10 promises, and two of the last three plans moved promises into it. Its promises, and the list promises still in A2, need these constructs:

| Construct | Example | Promises that it moves | Promises that it does not move, and why |
| --- | --- | --- | --- |
| A total over the items of a list | "The claim total always equals the sum of its line amounts" (claims.P04) | claims.P04, subscriptions.P15 | ticketing.P10: also "one ticket per held place", a pairing of two lists |
| A product of two numbers | "The payment amount equals the sum of quantity times unit amount over all lines" (payments.P07) | payments.P07, with the total | bookings.P09: also "the restaurant's single currency" (B4) |
| Uniqueness by more than one property of an item | "No SKU-location pair appears twice in the same request" (inventory.P06) | inventory.P06, ticketing.P05 | — |
| Equality of two embedded entities | "The answer shows the current plan as unchanged" (subscriptions.P11) | subscriptions.P11 | — |
| A rule on each item, with a value of the parent | "A line's expense date is never more than 90 days before the claim's submission date" (claims.P05) | none: the claim holds no submission date, which is the current time (E2) | claims.P05 |
| A pairing of the items of two lists | "One answer line for each requested line, with the same SKU" (inventory.P10) | none in this plan | inventory.P08, P10, P22, ticketing.P08, P10 |

This plan builds the first four. A rule on each item would move no promise of the corpus today, and a pairing of two lists is a larger construct; both wait for a promise that needs only them. The roadmap allowed paths, quantifiers, `count` and `sum` in the rule language (decision 8). This plan takes `sum` and a product, and keeps the rest out until the corpus needs it.

## What changes for a user

```yaml
claim.invariant.total_is_sum:
  description: The total of a claim is the sum of its lines
  on: claim.entity.claim
  rule: total = sum(line in lines: line.amount)

payment.invariant.amount_is_sum:
  description: The amount of a payment with line items is the sum of quantity times unit amount
  on: payment.entity.create_request
  rule: line_items is absent or amount = sum(item in line_items: item.quantity * item.unit_amount)

reservation.entity.request:
  fields:
    - ref: reservation.entity.line
      as: lines
      many: { minItems: 1, maxItems: 100, unique: [sku, location] }

subscription.operation.change_plan:
  ensures:
    - input.proration != 'at_period_end' or output.plan = current.plan
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The form of a total | **`sum(<item> in <list>: <value>)`**, with the item named in the rule. The value can use the item's properties (`line.amount`), the entity's, and arithmetic | One form covers "the sum of the amounts" and "the sum of quantity times unit amount". A name for the item keeps the item's properties apart from the entity's, with the prefix form that conditions already use |
| 2 | Where `sum` can be | **In invariants and in conditions,** over a list of embedded entities or a list of values of a property of the rule | The corpus needs it on an entity (claims.P04) and on an answer (subscriptions.P15) |
| 3 | The primitive of a total | **The primitive of the value: `integer` or `decimal`, exact.** The sum of no items is 0 | The same exact arithmetic as `+` |
| 4 | The product | **`*` between two `integer` values, or an `integer` and a `decimal`, exact.** Not between two `decimal` values, and not on `float`, dates or days. It binds tighter than `+` and `-` | The corpus needs quantity × price. A product of two decimals has a scale that no field states, and division is out, by decision 8 of the roadmap |
| 5 | Uniqueness by several properties | **`unique: [<property>, …]` on a list of embedded entities.** Two items are the same when each named property is present in both and equal. An item with a named property absent is not compared | `unique: true` compares the key of the item only. "No seat twice" names three properties, and a standing line has no row or seat number |
| 6 | Equality of embedded entities | **`=` and `!=` between two embedded entities of one entity**, compared property by property with the comparison of each primitive. Not for an entity that holds a list | subscriptions.P11 compares a plan as a whole. A list inside would need the pairing of items, which is out |
| 7 | SQL | **A unique list is a `UNIQUE` constraint of the child table over the parent key and the named columns. A rule with `sum` or equality of embedded entities is not a `CHECK`: `unenforced-in-sql`, as for any rule that a row cannot see** | Postgres treats `NULL` as distinct in `UNIQUE`, which is decision 5. A `CHECK` cannot read a child table |
| 8 | Gate 3 | **The boundary of a `unique: [ … ]` list is one request with two items that are the same by those properties.** A rule with `sum` is covered as any invariant: a scenario that breaks it | The same rules as today |
| 9 | `diff` | **`unique: [ … ]` follows the rules of `unique: true`: on In, adding it or naming fewer properties is narrower; on Out, the reverse.** A rule with `sum` or a product follows the rules of its invariant or condition | No new rule: the same relations as today |

## Scope

- **In scope:** `sum(… in …: …)`, `*`, `unique: [ … ]` on a list of embedded entities, `=` and `!=` between embedded entities; the Valibot schemas, the runtime and the Postgres schema for each; gate 3; `diff`; the six corpus promises; and the docs.
- **Out of scope:**
  - A rule on each item (`every`), and `count`. The corpus does not need them yet.
  - A pairing of two lists.
  - Products of two decimals, and division.
  - A sum with a condition, such as "1 ticket for a seated line, the quantity for a standing line" (ticketing.P04).

## The promises that this plan moves

| Promise | Now | After | The rule |
| --- | --- | --- | --- |
| claims.P04: 1 to 50 lines, one currency, and the total is the sum of the line amounts | workaround | declared | an invariant `total = sum(line in lines: line.amount)` |
| payments.P07: the amount equals the sum of quantity times unit amount | workaround | declared | an invariant with `sum` and `*` |
| subscriptions.P15: an invoice total is the sum of its line amounts | workaround | declared | an invariant with `sum` |
| inventory.P06: no SKU-location pair twice | workaround | declared | `unique: [sku, location]` |
| ticketing.P05: no seat twice in a hold or an order | not declarable | declared | `unique` over the three properties of a seat, on each list of seats |
| subscriptions.P11: at_period_end keeps the current plan | workaround | declared | `ensures: … output.plan = current.plan` |

These 6 promises take the score from 40 to 46 of 143 (32.2%). The contract builders apply the same strict test as before.

## The target, written first

Step 0 adds `tests/fixtures/lists`: a claim with lines and a total, a payment request with line items, a reservation request with `unique: [sku, location]`, and a plan that an operation must keep. It also adds `tests/lists.test.ts`, which runs the generated schemas and runtime. Each test is `it.fails` until its step is built.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `sum` and `*` in the rule language | The parser, the printer and the type checker. A sum over a property that is not a list, a value that is not a number, or `*` between two decimals is a `rule-type` error with a clear message |
| 2 | `sum` and `*` in the generated code | Valibot and the condition functions compute exactly, with the helpers of decimals; an invariant with `sum` is `unenforced-in-sql` |
| 3 | `unique: [ … ]` | The manifest, the IR, Valibot (one issue on the second item), the Postgres `UNIQUE` constraint, the gate 3 boundary and `diff` |
| 4 | Equality of embedded entities | The type checker and the generated code; an entity with a list is a `rule-type` error |
| 5 | The corpus | Claims, payments, subscriptions, inventory and ticketing; the six promises are declared; the minimum is the new score |
| 6 | Docs | The rule language, the manifest, Postgres and the gates pages; "Add an invariant" shows a total |

## Sabotages at the end

Each must turn CI red:

1. Make the claims core answer a total that is not the sum of the lines → the output schema refuses it, and a scenario fails.
2. Change `unique: [sku, location]` to `unique: [sku]` in a new manifest → `diff` reports a breaking change.
3. Remove the scenario that sends a repeated SKU-location pair → gate 3 `uncovered-boundary`.
4. Write `sum(line in lines: line.note)` over a string → `compile` stops.
5. Make the subscriptions core change the current plan in an at_period_end answer → a `ContractViolation` that names the rule.

## Done

- The 6 promises are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs state each rule.

## Risks

- **The rule language becomes a programming language.** The plan adds one aggregate and one operator, each because a promise of the corpus needs it. `every`, `count` and division wait for a promise.
- **A total over a long list.** A sum over 10,000 items is cheap; the schema already bounds each list with `maxItems` where the contract does.
- **Rounding.** `integer × decimal` and sums of decimals are exact, so there is nothing to round. A product of two decimals is out until a promise states its scale.
