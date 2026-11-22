# The Postgres schema

The `postgres` plugin writes `schema.generated.sql` and `domain.store.generated.ts` in the `--out` directory. The SQL file has `CREATE` statements for Postgres 14 or later. The plugin does not connect to a database or make migrations. Give the file to your migration tool.

| Item | Value |
| --- | --- |
| Plugin | `postgres`. It is not in the default plugin list. It needs `valibot` |
| Header | The two header lines, with `--` in place of `//`. Refer to [Generated code](./generated-code) |
| Statements | Only `CREATE`, `ALTER TABLE … ADD CONSTRAINT` and `COMMENT ON` |

## Configuration

<<< @/../packages/urn-forge/insurance/urn-forge.config.ts

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `tables` | A list of short keys | `[]` | The entities that become root tables. Each must have a `key`. Embedded entities become child tables, and do not go in this list |
| `unenforced` | `'warn'` or `'error'` | `'warn'` | The severity of `unenforced-in-sql` |

With `tables: []`, the file has only the header and the version line.

| Problem | Code |
| --- | --- |
| An unknown option, an incorrect value, or an item two times | `plugin-config` |
| An item that names no atom | `unresolved-ref` |
| An item that names an atom that is not an entity | `wrong-ref-kind` |
| An entity with no `key` | `missing-key` |

## Sequence of the statements

1. The header and the version line.
2. `CREATE SCHEMA IF NOT EXISTS "<context>";` for each stored context, in alphabetical order.
3. A domain for each stored field, in URN order.
4. Each root table, in the sequence of `tables`, then its child tables.
5. The foreign keys of links to root tables.
6. The functions and constraint triggers of the counts.

The stored entities are the entities in `tables` and the entities that they embed. Operations, events and errors are not stored. Sunset atoms get no statement.

## Names

All names are in double quotes, so a reserved word such as `limit` is a correct column name.

| Part | Name | Example |
| --- | --- | --- |
| Schema | The context | `"policy"` |
| Domain of a field | `"<context>"."<identifier>_value"` | `"policy"."premium_value"` |
| Check of a domain | `"<identifier>"` of the field | `"premium"` |
| Root table | `"<context>"."<identifier>"` of the entity | `"policy"."policy"` |
| Column | The property name | `"holder"` |
| Primary key | `"<table>_pkey"` | `"policy_pkey"` |
| Child table | `"<parent table>__<property>"` | `"policy"."policy__coverages"` |
| Foreign key to the parent | `"<child table>_parent_fkey"` | `"policy__coverages_parent_fkey"` |
| Foreign key of a link | `"<table>_<column>_fkey"` | `"policy_holder_fkey"` |
| Unique constraint of a list | `"<child table>_<column>_key"` | `"policy__coverages_peril_key"` |
| Check of an invariant | `"<identifier>"` of the invariant | `"term_is_positive"` |
| Count functions | `"<child table>_count"`, `_count_parent`, `_count_item` | `"policy"."policy__coverages_count"` |
| Count triggers | `"<property>_count"` | `"coverages_count"` |

A name of more than 63 bytes, or a name that two parts share, causes `invalid-sql-name`.

## Types

Each field becomes a domain with one check that holds all its constraints.

| Primitive | SQL type | Check that is always there |
| --- | --- | --- |
| `boolean` | `BOOLEAN` | None |
| `enum` | `TEXT` | `VALUE IN ('<value>', …)` |
| `string` | `TEXT` | None |
| `integer` | `INTEGER` if `min` and `max` fit in 32 bits, else `BIGINT` | With `BIGINT`: `VALUE BETWEEN -9007199254740991 AND 9007199254740991` |
| `float` | `DOUBLE PRECISION` | `VALUE NOT IN ('NaN', 'Infinity', '-Infinity')` |
| `decimal` | `NUMERIC` | `VALUE NOT IN ('NaN', 'Infinity', '-Infinity')` |
| `date` | `DATE` | None |
| `timestamp` | `TIMESTAMPTZ` | None |

| Constraint | Condition |
| --- | --- |
| `mustBe` | `VALUE = TRUE` or `VALUE = FALSE` |
| `minLength`, `maxLength` | `char_length(VALUE) >= <n>`, `<= <n>` |
| `regex` | `VALUE ~ '^(?:<pattern>)$'`, if the pattern is in the subset |
| `format: uuid` | `VALUE ~* '^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$'` |
| `format: email` | `VALUE ~ '<pattern of v.email()>'` |
| `format: uri` | None. `unenforced-in-sql` |
| `min`, `max`, `exclusiveMin`, `exclusiveMax` | `VALUE >= <n>`, `<=`, `>`, `<`. Dates use `DATE '<day>'`, timestamps `TIMESTAMPTZ '<t>'` |
| `multipleOf` | `VALUE % <n> = 0` |
| `scale` | `scale(VALUE) <= <s>` |
| `notIn` | `VALUE NOT IN (<n>, …)` |

