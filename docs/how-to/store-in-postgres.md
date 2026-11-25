# Store objects in Postgres

urn-forge can write a Postgres schema from the manifest, with the rules as constraints, so the database refuses a bad write from any code. It also writes a store file: pure functions that give the statements to write and read the rows. It writes no migrations and never connects to a database; your shell keeps the driver, the transaction and the locks.

## Turn it on

Add `postgres` to `urn-forge.config.ts`, with the objects that become tables. Each needs an `identifier`, which becomes the primary key. From the insurance domain of the repository:

<<< @/../packages/urn-forge/insurance/urn-forge.config.ts{11-14}

| Key | Value |
| --- | --- |
| `tables` | The object definitions that become tables |
| `references` | For a table, a property that holds the identifier of another table. It becomes a `FOREIGN KEY` |
| `unique` | For a table, lists of properties that no two rows share: `unique: { booking: [['restaurant_ref', 'starts_at']] }` |

`npx urn-forge compile` then also writes `schema.generated.sql` and `domain.store.generated.ts`, and gate 4 checks them. Apply the schema with your migration tool.

## What the schema holds

| Manifest | Postgres |
| --- | --- |
| The domain | A schema of that name |
| An object in `tables` | A table, commented with its `description` |
| `string`, `integer`, `number`, `boolean` | `TEXT`, `BIGINT`, `DOUBLE PRECISION`, `BOOLEAN` |
| A required property | `NOT NULL` |
| An embedded object | A column for each of its properties: `contact_email` |
| A list | A child table, `<table>__<property>`, with the parent's key and `position`. An optional list also adds `has_<property>` to the parent |
| A rule that SQL can say | A `CHECK` constraint |
| `uniqueItems` | A `UNIQUE` constraint |
| `minItems`, `maxItems` | A constraint trigger that counts the rows at the end of the transaction |

A rule with a macro (`all`, `exists`, `exists_one`, `map`) or `sum()` stays in the harness, and a comment names it. A time is `TEXT`, cast to `TIMESTAMPTZ` where a rule compares it. A `pattern` runs as a JavaScript regular expression in the harness and a POSIX one in Postgres, so use forms both accept, such as `[0-9]` and `^…$`. Lines from the booking example's [schema](https://github.com/heyshadowsmith/urn-forge/blob/main/packages/urn-forge/tests/fixtures/booking/generated/schema.generated.sql):

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
| `<table>FromRows(rows)` | The value, built from the rows of those reads, in order; `undefined` if there is none |

Each statement is `{ text, values }`, with `$1`, `$2`, … in the text. The store file does not check a value: check it with `check` or `runOperation` first. Write a value and its lists in one transaction, so the triggers count the rows once they are all in. With the `pg` driver:

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

An optional embedded object whose columns are all `NULL` reads back as absent.
