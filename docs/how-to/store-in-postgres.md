# Store entities in Postgres

The `postgres` plugin writes `schema.generated.sql`: `CREATE` statements for Postgres 14 or later. Each field becomes a domain, each configured entity becomes a table, and each invariant becomes a named `CHECK`. It also writes `domain.store.generated.ts`: the statements that store each table entity. This guide enables the plugin, applies the SQL, writes rows from the shell, and maps a Postgres error back to a URN.

The examples come from [`packages/urn-forge/insurance/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/insurance/), which CI tests. The customer and the policy are tables. The coverages of a policy are a child table.

The commands on this page ran in a clone of the urn-forge repository, from `packages/urn-forge`. In your project, run them from the folder of `urn-forge.config.ts`, and leave out `--config`.

## Before you start

- You have a project that compiles. Refer to [Set up a project](set-up-a-project).
- You have a migration tool for Postgres, and a database that it can change.
- You know which entities the shell keeps. Many entities are only the input or the output of an operation. Do not make them tables.

## 1. Enable the plugin

Add `postgres` to `plugins` in `urn-forge.config.ts`. List the short key of each entity that becomes a table in `tables` (highlighted):

<<< @/../packages/urn-forge/insurance/urn-forge.config.ts{13}

- Keep `valibot` and `fcis` in the list. A `plugins` list replaces the default list. The `postgres` plugin needs `valibot`: the store file uses the types of its schemas.
- Do not list an embedded entity. The plugin makes a child table for each list or embedded entity of a table.
- `unenforced` is `'warn'` by default. Step 4 tells you when to set it to `'error'`.

For each option, refer to [The Postgres schema](../reference/postgres-schema).

## 2. Give each table a key

Each entity in `tables` needs a `key`. The key becomes the primary key of the table. The insurance policy has one (highlighted):

```yaml{4}
policy.entity.policy:
  description: An issued insurance policy
  # What a link to a policy holds, and the primary key of its table (Postgres plan).
  key: policy.field.policy_id
```

If an entity in `tables` has no `key`, `compile` stops:

```
insurance/domain.manifest.yaml:84:1  error  missing-key  urn:acme:insurance:policy:entity:policy: is a table in the postgres config, so it needs a key: one of its own required, single-valued fields
```

To fix it, add `key` with a required, single-valued field of the entity. For the rules of a key, refer to [Add an entity](add-an-entity).

## 3. Compile

Run this command:

```bash
npx urn-forge compile --config insurance/urn-forge.config.ts
```

The first compile with the plugin writes the new file:

```
insurance/domain.manifest.yaml:79:12  warning  deprecated-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, which is deprecated (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30)
wrote      insurance/generated/domain.runtime.generated.ts
wrote      insurance/generated/domain.schemas.generated.ts
wrote      insurance/generated/domain.store.generated.ts
wrote      insurance/generated/schema.generated.sql
fingerprint sha256:cdd7f3a5a0f84f5f5d6d2f874a7e15be48b16ddf85506fbf72fc053a65322dd2
```

The `deprecated-ref` warning is about the retired field `note`. Refer to [Retire a URN](retire-a-urn).

Commit `schema.generated.sql` and `domain.store.generated.ts` with the other generated files. Gate 4 of `verify` compares it with a fresh compile, as it does for the TypeScript files.

The file of the insurance domain:

<<< @/../packages/urn-forge/insurance/generated/schema.generated.sql

## 4. Read the warnings

The plugin does not write an approximate check. If a rule has no exact SQL form, `compile` shows `unenforced-in-sql`. The file is still written. Here the customer is not in `tables`:

```
insurance/domain.manifest.yaml:84:1  warning  unenforced-in-sql  urn:acme:insurance:policy:entity:policy: the link "holder" to urn:acme:insurance:customer:entity:customer: that entity is not a table in the postgres config, so no foreign key can name it; the SQL does not enforce it, and the Valibot schema at the boundary still does
```

Here `coverages` has `required: false`:

```
insurance/domain.manifest.yaml:84:1  warning  unenforced-in-sql  urn:acme:insurance:policy:entity:policy: the optional list "coverages": no rows can mean absent or empty, so the SQL keeps them apart only as no rows; the SQL does not enforce it, and the Valibot schema at the boundary still does
```

Here `customer.field.name` has a `regex` with a lookahead, `^(?!admin).*$`:

```
insurance/domain.manifest.yaml:12:1  warning  unenforced-in-sql  urn:acme:insurance:customer:field:name: regex ^(?!admin).*$: lookaround and named groups have no translation; the SQL does not enforce it, and the Valibot schema at the boundary still does
```

The other causes are `format: uri`, and an invariant rule that names a list or an embedded entity. For each warning, do one of these:

- Change the manifest so that the rule has an SQL form. For example, add the target of the link to `tables`. Or remove `required: false` from the list. Or write the `regex` in the subset that the plugin translates.
- Keep the warning. The Valibot schema at the boundary still enforces the rule for each value that goes through `executeOperation`. A writer that does not use the core must check the rule itself.

If no rule may be outside the SQL, set `unenforced: 'error'` in the plugin config. Then each case is an error, and `compile` writes no files:

```
insurance/domain.manifest.yaml:84:1  error  unenforced-in-sql  urn:acme:insurance:policy:entity:policy: the link "holder" to urn:acme:insurance:customer:entity:customer: that entity is not a table in the postgres config, so no foreign key can name it; the SQL does not enforce it, and the Valibot schema at the boundary still does
```

A name that is longer than 63 bytes, or a name that two parts of the schema use, is `invalid-sql-name`. It is always an error. Here a second invariant `customer.invariant.term_is_positive` is on the policy too:

```
insurance/domain.manifest.yaml:119:1  error  invalid-sql-name  urn:acme:insurance:policy:invariant:term_is_positive: the check constraint name "policy.term_is_positive" is also a name that urn:acme:insurance:customer:invariant:term_is_positive uses
```

To fix it, give one of the two atoms a different identifier, or a shorter property name with `as`. For the subset of regular expressions and each name rule, refer to [The Postgres schema](../reference/postgres-schema).

## 5. Apply the SQL with your migration tool

urn-forge writes `CREATE` statements only. It does not connect to a database. Give the file to your migration tool:

1. For a new database, copy `schema.generated.sql` into a new migration of your tool.
2. Apply the migration in one transaction. With `psql`, for example:

   ```bash
   psql --single-transaction -v ON_ERROR_STOP=1 -f insurance/generated/schema.generated.sql
   ```

3. After a later change to the manifest, compile again. Compare the new file with the old file, for example with `git diff`.
4. Write the `ALTER` statements for the difference in a new migration of your tool.

::: warning
Do not apply a new `schema.generated.sql` to a database that has the old one. The `CREATE` statements fail on the parts that are there. urn-forge does not have migrations at this time. Refer to [Scope](../reference/scope).
:::

## 6. Write a policy and its coverages in one transaction

The shell writes rows after `executeOperation` returns `ok: true`. Then the values are parsed and branded, so they agree with the domains of the SQL.

Do not write the `INSERT` statements by hand. The plugin writes them in `domain.store.generated.ts`, from the same tables as the SQL. For each table entity, it has three functions:

| Function | Statements |
| --- | --- |
| `insertPolicyPolicy(policy)` | One `INSERT` for the row of the policy, then one for each row of its child tables |
| `replacePolicyPolicy(policy)` | A `DELETE` of the policy and its child rows, then the `INSERT` statements |
| `deletePolicyPolicy(policyId)` | One `DELETE` of the policy. Its child rows go with it (`ON DELETE CASCADE`) |

The name has the brand identifier of the entity. Each function returns statements, `{ text, values }`, and runs nothing. Each function takes the parsed entity type, so `tsc` refuses an object that `executeOperation` did not give.

A count of a list, such as `minItems: 1` and `maxItems: 3` for `coverages`, is a deferred trigger. Postgres checks it at `COMMIT`. Thus, run the statements of one value in one transaction:

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

For the output of `issue_policy` with two coverages, `insertPolicyPolicy` gives these statements:

```
INSERT INTO "policy"."policy" ("policy_id", "holder", "effective_date", "expiry_date", "premium", "deductible") VALUES ($1, $2, $3, $4, $5, $6)  ["123e4567-e89b-12d3-a456-426614174000","9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d","2026-01-01","2026-12-31","120.00",null]
INSERT INTO "policy"."policy__coverages" ("policy_id", "position", "peril", "limit", "note", "remark") VALUES ($1, $2, $3, $4, $5, $6)  ["123e4567-e89b-12d3-a456-426614174000",0,"fire","1000.00",null,null]
INSERT INTO "policy"."policy__coverages" ("policy_id", "position", "peril", "limit", "note", "remark") VALUES ($1, $2, $3, $4, $5, $6)  ["123e4567-e89b-12d3-a456-426614174000",1,"flood","500.00",null,"Basement excluded"]
```

- Each column of each table is in its `INSERT`. When a new property comes into the manifest, the next compile adds its column to the SQL and to the statements. A hand-written `INSERT` would not get it, and no gate finds that.
- Each item of a list gets its index as `position`, and an absent optional value is `NULL`.
- With node-postgres, get one client with `pool.connect()` for the transaction. A pool can send each query on a different connection.
- Without a transaction, Postgres checks the count at the end of each statement. Then the first `INSERT` of a policy fails, because the policy has no coverage yet.

This code ran with PGlite, on the output of `issue_policy`. [`packages/urn-forge/tests/store.test.ts`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/store.test.ts) also replaces a policy with fewer coverages and deletes it.

## 7. Convert the values that the driver reads

The core uses text for some primitives: `YYYY-MM-DD` for a `date`, `…Z` for a `timestamp`, and a decimal string for a `decimal`. A driver changes some of these values when it reads them:

| Primitive | Column type | OID | node-postgres gives, by default | The core needs |
| --- | --- | --- | --- | --- |
| `date` | `DATE` | `1082` | A JavaScript `Date` | `YYYY-MM-DD` |
| `timestamp` | `TIMESTAMPTZ` | `1184` | A JavaScript `Date` | ISO 8601 with `Z` |
| `decimal` | `NUMERIC` | `1700` | A string | A string. No change |
| `integer` outside 32 bits | `BIGINT` | `20` | A string | A number |

A column of a domain gives the OID of its base type. For example, PGlite gives `1082` for `effective_date` and `1700` for `premium`. Thus, a parser for the base type applies to each field of that primitive.

1. Read the rows, and put them in the form of the input of the generated schema:

   ```ts
   import * as v from 'valibot';
   import { PolicyPolicySchema } from './generated/domain.schemas.generated';

   /** Reads a policy back, and parses it with the generated schema to get branded values. */
   export async function loadPolicy(db: Sql, policyId: string) {
     const { rows } = await db.query('SELECT * FROM "policy"."policy" WHERE "policy_id" = $1', [policyId]);
     const coverages = await db.query(
       'SELECT "peril", "limit", "note" FROM "policy"."policy__coverages" WHERE "policy_id" = $1 ORDER BY "position"',
       [policyId],
     );
     const { deductible, ...policy } = rows[0]!;
     const row = {
       ...policy,
       ...(deductible === null ? {} : { deductible }),
       coverages: coverages.rows.map(({ note, ...coverage }) => (note === null ? coverage : { ...coverage, note })),
     };
     return v.safeParse(PolicyPolicySchema, row);
   }
   ```

2. Parse each row with the generated schema. Without a conversion, the schema refuses the dates. This is the output with the default parsers of PGlite:

   ```
   [
     'effective_date: Invalid type: Expected string but received Date',
     'expiry_date: Invalid type: Expected string but received Date'
   ]
   ```

3. Set a parser for each OID in the table. With PGlite, give `parsers` to the constructor:

   ```ts
   const parsers = {
     1082: (text: string) => text,
     1184: (text: string) => new Date(text).toISOString(),
     1700: (text: string) => text,
     20: (text: string) => Number(text),
   };
   const db = new PGlite({ parsers });
   ```

   With the parsers, `loadPolicy` gives the policy back:

   ```
   {
     policy_id: '123e4567-e89b-12d3-a456-426614174000',
     holder: '9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d',
     coverages: [
       { peril: 'fire', limit: '1000.00' },
       { peril: 'flood', limit: '500.00', note: 'Basement excluded' }
     ],
     effective_date: '2026-01-01',
     expiry_date: '2026-12-31',
     premium: '120.00'
   }
   ```

4. With node-postgres, set the same parsers with `pg.types.setTypeParser`. This page does not show the output of node-postgres:

   ```ts
   import pg from 'pg';

   pg.types.setTypeParser(1082, (text) => text); // DATE: keep YYYY-MM-DD
   pg.types.setTypeParser(1184, (text) => new Date(text).toISOString()); // TIMESTAMPTZ: ISO 8601 with Z
   pg.types.setTypeParser(20, (text) => Number(text)); // BIGINT: the plugin keeps it in the safe-integer range
   ```

Postgres writes a timestamp as text with a space and an offset, for example `2026-01-31 09:30:00+00`. The offset is the time zone of the session. `new Date(text).toISOString()` changes it to UTC with `Z`. With PGlite, in the time zone `Europe/Paris`, the parsers above gave this row:

```
{
  at: '2026-01-31T09:30:00.000Z',
  text: '2026-01-31 10:30:00+01',
  day: '2026-01-01',
  premium: '120.00',
  big: 9007199254740991
}
```

`at` is `TIMESTAMPTZ '2026-01-31T09:30:00Z'` through the parser. `text` is the same value as Postgres writes it. The core accepts a fraction of up to 3 digits, so `.000Z` is a correct `timestamp`.

## 8. Map a Postgres error to a URN

If a row breaks a rule of the SQL, Postgres refuses the statement or the `COMMIT`. The error has a SQLSTATE `code` and, for most rules, a `constraint`:

| `code` | Rule | `constraint` |
| --- | --- | --- |
| `23514` | An invariant | The identifier of the invariant, for example `term_is_positive` |
| `23514` | A constraint of a field | The identifier of the field, for example `premium` |
| `23514` | A count of a list, at `COMMIT` | `<property>_count`, for example `coverages_count` |
| `23503` | A link | For example `policy_holder_fkey` |
| `23505` | A key or a `unique` list | For example `policy__coverages_peril_key` |
| `23502` | A required field | None. The error gives the `column` |

For the full list, refer to [The Postgres schema](../reference/postgres-schema).

The SQL keeps the URN of each part in a comment. The comment of an invariant constraint starts with the URN of the invariant. This query lists the `CHECK` constraints of the tables in the schema `policy`, with their comments:

```sql
SELECT c.conname, c.contype, obj_description(c.oid, 'pg_constraint') AS comment
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'policy' AND c.contype = 'c' AND c.contypid = 0
ORDER BY c.conname
```

PGlite gives these rows:

```
deductible_below_premium  urn:acme:insurance:policy:invariant:deductible_below_premium — The deductible must be less than the premium
limit_is_positive  urn:acme:insurance:policy:invariant:limit_is_positive — The limit of a coverage must be more than 0
policy__coverages_position_check  null
term_at_most_a_year  urn:acme:insurance:policy:invariant:term_at_most_a_year — A policy can last 366 days at most
term_is_positive  urn:acme:insurance:policy:invariant:term_is_positive — The expiry date must be after the effective date
```

To map an error to a URN, do these steps:

1. Read `code`, `constraint`, `schema`, `table`, `column` and `dataType` from the error.
2. Find the constraint by its schema, its name, and its table or its domain.
3. Read the first comment that exists: the comment of the constraint, then of the domain, then of the table.
4. If the error has no constraint, read the comment of the column.
5. Take the first word of the comment. It is the URN.

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

A domain is not a table, so the error of a field constraint has `dataType`, for example `premium_value`, and no `table`. A constraint name is unique only in its table, so the query also uses the table.

The tables of the insurance domain give these results. Each line is the `code`, the `constraint` or the `column`, and the URN from `urnOf`. Each write is a call to `savePolicy` with one broken value:

```
23514  term_is_positive  urn:acme:insurance:policy:invariant:term_is_positive
23514  premium  urn:acme:insurance:policy:field:premium
23514  limit_is_positive  urn:acme:insurance:policy:invariant:limit_is_positive
23503  policy_holder_fkey  urn:acme:insurance:policy:entity:policy
23505  policy__coverages_peril_key  urn:acme:insurance:policy:entity:coverage
23514  coverages_count  urn:acme:insurance:policy:entity:policy
23502  premium  urn:acme:insurance:policy:field:premium
```

- An invariant gives the URN of the invariant, and a field constraint gives the URN of the field.
- A link, a `unique` list and a count give the URN in the comment of their table. For the table of an entity, or of a list of an embedded entity, this is the URN of the entity. For the table of a list of values, such as a list of names, it is the URN of the field. Read the `constraint` for the property.
- The query reads the catalog. The comments change only with a migration, so you can keep the results in memory.

A broken value that gets to Postgres shows a bug in the shell, or a writer that does not use the core. Write the URN to the log. Do not send the Postgres message to the caller.

## Result

`compile` writes `schema.generated.sql` with no `unenforced-in-sql` warning that you did not accept. Your migration tool applies it. The shell writes a policy and its coverages in one transaction, and reads them back as values that the generated schema accepts. A refused write gives a URN of the manifest.

## Related pages

- [The Postgres schema](../reference/postgres-schema)
- [Call an operation from the shell](call-an-operation)
- [Add an invariant](add-an-invariant)
- [The MECE model of primitives](../explanation/primitives-model)
- [Scope](../reference/scope)
