# Objects in Postgres

Turn this on when your application stores the objects of the domain in Postgres. The agent then writes the shell that runs the statements.

urn-forge can write a Postgres schema from the manifest, with the rules as constraints. The database then rejects a bad write from all code. urn-forge also writes a store file. The store file has pure functions that give the statements to write and read the rows. urn-forge writes no migrations, and it never connects to a database. Your shell controls the driver, the transaction and the locks.

## Start the Postgres output

Add `postgres` to `urn-forge.config.ts`, with the objects that become tables. Each of these objects must have an `identifier`, which becomes the primary key. This is from the insurance domain of the repository:

<<< @/../packages/urn-forge/insurance/urn-forge.config.ts{11-14}

| Key | Value |
| --- | --- |
| `tables` | The object definitions that become tables |
| `references` | For a table, a property that holds the identifier of another table. It becomes a `FOREIGN KEY` |
| `unique` | For a table, lists of properties that two rows cannot share: `unique: { booking: [['restaurant_ref', 'starts_at']] }` |

Then `npx urn-forge compile` also writes `schema.generated.sql` and `domain.store.generated.ts`, and gate 4 checks them. Apply the schema with your migration tool.

## What the schema contains

| Manifest | Postgres |
| --- | --- |
| The domain | A schema of that name |
| An object in `tables` | A table, with its `description` as a comment |
| `string`, `integer`, `number`, `boolean` | `TEXT`, `BIGINT`, `DOUBLE PRECISION`, `BOOLEAN` |
| A required property | `NOT NULL` |
| An embedded object | A column for each of its properties: `contact_email` |
| A list | A child table, `<table>__<property>`, with the key of the parent and `position`. An optional list also adds `has_<property>` to the parent |
| A rule that SQL can say | A `CHECK` constraint |
| `uniqueItems` | A `UNIQUE` constraint |
| `minItems`, `maxItems` | A constraint trigger that counts the rows at the end of the transaction |

A rule with a macro (`all`, `exists`, `exists_one`, `map`) or `sum()` stays in the harness, and a comment names it. A time is `TEXT`. Where a rule compares a time, the schema casts it to `TIMESTAMPTZ`. A `pattern` is a JavaScript regular expression in the harness, and a POSIX regular expression in Postgres. Use forms that the two accept, such as `[0-9]` and `^…$`. These lines are from the [schema](https://github.com/heyshadowsmith/urn-forge/blob/main/packages/urn-forge/tests/fixtures/booking/generated/schema.generated.sql) of the booking example:

```sql
  CONSTRAINT "booking_party_size_maximum" CHECK (("party_size" <= 12)),
  CONSTRAINT "booking_large_party_pays_deposit" CHECK ((("party_size" < 7) OR (("deposit" IS NOT NULL) AND ("deposit" > 0)))),
```

## Write and read a value

For each table, the store file exports:

| Export | Gives |
| --- | --- |
| `insert<Table>(value)` | The statements that write a value and the rows of its lists |
| `replace<Table>(value)` | Delete, then insert |
| `delete<Table>(identifier)` | The delete; the foreign keys remove the rows of the lists |
| `select<Table>(identifier)` | One read for the table and one for each child table |
| `<table>FromRows(rows)` | The value, made from the rows of those reads, in sequence. It is `undefined` if there is no value |

Each statement is `{ text, values }`, with `$1`, `$2`, … in the text. The store file does not check a value. Check the value first with `check` or `runOperation`. Write a value and its lists in one transaction. Then the triggers count the rows after all of the rows are in the tables. This example uses the `pg` driver:

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

If all columns of an optional embedded object are `NULL`, the read gives no object.
