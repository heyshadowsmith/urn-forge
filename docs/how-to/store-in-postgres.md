# Store entities in Postgres

The `postgres` plugin writes two files. `schema.generated.sql` has the `CREATE` statements for Postgres 14 or later: a domain for each field, a table for each configured entity, and a named `CHECK` for each invariant. `domain.store.generated.ts` has the statements that store each table entity. This guide enables the plugin, applies the SQL, writes and reads rows, and maps a Postgres error to a URN.

The examples come from [`packages/urn-forge/insurance/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/insurance/). The customer and the policy are tables. The coverages of a policy are a child table.

## Before you start

- You have a project that compiles. Refer to [Set up a project](set-up-a-project).
- You have a migration tool for Postgres.
- You know which entities the shell keeps. Many entities are only the input or the output of an operation. Do not make them tables.

## 1. Enable the plugin

1. Add `postgres` to `plugins` in `urn-forge.config.ts`. List the short key of each table entity in `tables`:

   ```ts
   plugins: ['valibot', 'fcis', ['postgres', { tables: ['customer.entity.customer', 'policy.entity.policy'] }]],
   ```

   - Keep `valibot` and `fcis` in the list. A `plugins` list replaces the default list.
   - Do not list an embedded entity. The plugin makes a child table for each list or embedded entity of a table.

2. Give each table entity a `key`. The key becomes the primary key:

   ```yaml
   policy.entity.policy:
     description: An issued insurance policy
     key: policy.field.policy_id
   ```

   If an entity in `tables` has no `key`, `compile` stops with `missing-key`.

3. Run `npx urn-forge compile`. Commit `schema.generated.sql` and `domain.store.generated.ts` with the other generated files. Gate 4 compares them with a fresh compile.

The SQL of the insurance domain:

<<< @/../packages/urn-forge/insurance/generated/schema.generated.sql

## 2. Read the warnings

The plugin does not write an approximate check. If a rule has no exact SQL form, `compile` shows `unenforced-in-sql`, and still writes the file. Here the customer is not in `tables`:

```
insurance/domain.manifest.yaml:84:1  warning  unenforced-in-sql  urn:acme:insurance:policy:entity:policy: the link "holder" to urn:acme:insurance:customer:entity:customer: that entity is not a table in the postgres config, so no foreign key can name it; the SQL does not enforce it, and the Valibot schema at the boundary still does
```

For each warning, do one of these:

- Change the manifest so that the rule has an SQL form. For example, add the target of the link to `tables`.
- Keep the warning. The Valibot schema still enforces the rule for each value that goes through `executeOperation`. A writer that does not use the core must check the rule itself.

If no rule may be outside the SQL, set `unenforced: 'error'` in the plugin config. A name that is longer than 63 bytes, or that two parts of the schema use, is always an error, `invalid-sql-name`. For each option and rule, refer to [The Postgres schema](../reference/postgres-schema).

## 3. Apply the SQL with your migration tool

urn-forge writes `CREATE` statements only. It does not connect to a database.

1. For a new database, copy `schema.generated.sql` into a new migration of your tool.
2. Apply the migration in one transaction.
3. After a later change to the manifest, compile again. Compare the new file with the old file, for example with `git diff`.
4. Write the `ALTER` statements for the difference in a new migration.

::: warning
Do not apply a new `schema.generated.sql` to a database that has the old one. The `CREATE` statements fail on the parts that are there.
:::

## 4. Write rows in one transaction

The shell writes rows after `executeOperation` returns `ok: true`. Then the values are parsed and branded. Do not write the `INSERT` statements by hand. For each table entity, `domain.store.generated.ts` has three functions:

| Function | Statements |
| --- | --- |
| `insertPolicyPolicy(policy)` | One `INSERT` for the row of the policy, then one for each row of its child tables |
| `replacePolicyPolicy(policy)` | A `DELETE` of the policy and its child rows, then the `INSERT` statements |
| `deletePolicyPolicy(policyId)` | One `DELETE` of the policy. Its child rows go with it (`ON DELETE CASCADE`) |

Each function returns statements, `{ text, values }`, and runs nothing. A count of a list, such as `minItems: 1`, is a deferred trigger that Postgres checks at `COMMIT`. Thus, run the statements of one value in one transaction:

```ts
import type { PolicyPolicy } from './generated/domain.schemas.generated';
import { insertPolicyPolicy, type Statement } from './generated/domain.store.generated';

/** The part of a database client that the shell uses. A node-postgres client and PGlite both have it. */
interface Sql {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/** Runs statements in one transaction. The count triggers run at COMMIT. */
export async function run(db: Sql, statements: readonly Statement[]): Promise<void> {
  await db.query('BEGIN');
  try {
    for (const { text, values } of statements) await db.query(text, [...values]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export function savePolicy(db: Sql, policy: PolicyPolicy): Promise<void> {
  return run(db, insertPolicyPolicy(policy));
}
```

For a policy with two coverages, `insertPolicyPolicy` gives these statements:

```
INSERT INTO "policy"."policy" ("policy_id", "holder", "effective_date", "expiry_date", "premium", "deductible") VALUES ($1, $2, $3, $4, $5, $6)  ["123e4567-e89b-12d3-a456-426614174000","9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d","2026-01-01","2026-12-31","120.00",null]
INSERT INTO "policy"."policy__coverages" ("policy_id", "position", "peril", "limit", "note", "remark") VALUES ($1, $2, $3, $4, $5, $6)  ["123e4567-e89b-12d3-a456-426614174000",0,"fire","1000.00",null,null]
INSERT INTO "policy"."policy__coverages" ("policy_id", "position", "peril", "limit", "note", "remark") VALUES ($1, $2, $3, $4, $5, $6)  ["123e4567-e89b-12d3-a456-426614174000",1,"flood","500.00",null,"Basement excluded"]
```

With node-postgres, get one client with `pool.connect()` for the transaction. A pool can send each query on a different connection.

## 5. Convert the values that the driver reads

The core uses text for some primitives. A driver changes some of these values when it reads them. Set a parser for each OID:

| Primitive | Column type | OID | node-postgres gives, by default | The core needs |
| --- | --- | --- | --- | --- |
| `date` | `DATE` | `1082` | A JavaScript `Date` | `YYYY-MM-DD` |
| `timestamp` | `TIMESTAMPTZ` | `1184` | A JavaScript `Date` | ISO 8601 with `Z` |
| `decimal` | `NUMERIC` | `1700` | A string | A string. No change |
| `integer` outside 32 bits | `BIGINT` | `20` | A string | A number |

With PGlite, give `parsers` to the constructor:

```ts
const parsers = {
  1082: (text: string) => text,
  1184: (text: string) => new Date(text).toISOString(),
  1700: (text: string) => text,
  20: (text: string) => Number(text),
};
const db = new PGlite({ parsers });
```

With node-postgres, use `pg.types.setTypeParser` with the same OIDs. Then parse each row that you read with the generated schema, for example `v.safeParse(PolicyPolicySchema, row)`, to get branded values. Without the parsers, the schema refuses the dates.

## 6. Map a Postgres error to a URN

If a row breaks a rule of the SQL, Postgres refuses the statement or the `COMMIT`. The SQL keeps the URN of each part in a comment. The first word of the comment is the URN. This function reads it:

```ts
const URN_OF_CONSTRAINT = `
  SELECT coalesce(
           obj_description(c.oid, 'pg_constraint'),
           obj_description(c.contypid, 'pg_type'),
           obj_description(c.conrelid, 'pg_class')
         ) AS comment
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  LEFT JOIN pg_class r ON r.oid = c.conrelid
  LEFT JOIN pg_type t ON t.oid = c.contypid
  WHERE n.nspname = $1 AND c.conname = $2 AND (r.relname = $3 OR t.typname = $4)`;

const URN_OF_COLUMN = `
  SELECT col_description(a.attrelid, a.attnum) AS comment
  FROM pg_attribute a
  JOIN pg_class r ON r.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = r.relnamespace
  WHERE n.nspname = $1 AND r.relname = $2 AND a.attname = $3`;

/** The fields of a Postgres error that the shell reads. node-postgres and PGlite give them with these names. */
interface PgError {
  readonly code?: string;
  readonly constraint?: string;
  readonly schema?: string;
  readonly table?: string;
  readonly column?: string;
  readonly dataType?: string;
}

/** The URN that a Postgres error names: an invariant, a field, or an entity. The first word of the comment is the URN. */
export async function urnOf(db: Sql, error: PgError): Promise<string | undefined> {
  const { rows } =
    error.constraint !== undefined
      ? await db.query(URN_OF_CONSTRAINT, [error.schema, error.constraint, error.table ?? null, error.dataType ?? null])
      : await db.query(URN_OF_COLUMN, [error.schema, error.table, error.column]);
  const comment = rows[0]?.comment;
  return typeof comment === 'string' ? comment.split(' ')[0] : undefined;
}
```

Each line below is the `code`, the `constraint` or the `column`, and the URN from `urnOf`. Each write is a call to `savePolicy` with one broken value:

```
23514  term_is_positive  urn:acme:insurance:policy:invariant:term_is_positive
23514  premium  urn:acme:insurance:policy:field:premium
23514  limit_is_positive  urn:acme:insurance:policy:invariant:limit_is_positive
23503  policy_holder_fkey  urn:acme:insurance:policy:entity:policy
23505  policy__coverages_peril_key  urn:acme:insurance:policy:entity:coverage
23514  coverages_count  urn:acme:insurance:policy:entity:policy
23502  premium  urn:acme:insurance:policy:field:premium
```

- An invariant gives the URN of the invariant. A field constraint gives the URN of the field.
- A link, a `unique` list and a count give the URN of their table. Read the `constraint` for the property.
- The comments change only with a migration, so you can keep the results in memory.

A broken value that gets to Postgres shows a bug in the shell, or a writer that does not use the core. Write the URN to the log. Do not send the Postgres message to the caller.

## Result

Your migration tool applies `schema.generated.sql`. The shell writes a policy and its coverages in one transaction, and reads them back as values that the generated schema accepts. A refused write gives a URN of the manifest.

## Related pages

- [The Postgres schema](../reference/postgres-schema)
- [Call an operation from the shell](call-an-operation)
- [Core and shell](../explanation/core-and-shell)