```sql
CREATE DOMAIN "policy"."premium_value" AS NUMERIC
  CONSTRAINT "premium" CHECK (VALUE NOT IN ('NaN', 'Infinity', '-Infinity') AND VALUE > 0 AND scale(VALUE) <= 2);
COMMENT ON DOMAIN "policy"."premium_value" IS 'urn:acme:insurance:policy:field:premium — The price of the policy for its whole term';
```

### Regular expressions

The plugin translates a `regex` only if each part is in this subset. Else the field gets no shape check, and the plugin reports `unenforced-in-sql`.

| In the subset | Not in the subset |
| --- | --- |
| Literal characters, `.`, `\d`, `\w`, `\s`, `\D`, `\W`, `\S` (outside brackets) | Lookahead, lookbehind, named groups |
| Bracket classes, for example `[a-z]` or `[^x]` | Back references `\1` to `\9`, `\k` |
| `\n`, `\r`, `\t`, `\f`, `\v`, `\uXXXX`, `\u{…}`, `\xXX`, an escaped syntax character | `\b`, `\B`, `\p{…}` and other letter escapes |
| `*`, `+`, `?`, `{n}`, `{n,}`, `{n,m}` with counts up to 255. Lazy quantifiers | Counts above 255 |
| `(…)`, `(?:…)`, `\|`, `^`, `$` | `\D`, `\W`, `\S` inside brackets, `[^]`, `[]`, `\0` |

## Tables

| Field reference | In the table of the entity |
| --- | --- |
| `ref: <field>` | A column with the domain of the field |
| `link: <entity>` | A column with the domain of the key field, and a foreign key if the entity is in `tables` |
| `ref: <entity>`, or any reference with `many` | A child table |

- A column is `NOT NULL` if `required: true`.
- The primary key of a root table is the `key` column.
- A child table has the key columns of its parent, then `"position"` for a list, then the columns of the item.
- The primary key of a child table is the parent key and `position`. The foreign key to the parent has `ON DELETE CASCADE`.
- `unique: true` adds a `UNIQUE` constraint on the parent key and the item key or value.
- `unique: [a, b]` adds a `UNIQUE` constraint on the parent key and the columns `a` and `b`, named `<child table>_a_b_key`. Postgres treats `NULL` as distinct, so a row with one of them absent is not compared.
- The foreign keys of links come after all tables, so links can make a cycle.

```sql
CREATE TABLE "policy"."policy__coverages" (
  "policy_id" "policy"."policy_id_value" NOT NULL,
  "position" INTEGER NOT NULL CHECK ("position" >= 0),
  "peril" "policy"."peril_value" NOT NULL,
  "limit" "policy"."limit_value" NOT NULL,
  "note" "policy"."note_value",
  "remark" "policy"."remark_value",
  CONSTRAINT "policy__coverages_pkey" PRIMARY KEY ("policy_id", "position"),
  CONSTRAINT "policy__coverages_parent_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"."policy" ("policy_id") ON DELETE CASCADE,
  CONSTRAINT "policy__coverages_peril_key" UNIQUE ("policy_id", "peril"),
  CONSTRAINT "limit_is_positive" CHECK ("limit" > 0)
);
```

### Counts

| Field reference | Count |
| --- | --- |
| `many` with `minItems` or `maxItems` | Between `minItems` and `maxItems` rows |
| `ref: <entity>`, no `many`, `required: true` | Exactly 1 row |
| Other references | No count |

A count is a pair of constraint triggers, `DEFERRABLE INITIALLY DEFERRED`. Postgres checks it at `COMMIT`. An incorrect count fails with SQLSTATE `23514` and the message `<entity URN>: "<property>" has <n> item(s); it must have <limits>`.

An absent optional list and an empty list are both no rows.

## Invariants

Each invariant becomes a named `CHECK` on each table that stores its entity, in URN order.

| Rule | SQL |
| --- | --- |
| A field or a link | The column |
| A `date`, `timestamp` or `decimal` literal | `DATE '<day>'`, `TIMESTAMPTZ '<t>'`, `'<n>'::NUMERIC` |
| `a + b`, `a - b` | `(a + b)`. On `integer`, `(a::BIGINT + b)` |
| `d1 - d2`, two dates | `(d1 - d2)`, in days |
| `t + n minutes`, `hours` or `days` | `(t + n * INTERVAL '1 minute')`, `'1 hour'` or `'1 day'` |
| `!=` | `<>` |
| `and`, `or`, `not a` | `AND`, `OR`, `NOT (a)` |
| `x is present`, `x is absent` | `"x" IS NOT NULL`, `"x" IS NULL` |

A rule that names a list or an embedded entity gets no check. The plugin reports `unenforced-in-sql`.

## Comments

| Statement | Text |
| --- | --- |
| `COMMENT ON DOMAIN` | `<field URN> — <description>`. A deprecated field adds ` (deprecated: superseded by <URN>; sunset on <date>)` |
| `COMMENT ON TABLE`, root table | `<entity URN> — <description>`, with the same deprecated mark |
| `COMMENT ON TABLE`, child table | `<entity URN> (embedded in <parent URN> as <property>)`, or `<URN> (a list in <parent URN> as <property>)` |
| `COMMENT ON COLUMN` | `<field URN>`, or `<linked entity URN> (a link: the value of its key)` |
| `COMMENT ON CONSTRAINT`, invariant | `<invariant URN> — <message>` |

