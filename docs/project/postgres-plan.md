# urn-forge Postgres plan

Nov 21, 2026 · @Shadow Smith

Today urn-forge gives a domain validated input, a typed core and scenarios, but no place to keep its data. The spec has a fourth plugin for that (spec §7.4): `schema.generated.sql`, with `CREATE` statements for Postgres. The [structure plan](./structure-plan) gave the IR what this plugin needs: a `key` on an entity, a `link` to another entity, embedded entities and lists. This plan adds the plugin.

The plugin writes SQL that you give to your migration tool. It does not run SQL, make migrations, or write code that reads and writes rows. Those stay in the shell (spec §7.4, "Emits create statements only").

## What changes for a user

```ts
// urn-forge.config.ts
export default defineConfig({
  manifest: './domain.manifest.yaml',
  plugins: [
    ['valibot', {}],
    ['fcis', {}],
    ['postgres', { tables: ['customer.entity.customer', 'policy.entity.policy'] }],
  ],
});
```

```sql
-- schema.generated.sql (generated)
CREATE SCHEMA IF NOT EXISTS "policy";

-- A field is a domain: its primitive and its constraints, in one place.
CREATE DOMAIN "policy"."premium_value" AS NUMERIC
  CONSTRAINT "premium" CHECK (VALUE > 0 AND scale(VALUE) <= 2);
COMMENT ON DOMAIN "policy"."premium_value" IS 'urn:acme:insurance:policy:field:premium';

-- An entity in `tables` is a table. A reference is a column; a link is a foreign key.
CREATE TABLE "policy"."policy" (
  "policy_id"      "policy"."policy_id_value"     NOT NULL PRIMARY KEY,
  "holder"         "customer"."customer_id_value" NOT NULL REFERENCES "customer"."customer" ("customer_id"),
  "effective_date" "policy"."effective_date_value" NOT NULL,
  "expiry_date"    "policy"."expiry_date_value"   NOT NULL,
  "premium"        "policy"."premium_value"       NOT NULL,
  "deductible"     "policy"."deductible_value",
  -- An invariant is a named CHECK.
  CONSTRAINT "term_is_positive" CHECK ("expiry_date" > "effective_date"),
  CONSTRAINT "deductible_below_premium" CHECK ("deductible" IS NULL OR "deductible" < "premium")
);

-- A list (or an embedded entity) is a child table, in order, unique by the key.
CREATE TABLE "policy"."policy__coverages" (
  "policy_id" "policy"."policy_id_value" NOT NULL REFERENCES "policy"."policy" ("policy_id") ON DELETE CASCADE,
  "position"  INTEGER NOT NULL CHECK ("position" >= 0),
  "peril"     "policy"."peril_value" NOT NULL,
  "limit"     "policy"."limit_value" NOT NULL,
  "note"      "policy"."note_value",
  PRIMARY KEY ("policy_id", "position"),
  UNIQUE ("policy_id", "peril"),
  CONSTRAINT "limit_is_positive" CHECK ("limit" > 0)
);
-- minItems 1 and maxItems 3: a constraint trigger, checked when the transaction commits.
```

A shell that writes a policy with a limit of 0 gets the Postgres error `23514` with the constraint name `limit_is_positive`. A comment on each constraint holds its invariant URN, so the shell can map the error back to the manifest.

## The model

The three layers of the [MECE model](../explanation/primitives-model) go to three places in SQL:

| Layer | In SQL |
| --- | --- |
| The field: a primitive and its constraints | A `DOMAIN` with its `CHECK`s. Every column and every list of the field uses it |
| The field reference: presence, count, structure | The column: `NOT NULL`, the foreign key of a link, the child table of a list or an embedded entity, its `UNIQUE`, and the count trigger |
| The invariant | A named `CHECK` on the table of its entity |

