# The Postgres schema

With `postgres` in the config, `urn-forge compile` writes `schema.generated.sql` next to `domain.generated.ts`. The file is a schema only: `CREATE SCHEMA`, `CREATE TABLE` and `COMMENT` statements. urn-forge writes no code that reads or writes rows, and no migrations.

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

## The schema

| Manifest | SQL |
| --- | --- |
| The domain, for example `booking` | `CREATE SCHEMA IF NOT EXISTS "booking"` |
| An object in `tables` | `CREATE TABLE "<domain>"."<object>"`, and `COMMENT ON TABLE` with its `description` |
| A property of type `string` | A `TEXT` column |
| A property of type `integer` | A `BIGINT` column |
| A property of type `number` | A `DOUBLE PRECISION` column |
| A property of type `boolean` | A `BOOLEAN` column |
| A property that is an object or a list | A `JSONB` column |
| A property in `required` | `NOT NULL` |
| The `identifier` | `PRIMARY KEY`, with the name `<table>_pkey` |
| An entry of `references` | `FOREIGN KEY … REFERENCES`, with the name `<table>_<property>_fkey` |
| An entry of `unique` | `UNIQUE`, with the name `<table>_<properties>_unique` |
| A rule of a property's definition | `CHECK`, with the name `<table>_<property>_<rule>` |
| A rule of the object | `CHECK`, with the name `<table>_<rule>` |

A property whose definition names another definition as its type gets the rules of both definitions.

A time is a `TEXT` column. A rule that compares times casts the column to `TIMESTAMPTZ` in its `CHECK`.

## Rules in SQL

A rule becomes a `CHECK` constraint if SQL can say each part of it:

| Rule language | SQL |
| --- | --- |
| `self`, `self.<property>` of a column that is not `JSONB` | The column |
| A literal, an argument | A literal; a list is `ARRAY[…]` |
| `&&`, `\|\|`, `!` | `AND`, `OR`, `NOT` |
| `==`, `!=`, `<`, `<=`, `>`, `>=` | `=`, `<>`, `<`, `<=`, `>`, `>=` |
| `x in [list]` | `x = ANY(ARRAY[…])` |
| `+` of two strings | `\|\|` |
| `/` of two ints | `TRUNC(a::NUMERIC / b)::BIGINT` |
| `has(self.p)` | `p IS NOT NULL` |
| `size(s)` of a string | `char_length(s)` |
| `s.matches(re)` | `s ~ re` |
| `timestamp(s)` | `(s)::TIMESTAMPTZ` |
| `duration('30m')` | `INTERVAL '1800000 milliseconds'` |

These rules stay in the harness, and a comment at the end of the table lists them:

- a rule with a macro (`all`, `exists`, `exists_one`, `map`) or `sum()`;
- a rule that reads a `JSONB` column, or a path into it, such as `self.contact.email`;
- the rules of each definition inside a `JSONB` column;
- `size()` of a list, and `in` with an object.

The `required` rule of the table's object is `NOT NULL`, not a `CHECK`.

A regular expression of `pattern` runs as a JavaScript regular expression in the harness, and as a POSIX regular expression in Postgres. Use the forms that both accept, such as `[0-9]` and `^…$`.

## Example

The booking fixture of the repository has one table, `booking`:

<<< @/../packages/urn-forge/tests/fixtures/booking/generated/schema.generated.sql{sql}

`tables`, `contact` and `dishes` are `JSONB`, so their rules are in the comment. `total_is_the_dishes` has a macro, so it is in the comment too.

## Related pages

- [Store objects in Postgres](../how-to/store-in-postgres)
- [The configuration file](./configuration)
- [The rule language](./rule-language)