## Errors from Postgres

| Rule | SQLSTATE | Constraint |
| --- | --- | --- |
| A field constraint | `23514` | The identifier of the field |
| `required: true` | `23502` | None |
| The key | `23505` | `<table>_pkey` |
| `unique` | `23505` | `<child table>_<column>_key`, or `<child table>_<columns>_key` for a list of names |
| A link | `23503` | `<table>_<column>_fkey` |
| An invariant | `23514` | The identifier of the invariant |
| A count | `23514`, at `COMMIT` | `<property>_count` |

## Rules that the SQL does not enforce

The plugin does not write an approximate rule. The Valibot schema still enforces each of these rules.

| Case | Comment in the SQL |
| --- | --- |
| `format: uri` | Yes, before the domain |
| A `regex` outside the subset | Yes, before the domain |
| A link to an entity that is not in `tables` | No |
| A rule that names a list or an embedded entity | Yes, after the comments of the table |
| A list with `required: false` | No |

## The store file

| Export | Description |
| --- | --- |
| `Statement` | `{ readonly text: string; readonly values: readonly unknown[] }`, with `$1`, `$2`, … parameters |
| `insert<Brand>(value)` | One `INSERT` for the row, then one for each child row. `value` is the parsed entity type |
| `replace<Brand>(value)` | The `delete<Brand>` statement, then the `insert<Brand>` statements |
| `delete<Brand>(key)` | One `DELETE`. Child rows go by `ON DELETE CASCADE`. `key` is the branded key type |
| `replace<Brand>From(value, from)` | For an entity that an operation `changes`: as `replace<Brand>`, but the `DELETE` takes the root row only while its state is in `from` (`AND "<state>" = ANY($2)`). If it deletes no row, the record moved after the shell loaded it: roll back. A shell that does not check gets a duplicate key error from the `INSERT` |

Run the statements of one call in one transaction. The file has no reads, except `nextEvents` of the outbox.

## Timed changes

For each operation with `due` whose `changes` entity is a table, the store file has:

| Export | Description |
| --- | --- |
| `select<Operation brand>Due(now, limit)` | One `SELECT` of the key of at most `limit` rows in a state of `from` where `due` holds at `now`, in key order. `now` is `$1`, a `TIMESTAMPTZ`; `today` is its date in UTC |

If the entity is not a table, or the rule reads a list or an embedded entity, the plugin reports `unenforced-in-sql`, and the file has no query for the operation. Refer to [Run changes on a clock](../how-to/run-changes-on-a-clock).

## The outbox

A domain with an event that has `delivery` gets one more table, also with no table in `tables`:

```sql
CREATE SCHEMA IF NOT EXISTS "outbox";

CREATE TABLE "outbox"."delivery" (
  "position" BIGINT GENERATED ALWAYS AS IDENTITY,
  "id" TEXT NOT NULL,
  "urn" TEXT NOT NULL,
  "order_key" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "published_at" TIMESTAMPTZ,
  CONSTRAINT "delivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_order_key_sequence_key" UNIQUE ("order_key", "sequence")
);
```

The name of the table is the domain. `order_key` is the JSON list of the `orderBy` values of the event. The store file has these exports:

| Export | Description |
| --- | --- |
| `insertEvents(events)` | One `INSERT` for each event of `executeOperation`. The sequence is 1 more than the last sequence of its `order_key`, from 1, and the payload holds it in the `sequence` property. Run the statements in the transaction of the change. An event with no `delivery` causes an exception |
| `nextEvents(limit)` | One `SELECT` of at most `limit` rows: for each `order_key`, the row with no `published_at` and the lowest sequence, in the order that they were written. Each row is an `OutboxRow`: `id`, `urn`, `sequence`, `payload` |
| `markPublished(id)` | One `UPDATE` that sets `published_at`. Run it only after the transport took the event |

- A second event with the same id causes a duplicate key error.
- Two transactions that write an event of one `order_key` at the same time cannot both commit: the second gets a duplicate key error on the sequence. Run it again.
- The `sequence` column is set for each event. `delivery.sequence` also puts it in the payload.
- The table keeps published rows. Delete them when you do not need them.

## Limits

| Value | Valibot | Postgres |
| --- | --- | --- |
| A `date` in the year 0000 | Accepts | Refuses |
| A `string` with U+0000 | Accepts | Refuses |
| A text form that the primitive does not use, for example `1e3` for a `decimal` | Refuses | Accepts |

node-postgres gives `DATE` and `TIMESTAMPTZ` as `Date` objects, and `NUMERIC` and `BIGINT` as strings. Change them to the form of the primitive before you call `executeOperation`.

urn-forge does not have migrations, row reads, indexes other than keys, or databases other than Postgres at this time.

## A complete example

<<< @/../packages/urn-forge/insurance/generated/schema.generated.sql{sql}

## Related pages

- [Store entities in Postgres](../how-to/store-in-postgres)
- [The configuration file](./configuration)
- [Generated code](./generated-code)