The Valibot schema at the boundary stays the first check. The SQL is a second check, for a shell with a bug and for writers that do not use the core. Each rule is in the SQL exactly, or the plugin says that it is not (decision 8). It never drops a rule without a word.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Which entities become tables? | **The entities in the plugin's `tables` config**, by short key. Each one needs a `key` (`missing-key`). The entities that a table embeds become child tables automatically | Many entities are only an operation's input or output (a cancellation, a refund quote). The spec makes every entity with a key a table, but a key also identifies a coverage in a list, and a coverage is not a table of its own. Storage is a decision of the shell, so it goes in the config, not in the manifest |
| 2 | How do URNs become SQL names? | **A context is a schema, an entity identifier is a table, a property name is a column.** A field's domain is `<context>.<identifier>_value`. A child table is `<table>__<property>`. Every name is quoted. A name over 63 bytes or a name used twice is `invalid-sql-name` | URNs already have a namespace and Postgres has one too. Quotes make reserved words safe: `limit` is a real coverage field. `_value` keeps a domain apart from a table, because a table also makes a type of its own name |
| 3 | Where do field constraints go? | **On a `DOMAIN` for each field** (spec §7.4 put them on each table as `ck_<brand>`) | A field's rules are the same in every entity, so one place holds them. A domain also works for the items of a list. This is the MECE rule applied to SQL |
| 4 | Which SQL type for each primitive? | `boolean` → `BOOLEAN`; `integer` → `INTEGER` if its bounds fit in 32 bits, else `BIGINT` with the safe-integer range; `float` → `DOUBLE PRECISION` without NaN or infinities; `decimal` → `NUMERIC` with no precision, and `scale(VALUE) <= s`; `string` → `TEXT` (also for `format: uuid`); `enum` → `TEXT` with `IN (…)`; `date` → `DATE`; `timestamp` → `TIMESTAMPTZ` | Native types keep order, indexes and date arithmetic for queries. `NUMERIC` with no precision keeps the digits it gets, and `scale` is the step of the MECE model, with no `precision`. A uuid stays `TEXT`, because the `UUID` type writes it back in lower case, and a string compares exactly. An `ENUM` type is hard to change; a check is not |
| 5 | What does "length" mean? | **Unicode code points, everywhere.** This changes the Valibot output (it counts UTF-16 units today) and the boundary values of gate 3 | Postgres `char_length` counts code points. JavaScript `.length` counts UTF-16 units, so an emoji is 2 in one and 1 in the other. One meaning in both places is the only way that both checks agree. Code points are also what a person counts. The change affects only text with characters outside the Basic Multilingual Plane, and urn-forge has no users outside this repository yet |
| 6 | How is a list stored, or an embedded entity? | **As a child table**, with the parent's key columns and `position` (for a list) as its primary key. `unique` becomes `UNIQUE (parent, key)`, or `UNIQUE (parent, value)` for a list of values. A link in a child table is a foreign key there too. No `JSONB` option | A child table keeps every rule in force: the domains, the links and the invariants of the embedded entity. A `JSONB` column cannot check what is inside it. The spec's `listStorage` option would be two spellings for one thing |
| 7 | How are counts enforced (`minItems`, `maxItems`, a required embedded entity)? | **A constraint trigger for each child table**, `DEFERRABLE INITIALLY DEFERRED`, so the count is checked when the transaction commits | A count is about many rows, and a `CHECK` sees one row. A deferred trigger lets the shell write the parent and its children in any order in one transaction |
| 8 | What if a rule has no exact SQL form? | **A warning `unenforced-in-sql`**, with the URN and the reason, and a comment in the SQL. The config `unenforced: 'error'` makes it an error. Cases: `format: uri` (Valibot checks it with the URL parser), a `regex` outside the shared subset, a rule that names a list or an embedded entity (`is present`), a link to an entity that is not a table, an optional list (no rows can mean absent or empty) | Spec §7: a plugin "must report any rule it cannot translate", and never skip it. The boundary still enforces each one, so a warning is honest, and the `'error'` mode is the same choice as `boundaryCoverage` |
| 9 | Regular expressions | **Translate a pattern only if it uses the subset that the plugin can rewrite exactly:** literals, `.`, bracket classes such as `[a-z]`, quantifiers, anchors, groups and `|`. `\d`, `\w` and `\s` become explicit ASCII classes (`[0-9]`, `[A-Za-z0-9_]` and the whitespace that JavaScript defines), and the `i` flag becomes `~*`. Anything else is `unenforced-in-sql`. `format: uuid` and `format: email` use their Valibot patterns (one uses `i`, the other `\w`), rewritten in the same way | The two engines have different dialects. In Postgres, `\w` and `\d` also match letters and digits outside ASCII, but in JavaScript they do not. A pattern that means something else in Postgres is worse than no check, because it refuses good values or lets bad ones in |
| 10 | Invariants | **A named `CHECK` on the table of the `on` entity**, translated from the rule AST: `is present` → `IS NOT NULL`, a link → its key column. The constraint name is the invariant's identifier, and a comment holds its URN | The rule language was made small so that each plugin can translate it (spec §4.3). The name lets the shell map a Postgres error back to the invariant |
| 11 | What else goes into the SQL? | **`COMMENT ON` each schema, domain, table, column and constraint**, with its URN and its description. No row-mapping code, no migrations | The database then names the manifest for each part. Code to read and write rows is a large addition, and the spec leaves it to the shell. It can be a later plan |
| 12 | How is the SQL tested? | **With PGlite** (Postgres compiled to WebAssembly) as a development dependency. The tests apply each fixture's SQL, and for every boundary case of gate 3 they compare the Postgres verdict with the Valibot verdict | Two evaluators are the largest risk (as in the invariants plan). PGlite is real Postgres with no Docker and no server, so the tests and CI stay simple. Users get no new runtime dependency: the plugin only writes text |
| 13 | Which Postgres version? | **14 or later** | `scale()` is in 13 and later, and 13 is out of support. A version line in the SQL header says it |
| 14 | Target | **Extend `insurance/`**: the policy gets `key: policy.field.policy_id`, and its config enables the plugin with the customer and the policy as tables | The insurance domain already has a link, an embedded list with a key, and invariants on a parent and on a child, so every part of the plugin runs on a real domain |
| 15 | One PR? | **Yes**, one commit per step, as before | |

