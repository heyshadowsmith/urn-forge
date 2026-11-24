# The Postgres schema

With `postgres` in the config, `urn-forge compile` writes two more files next to `domain.generated.ts`:

- `schema.generated.sql`: the schema. It has `CREATE SCHEMA`, `CREATE TABLE`, `COMMENT`, `CREATE FUNCTION` and `CREATE CONSTRAINT TRIGGER` statements.
- `domain.store.generated.ts`: the store file. It has pure functions that give the statements to write and read the rows of each table. Refer to [The store file](#the-store-file).

urn-forge writes no migrations. It does not connect to a database.

## The config

```ts
postgres: {
  tables: ['customer', 'policy'],
  references: { policy: { holder: 'customer' } },
  unique: { booking: [['restaurant_ref', 'starts_at']] },
},
```

| Key | Required | Value |
| --- | --- | --- |
| `tables` | Yes | The names of the object definitions that become tables. Each must have an `identifier` |
| `references` | No | For a table, a map of a property to the table that it refers to. The property must have the type of the identifier of that table. It becomes a `FOREIGN KEY` |
| `unique` | No | For a table, a list of lists of properties. Each list becomes a `UNIQUE` constraint |

A wrong entry stops `compile` with `postgres-config`:

```
urn-forge.config.ts  error  postgres-config  postgres.tables.0: parcel has no identifier; a table needs one for its primary key
urn-forge.config.ts  error  postgres-config  postgres.tables.1: weight_grams is not an object definition of the manifest
```

A manifest that does not give correct tables stops `compile` with `postgres-column`:

- two parts give one column name;
- a table or a column has a name longer than 63 bytes, the limit of Postgres;
- a list has lists as its items.

```
urn-forge.config.ts  error  postgres-column  postgres.tables.order__grid: grid is a list of lists, which is not a table of Postgres
urn-forge.config.ts  error  postgres-column  postgres.tables.order: two parts give the column contact_email
```

## The tables

| Manifest | SQL |
| --- | --- |
| The domain, for example `booking` | `CREATE SCHEMA IF NOT EXISTS "booking"` |
| An object in `tables` | `CREATE TABLE "<domain>"."<object>"`, and `COMMENT ON TABLE` with its `description` |
| A property of type `string` | A `TEXT` column |
| A property of type `integer` | A `BIGINT` column |
| A property of type `number` | A `DOUBLE PRECISION` column |
| A property of type `boolean` | A `BOOLEAN` column |
| A property that is an object | A column for each of its properties, in the same table. Refer to [Embedded objects](#embedded-objects) |
| A property that is a list | A child table. Refer to [Lists](#lists) |
| A property that is an optional list | Also a column `has_<path>` of type `BOOLEAN NOT NULL` in the parent |
| A property in `required` | `NOT NULL`, if each object that holds it is required too |
| The `identifier` | `PRIMARY KEY`, with the name `<table>_pkey` |
| An entry of `references` | `FOREIGN KEY … REFERENCES`, with the name `<table>_<property>_fkey` |
| An entry of `unique` | `UNIQUE`, with the name `<table>_<properties>_unique` |

A time is a `TEXT` column. A rule that compares times casts the column to `TIMESTAMPTZ` in its `CHECK`.

### Embedded objects

The name of a column is the path of its value, with `_` between the parts. The email of the contact of a booking is `contact_email`. An object inside an object adds more parts to the name, at any depth.

A property of an optional object can be `NULL`, also if the object requires it. A `CHECK` with the name `<table>_<path>_required` makes sure that each required property is present when the object is present. The object is present when one of its columns is not `NULL`. This is a real constraint of the payments contract:

```sql
  CONSTRAINT "payment_card_summary_required" CHECK (NOT ("card_summary_brand" IS NOT NULL OR "card_summary_last4" IS NOT NULL OR "card_summary_exp_month" IS NOT NULL OR "card_summary_exp_year" IS NOT NULL) OR ("card_summary_brand" IS NOT NULL AND "card_summary_last4" IS NOT NULL AND "card_summary_exp_month" IS NOT NULL AND "card_summary_exp_year" IS NOT NULL))
```

An optional object whose columns are all `NULL` is absent. Thus an object with no required property reads back as absent, not as an empty object.

### Lists

A list is a child table, `<table>__<path>`. The list `dishes` of the table `booking` is the table `booking__dishes`.

| Part | SQL |
| --- | --- |
| The key of the parent | The same columns, `NOT NULL` |
| The place of an item in the list | `position INTEGER NOT NULL`, from 0 |
| The primary key | The key of the parent and `position`, with the name `<child>_pkey` |
| The foreign key | To the parent, `ON DELETE CASCADE`, with the name `<child>_parent_fkey` |
| An item that is a value | One column, `value` |
| An item that is an object | The columns of the item, as in a table |
| A list inside an item | A grandchild table, `<child>__<path>`. The `position` of the parent is the column `<parent path>_position` |
| A table description | The `description` of the list definition |

This is a grandchild table, from a list `sizes` inside the items of a list `lines`:

```sql
CREATE TABLE "shop"."order__lines__sizes" (
  "order_id" TEXT NOT NULL,
  "lines_position" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "order__lines__sizes_pkey" PRIMARY KEY ("order_id", "lines_position", "position"),
  CONSTRAINT "order__lines__sizes_parent_fkey" FOREIGN KEY ("order_id", "lines_position") REFERENCES "shop"."order__lines" ("order_id", "position") ON DELETE CASCADE
);
```

An optional list adds the column `has_<path>` to its parent. `TRUE` is a list, also with no rows. `FALSE` is no list. Thus an absent list and an empty list stay different.

## Rules in SQL

A rule becomes a `CHECK` constraint in the table that holds its values, if SQL can say each part of it:

| Rule language | SQL |
| --- | --- |
| `self`, `self.<property>`, `self.<object>.<property>` | The column of that value |
| A literal, an argument | A literal; a list is `ARRAY[…]` |
| `&&`, `\|\|`, `!` | `AND`, `OR`, `NOT` |
| `==`, `!=`, `<`, `<=`, `>`, `>=` | `=`, `<>`, `<`, `<=`, `>`, `>=` |
| `x in [list]` | `x = ANY(ARRAY[…])` |
| `+` of two strings | `\|\|` |
| `/` of two ints | `TRUNC(a::NUMERIC / b)::BIGINT` |
| `has(self.p)` of a value | `p IS NOT NULL` |
| `has(self.p)` of an embedded object | One of its columns `IS NOT NULL` |
| `has(self.p)` of an optional list | The column `has_p` |
| `size(s)` of a string | `char_length(s)` |
| `s.matches(re)` | `s ~ re` |
| `timestamp(s)` | `(s)::TIMESTAMPTZ` |
| `duration('30m')` | `INTERVAL '1800000 milliseconds'` |

The names of the constraints:

| Rule | Name |
| --- | --- |
| A rule of the definition of a column | `<table>_<column>_<rule>` |
| A rule of the definition of the item of a list of values | `<child>_value_<rule>` |
| A rule of the object of the table, or of the item of a list | `<table>_<rule>` |
| A rule of an embedded object | `<table>_<path>_<rule>`. If the object is optional, the `CHECK` applies only when the object is present |

A property whose definition names another definition as its type gets the rules of both definitions.

The `required` rule of the table's object is `NOT NULL`, not a `CHECK`.

A regular expression of `pattern` runs as a JavaScript regular expression in the harness, and as a POSIX regular expression in Postgres. Use the forms that both accept, such as `[0-9]` and `^…$`.

### The rules of a list

| Rule of the list | SQL |
| --- | --- |
| `uniqueItems` | `UNIQUE NULLS NOT DISTINCT` over the key of the parent and the value, with the name `<child>_uniqueItems`. For a list of objects: the identifier of the item, or else all the columns of the item |
| `minItems`, `maxItems` | A constraint trigger that counts the rows of each parent |
| The column `has_<path>` | The same trigger. If the flag is `FALSE`, the list must have no rows |

The trigger is `DEFERRABLE INITIALLY DEFERRED`. It counts the rows at the end of the transaction, when all the rows of a write are in. Its error has the `ERRCODE` `check_violation`, the name of the constraint (`<child>_minItems`, `<child>_maxItems` or `<child>_listed`) and the message of the rule:

```
Must have at most 4 items
```

Write a value and its lists in one transaction. Outside a transaction, each statement is its own transaction, and the trigger counts after each statement:

- a parent of a list with `minItems` is refused before its first row is in;
- a statement that breaks `maxItems` is refused, but the rows of the statements before it stay in the table.

### What stays in the harness

These rules stay in the harness, and a comment at the end of the table lists them:

- a rule with a macro (`all`, `exists`, `exists_one`, `map`) or `sum()`;
- `size()` of a list, and `in` with an object;
- a rule of a list other than `uniqueItems`, `minItems` and `maxItems`.

The comment names the place of each rule and its name:

```sql
-- Not in SQL; the harness checks these rules: booking: total_is_the_dishes
```

## Example

The booking fixture of the repository has one table, `booking`, and two child tables, `booking__tables` and `booking__dishes`:

<<< @/../packages/urn-forge/tests/fixtures/booking/generated/schema.generated.sql{sql}

Examine these parts of the schema:

- `contact` is an embedded object, so it is the columns `contact_email` and `contact_phone`.
- `tables` and `dishes` are optional lists, so `booking` has `has_tables` and `has_dishes`.
- `booking__tables` is a list of values. Its `uniqueItems` is a `UNIQUE` constraint, and its `maxItems` is in the trigger `booking__tables_count`.
- `booking__dishes` is a list of objects. The rules of `course` and `amount` are `CHECK` constraints of the child table.
- `total_is_the_dishes` has a macro, so it is in the comment.

## The store file

`domain.store.generated.ts` has these exports for each table of `tables`. The names come from the table: `booking` gives `insertBooking` and `bookingFromRows`.

| Export | What it gives |
| --- | --- |
| `insert<Table>(value)` | The statements that write a new value: its row and the rows of its lists |
| `delete<Table>(identifier)` | The statement that deletes a value. The foreign keys delete the rows of its lists |
| `replace<Table>(value)` | The statements of `delete<Table>`, then those of `insert<Table>` |
| `select<Table>(identifier)` | The statements that read a value: one for the table and one for each child table |
| `<table>FromRows(rows)` | The value, built from the rows of the statements of `select<Table>`, in their order. `undefined` if the table has no row |
| `Statement` | `{ text, values }`: the SQL text with `$1`, `$2`, …, and the values |
| `Row` | A row that the driver gives |

The functions make no call to a database. The shell runs each statement with its own driver, in its own transaction. The file imports only the types of `domain.generated.ts`.

These are the real statements of `selectBooking('ABCDEFGH')`:

```json
[
  {
    "text": "SELECT * FROM \"booking\".\"booking\" WHERE \"reference\" = $1 ORDER BY \"reference\"",
    "values": [
      "ABCDEFGH"
    ]
  },
  {
    "text": "SELECT * FROM \"booking\".\"booking__tables\" WHERE \"reference\" = $1 ORDER BY \"reference\", \"position\"",
    "values": [
      "ABCDEFGH"
    ]
  },
  {
    "text": "SELECT * FROM \"booking\".\"booking__dishes\" WHERE \"reference\" = $1 ORDER BY \"reference\", \"position\"",
    "values": [
      "ABCDEFGH"
    ]
  }
]
```

The store file does not check a value. Check it with `check` or `runOperation` before you write it. A `BIGINT` that the driver gives as a string becomes a number.

The store file of the booking fixture:

<<< @/../packages/urn-forge/tests/fixtures/booking/generated/domain.store.generated.ts{ts}

## Related pages

- [Store objects in Postgres](../how-to/store-in-postgres)
- [The configuration file](./configuration)
- [The rule language](./rule-language)
- [The generated code](./generated-code)
