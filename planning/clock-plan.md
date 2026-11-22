# urn-forge clock plan

Nov 22, 2026 · @Shadow Smith

After [the current time](./time-plan.md), the corpus is at 61 of 143 promises (42.7%). E3, "what happens with no call", has 9 promises. Most say that **when a time passes, a record moves or an event is published**:

| Promise | What happens, and when |
| --- | --- |
| payments.P17 | "An authorized card payment that is not captured within 7 days moves to expired and can no longer be captured" |
| inventory.P16 | "An ACTIVE reservation … expires 30 minutes after creation unless the request set a time-to-live …, and its stock becomes available again" |
| claims.P23 | "A claim left in SUBMITTED for 30 days without a decision is reported in a ClaimDecisionOverdue event, and its state is not changed by that" |
| subscriptions.P21 | "trial_will_end is published 3 days before a trial ends, or immediately on creation if the trial is shorter than 3 days" |
| payments.P20, subscriptions.P19, ticketing.P19 | "Each change publishes one event", where some changes have no call |
| ticketing.P07, P15 | "An expiry time exactly 10 minutes after the hold was created"; "accepted only … within 72 hours": rules on `now`, which the [time plan](./time-plan.md) now allows |

A call made after the time is the easy half: `requires: now < current.authorized_at + 7 days` refuses a capture. The other half needs **someone to act when no one calls**. Today a contract cannot say who does, or when.

## The idea

A timed change is an operation like any other, with `changes`, `requires`, `ensures` and `emits`. It adds `due`: a rule over the record and `now` that says when the operation must run. **The shell's clock calls it**, for each record that is due. urn-forge generates the query that finds those records, and the runtime refuses a call for a record that is not due.

```yaml
payment.operation.expire_payment:
  description: Expire an authorized payment that was not captured within 7 days
  input: payment.entity.payment_ref
  output: payment.entity.payment
  changes: { entity: payment.entity.payment, from: [authorized], to: expired, otherwise: payment.error.invalid_state }
  due: now >= current.authorized_at + 7 days
  emits:
    - event: payment.event.expired
  callers:
    allow: [caller.kind = 'clock']
    otherwise: payment.error.forbidden

payment.operation.capture_payment:
  requires:
    - rule: now < current.authorized_at + 7 days
      otherwise: payment.error.invalid_state
```

```ts
// The shell's clock, for example each minute:
const now = new Date().toISOString();
const { text, values } = selectExpirePaymentDue(now, 100);
for (const { payment_id } of (await db.query(text, values)).rows) {
  await db.transaction(async (tx) => {
    const current = await loadPayment(tx, payment_id);
    const result = executeOperation(EXPIRE, { payment_id }, core, { current, now, caller: CLOCK, newEventId });
    if (result.ok) await run(tx, [...replacePaymentFrom(result.output, ['authorized']), ...insertEvents(result.events)]);
  });
}
```

An event with no move (claims.P23, subscriptions.P21) is a timed operation whose record keeps a mark, so the event is published once:

```yaml
claim.operation.report_overdue:
  changes: { entity: claim.entity.claim, from: [SUBMITTED], otherwise: claim.error.invalid_state }
  due: current.overdue_reported_at is absent and now >= current.submitted_at + 30 days
  ensures:
    - output.overdue_reported_at = now
    - output.state = current.state
  emits:
    - event: claim.event.decision_overdue
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | How a timed change is stated | **An operation with `due: <rule>`, and `changes`.** Not a new kind | It needs everything an operation has: a record, a move, conditions, events, callers. A new kind would copy each of them |
| 2 | What `due` reads | **`current.` and `now`**, with the rule language and the time arithmetic of the time plan | A timed change depends on the record and the clock, never on a request |
| 3 | The runtime | **A call of a `due` operation for a record that is not due is a `ContractViolation`.** It runs after the state of `changes`, so a record in another state gets `otherwise` | The clock is the shell's code: a call too early is a bug, not a refusal. A record that moved first (a capture before the sweep) is a normal race |
| 4 | Finding the records that are due | **The Postgres extra generates `select<Op>Due(now, limit)`: the keys of the rows in a `from` state where `due` holds**, with `due` in SQL and `now` as a parameter. The entity of `changes` must be a table; else the plugin reports `unenforced-in-sql` for `due` | The sweep must not miss a record. A query from the same rule cannot disagree with the runtime check |
| 5 | Who calls | **The shell's clock: a caller that the domain's `callers` can name, such as `caller.kind = 'clock'`.** urn-forge does not run a scheduler | As with the transport of events: urn-forge states and checks, the shell runs |
| 6 | "Can no longer be captured" before the sweep | **The other operations state it with `requires` on `now`**, with no new construct | The time plan already allows it; the corpus writes it next to the `due` rule |
| 7 | An event with no move | **A mark on the record, read by `due` and set by `ensures`** | "Reported once" needs the record to remember. A mark is a field like any other |
| 8 | Gate 3 | **Each `due` operation needs a scenario where it is due and runs, and one where it is not due and refuses** (the `ContractViolation` step) | Both sides of the clock's rule, as the writer writes them |
| 9 | `diff` | **A new `due` rule, or a changed one: breaking.** Removing `due` (the change no longer happens by itself): breaking | Consumers rely on the change, and on its time |

## Scope

- **In scope:** `due` on an operation; the runtime check; `select<Op>Due` in the Postgres extra; a Gherkin step that expects a call to be refused as not due; gate 3; `diff`; the corpus promises below; and the docs.
- **Out of scope:**
  - A scheduler. The shell runs its clock.
  - Changes to other records in a timed change, such as "its stock becomes available again" when the stock is a separate record (inventory.P16 may need it).
  - Time zones (D3).

## The promises that this plan can move

| Promise | Now | After | How |
| --- | --- | --- | --- |
| payments.P17 | workaround | declared | `expire_payment` with `due`, and `requires` on capture |
| claims.P23 | workaround | declared | `report_overdue` with a mark |
| subscriptions.P21 | workaround | declared | a timed `announce_trial_end` with a mark, and the create rule as it is |
| ticketing.P07 | workaround | declared | `ensures: output.expires_at = now + 10 minutes` (the time plan) |
| ticketing.P15 | workaround | to check | `requires: now <= current.created_at + 72 hours` on accept; the rest of the promise |
| inventory.P16 | workaround | to check | `expire_reservation` with `due`; "its stock becomes available again" if the stock is on the reservation's record |
| payments.P20, subscriptions.P19, ticketing.P19 | workaround | to check | each change without a call now has an operation; the other parts of each promise |

If each one passes the strict test, 4 to 9 promises take the score from 61 to 65–70 of 143 (45.5–49.0%). The contract builders apply the same strict test as before.

## The target, written first

Step 0 adds `tests/fixtures/clock`: a payment that expires after 7 days, with a capture that refuses after it, and a claim reported once when overdue. Its config has the payment and the claim as tables. It also adds `tests/clock.test.ts`, which runs the runtime and runs `select…Due` on PGlite at fixed times.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `due` in the manifest and the IR | A `due` rule types over `current.` and `now`; `due` without `changes`, or a name of `input.`, is `invalid-due` |
| 2 | The runtime | A call for a record that is not due is a `ContractViolation` that names the rule. Every other domain's output is the same |
| 3 | `select<Op>Due` | The Postgres extra translates `due` with `now` as a parameter; PGlite gives the due rows and no other |
| 4 | Gherkin, gate 3 and `diff` | A step for a call that is not due; the coverage of decision 8; one `tests/diff` case for each rule of decision 9 |
| 5 | The corpus | The contracts; the minimum is the new score |
| 6 | Docs | A how-to guide, "Run changes on a clock"; the manifest, Postgres, generated code, Gherkin and diagnostics pages |

## Sabotages at the end

Each must turn CI red:

1. Change `+ 7 days` to `+ 8 days` with no change to the scenarios → the scenario on day 7 fails.
2. Call `expire_payment` for a payment authorized 6 days ago → a `ContractViolation` that names the `due` rule.
3. Remove the mark from `report_overdue`'s `due` → the scenario that runs it twice reports twice, and fails.
4. Remove `due` in a new manifest → `diff` reports a breaking change.
5. Make `select…Due` disagree with the rule (edit the generated file) → gate 4 drift.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say that the shell runs the clock, and what urn-forge states and checks.

## Risks

- **A clock that does not run.** urn-forge cannot know that the shell calls the sweep. The docs put the clock in the shell, with its tests, as for the transport of events.
- **A sweep that is late.** A record is due from its time, and moves when the clock next runs. The `requires` of the other operations keep each promise from the time itself.
- **Two sweeps at once.** `replace<Brand>From` deletes the row only in a `from` state, so the second sweep finds no row and rolls back.
