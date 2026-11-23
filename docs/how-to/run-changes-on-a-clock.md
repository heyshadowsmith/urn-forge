# Run changes on a clock

Some changes happen because time passed, with no call: "an authorized payment that is not captured within 7 days moves to expired", "a claim left in SUBMITTED for 30 days is reported". This guide declares such a change and when it is due. urn-forge then gives the query that finds the records that are due, and refuses a call for a record that is not due. Your shell runs the clock.

The examples come from [`packages/urn-forge/tests/fixtures/clock/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/clock/).

## Before you start

- The record has states and moves. Refer to [Declare states and moves](declare-states).
- The entity of the record is a table of the Postgres extra. Refer to [Store values in Postgres](store-in-postgres).
- You know rules on the time: `now`, and `t + 7 days`. Refer to [Declare preconditions and postconditions](declare-conditions#a-window-of-time).

## 1. Declare the timed change

A timed change is an operation with `changes` and `due`: a rule over the record (`current.`) and the time (`now`, `today`) that says when the change must happen:

```yaml
payment.operation.expire_payment:
  description: Expire an authorized payment that was not captured within 7 days
  input: payment.entity.payment_ref
  output: payment.entity.payment
  changes:
    entity: payment.entity.payment
    from: [authorized]
    to: expired
    otherwise: payment.error.invalid_status
  due: now >= current.authorized_at + 7 days
  emits:
    - event: payment.event.expired
  errors: [payment.error.invalid_status]
```

A `due` rule cannot read the request: no request starts the call. `due` without `changes` stops `compile` with `invalid-due`.

## 2. Refuse the late call before the clock runs

The clock can be late. Give the other operations the same time, with `requires`, so a capture on day 7 is refused even before the payment expires:

```yaml
payment.operation.capture_payment:
  requires:
    - rule: now < current.authorized_at + 7 days
      otherwise: payment.error.invalid_status
```

## 3. Publish an event once, with no move

To publish an event when time passes, with no change of state, keep a mark on the record. `due` reads it, and `ensures` sets it:

```yaml
claim.operation.report_overdue:
  description: Report a claim that waits for a decision for 30 days, once, with no change of state
  input: claim.entity.claim_ref
  output: claim.entity.claim
  changes:
    entity: claim.entity.claim
    from: [SUBMITTED]
    otherwise: claim.error.invalid_state
  due: current.overdue_reported_at is absent and now >= current.submitted_at + 30 days
  ensures:
    - output.overdue_reported_at is present and output.overdue_reported_at = now
  emits:
    - event: claim.event.decision_overdue
  errors: [claim.error.invalid_state]
```

## 4. Run the clock in the shell

The store file has a query for each timed change: `select<Operation brand>Due(now, limit)` gives the keys of the rows in a state of `from` where `due` holds. It comes from the same rule as the runtime check:

```sql
SELECT "payment_id" FROM "payment"."payment" WHERE "status" = ANY($2) AND $1::TIMESTAMPTZ >= ("authorized_at" + 7 * INTERVAL '24 hours') ORDER BY "payment_id" LIMIT $3
```

Run it on your clock, and run the operation for each key, each in its own transaction:

```ts
const now = new Date().toISOString();
const due = selectPaymentExpirePaymentDue(now, 100);
for (const { payment_id } of (await db.query(due.text, due.values)).rows) {
  await db.transaction(async (tx) => {
    const current = await loadPayment(tx, payment_id);
    const result = executeOperation('urn:demo:clock:payment:operation:expire_payment', { payment_id }, core, { current, now });
    if (result.ok) await run(tx, replacePaymentPaymentFrom(result.output, ['authorized']));
  });
}
```

- A call for a record that is not due is a `ContractViolation`:

  ```text
  urn:demo:clock:payment:operation:expire_payment is not due for this record: now >= current.authorized_at + 7 days
  ```

- A record that moved first, such as a payment captured before the clock ran, gets the `otherwise` error of `changes`. That is a normal race: skip it.
- Two clocks at once: `replace<Entity>From` deletes the row only in a `from` state, so the second finds no row. Roll back.
- In a domain with a `caller`, give the clock a caller that `callers` allows, such as a role `clock`.

## 5. Write the scenarios

Write a scenario where the change is due and runs, and one where it is not due:

```gherkin
@urn:demo:clock:payment:operation:expire_payment
Scenario: A payment is not due to expire before 7 days
  Given the time is "2026-11-08T11:59:59.999Z"
  And the current payment is:
    | payment_id   | status     | authorized_at        |
    | pay_abcd1234 | authorized | 2026-11-01T12:00:00Z |
  When I run the operation with:
    | payment_id   |
    | pay_abcd1234 |
  Then the operation is not due
```

Gate 3 reports a timed change with no such scenario as `uncovered-due`:

```text
urn:demo:clock:payment:operation:expire_payment runs when now >= current.authorized_at + 7 days, and no scenario calls it for a record that is not due; add one with Then the operation is not due
```

## Result

- The manifest states which changes happen by themselves, and when.
- The shell's clock finds the records with a query from the same rule, and the runtime refuses a call that is too early.
- `urn-forge diff` reports a new, changed or removed `due` as breaking. Refer to [Change the contract](change-the-contract).

## Related pages

- [The manifest](../reference/manifest)
- [The Postgres schema](../reference/postgres-schema)
- [Gherkin steps](../reference/gherkin-steps)
