# urn-forge plan: promises across stored records

Nov 28, 2026 · @Shadow Smith

After the full rule language, the largest holes of the corpus are no longer in the language. Each rule reads one call: the input that the shell loaded, and the answer. A promise about other calls, or about the other records of a table, passes every generated check today. The comments of the corpus name four kinds of break:

| Kind | The break | Promises |
| --- | --- | --- |
| A stale write | Two calls load the same record. Both pass their rules, and the last write wins: a refund of a ticket twice, a PAID claim moved back, a CANCELED subscription paused | claims P10; inventory P11, P13; payments P13; subscriptions P12; ticketing P11, P15 |
| A unique value with a condition | Two creates at the same time both find no record: two open reservations of one order, two live subscriptions of one customer | inventory P12; subscriptions P16 |
| An overlap | Two stored invoices of one subscription with overlapping periods | subscriptions P13 |
| A repeated request | A repeat with the same idempotency key runs the operation again | claims P15; inventory P14; payments P14; subscriptions P17; ticketing P13 |

A fifth break is not about stored records: **the restaurant's time zone** in bookings. No input holds it, so the core chooses it (P03, P07, P12, P14, P15, P16).

urn-forge does not run the application. The store file gives the statements of each write and read, and the shell runs them with its own driver, in its own transaction. This plan keeps that split. Each construct is a statement or a constraint of the schema, which Postgres enforces, and a small generated function where a sequence of statements must be exact.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | A stale write | **`replace<Name>(value, loaded)` writes only if the stored record is still the record that the shell loaded: `UPDATE … WHERE` each column `IS NOT DISTINCT FROM` its loaded value. The statement says that it expects 1 row. A new generated function, `execute(statements, query)`, runs the statements with the shell's `query` function, and throws `StaleWrite` when a statement changes another number of rows** | The shell already holds the loaded record: the rules read it. Compare-and-set on it needs no version column and no change to the manifest. `execute` is the only function of the store that calls something, and it calls only the function that the shell gives it |
| 2 | A unique value with a condition | **`postgres.unique` takes an entry `{ columns: [...], where: rule }`, where the rule is a rule of the manifest on the record, such as `self.status == 'ACTIVE'`. It becomes a partial unique index. The rule must become SQL, or `compile` stops** | A unique index is the only check that two transactions at the same time cannot both pass. The condition is a rule that the manifest already states |
| 3 | An overlap | **`postgres.noOverlap`: `{ columns: [...], from: column, to: column }`. It becomes an exclusion constraint on a range of the two times, with `btree_gist`** | An exclusion constraint is to an overlap what a unique index is to a value. PGlite has `btree_gist`, so the test can run it |
| 4 | A repeated request | **A generated table, `<schema>.request`, with the operation, the key, a hash of the input, and the answer. A generated function, `runOnce(query, core, operation, key, input)`: in the shell's transaction, it inserts the key first (`ON CONFLICT DO NOTHING`), then runs the harness and stores the answer, or reads the first answer. The same key with another input is the answer `InputRejected` with the rule `same_request`** | The insert first is what makes two repeats at the same time safe: the second waits on the unique key until the first commits. The 0.1 version of `runOnce` wrote the answer again on a repeat and had no lock (item 16 of the roadmap). This one is a fixed order of three statements, and the test proves the order |
| 5 | Is a promise that the store keeps declared? | **Yes, when the table is in the config and gate 2 shows that the shell writes the table only through the store file. Gate 2 gets a new check: a shell file that has the text of an `INSERT`, `UPDATE` or `DELETE` of a table of the config is `direct-write`** | The same test as the harness: a promise that the generated code keeps, and that a gate keeps the shell from going around |
| 6 | Capacity: ticketing P12, the seats of a section | **Out of scope for a construct.** A sum across the rows of a table is not a constraint. The contract can store a count on the section record, and decision 1 then keeps it: two holds load the same section, and the second write is stale | A construct for sums would be a trigger, and triggers are logic in the database. Compare-and-set on a parent record is the general form |
| 7 | The restaurant's time zone | **A change to the bookings contract only: `create_request` takes the restaurant that the shell loaded, with its `time_zone`, and each answer's `time_zone` is the restaurant's** | It is not a construct of urn-forge. The input already carries what the shell loads, such as the stored booking |
| 8 | The delivery of events (D4) | **Out of scope** | It is the shell's outbox and its sender, after the commit. A later plan |

## The target, written first

Step 0 adds `tests/stored-records.test.ts`. It runs on PGlite, with no real concurrency: each test plays the interleaving in order, which is the order that Postgres gives two transactions at the same time.

- **A stale write:** load A, load B, write A, write B. B throws `StaleWrite`, and the record is A's.
- **A unique value with a condition:** two ACTIVE records with the same key fail. An ACTIVE one and a CANCELED one do not.
- **An overlap:** two periods of one subscription that overlap fail. Two that touch do not.
- **A repeated request:** a repeat gives the first answer and writes nothing. The same key with another input is refused.

Each test is `it.fails` until its step. The test of a repeat at the same time, where the second transaction waits, needs two connections. PGlite has one, so this test cannot run here. The plan records it as a limit, not as a pass.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | Compare-and-set, `execute`, `StaleWrite` | Its tests pass. Each contract's store file is compiled again |
| 2 | `unique` with `where` | Its tests pass, and `compile` stops for a condition that is not SQL |
| 3 | `noOverlap` | Its tests pass |
| 4 | The table of requests, and `runOnce` | Its tests pass |
| 5 | Gate 2: `direct-write` | A shell file with an `UPDATE` of a table of the config fails gate 2 |
| 6 | The proof: each contract uses the constructs where its promises need them, and bookings gets the restaurant's time zone. The corpus is judged again, and the score is recorded before and after | `npm run check` passes |
| 7 | The docs: the CLI and config reference, the methodology (what the gates cannot prove), and the package's `AGENTS.md` | The docs build |

## Sabotages at the end

Each must turn CI red:

1. Make `replace` write with no `WHERE` on the loaded columns → the stale-write test.
2. Drop the `WHERE` of a partial unique index → the test of an ACTIVE and a CANCELED record.
3. Make `runOnce` store the answer before it inserts the key → the repeat test.
4. Write an `UPDATE` in a shell file → gate 2.

## Risks

- **The shell must use `execute` and `runOnce`.** Gate 2 finds a write by its text, not every write: a statement built from parts can pass it. The methodology says so, as it does for gate 2 today.
- **Compare-and-set on each column** makes a write fail when any column changed, also a column that the operation did not read. This is safe, and the shell can load and try again. A narrower check needs the manifest to say which columns an operation reads, which is a construct that this plan does not add.
- **Postgres only.** The constraints and `runOnce` use Postgres. Another database is out of scope, as it is today.
- **Concurrency that the tests cannot run.** The tests prove the statements and their order. They do not prove that Postgres waits, which is Postgres's own guarantee.
