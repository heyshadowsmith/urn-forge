# urn-forge contract completeness roadmap

Nov 22, 2026 · @Shadow Smith

**The goal: a manifest can declare any contract.** A contract is the closed, named set of promises that a domain makes at its boundaries: what it accepts, what it can answer, and what it keeps (refer to [What a contract cannot say yet](../docs/explanation/the-contract.md)). Today a manifest states the promises about one value, one entity, one operation and its answers, and how the contract changes. It cannot state the promises that connect two things, and it leaves four promises out on purpose.

This roadmap replaces two decisions: the feature freeze of the [feature audit](./feature-audit.md) (decision 2), and the list of promises that the [scope charter](./scope-charter.md) leaves out on purpose (decision 3). It keeps the test of the charter: a new construct must describe the contract and not the behaviour, each part that enforces the contract must be able to use it, it must be deterministic, and a scenario must be able to show it. "Any contract" means any promise that passes that test. Business logic stays in the core.

## How completeness is measured: the contract corpus

A goal of "any contract" needs a measure, or it has no end.

- **The corpus** is a directory, `contracts/`, of real contracts, each written as plain promises first: payments, bookings, claims, ticketing, insurance, subscriptions, inventory, and the public contract of a known API style (a payments API, a messaging API).
- **Each promise** of each contract is a line with an ID: `payments.P07: a card payment has a card number and no account`.
- **Each promise has one status:** *declared* (the manifest states it, and a test shows that each enforcing part applies it), *workaround* (the manifest states it only with a pattern of [known holes](../docs/explanation/the-contract.md)), or *not declarable*.
- **The score** is the share of promises that are declared. CI prints it. Each plan of this roadmap names the promises that it moves to *declared*, and the score must go up.
- **A blind trial after each phase** gives a new contract to an agent, which writes its promises, then its manifest, and reports each promise that it could not declare. New promises go into the corpus.

## The first score

Nov 22, 2026: **26 of 143 promises declared (18.2%).** 89 are workarounds and 28 are not declarable. Refer to the [corpus plan](./corpus-plan.md).

| Hole | Promises | Hole | Promises |
| --- | --- | --- | --- |
| A2 Request and answer | 19 | E2 The current time | 6 |
| C3 States and transitions | 16 | E4 How the contract changes | 6 |
| D4 Delivery of events | 11 | B1 Either-or shapes | 4 |
| D2 Who can call | 10 | D3 Time zones | 4 |
| A1 Lists and embedded entities | 9 | E1 Check digits | 2 |
| C1 Uniqueness | 8 | A3 More than one error | 1 |
| C2 The same request two times | 7 | B3 Maps | 1 |
| E3 Changes after a time | 7 | | |
| B4 Units and currencies | 6 | | |

The corpus found four holes that this roadmap did not have, now in phase E:

| # | Hole |
| --- | --- |
| E1 | Formats that need a check digit or a checksum (Luhn, mod-97) |
| E2 | Rules against the current time ("at least 2 hours before the start") |
| E3 | Changes that happen after a time, without a request ("expires after 7 days") |
| E4 | Rules about how the contract changes over time (how long a deprecated version stays) |

Each contract builder also reported gaps that no hole names. Each was met in three or more of the six contracts:

- **A rejected input answers with a declared error.** The promises name a refusal code, such as `INVALID_REQUEST`. A field limit or an invariant always answers with an input rejection, which has no name of its own. This was filed under A2 or A3.
- **A refusal changes nothing.** Nothing in a manifest says that a declared error leaves the state as it was.
- **Exactly one event for each change.** `emits` means zero or more events of each kind.
- **A rule on the stored state before a call**, such as "only a captured payment can be refunded". This was filed under A2 or C3, but it is closer to C3.
- **An invariant on an output entity.** The runtime applies it to each answer, but no scenario can show it broken.

Friction in urn-forge, met by two or more builders:

- Gate 3 refuses an `Examples` column whose placeholder is inside a list or object cell, such as `[{ sku: <sku> }]` (`unknown-header`).
- An event that no operation emits is not checked.

## States and moves (C3)

