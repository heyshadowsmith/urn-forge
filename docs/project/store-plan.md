# urn-forge store plan

Nov 22, 2026 · @Shadow Smith

The `postgres` plugin writes the tables, the domains and the checks. The shell then writes the rows with SQL by hand. The two are not tied together. In the fourth blind trial, v2 of the manifest added an optional `buyer_phone` to the stored `order`. The shell's `INSERT` named its columns by hand, so `buyer_phone` was never stored. `tsc` and all four gates passed. The agent found the fault only by reading the output of its demo.

This plan has the plugin also write the statements that store each entity, from the same table model as the `CREATE` statements. A new property is then a new column, and the statement that writes it, in one compile.

## What changes for a user

```ts
// src/generated/domain.store.generated.ts (written by the postgres plugin)
export function insertPolicy(policy: s.PolicyPolicy): readonly Statement[];
export function replacePolicy(policy: s.PolicyPolicy): readonly Statement[];
export function deletePolicy(policyId: s.PolicyPolicyId): readonly Statement[];
```

```ts
// The shell: the output of the operation, written in one transaction.
const result = executeOperation('urn:acme:insurance:policy:operation:issue_policy', body, core);
if (result.ok) {
  await db.transaction(async (tx) => {
    for (const { text, values } of insertPolicy(result.output)) await tx.query(text, values);
  });
}
```

`insertPolicy` gives one `INSERT` for the `policy` row and one for each coverage in `policy__coverages`, with each column of each table, in the order the foreign keys need. The count trigger runs at `COMMIT`, as it does today.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | What does the plugin write? | **A TypeScript file, `domain.store.generated.ts`, beside `schema.generated.sql`.** For each table entity: functions that return statements, `{ text, values }` with `$1`, `$2`, … parameters | A statement is data. The file needs no driver, so node-postgres, PGlite and postgres.js can each run it. `{ text, values }` is the form that node-postgres takes, and PGlite takes the same two arguments |
| 2 | One source for the SQL and the statements | **A table model**: each table with its columns, its key, its parent and the property that it holds. The plugin builds the model once, and writes the `CREATE` statements and the store functions from it | Two generators that read the IR apart could drift. With one model, a column that the schema has and the insert does not cannot occur |
| 3 | Which functions | **`insert<Entity>`, `replace<Entity>` and `delete<Entity>` for each table entity.** `replace` deletes the row and its child rows, then inserts again, so a list that got shorter loses its old items. `delete` takes the key | These cover what the shells of the trials did: store a new row, store a changed one, remove one. An `UPDATE` of single columns would need a way to name the changed columns, which the entity type does not have |
| 4 | Reads | **Not in this plan.** No `SELECT` and no function from rows to an entity | A read needs a decision about each child table (a join or a second query), about absent values, and about the brands of the result, which only a parse can give. Writing is the gap that the trial found |
| 5 | The input type | **The parsed entity type of the schemas** (`s.PolicyPolicy`): the output of `executeOperation`, branded | The shell then stores only values that passed the contract. `tsc` refuses a hand-made object with a missing or extra property |
| 6 | Values | **As the schema gives them**: a `decimal`, a `date` and a `timestamp` as text, an absent optional value as `NULL`, a link as the key value. A list is one row for each item, with `position` from 0. An embedded entity is one row in its child table. A list of values is one row for each value | The same values as the columns' domains take, so Postgres checks them again, as it does today |
| 7 | Order of the statements | **Parent before child for `insert`; children before parent for `delete`.** `replace` is `delete`, then `insert` | The foreign keys of the child tables need it. The count triggers wait for `COMMIT`, so the order of the items does not matter |
| 8 | The transaction | **The shell runs the statements in one transaction.** The file has no transaction code | The transaction belongs to the driver. The docs show it for node-postgres and PGlite. A count rule is checked at `COMMIT`, so a shell that does not use a transaction gets the error after the first row |
| 9 | Names | **`insert<Brand>`, `replace<Brand>`, `delete<Brand>`**, with the brand identifier of the entity, as the other generated names | One rule for each generated name. Refer to [Naming](../reference/naming) |
| 10 | Gates | **Gate 4 compares the file, as each generated file. Gate 2 does not examine it,** because it is generated | No new rule. A shell that imports the file and stores `result.output` cannot leave a column out |
| 11 | A shell that still writes by hand | **Allowed.** The docs say to use the store functions, and why | A team can have a reason, for example a bulk import. The plan makes the safe way the easy way; it does not forbid the other |
| 12 | Target | **The fourth blind trial's fault, in the insurance domain.** A test adds an optional property to the stored `policy` and compiles. It then stores a policy with `insertPolicy` on PGlite and reads the new column back. It also stores a policy with coverages, replaces it with fewer coverages, and deletes it, and the tables have the expected rows after each step | The trial's fault is the case to close. Insurance has a root table, a link, a child table of an embedded entity and a count trigger |
| 13 | One PR? | **Yes**, one commit per step | |

## Scope

**In:** the table model in the plugin, with the `CREATE` statements written from it; `domain.store.generated.ts` with `insert`, `replace` and `delete` for each table entity; the `Statement` type; insurance's store file; the docs (Store entities in Postgres, the Postgres schema reference, the generated files, Naming, Call an operation from the shell).

**Out:** reads; `UPDATE` of single columns; migrations (`ALTER TABLE`); a driver or a connection; batching of statements; an outbox for events.

## The target, written first

Step 0 writes `tests/store.test.ts` with the cases of decision 12, against a hand-written `insertPolicy` that leaves out one column, as the trial's shell did. The test fails on that column; that is the check of step 0. The hand-written function goes when step 2 generates the real one.

## Build order

One PR (decision 13), one commit per step. Each step leaves the repository green and ends with a check.

- [ ] **0. The target.** As above. *Check:* the test fails on the missing column.
- [ ] **1. The table model.** The plugin builds the model, and writes the `CREATE` statements from it. *Check:* `schema.generated.sql` of each domain and fixture does not change, byte for byte.
- [ ] **2. The store file.** `insert`, `replace` and `delete` from the model, and the `Statement` type. *Check:* the target passes on PGlite; for each table of each fixture, the insert names each column of the `CREATE` statement (a test that reads both from the model); `tsc` refuses an object that is not the entity type.
- [ ] **3. Ship.** Insurance's store file, the docs and the notes. *Check:* CI green; every sabotage below fails.

## Done

| Sabotage | What catches it | Result |
| --- | --- | --- |
| An optional property added to a stored entity, and the shell stores with `insertPolicy` | The new column has the value (the target) | |
| `insertPolicy` of an object that is not a parsed `PolicyPolicy` | `tsc` | |
| A hand edit of `domain.store.generated.ts` | Gate 4, `generated-differs` | |
| `replacePolicy` with one coverage fewer | The old coverage row is gone | |
| The statements run without a transaction, for a policy with no coverage | Postgres refuses the count at the end of the statement | |

## Risks

- **A second generated file to keep stable.** The `CREATE` statements change only in step 1, and that step must change no byte. Each later change to the model changes both files together, which is the point.
- **The shell may still need its own SQL** for reads and for counts such as the seats that are left. This plan does not remove that SQL; it removes the hand-written writes of entities, which is where the trial's fault was.
- **Large lists.** One `INSERT` for each item is simple, and slow for thousands of items. A multi-row `INSERT` can come later without a change to the function signatures.