## Scope

**In:** the `postgres` plugin and its config (`tables`, `unenforced`); schemas, domains, tables, child tables, keys, foreign keys, `UNIQUE`, count triggers, invariant checks and comments; length in code points (decision 5); two new codes, `unenforced-in-sql` and `invalid-sql-name`; PGlite tests; `insurance/`; the docs, with a how-to for the shell (the node-postgres type parsers and how to map an error to a URN).

**Out:** migrations and diffs of the schema; code that reads and writes rows; indexes other than keys and `UNIQUE`; other databases; a `verify` gate that applies the SQL (no gate should need a database); lifecycle (pass 8 is not built).

## The target, written first

Step 0 changes `insurance/`. The policy gets `key: policy.field.policy_id`, and `urn-forge.config.ts` lists the three plugins, with `customer.entity.customer` and `policy.entity.policy` in `tables`. A test applies the expected SQL for insurance in PGlite, writes a correct policy with two coverages, and expects each broken write to fail with its constraint name: no holder row, a limit of 0, a repeated peril, no coverages, four coverages, a premium with three decimals. Until step 2, `compile` refuses the config, because `postgres` is not a plugin name (`config-invalid`); that is the check of step 0.

## Build order

One PR (decision 15), one commit per step. Each step leaves the repository green and ends with a check.

- [ ] **0. The target.** As above. *Check:* `compile` refuses exactly the unknown plugin.
- [ ] **1. Length in code points.** Valibot `minLength` and `maxLength` count code points; gate 3 boundary values and the docs follow. *Check:* a string with an emoji is at the edge by code points, in a unit test and in the `primitives` fixture.
- [ ] **2. The plugin, names and domains.** The config schema, the name rules, one domain per field with each constraint, the comments, the header. *Check:* a `postgres` fixture with every primitive and constraint applies in PGlite, and for every boundary case Postgres and Valibot give the same answer; fixtures for `invalid-sql-name` and `unenforced-in-sql`.
- [ ] **3. Tables.** Columns, `NOT NULL`, primary keys, links as foreign keys, child tables for lists and embedded entities, `UNIQUE`, count triggers. *Check:* insurance's SQL applies, and the target test passes for every write except the invariant ones.
- [ ] **4. Invariants.** Each rule as a named `CHECK`, on a table or a child table; the cases of decision 8 as warnings. *Check:* the `rules` fixture's edge tests give the same answer in Postgres and in Valibot; the whole target test passes.
- [ ] **5. Ship.** Insurance's SQL tested in CI; reference pages for the plugin and the SQL names; a how-to for the shell; the model in the explanation pages. *Check:* CI green; every sabotage below fails.

## Done

| Sabotage | What catches it |
| --- | --- |
| A table in `tables` with no `key` | `missing-key` |
| A table name over 63 bytes, or two names that are the same | `invalid-sql-name` |
| A `regex` with a lookahead | `unenforced-in-sql` (an error with `unenforced: 'error'`) |
| `exclusiveMin` translated as `>=` | The boundary test: Postgres and Valibot disagree at the edge |
| A policy with four coverages, committed | The count trigger |
| A coverage with a limit of 0 | `CHECK` `limit_is_positive` |
| A holder that is not a customer row | The foreign key |
| A string of 10 emoji with `maxLength: 10` | Valibot and Postgres both accept it (decision 5) |

## Risks

- **Two evaluators.** The SQL and the Valibot schema are two translations of one rule. Decision 12 tests them on the same boundary cases. Decision 9 keeps regular expressions to a subset that means the same thing in both.
- **Driver conversions.** node-postgres reads `DATE` and `TIMESTAMPTZ` as JavaScript `Date` objects, and `BIGINT` and `NUMERIC` as strings, and Postgres writes a timestamp as `2026-01-31 09:30:00+00`, not with `T` and `Z`. The values are equal by their primitive's comparison, but their text is not. The shell must convert them, and the how-to must show how, with real code. Row-mapping code can come later as its own plan.
- **Triggers.** Count triggers are PL/pgSQL, which the rest of the output is not. They have a cost on each write to a child table. If they prove too slow or too complex, a count can become `unenforced-in-sql` instead, as an addition to decision 8.
- **Breaking length.** Decision 5 changes a meaning that exists. It affects only text with characters outside the Basic Multilingual Plane, and before 1.0 the change is cheap.
- **No migrations.** A change to the manifest changes the SQL, and the user must turn the difference into a migration with their own tool (spec §7.4). Lifecycle (pass 8) will make that safer later.
