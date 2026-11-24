# urn-forge plan: Valibot schemas and relational tables

Nov 24, 2026 · @Shadow Smith

urn-forge 0.2.0 made two choices that the [redesign plan](./manifest-redesign-plan.md) did not make, and that this plan undoes:

- **The generated file has no Valibot.** Each definition has a plain TypeScript check. It cannot plug into tRPC, form libraries, Hono or anything else that takes a Standard Schema.
- **A list or an embedded object is a JSONB column.** The database does not check the rules of the values inside it. Only the harness checks them, and a write from other code can store any JSON.

## What changes for a user

```ts
import { BookingSchema, runOperation } from './generated/domain.generated';

// A Standard Schema: any library that takes one can use it.
const result = v.safeParse(BookingSchema, body);
```

```sql
CREATE TABLE "booking"."booking" (
  "reference" TEXT NOT NULL,
  "contact_email" TEXT NOT NULL,          -- an embedded object: one column for each property
  "contact_phone" TEXT,
  …
);
CREATE TABLE "booking"."booking__dishes" (  -- a list of objects: a child table
  "reference" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "course" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  CONSTRAINT "booking__dishes_pkey" PRIMARY KEY ("reference", "position"),
  CONSTRAINT "booking__dishes_parent_fkey" FOREIGN KEY ("reference") REFERENCES "booking"."booking" ("reference") ON DELETE CASCADE,
  CONSTRAINT "booking__dishes_course_enum" CHECK ("course" = ANY(ARRAY['starter', 'main', 'dessert']))
);
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The schema of a definition | **A Valibot schema for each definition, `<Name>Schema`: `v.string()`, `v.number()` with `v.integer()`, `v.boolean()`, `v.array()`, `v.strictObject()` with `v.optional()` for a property outside `required`. A definition named as a type is its root's schema, with its own rules in a pipe** | A Valibot schema is a Standard Schema, so other libraries can use it. These are the schema functions of Valibot, with no adapter |
| 2 | A rule in the schema | **Each rule is a validation action in the schema's pipe. Its type is the rule's name, and its message is the rule's message with the arguments filled in. A failure keeps the rule, the definition, the path and the message, as now** | The failures, the Gherkin steps and gate 3 do not change. Valibot runs the pipe of an object only after its properties parse, as the checks of 0.2 do |
| 3 | The failures of the structure | **A value of the wrong type is `type`, a property that the object does not have is `properties`, and a missing required property is `required`, as now** | The rule names of 0.2 stay. `check()`, `runOperation` and the Gherkin steps do not change for a user |
| 4 | The dependency | **The generated file imports `valibot`, and `valibot` is a dependency of `urn-forge`** | As in 0.1. A project installs urn-forge and gets the version of Valibot that urn-forge was tested with |
| 5 | The checks of the compiler | **The compiler checks each argument of a rule with the same generated schemas, with `v` passed in** | One set of checks, in the compiler and in the project |
| 6 | An embedded object | **Columns in the parent table, `<property>_<sub-property>`, at any depth. Two properties that give one column name stop `compile` (`postgres-column`). A required property of an optional object is a CHECK: present when any column of the object is present** | A column can hold a rule as a CHECK, which JSONB cannot. No join for a value of one row |
| 7 | A list of objects | **A child table, `<table>__<property>`: the parent's identifier, `position`, and a column for each property of the item, with the item's rules as CHECKs. Its primary key is the parent's identifier and `position`. Its foreign key to the parent cascades a delete. A list inside an item is a table of the child, at any depth** | The rules of each item are checked by the database |
| 8 | A list of values | **A child table, `<table>__<property>`: the parent's identifier, `position`, and `value`, with the rules of the value as CHECKs** | The same as a list of objects |
| 9 | The rules of a list | **`uniqueItems`: a UNIQUE constraint over the parent's identifier and the value (or the item's identifier). `minItems` and `maxItems`: a constraint trigger, deferred to the end of the transaction, that counts the rows of the parent, as in 0.1. A rule with a macro (`all`, `exists`, `exists_one`, `map`, `sum()`) is not in SQL; the schema's comment names it, as now** | Each standard rule of a list that SQL can say, SQL says. A count is only right once all the rows of a write are in |
| 10 | Writing and reading the rows | **The store file, `domain.store.generated.ts`, for the tables of the config: `insert<Table>(value)`, `delete<Table>(identifier)` and `replace<Table>(value)` give the statements of a write as `{ text, values }`; `select<Table>(identifier)` gives the statements of a read, and `<table>FromRows(rows)` builds the value from their rows. Pure functions: the shell runs the statements with its own driver** | Without them, the shell writes the code that splits a value into rows and builds it back, for each table. This code is generated in the same way as the schema, so the two cannot disagree. It changes decision 36 of the [notes](./manifest-redesign-notes.md), which said no runtime code: these functions make no call, and the shell keeps its driver, its transaction and its locks |
| 11 | `diff` | **No change.** The manifest does not change | |

## Scope

- **In scope:** decisions 1 to 10; the booking fixture, the domains and the contracts recompiled; the docs of the generated code, the Postgres schema and the store file.
- **Out of scope:** a database other than Postgres; a store that loads, locks and saves by itself (the shell's job).

## The target, written first

Step 0 adds tests that fail for the reason expected:

- the generated `BookingSchema` is a Standard Schema, and `v.safeParse` gives the failures of 0.2, by rule name;
- the booking fixture's schema has the child table `booking__dishes` and the columns `contact_email` and `contact_phone`, and a dish with an unknown course is refused by a CHECK on PGlite;
- a booking with five tables is refused by the count trigger at the end of the transaction;
- `insertBooking` then `selectBooking` and `bookingFromRows` give back the same booking, on PGlite.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | Valibot schemas for the definitions, with each rule as a named action | The failures of each check are the same as in 0.2; the Gherkin steps and gate 3 pass |
| 2 | The compiler checks arguments with the schemas | The tests of rule-argument pass |
| 3 | Embedded objects as columns | The CHECKs of their rules refuse rows on PGlite |
| 4 | Lists as child tables, with UNIQUE and the count triggers | The CHECKs, UNIQUE and the counts refuse rows on PGlite |
| 5 | The store file | A value written and read back is the same value, on PGlite, for each table of the domains |
| 6 | The domains, the contracts and the docs | Each compiles, verifies and passes its scenarios; the docs build |

## Sabotages at the end

Each must turn CI red:

1. Remove the action of a rule from a schema → the failure of a scenario that breaks the rule.
2. Drop a CHECK of a child table → the PGlite test of that rule.
3. Make `bookingFromRows` skip a list → the round-trip test.
4. Edit a generated schema by hand → gate 4.

## Risks

- **Valibot's issues and the failures of 0.2.** Valibot reports a missing key and a wrong type in its own words. The generated code maps them to `required`, `type` and `properties`, and a test checks each.
- **Wide tables.** An embedded object adds a column for each of its properties. That is the cost of a CHECK on each of them.
- **An object with no required property.** When each of its columns is absent, the object reads back as absent, not as an empty object. The docs say so.
