# urn-forge integrity plan

Nov 23, 2026 · @Shadow Smith

The [audit of the declared promises](./contract-completeness-roadmap.md) (step 16) put the corpus at 49 of 143 promises (34.3%). Some of the 40 breaks that it found are faults in the code that urn-forge generates. Every contract gets them, also when the shell uses the generated code as the docs say. This plan fixes them.

Decision 10 of the roadmap applies: this plan adds no key to the manifest. Each fix changes what the generated runtime, store file and SQL do with the constructs that exist.

## The faults

| # | Fault | Where | Promises it breaks |
| --- | --- | --- | --- |
| 1 | **A repeat is written again.** `runOnce` gives a repeat as a plain success. `commit` then gives the statements of a success again: the record of `changes` and the statements of `writes`. A later change is undone, or an insert fails on a duplicate key | Store file | inventory.P15, subscriptions.P18, ticketing.P14, payments.P11 |
| 2 | **A repeat waits for the record.** The runtime answers a repeat after it checks the record. If the record is gone or has changed, a repeat gets the `missing` error or a state error, not the first answer | Runtime | ticketing.P14 |
| 3 | **Two repeats at the same time both run.** `runOnce` reads the answers with no lock. Two calls with one key find no answer, and both run the core. The second insert of the answer fails, but the effect outside the database (a charge) is done two times | Store file | bookings.P17 |
| 4 | **A refusal is not stored.** A repeat after a refusal runs again and can succeed, so it does not get the first answer | Store file | payments.P15, subscriptions.P18, claims.P16 (in part) |
| 5 | **The outbox forgets.** The sequence is `MAX(sequence) + 1` over the rows in the table, and the primary key covers only those rows. The docs say to delete published rows. After that, the sequence starts again at 1, and an event id can be used again | Store file, SQL, docs | inventory.P19, bookings.P21 |
| 6 | **`missing` before `callers`.** For an unknown key, the runtime answers the `missing` error before it checks who may call. A caller with no access learns which keys exist | Runtime | inventory.P21 |
| 7 | **Two changes from one loaded record.** The shell loads the record with its own SQL, with no lock. Two calls load the same record, and both pass the `from` guard of `replace<Entity>From`, because the state did not change. The second overwrites the first | Store file | payments.P11, claims.P10 (in part) |

The audit found two more causes. This plan does not fix them:

- **The record that the shell builds in `writes`.** When an operation's answer is not the stored record, nothing checks the record that the shell writes. This needs a design of its own: the next plan.
- **Rules that the manifests leave out.** The corpus pass after this plan adds them, for example `requires: current.subscription_id = input.subscription_id`.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | How `commit` knows a repeat | **A repeat result has `repeat: true`. `commit` gives no statement for it, and `commitOnce` returns it as it is** | A repeat changed nothing the first time it was stored; it must change nothing now. The flag is on the result, so the shell writes no new code |
| 2 | When the runtime answers a repeat | **After it parses the caller, and before it checks the record. The record is not read.** The key's owners already tie a repeat to the caller who made the first call | The first answer does not depend on the record as it is now. Fault 2 |
| 3 | The lock of `runOnce` | **`runOnce` inserts the key first, with no answer, `ON CONFLICT DO NOTHING`. A second call with the key waits on the primary key until the first transaction ends, then reads the first answer. When the call ends, `runOnce` stores the answer in that row** | The database gives the lock, with no extra statement. If the first transaction rolls back, its row goes too, and the second call runs |
| 4 | Refusals | **`runOnce` stores each declared refusal (a `DomainError`), also a retryable one, and a repeat gets it. It does not store an `InputRejected` or a `ContractViolation`: those do not run the core.** A caller that wants to try again sends a new key | "Returns the original answer" has no exception for a refusal. `retryable` says that a new request can succeed, not a repeat of the same one. This replaces a decision of the [idempotency plan](./idempotency-plan.md) |
| 5 | The outbox | **The store file gives `prunePublished(before)`, which sets the payload of published rows to null and keeps the id and the sequence. The docs say to call it, and not to delete rows** | The primary key and `MAX(sequence)` then cover every event ever written. One small row for each event stays, as with the used values of `unique` |
| 6 | `missing` and `callers` | **For an unknown key, the runtime checks the `callers` rules first. A rule that reads `current.` does not hold when there is no record. Only a caller for whom a rule holds gets the `missing` error** | A caller with no access gets the refusal of `callers`, for any key. A caller with access learns only what it may learn |
| 7 | Loading the record | **The store file gives `load<Entity>(query, key)`: the record with its child rows, read with `FOR UPDATE`, or `null`. The docs say to load `current` with it, in the transaction of the call** | The lock makes the second call wait, then load the record that the first call wrote. The record is built by generated code, not by the shell's SQL |
| 8 | `diff` | **No change.** The manifest does not change | The SQL changes: the answer of the idempotency table becomes nullable while a call runs, and the outbox payload becomes nullable. The docs give the `ALTER TABLE` statements for a database that exists |