Nov 22, 2026: **34 of 143 promises declared (23.8%)**, up from 26. Refer to the [states plan](./states-plan.md). The 8 promises that the plan named are declared, and C3 goes from 16 promises to 5. Its other promises moved to the hole of the part that is still missing, most to E2 (the current time).

Moving the six contracts onto states found five gaps in the first design, each closed in the same change:
- `missing`, for a record that the shell does not find;
- `to` as a list, for an end state that depends on the request;
- staying in a state is not a move;
- the state and the key of a smaller answer;
- an Examples column that only the current record uses.

What the contracts still could not state, each in two or more contracts:
- An end state that depends on a value of the request, such as the cancel mode. `to` lists the states, but not which input gives which.
- Fields that cannot change in some states ("lines cannot change after DRAFT").
- A rule between the stored record and the request, such as "a capture is at most the authorized amount" or "the version is one higher". This is the stored-state part of A2.
- A repeat of a call that ends in the same state with the first answer (C2).


## Conditions (part of A2)

Nov 22, 2026: **40 of 143 promises declared (28.0%)**, up from 34. Refer to the [conditions plan](./conditions-plan.md). Bookings P02 and P08, claims P12, and payments P10, P11 and P12 are declared. Subscriptions P11 did not move: "the current plan is unchanged" compares an embedded entity as a whole, which a rule cannot do, so it moved to A1. A2 goes from 19 promises to 13.

The contracts found that filling a refusal by property name is too weak when the request and the record share a name; `fill` names the source of each property. Still open:
- A property of a refusal that is a calculation, such as "available = captured - refunded".
- A rule that names an emitted event (claims P14: "the published event carries the reason").
- `requires` runs before the core, so a refusal can carry values of the record. Who may call (D2) must be examined in the shell first.

## Lists (A1)

Nov 22, 2026: **45 of 143 promises declared (31.5%)**, up from 40. Refer to the [lists plan](./lists-plan.md). Claims P04, payments P07, inventory P06, ticketing P05 and subscriptions P11 are declared. A1 goes from 10 promises to 5.

Moving the contracts onto lists found two gaps, each closed in the same change:
- Paths into embedded entities, such as `total.amount_minor`, for money as an amount and a currency.
- A repeated item covered the gate 3 boundary of `unique` even in a list that the schema refused for its length first.

What the contracts still could not state:
- A rule on each item (`every`), such as "each line is in the currency of the total" (subscriptions P15) or "a line's date is at most 90 days before submission" (claims P05).
- A pairing of the items of two lists, such as "one ticket for each held place" (ticketing P10) or "one answer line for each requested line" (inventory P10).
- A sum with a condition, such as "1 ticket for a seated line, the quantity for a standing line" (ticketing P04).
- An invariant on an entity that is only an answer needs no breaking scenario in gate 3. Each success scenario checks it, but no scenario shows that it refuses.

## Event delivery (D4)

Nov 22, 2026: **52 of 143 promises declared (36.4%)**, up from 45. Refer to the [event delivery plan](./event-delivery-plan.md). Bookings P20 and P21, claims P14 and P21, payments P21, subscriptions P20 and inventory P19 are declared. D4 goes from 11 promises to 3.

The contracts found two gaps, each closed in the same change:
- `nextEvents` gave every unpublished row, so a publisher that skipped a failed event could send a later event of the same order first. It now gives only the oldest unpublished event of each order.
- An `ensures` rule that reads `event.` failed on a success that its `when` rules allow to have no event, such as a repeat cancel. It is now not checked when there is no event.

What the contracts still could not state:
- The time of a change. Each `occurred_at` is a value of the core, not a clock (E2): payments P20, inventory P18.
- Events with no operation: a trial that ends, an expired reservation, a status that the bank changes (E3).
- One event for each item of a list: "one StockReserved for each line" (inventory P18, P20).
- An order for each item of a list in an event, or an event in two orders: an OrderPlaced that names several tickets (ticketing P20). `orderBy` names top-level properties only, not paths.
- A rule on one event of a success with several events: `event.` needs one event.
- A contract can make a change with no event that its promise does not allow: claims P20, where `edit_draft` moves a rejected claim back to DRAFT.

## Callers (D2)

