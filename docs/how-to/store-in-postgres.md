# Store objects in Postgres

urn-forge can write a Postgres schema from the manifest, with the rules as constraints, so that a write from any code is checked by the database too. It also writes a store file: pure functions that give the statements to write and read the rows. urn-forge writes no migrations and never connects to a database; your shell keeps the driver, the transaction and the locks.

## Turn it on

Add `postgres` to `urn-forge.config.ts`, with the objects that become tables. Each needs an `identifier`, which becomes the primary key. The insurance domain of the repository:

<<< @/../packages/urn-forge/insurance/urn-forge.config.ts{11-14}

| Key | Value |
| --- | --- |
| `tables` | The object definitions that become tables |
| `references` | For a table, a property that holds the identifier of another table. It becomes a `FOREIGN KEY` |
| `unique` | For a table, lists of properties that no two rows share: `unique: { booking: [['restaurant_ref', 'starts_at']] }` |

`npx urn-forge compile` then writes two more files next to `domain.generated.ts`: `schema.generated.sql` and `domain.store.generated.ts`. Apply the schema with your migration tool. Gate 4 checks both files like the others.

## What the schema holds

| Manifest | Postgres |
| --- | --- |
| The domain | A schema of that name |
| An object in `tables` | A table, commented with its `description` |
| `string`, `integer`, `number`, `boolean` | `TEXT`, `BIGINT`, `DOUBLE PRECISION`, `BOOLEAN` |
| A required property | `NOT NULL` |
| An embedded object | A column for each of its properties, named by path: `contact_email` |
| A list | A child table, `<table>__<property>`, with the parent's key and `position`. An optional list also adds `has_<property>` to the parent, so an empty list and no list stay different |
| A rule that SQL can say | A `CHECK` constraint |
| `uniqueItems` | A `UNIQUE` constraint |
| `minItems`, `maxItems` | A constraint trigger that counts the rows at the end of the transaction |

A rule with a macro (`all`, `exists`, `exists_one`, `map`) or `sum()` stays in the harness, and a comment under the table names it. A time is `TEXT`; a rule that compares times casts it to `TIMESTAMPTZ`. A `pattern` runs as a JavaScript regular expression in the harness and a POSIX one in Postgres, so use forms both accept, such as `[0-9]` and `^…$`.

The schema of the booking example, with one table and two child tables:

<<< @/../packages/urn-forge/tests/fixtures/booking/generated/schema.generated.sql{sql}

- `contact` is embedded, so it is the columns `contact_email` and `contact_phone`.
- `tables` is a list of values; its `uniqueItems` is a `UNIQUE` constraint and its `maxItems` is the trigger `booking__tables_count`.
- `dishes` is a list of objects; the rules of `course` and `amount` are `CHECK` constraints of `booking__dishes`.
- `total_is_the_dishes` uses `map` and `sum()`, so it is in the comment.

## Write and read a value

For each table, the store file exports:

| Export | Gives |
| --- | --- |
| `insert<Table>(value)` | The statements that write a value and the rows of its lists |
| `replace<Table>(value)` | Delete, then insert |
| `delete<Table>(identifier)` | The delete; the foreign keys remove the rows of the lists |
| `select<Table>(identifier)` | One read for the table and one for each child table |
| `<table>FromRows(rows)` | The value, built from the rows of those reads, in order; `undefined` if there is none |

Each statement is `{ text, values }`, with `$1`, `$2`, … in the text. The store file does not check a value: check it with `check` or `runOperation` first. Write a value and its lists in one transaction, so the triggers count the rows once they are all in.

A shell with the `pg` driver:

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

For a booking with two tables and one dish, `insertBooking` gives four statements. The first two:

```
INSERT INTO "booking"."booking" ("reference", "party_size", "state", "deposit", "starts_at", "ends_at", "note", "has_tables", "contact_email", "contact_phone", "has_dishes", "total") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ["ABCDEFGH",4,"confirmed",null,"2026-11-24T19:00:00Z","2026-11-24T21:00:00Z",null,true,"ada@example.com",null,true,2400]
INSERT INTO "booking"."booking__tables" ("reference", "position", "value") VALUES ($1, $2, $3) ["ABCDEFGH",0,3]
```

A booking with five tables breaks `maxItems`; the trigger refuses the transaction at the commit, with the constraint `booking__tables_maxItems` and the rule's message, `Must have at most 4 items`.

An optional embedded object whose columns are all `NULL` reads back as absent, so an object with no required property cannot be stored as empty.

Foreign keys, uniqueness across rows and the choice of tables are database facts. They stay in the config, so the manifest stays a contract of values and operations.
