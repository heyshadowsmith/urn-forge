# Store objects in Postgres

Make a Postgres schema from the manifest, and functions that write and read its rows. Each object that you name is a table. An embedded object is columns of the table, and a list is a child table. Each rule that SQL can state is a `CHECK` constraint or a trigger.

## Before you start

- Each object that becomes a table has an `identifier`. Refer to [Add an object or a list](add-an-object-or-a-list).
- No list has lists as its items. A list of lists stops `compile` with `postgres-column`.

## Steps

1. Open `urn-forge.config.ts`.
2. Add `postgres`, with `tables`: the names of the objects that become tables.
3. If a property holds the identifier of another table, add it to `references`. The property must have the type of the identifier of that table.
4. If no two rows may share the values of some properties, add them to `unique`.
5. Run `npx urn-forge compile`. It writes `schema.generated.sql` and `domain.store.generated.ts` next to `domain.generated.ts`.
6. Apply the schema with your migration tool.
7. In the shell, run the statements of the store file in a transaction. Refer to [Write and read a value](#write-and-read-a-value).

## Example

The insurance domain of the repository stores customers and policies. Its config is `packages/urn-forge/insurance/urn-forge.config.ts`:

<<< @/../packages/urn-forge/insurance/urn-forge.config.ts{11-14}

`holder` is a property of `policy`. Its type is `customer_id`, the identifier of `customer`, so it can refer to the table `customer`. `compile` lists the three files:

```
unchanged  packages/urn-forge/insurance/generated/domain.generated.ts
unchanged  packages/urn-forge/insurance/generated/schema.generated.sql
unchanged  packages/urn-forge/insurance/generated/domain.store.generated.ts
```

This is the schema:

<<< @/../packages/urn-forge/insurance/generated/schema.generated.sql{sql}

Examine these parts of the schema:

- The schema of Postgres has the name of the domain, `insurance`.
- A required property is `NOT NULL`. The identifier is the primary key.
- `holder` has the constraint `policy_holder_pattern`, from the rule of `customer_id`, its type.
- `coverages` is a list of objects, so it is the child table `policy__coverages`. Each row is one coverage, at its `position`. The rules of a coverage are `CHECK` constraints of that table.
- The `minItems` and `maxItems` of `coverages` are in the trigger `policy__coverages_count`. It counts the coverages of each policy at the end of the transaction.
- `one_coverage_per_peril` has a macro, so SQL does not state it. The last comment of the table names it. The harness checks it before the core answers.

To make two properties unique together, use `unique`. Each entry is a list of properties:

```ts
postgres: {
  tables: ['booking'],
  unique: { booking: [['restaurant_ref', 'starts_at']] },
},
```

## Write and read a value

The booking fixture of the repository has the table `booking`, with the lists `tables` and `dishes`. Its store file has `insertBooking`, `selectBooking` and `bookingFromRows`. Refer to [The store file](../reference/postgres-schema#the-store-file).

1. Check the value with `check` or `runOperation`. The store file does not check it.
2. Start a transaction.
3. Run each statement of `insertBooking(booking)`, in its order.
4. Commit the transaction. The triggers count the rows of the lists at the commit.
5. To read the booking, run each statement of `selectBooking(reference)`, and keep the rows of each.
6. Give the rows to `bookingFromRows`, in the same order.

Do not write the rows of a value outside a transaction. The triggers then count after each statement, and a refused statement leaves the rows of the statements before it in the tables.

This shell uses the driver `pg`:

```ts
import pg from 'pg';
import { check, type Booking } from './generated/domain.generated';
import { insertBooking, selectBooking, bookingFromRows, type Row } from './generated/domain.store.generated';

const pool = new pg.Pool();

export async function saveBooking(booking: Booking): Promise<void> {
  const checked = check('booking', booking);
  if (!checked.ok) throw new Error(checked.failures.map((f) => f.message).join('; '));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const statement of insertBooking(booking)) await client.query(statement.text, [...statement.values]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function loadBooking(reference: string): Promise<Booking | undefined> {
  const rows: Row[][] = [];
  for (const statement of selectBooking(reference)) rows.push((await pool.query(statement.text, [...statement.values])).rows);
  return bookingFromRows(rows);
}
```

To change a stored booking, use `replaceBooking(booking)` in place of `insertBooking(booking)`. It deletes the row and the rows of its lists, then inserts them again.

For this booking:

```json
{"reference":"ABCDEFGH","party_size":4,"state":"confirmed","starts_at":"2026-11-24T19:00:00Z","ends_at":"2026-11-24T21:00:00Z","tables":[3,4],"contact":{"email":"ada@example.com"},"dishes":[{"course":"main","amount":2400}],"total":2400}
```

`insertBooking` gives four statements: one row of `booking`, two rows of `booking__tables` and one row of `booking__dishes`. These are the first two:

```json
[
  {
    "text": "INSERT INTO \"booking\".\"booking\" (\"reference\", \"party_size\", \"state\", \"deposit\", \"starts_at\", \"ends_at\", \"note\", \"has_tables\", \"contact_email\", \"contact_phone\", \"has_dishes\", \"total\") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
    "values": ["ABCDEFGH", 4, "confirmed", null, "2026-11-24T19:00:00Z", "2026-11-24T21:00:00Z", null, true, "ada@example.com", null, true, 2400]
  },
  {
    "text": "INSERT INTO \"booking\".\"booking__tables\" (\"reference\", \"position\", \"value\") VALUES ($1, $2, $3)",
    "values": ["ABCDEFGH", 0, 3]
  }
]
```

The rows of `selectBooking('ABCDEFGH')`:

```json
[[{"reference":"ABCDEFGH","party_size":4,"state":"confirmed","deposit":null,"starts_at":"2026-11-24T19:00:00Z","ends_at":"2026-11-24T21:00:00Z","note":null,"has_tables":true,"contact_email":"ada@example.com","contact_phone":null,"has_dishes":true,"total":2400}],[{"reference":"ABCDEFGH","position":0,"value":3},{"reference":"ABCDEFGH","position":1,"value":4}],[{"reference":"ABCDEFGH","position":0,"course":"main","amount":2400}]]
```

`bookingFromRows` gives the same booking back:

```json
{"reference":"ABCDEFGH","party_size":4,"state":"confirmed","starts_at":"2026-11-24T19:00:00Z","ends_at":"2026-11-24T21:00:00Z","contact":{"email":"ada@example.com"},"total":2400,"tables":[3,4],"dishes":[{"course":"main","amount":2400}]}
```

A booking with five tables breaks `maxItems` of `tables`. The trigger refuses it at the commit, and the transaction writes no row:

```
Must have at most 4 items
```

## What stays in the shell

- The shell has the driver, the connection, the transaction and the locks. The store file only gives statements.
- The shell reads a row, and puts it in the input as the stored record. Refer to [Model a stored record, the caller and the time](model-the-input).
- The shell writes the output to the tables after `runOperation` gives `ok: true`.
- A foreign key, a unique value and a `CHECK` constraint are database facts. They are in the config, not in the manifest, so the manifest stays a contract of values and operations.

## Result

`schema.generated.sql` and `domain.store.generated.ts` are in the output folder. Gate 4 compares them with a new compile, as it does for `domain.generated.ts`:

```
gate 4  drift         PASS  3 generated file(s) compared byte for byte against packages/urn-forge/insurance/generated
```

If you remove `postgres` from the config, the next `compile` removes the two files.

## Related pages

- [The Postgres schema](../reference/postgres-schema)
- [The configuration file](../reference/configuration)
- [Model a stored record, the caller and the time](model-the-input)
- [The core and the shell](../explanation/core-and-shell)