Nov 22, 2026: **57 of 143 promises declared (39.9%)**, up from 52. Refer to the [callers plan](./callers-plan.md). Bookings P19, claims P18 and P19, inventory P21 and payments P16 are declared. D2 goes from 10 promises to 4; bookings P16 moved to E2.

The contracts found two gaps, each closed in the same change:
- An operation whose `otherwise` error sorted after it in URN order built without its callers, with no diagnostic. Each kind now builds after the kinds it reads.
- `allow: any` needed an `otherwise`, which no caller can get, so gate 3 asked for a scenario that cannot exist. It now takes none.

What the contracts still could not state:
- Gate 3 does not show that each rule of `allow` is covered, or each part of a rule. A scenario that refuses a manager who approves their own claim can be removed with verify still green. Decision 8 of the plan is not built.
- One `otherwise` for each operation: a read-only key and a key of another merchant cannot get different refusals (payments P22).
- Authentication refusals, such as "unauthorized", are the shell's: a missing caller is a `ContractViolation`.
- Membership in a list of the caller, such as "staff assigned to the event" (ticketing P21).
- A rule that reads a second record, such as the organizer of the event of a ticket.
- Filters on lists: "may list their own subscriptions" (subscriptions P22).
- The core and the events do not get the caller, so each claims rule ties the actor of the request to the caller.

## The current time (E2)

Nov 22, 2026: **61 of 143 promises declared (42.7%)**, up from 57. Refer to the [time plan](./time-plan.md). Payments P18, subscriptions P06 and P12, and ticketing P23 are declared. E2 goes from 10 promises to 0: the four of bookings move to D3, as their start is a local time in the zone of the restaurant; payments P20 moves to E3; ticketing P09 moves to A2.

The contracts found one gap, closed in the same change: gate 3 did not fill in the time of an outline, `Given the time is "<now>"`.

What the contracts still could not state:
- A local date and time in a zone (D3): bookings P07, P14, P15 and P16. `now` is there; the instant of the start is not.
- A value that a record copies from another record, such as the start of the event on an order, a ticket and a transfer. A description says it; nothing checks it.
- The record that an operation leaves behind when its answer has another shape (payments P18 states the capture time of the answer, and the shell stores it).
- A rule on each item of a list (`every`), such as the start of each ticket of an order.
- "One of" in the rule language: `status != 'a' and status != 'b' …`.

## Changes on a clock (E3)

Nov 22, 2026: **65 of 143 promises declared (45.5%)**, up from 61. Refer to the [clock plan](./clock-plan.md). Payments P17, claims P23, subscriptions P21 and ticketing P07 are declared. E3 goes from 9 promises to 3: ticketing P15 moves to D2 and P19 to A2, as their clock parts are now stated.

The contracts found one gap, closed in the same change: `Then the output is` compared timestamps as text, so `19:00:00Z` did not match `19:00:00.000Z`.

What the contracts still could not state:
- A timed change that changes other records: "its stock becomes available again" (inventory P16).
- Moves that no one calls and no time decides, such as a bank that authorizes a payment (payments P20).
- A built-in caller for the clock: a domain with a caller that requires a tenant or an employee makes those fields optional, and every rule guards them.
- An operation only for the shell, which a promise of "exactly these operations" can leave out (inventory P07 is kept declared on that reading).
- A rule on one event of a success with several events (ticketing P19, subscriptions P19).
- No scenario shows that a stored record breaks an invariant, or that a caller does.
- The stored record of an operation whose answer has another shape: the shell copies `submitted_at` or `captured_at` into it.

## Idempotency (C2)

Nov 22, 2026: **71 of 143 promises declared (49.7%)**, up from 65. Refer to the [idempotency plan](./idempotency-plan.md). Bookings P17, claims P16, inventory P15, payments P15, subscriptions P18 and ticketing P14 are declared. C2 goes from 7 promises to 1.

The contracts found two gaps, each closed in the same change:
- `runOnce`, and the steps, answered a repeat before the runtime checked `callers`, so a read-only key could get the answer of a write. The runtime now gives the first answer only once the caller may call.
- The runtime of a domain with a caller and no record referred to a record that it does not have.

