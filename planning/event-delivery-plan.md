# urn-forge event delivery plan

Nov 22, 2026 · @Shadow Smith

After [lists](./lists-plan.md), the corpus is at 45 of 143 promises (31.5%). D4, "the delivery of events", has 11 promises, and each contract has two of the same kind:

| Group | Example | Promises |
| --- | --- | --- |
| Which events a change publishes | "Every state change publishes exactly one event … carrying the booking reference, …, new state" (bookings.P20) | bookings.P20, inventory.P18, payments.P20, subscriptions.P19, ticketing.P17 |
| How events are delivered | "Events are delivered at least once, each carries a unique event id for de-duplication, and events for the same booking are delivered in the order the changes happened" (bookings.P21) | bookings.P21, claims.P21, inventory.P19, payments.P21, subscriptions.P20, ticketing.P20 |

Two promises of A2 have the same shape: "the published event carries that reason" (claims.P14) and "when the available count drops to 0, the service publishes StockDepleted" (inventory.P20).

The [events plan](./events-plan.md) added events. Today `emits` lists the events that a handler *can* return, each zero times or more. Nothing states that a change publishes exactly one event, which values it carries, or how it reaches a consumer. Each core sets the event id to a constant, because a pure core cannot make a unique id. The publisher is the user's code, and urn-forge does not know of it.

The roadmap said that D4 can only be stated and documented, because the delivery is the platform's. This plan does more: the Postgres extra already writes the changed record, so it can write the events in the same transaction (an outbox) and give them to a publisher in order. Then urn-forge generates the part that keeps each promise, and only the transport stays the user's.

## What changes for a user

```yaml
payment.event.captured:
  description: A payment was captured
  fields:
    - ref: event.field.event_id
    - ref: payment.field.payment_id
    - ref: payment.field.status
    - ref: payment.field.previous_status
  delivery:
    id: event_id
    orderBy: payment_id

payment.operation.authorize_payment:
  emits:
    - event: payment.event.authorized
      when: output.status = 'authorized'
    - event: payment.event.pending
      when: output.status = 'pending'
  ensures:
    - event.payment_id = output.payment_id
```

