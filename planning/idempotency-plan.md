# urn-forge idempotency plan

Nov 22, 2026 · @Shadow Smith

After [changes on a clock](./clock-plan.md), the corpus is at 65 of 143 promises (45.5%). C2, "repeated calls", has 7 promises. Six are one promise in six contracts:

| Promise | The key | Who owns it | Another body |
| --- | --- | --- | --- |
| bookings.P17 | the create request | — | refused, INVALID_REQUEST |
| claims.P16 | each request with a key | the caller | — |
| inventory.P15 | each write | — | refused, IDEMPOTENCY_CONFLICT |
| payments.P15 | each write | the merchant | refused |
| subscriptions.P18 | each write, 1 to 255 characters | — | refused |
| ticketing.P14 | create-hold, checkout and refund, 8 to 64 characters | — | — |

Each says: **a repeat with the same key within 24 hours returns the original answer, with no second effect.** Most add: the same key with another body is refused. The seventh, bookings.P18, is the same idea with no key: cancelling a cancelled booking returns the same details and does not refund again.

Today each contract has a key field and, at most, a conflict error. The core cannot keep the answers: it is pure, and it sees one call. The shell must store each answer and look it up, and nothing states how.

## What changes for a user

```yaml
payment.operation.create_payment:
  idempotency:
    key: input.idempotency_key
    scope: caller.merchant_id
    window: 24 hours
    otherwise: payment.error.idempotency_conflict
```

```ts
const result = await runOnce(db, urn, body, { caller, now }, () => executeOperation(urn, body, core, { caller, now, newEventId }));
```

```gherkin
When I run the operation with:
  | idempotency_key | amount |
  | key-0001        | 500    |
And I run the operation again with:
  | idempotency_key | amount |
  | key-0001        | 500    |
Then the answer is the first answer
And the operation emits no event
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where it is stated | **`idempotency` on an operation: `key` (a required or optional `input.` string), `scope` (optional: `caller.` names, or `input.` names, that own the key), `window` (a time: `24 hours`), and `otherwise` (optional: the declared error for the same key with another body)** | Each promise names the key, its owner, the window and the conflict. Without `otherwise`, a repeat returns the first answer whatever its body (claims.P16, ticketing.P14) |
| 2 | Who keeps the answers | **The Postgres extra: a table of answers (the operation, the scope, the key, a hash of the body, the answer, the time), and the statements `findAnswer` and `insertAnswer`, written in the transaction of the call.** The key and scope are the primary key | A repeat that comes while the first call is running must wait or fail, not run twice: the primary key does that. The answer commits with the change, so a crash leaves both or neither |
| 3 | The flow in the shell | **A generated `runOnce(…)` in the store file: find the answer; if there is one and the body is the same, return it; if the body differs, return `otherwise`; else run `executeOperation`, and on a success insert the answer.** A refusal is not stored | A refusal changed nothing, so a repeat may succeed later. The flow is the same for every operation, so it is generated, not written in each shell |
| 4 | The body | **The parsed input, with the key and with keys in sorted order, as canonical JSON; its SHA-256 is the hash** | Two bodies that parse to one value are one body; the order of the properties in JSON does not matter |
| 5 | The window | **An answer is found while `now` < its time + `window`. After it, the key is free** | "Within 24 hours". The table keeps old rows until the user deletes them |
| 6 | Events | **A repeat emits no event** | "Without a second effect": the events of the first call are in the outbox |
| 7 | Gherkin | **`When I run the operation again with:` runs the operation once more in the same scenario, with the same store; `Then the answer is the first answer`** | The repeat is a second call. The steps keep an in-memory store with the same rules as the table, so a scenario shows the flow |
| 8 | Gate 3 | **An operation with `idempotency` needs a scenario that repeats it, and, with `otherwise`, one that repeats it with another body** | Both sides of the rule |
| 9 | `diff` | **Adding `idempotency`: compatible (a repeat that made a second effect now does not). Removing it, a shorter window, or a new `otherwise`: breaking** | Callers rely on safe retries |
| 10 | bookings.P18, the repeat cancel | **Out of this construct: it is a rule on states** (a cancel of a cancelled booking succeeds with no change), which `changes` and `ensures` can state today | It has no key |

## Scope

- **In scope:** `idempotency` on an operation; the answers table and `runOnce` in the Postgres extra; the canonical body hash; the Gherkin steps with their in-memory store; gate 3; `diff`; the corpus promises below; and the docs.
- **Out of scope:**
  - A store other than Postgres.
  - Idempotency of reads.
  - Deleting old answers. The docs show a `DELETE` of rows older than the window.

## The promises that this plan can move

| Promise | Now | After |
| --- | --- | --- |
| bookings.P17, claims.P16, inventory.P15, payments.P15, subscriptions.P18, ticketing.P14 | workaround | declared, if the contract uses the Postgres extra and states each key, owner and conflict |
| bookings.P18 | workaround | to check: `changes` from `[CONFIRMED, CANCELLED]` and an `ensures` that a cancelled booking stays as it was |

If each one passes the strict test, 6 or 7 promises take the score from 65 to 71–72 of 143 (49.7–50.3%). The contract builders apply the same strict test as before.

## The target, written first

Step 0 adds `tests/fixtures/idempotency`: a payment created with a key owned by the merchant, with a conflict error, and a refund with a key and no conflict. It also adds `tests/idempotency.test.ts`, which runs `runOnce` on PGlite: a repeat returns the first answer and emits nothing, another body is refused, a refusal is not stored, and a key is free after the window.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `idempotency` in the manifest and the IR | `invalid-idempotency` for a key that is not an `input.` string, a scope that is not `caller.` or `input.`, a window that is not a time, or an `otherwise` not in `errors` |
| 2 | The store | The answers table, the hash, and `runOnce` |
| 3 | Gherkin and gate 3 | The two steps, with the in-memory store; `uncovered-idempotency` |
| 4 | `diff` | One `tests/diff` case for each rule of decision 9 |
| 5 | The corpus | The contracts; the minimum is the new score |
| 6 | Docs | A how-to guide, "Make a call safe to repeat"; the manifest, Postgres, Gherkin and diagnostics pages |

## Sabotages at the end

Each must turn CI red:

1. Make the inventory steps run each repeat as a new call (no store) → the repeat scenario emits a second event, and fails.
2. Change the window to `23 hours` in a new manifest → `diff` reports a breaking change.
3. Remove the scenario that repeats with another body → gate 3 `uncovered-idempotency`.
4. Write `key: input.amount` on an integer → `compile` stops with `invalid-idempotency`.
5. Insert the same key twice in one scope in PGlite → the primary key refuses it.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say what `runOnce` keeps, and what the shell must do: run it in one transaction with the change.

## Risks

- **A shell that does not call `runOnce`.** urn-forge cannot know. The docs put the call in the shell, next to `insertEvents`.
- **A body that changes meaning with a new version of the contract.** The hash is of the parsed input of the current version: a repeat across a deploy that changed the input may be refused as another body. The docs say so.
- **A long first call.** A repeat that comes while the first is running waits on the primary key, then finds the answer.