What the contracts still could not state:
- A repeat of a call with no key: bookings P18, "cancelling a cancelled booking returns the same details and does not refund again". The record does not keep the cancellation, and no refund is modelled.
- A key shared across operations: a key is owned by one operation.
- An `otherwise` error with fields that the input does not have: subscriptions added a second conflict error.
- Gate 3 asks for a repeat, but not for each part of the rule: another body, another owner, the edge of the window.
- The steps do not change the record between a call and its repeat.

## The phases

Each item is a plan of its own, with the format of the earlier plans: a target written first, one commit for each step, sabotages at the end. The order puts first what the most contracts need, and what fits the machinery that exists.

### Phase A: relations inside one request and its answer

| # | Hole | The construct | Enforced by |
| --- | --- | --- | --- |
| A1 | Rules between an entity and its list items and embedded entities | Paths and quantifiers in the rule language: `each lines: receipt_date >= claim_date - 90`, `count(names) = quantity`, `sum(lines.amount) = total` | Valibot (exact); SQL where a row sees it, else `unenforced-in-sql`; gate 3 coverage of the invariant; `diff` as a rule change |
| A2 | Rules between the request and the answer | Postconditions on an operation: `ensures: output.refund <= input.premium` | `executeOperation`: a broken postcondition is `ContractViolation`; gate 3 needs a scenario at the edge; `diff`: a new postcondition narrows Out (compatible) |
| A3 | More than one declared error for one call | `fail` with a list of declared errors | The runtime, gate 1 types, the `fails with` step for each |

### Phase B: shapes

| # | Hole | The construct | Enforced by |
| --- | --- | --- | --- |
| B1 | Either-or shapes | A variant entity: a discriminator field and one entity for each case | Valibot `v.variant`; a union type in TypeScript; SQL columns of each case with a `CHECK` for the case; gate 3 boundary coverage for each case; `diff` for a new or removed case by direction of use |
| B2 | Present and empty, not absent | `nullable` on a field reference | Valibot `v.nullable`; SQL `NULL` with the meaning written in a comment; gate 3 needs a `null` case |
| B3 | Maps | `map` on a field reference, with a key field and a value | Valibot `v.record`; SQL child table keyed by the map key |
| B4 | Units and currencies | `unit` on a field; a rule may compare and add only fields of one unit | Pass 6 types the units; the schema of a money value with its currency field |

### Phase C: promises about what is kept and about repeated calls

| # | Hole | The construct | Enforced by |
| --- | --- | --- | --- |
| C1 | Uniqueness among stored records | `unique: [<property>, …]` on an entity | SQL `UNIQUE` with the URN comment; a declared error that the shell gives from `23505`; a scenario step that stores two |
| C2 | The same request two times | `idempotencyKey: <property>` on an operation | The store file: a table of keys and answers, and the statements to read and write it; a scenario step that sends one request two times |
| C3 | States and transitions of an entity | A `states` field with the moves that are allowed: `submitted → approved, rejected` | The store file: an `UPDATE … WHERE state = <from>`; a declared error for a move that is not allowed; gate 3 coverage of each move |
| C4 | Operations that take a long time | An operation that answers `accepted` with a reference, and an event for each later state (uses C3) | The runtime types; event coverage; scenarios for each state |

### Phase D: promises across a system