```ts
const result = executeOperation(urn, body, core, { current, newEventId: () => crypto.randomUUID() });
if (result.ok) await db.transaction(async (tx) => {
  await replacePaymentFrom(tx, result.output, ['pending']);
  await insertEvents(tx, result.events); // the outbox, with the order of each payment
});
// A publisher process, which is yours:
for (const event of await nextEvents(db, 100)) { await send(event); await markPublished(db, event); }
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | How an operation says "exactly one" | **An item of `emits` can be `{ event, when? }`: exactly one such event on each success where the `when` rule holds, and none where it does not. Without `when`, on each success.** A short key in the list keeps today's meaning: zero or more | One form covers "each change publishes one event" (bookings.P20) and "publishes StockDepleted when the count drops to 0" (inventory.P20). `when` uses the rule language of `ensures` |
| 2 | Which values an event carries | **The prefix `event.` in `ensures`, in an operation with exactly one event on each success:** `event.reason = input.reason` | "Carrying the new state", "the answer and the event carry that reason". With more than one event, `event.` has no single meaning, so it is a `rule-type` error |
| 3 | Who makes the event id | **The shell, through `executeOperation(…, { newEventId })`. An event with `delivery.id` gets it from the runtime; the core does not set it**, and the type of `emit` leaves it out | A pure core cannot make a unique id, so today each core uses a constant. The shell has the clock and the random source |
| 4 | Where delivery is stated | **`delivery` on each event: `id` (a required string property), `orderBy` (the properties that set the order), and optional `sequence` (an integer property that the outbox fills, 1 higher for each event of one `orderBy` value)** | Each promise names its own order: per booking, per payment, per SKU and location (inventory.P19 has a sequence). One key per event keeps it explicit |
| 5 | Who keeps the delivery | **The Postgres extra, for a domain with `delivery`:** an outbox table (the id as primary key; the URN; the `orderBy` values; the sequence; the payload as `jsonb`); `insertEvents(tx, events)`, in the transaction of the change; `nextEvents(db, n)`, the oldest unpublished event of each order, in order; and `markPublished(db, event)`. **The transport is the user's**, and the docs say so | The change and its events commit together, so an event is never lost. A row stays until `markPublished`, so a crash sends it again: at least once. `nextEvents` gives one order key's events in sequence. A duplicate id is refused by the primary key |
| 6 | Gate 3 | **An event with `when` needs a scenario that emits it and one that does not, with `Then the operation emits no "<event URN>"`.** No new coverage for `delivery`: the tests of the generated store keep it | The same rule as a condition: both sides of the rule |
| 7 | `diff` | **Adding `when` to an event, or an `{ event }` item, is compatible (Out narrows). Removing one, or widening `when`, is breaking. Any change of `delivery` is breaking** | A consumer counts on the events and their order |
| 8 | Unchanged output | **The runtime emits the code for counts and ids, and the Postgres extra the outbox, only in a domain that uses them** | Every other domain keeps its files and its fingerprint |

## Scope

- **In scope:** `emits` items with `when`; `event.` in `ensures`; `newEventId`; `delivery` on an event; the outbox table and the three store functions; gate 3; `diff`; the corpus promises below; and the docs.
- **Out of scope:**
  - The transport: a queue, a broker or a webhook. The docs show a publisher loop.
  - Exactly-once delivery. Consumers drop duplicates by the id.
  - The time of an event from a clock (E2). `occurred_at` stays a value of the core.
  - The order of events across operations, such as "the cancellation is published before the refunds" (ticketing.P17), which also needs each ticket of the event to be refunded (a pairing).

## The promises that this plan can move

| Promise | Now | After | How |
| --- | --- | --- | --- |
| bookings.P20 | workaround | declared | `{ event }` on each changing operation, and `ensures` on its values |
| inventory.P18 | workaround | declared | the same |
| payments.P20 | workaround | declared | `when` on the new status, and `event.previous_status = current.status` |
| subscriptions.P19 | workaround | to check | the events of the trial and the invoices may have no operation that emits them |
| claims.P14 | workaround | declared | `ensures: event.reason = input.reason` |
| inventory.P20 | workaround | declared | `when: output.available = 0` |
| bookings.P21, claims.P21, payments.P21, subscriptions.P20, ticketing.P20 | workaround or not declarable | declared | `delivery` with `id` and `orderBy`, kept by the outbox |
| inventory.P19 | workaround | declared | `delivery` with `sequence` |
| ticketing.P17 | workaround | workaround | out of scope |

If each one passes the strict test, these 12 promises take the score from 45 to 57 of 143 (39.9%). The contract builders apply the same strict test as before. A promise that the outbox keeps is declared only when the contract uses the Postgres extra for it.

## The target, written first

Step 0 adds `tests/fixtures/events`: a payment with `when` on two events, an `ensures` with `event.`, and `delivery` with `orderBy` and `sequence`. It also adds `tests/events.test.ts`, which runs the generated runtime and the generated store against PGlite: two events of one payment come back in order, a crash before `markPublished` gives the event again, and a duplicate id is refused. Each test is `it.fails` until its step is built.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `emits` items with `when` | The manifest, the IR and the runtime: a success with no event, or two, is a `ContractViolation` that names the event and the rule |
| 2 | `event.` in `ensures` | The type checker, and the runtime. `event.` in an operation without exactly one event is a `rule-type` error |
| 3 | `delivery` and `newEventId` | The manifest and the IR, with `invalid-delivery` for a missing or wrong property; the runtime fills the id; `emit` has no id parameter |
| 4 | The outbox | The Postgres table, `insertEvents`, `nextEvents` and `markPublished`; the sequence for each order key |
| 5 | Gate 3 and `diff` | The `when` coverage, and one `tests/diff` case for each rule of decision 7 |
| 6 | The corpus | The six contracts; the minimum is the new score |
| 7 | Docs | "Emit an event" shows `when`, `delivery` and the outbox; the manifest, Postgres, generated code, diagnostics and Gherkin pages |

## Sabotages at the end

Each must turn CI red:

1. Make the payments core return no event on a capture → a `ContractViolation`, and a scenario fails.
2. Make the claims core put another reason in the event → a `ContractViolation` that names the rule.
3. Remove `markPublished` from the publisher test, and run it twice → the second run gets the event again (at least once), and a test that expects one delivery fails.
4. Change `orderBy` in a new manifest → `diff` reports a breaking change.
5. Remove the scenario where the stock does not drop to 0 → gate 3 `uncovered-event`.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs state each rule, and who keeps each part of a delivery.

## Risks

- **A promise that the code does not keep.** The transport is the user's. The docs state what the outbox keeps (no lost event, order per key, unique ids) and what the user's publisher must do (send, then `markPublished`).
- **The outbox and other stores.** Only Postgres gets an outbox. A domain without the Postgres extra can declare `delivery`, but then nothing generated keeps it, and such a corpus promise stays a workaround.
- **A slow outbox.** `nextEvents` reads by an index on the order key and the sequence. A large backlog is the user's to watch.
