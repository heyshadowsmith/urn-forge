# urn-forge uniqueness plan

Nov 23, 2026 · @Shadow Smith

After [UTC times](./utc-times-plan.md), the corpus is at 80 of 143 promises (55.9%). C1, "uniqueness", has 9 promises:

| Promise | What it needs |
| --- | --- |
| bookings.P01 | A booking reference is never reused |
| claims.P01 | A claim id is never reused |
| ticketing.P03 | A ticket code is unique across all events |
| inventory.P13 | A reservation id is unique and never reused, and at most one open reservation exists for each order id |
| subscriptions.P17 | At most one live subscription for each customer and plan, else `conflict` |
| claims.P17 | One receipt, by its hash, on lines of at most one live claim, else `DUPLICATE_RECEIPT` |
| ticketing.P11 | A hold that leaves ACTIVE holds no seat |
| ticketing.P13 | A seat is in at most one active hold or live ticket, and a section has no more than its capacity |
| subscriptions.P14 | The invoice periods of a subscription follow each other with no gap and no overlap |

The core is pure and sees one call, so it cannot know the other records. Only the database can: a unique index refuses a second row in the same transaction that wrote it. Today nothing states the rule, nothing makes the index, and a clash comes back to the shell as a database error, not as the declared refusal.

## What changes for a user

```yaml
subscription.entity.subscription:
  key: subscription.field.subscription_id
  unique:
    - by: [customer_id, plan_id]
      when: status != 'canceled' and status != 'expired'
      otherwise: subscription.error.conflict
    - by: [subscription_id]
      forever: true
```

```ts
await db.transaction(async (tx) => {
  const result = await commitOnce(query(tx), executeOperation(urn, body, core, { now }));
  // A clash is the declared refusal, and the call wrote nothing.
});
```

```gherkin
Given these subscriptions are stored:
  | subscription_id | customer_id | plan_id  | status |
  | sub_00000001    | cus_0001    | pln_gold | active |
When I run the operation with:
  | customer_id | plan_id  |
  | cus_0001    | pln_gold |
Then the operation fails with "urn:corpus:subscriptions:subscription:error:conflict"
And nothing changes
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where it is stated | **`unique` on an entity that is a table: a list of `by` (properties of the entity), with `when` (optional: a rule over the row; only the rows where it holds take part) and `otherwise` (optional: the declared error of a clash)** | Each promise names the values that must differ, and some only among live records |
| 2 | What enforces it | **The Postgres extra: a unique index for each entry, partial with `WHERE` for `when`.** A `when` that SQL cannot write stops `compile` (`invalid-unique`), as the rule is the index | Only the database sees every record. The index refuses a clash even between two calls at the same time |
| 3 | Never reused | **`forever: true`: the values go into a table of used values, `"used"."<domain>"`, which the store adds to on each insert and never deletes from.** Its primary key refuses a second use, also after the record is deleted | "Never reused for another booking" is about records that are gone, too |
| 4 | The refusal | **A generated `commitOnce(query, result, writes?)` in the store file: it runs the statements of `commit` in a savepoint. On a clash with an index that has `otherwise`, it rolls back to the savepoint and gives the declared error, filled by name from the record; on any other clash, the database error.** | The caller gets the declared refusal, and the call writes nothing. The same pattern as `runOnce` |
| 5 | Gherkin | **`Given these <word>s are stored:`, a table of records. After a success, the steps check each `unique` against them with the same rules, and answer the clash as `commitOnce` does** | A scenario shows the clash, with no database |
| 6 | Gate 3 | **A `unique` with `otherwise` needs a scenario that clashes: `uncovered-unique`** | The refusal is a declared answer, as any error |
| 7 | `diff` | **A new or changed `unique`: breaking (callers that worked are refused, and rows already stored may clash). A removed one: breaking (callers can rely on less)** | Both sides depend on it |
| 8 | Out of scope | **A rule across two entities (a seat in a hold or a ticket), a count (a capacity), a rule on child rows across records (a receipt on the lines of two claims), and an order of records (no gap between periods)** | Each needs more than one index. They stay workarounds, with a comment that names what is missing |

## Scope

- **In scope:**
  - `unique` on an entity, with `by`, `when`, `otherwise` and `forever`.
  - The indexes and the table of used values in the Postgres extra.
  - `commitOnce`.
  - The step, gate 3 and `diff`.
  - The corpus promises below, and the docs.
- **Out of scope:** decision 8, and a store other than Postgres.

## The promises that this plan can move

| Promise | After |
| --- | --- |
| bookings.P01, claims.P01 | declared, with `forever: true` on the reference or the id |
| ticketing.P03 | declared, if the ticket is a table, with `unique` on the code |
| inventory.P13 | declared, with `forever: true` on the reservation id, and `unique` on the order id `when` the reservation is open |
| subscriptions.P17 | declared, with `unique` on the customer and the plan `when` the subscription is live, `otherwise` conflict |
| claims.P17, ticketing.P11, ticketing.P13, subscriptions.P14 | stay workarounds (decision 8) |

If they pass the strict test, 4 to 5 promises take the score from 80 to 84–85 of 143 (58.7–59.4%). The contract builders apply the same strict test as before.

## The target, written first

Step 0 adds `tests/fixtures/uniqueness`: a subscription with a live-per-customer-and-plan rule and an id that is never reused. It also adds `tests/uniqueness.test.ts`, which runs `commitOnce` on PGlite:

- a second live subscription is the declared conflict, and nothing is written;
- a canceled one does not clash;
- a deleted id cannot come back;
- two transactions at the same time cannot both commit.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `unique` in the manifest and the IR | `invalid-unique` for a `by` that is not a property, a `when` that SQL cannot write, an `otherwise` that the record cannot fill, or an entity that is not a table |
| 2 | The indexes, the used values, and `commitOnce` | The schema and the store file; the PGlite tests |
| 3 | Gherkin and gate 3 | The step; `uncovered-unique` |
| 4 | `diff` | One `tests/diff` case for each rule of decision 7 |
| 5 | The corpus | The contracts; the minimum is the new score |
| 6 | Docs | A how-to guide, "Keep values unique"; the manifest, Postgres, Gherkin and diagnostics pages |

## Sabotages at the end

Each must turn CI red:

1. Make the subscriptions core create a second live subscription for one customer and plan → its scenario fails.
2. Drop the partial index from the schema → the PGlite test of a clash fails.
3. Delete a booking and reuse its reference → `commitOnce` refuses it.
4. Remove the clashing scenario → gate 3 `uncovered-unique`.
5. Add a `unique` in a new manifest → `diff` reports a breaking change.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say that `commitOnce` must run the writes of each call, and what a clash gives.

## Risks

- **A shell that writes without `commitOnce`.** The index still refuses the clash, as a database error, not as the declared refusal. The docs put `commitOnce` in the shell.
- **The table of used values grows forever.** That is what "never reused" means. One row for each value, with no payload.
- **Rows already stored that clash.** A new `unique` fails to create its index on such data. `diff` reports it as breaking, and the docs say to clean the data first.