## Scope

- **In scope:** faults 1 to 7; the Gherkin steps that act as `runOnce` (decisions 2 and 4); the corpus promises below; the docs.
- **Out of scope:**
  - the record that the shell builds in `writes` (the next plan);
  - the rules that the manifests leave out (the corpus pass after);
  - a key for more than one operation (claims.P16 in part).

## The promises that this plan can move

| Promise | Faults | After |
| --- | --- | --- |
| inventory.P15 | 1 | declared |
| subscriptions.P18 | 1, 4 | declared |
| ticketing.P14 | 1, 2 | declared |
| payments.P15 | 4 | declared |
| bookings.P17 | 3 | declared |
| inventory.P19 | 5 | declared |
| bookings.P21 | 5 | declared |
| inventory.P21 | 6 | declared |
| payments.P11 | 1, 7 | stays a workaround: no invariant states the order of the amounts, and "the sum of the refunds" is a comment. The corpus pass can fix the first |
| claims.P10, claims.P16 | 7, 4 | stay workarounds: the record built in `writes`, and a key for more than one operation |

If each passes the test of *declared*, 8 promises take the score from 49 to 57 of 143 (39.9%). The contract builders apply the same test as the audit.

## The target, written first

Step 0 adds `tests/integrity.test.ts`. It runs the generated code of `tests/fixtures/idempotency` and `tests/fixtures/delivery`, `tests/fixtures/callers` and `tests/fixtures/states` on PGlite, and shows each fault as the audit found it:

- a repeat through `commitOnce` gives no statement, and a later change stays;
- a repeat after the record is gone gets the first answer;
- two transactions with one key: the core runs one time;
- a repeat of a refused call gets the refusal;
- after `prunePublished`, the next event gets the next sequence, and an old event id is refused;
- a caller with no access gets the refusal of `callers` for an unknown key;
- two transactions that load one record with `load<Entity>`: the second sees the change of the first.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | Repeats: `repeat: true`, `commit`, the order in the runtime, and the steps | Faults 1 and 2 |
| 2 | `runOnce`: the lock and the stored refusals | Faults 3 and 4 |
| 3 | The outbox: `prunePublished` | Fault 5 |
| 4 | `callers` before `missing` | Fault 6 |
| 5 | `load<Entity>` | Fault 7 |
| 6 | The corpus | The contracts; the minimum is the new score |
| 7 | Docs | The Postgres schema page, "Make a call safe to repeat", "Emit an event", "Declare callers", "Store entities in Postgres", and the `ALTER TABLE` statements |

## Sabotages at the end

Each must turn CI red:

1. Make `commit` give the statements of a repeat → the PGlite test of a later change fails.
2. Remove the first insert of `runOnce` → the test of two transactions runs the core two times.
3. Store only successes again → the test of a repeated refusal fails.
4. Make `prunePublished` delete the rows → the test of the sequence fails.
5. Check `missing` before `callers` again → the test of an unknown key fails.
6. Remove `FOR UPDATE` from `load<Entity>` → the test of two transactions fails.

## Done

- The promises that pass the test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say how to load `current`, and not to delete outbox rows.

## Risks

- **Databases that exist.** The idempotency and outbox tables change. The docs give the statements, and the change log names them.
- **A lock held for the whole call.** `runOnce` and `load<Entity>` hold their locks until the transaction ends. A slow call makes the repeats and the other changes of one record wait. That is what "at most once" and "no lost change" cost.
- **Stored refusals keep a caller out.** A caller that sends the same key after a retryable refusal gets the refusal again. The docs say to send a new key to try again.