| # | Hole | The construct | Enforced by |
| --- | --- | --- | --- |
| D1 | One domain that refers to another | Imports between manifests: `uses: acme:accounts@^1` and references to its atoms | The compiler reads the other manifest; `diff` across the pair; generated types from the other domain |
| D2 | Who can call | `callers` on an operation: named roles, and rules on the input that the caller must meet (`caller.customer_id = input.holder`) | A generated guard that the shell calls before `executeOperation`; a declared error `forbidden`; scenario steps with a caller |
| D3 | Time zones | A `zone` on a `timestamp` field or on the manifest; `date_of(at)` in a rule | Valibot and SQL with the zone from the manifest, never from the environment (keeps determinism) |
| D4 | The delivery of events | Declared guarantees on an event: an ordering key, at least one delivery, a deduplication key | Generated metadata for the publisher; a scenario step for the key; the guarantee itself is the platform's, so the manifest states it and the docs give the owner |

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The goal | **A manifest can declare any promise that passes the test of the scope charter** | "Any contract" without the test becomes "any program". The test keeps business logic in the core |
| 2 | The feature freeze of the audit | **Lift it**, and put the corpus score in its place: a new construct is in only if it moves promises of the corpus to *declared* | Evidence still decides; the corpus gives it without a human team first |
| 3 | The promises that the charter left out | **Back in, as phase D**, each with a construct that states the promise and names who enforces it when urn-forge cannot | Each is a real promise. A manifest can state a promise that the platform keeps, as long as it says so |
| 4 | The cuts of the audit | **Keep audit records (`recordAs`)**: "a refusal is recorded" is a promise about an answer. **Still cut `core-parser-import`** | The first is contract by the definition; the second is not a promise |
| 5 | The docs split | **Do it first, before phase A** | Each phase adds surface. A core path and pages for each extra keep a new user from meeting all of it |
| 6 | The corpus | **Build it before A1**, with at least six contracts and their promises, and the first score | Each plan then states the promises that it moves, and CI shows the score |
| 7 | The order | **A, B, C, D**, one plan at a time | A and B extend what exists; C needs the store file; D needs decisions about other systems |
| 8 | The rule language | **It grows in A1, A2 and B4 only**: paths, quantifiers, `count`, `sum`, units, `input.` and `output.`. No user functions, no loops, no calls | These are what relations need. More would make it a programming language, which fails the test |
| 9 | Outside registries | **urn-forge ships no outside registry: no time zones, no currencies, no countries, no names of places. A contract states the values it accepts, as an `enum` or a rule, in its own repository**. Added Nov 23, 2026 | A registry changes by its own rules, outside the contract and outside urn-forge. A pinned copy in urn-forge would make urn-forge its keeper; a copy from the platform (`Intl`, the database) would give two verdicts for one commit. A contract that lists the currencies it accepts states a narrower and truer promise than "any ISO 4217 code". The [UTC times plan](./utc-times-plan.md) made the same choice for time zones |

## The first steps

1. The docs split (decision 5). Done.
2. The corpus, with its score in CI (decision 6). Done: 18.2%.
3. States and moves (C3). Done: 23.8%.
4. Conditions (part of A2). Done: 28.0%.
5. Lists (A1). Done: 31.5%.
6. Event delivery (D4). Done: 36.4%.
7. Callers (D2). Done: 39.9%.
8. The current time (E2). Done: 42.7%.
9. Changes on a clock (E3). Done: 45.5%.
10. Idempotency (C2). Done: 49.7%.
11. Compatibility (E4). Done: 51.0%. The four E4 promises left are about how long an operator runs an old major version, which nothing that urn-forge builds can check.
12. Refusals (part of A2). Done: 51.7%. Ticketing P09 is declared. Bookings P12, claims P13 and inventory P08 state more, and stay workarounds: a window over a local time (D3), a seventh refusal code, and the stored stock (group 3).
13. UTC times (most of D3). Done: 55.9%. Bookings P07, P14, P15 and P16, inventory P17 and subscriptions P23 are declared. D3 keeps 3 promises that need zone data: bookings P03 and P12, and ticketing P22.
14. Uniqueness (C1). Done: 59.4%. Bookings P01, claims P01, inventory P13, subscriptions P17 and ticketing P03 are declared. C1 keeps 4: a seat across holds and tickets, a capacity, a receipt on child rows of two claims, and the order of invoice periods.
15. Currencies (B4), with no plan and no new construct (decision 9): each contract lists the currencies it accepts as an `enum`. Done: 62.2%. Claims P02, payments P01, subscriptions P03 and ticketing P02 are declared. Bookings P09 stays a workaround: the service has many restaurants, and one enum cannot be the currency of each.
16. The next plan. The score now puts A2 (12) and A1, C3, D2 (5 each) first.

## Risks

- **The manifest becomes a language to learn.** Each construct adds a page and codes. The docs split, and a core path that does not mention phases B to D, keep the first hour small.
- **A promise that no part can enforce.** D4 can only be stated and documented. Each such construct must say who keeps the promise, or it is a comment, not a contract.
- **The corpus as our own opinion.** Its contracts are written by us. The blind trial after each phase adds promises from outside.
