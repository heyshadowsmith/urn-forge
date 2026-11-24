# Store objects in Postgres

Make a Postgres schema from the manifest: a table for each object that you name, a column for each property, and a `CHECK` constraint for each rule that SQL can state. urn-forge writes only the schema. It does not write code that reads or writes rows.

## Before you start

- Each object that becomes a table has an `identifier`. Refer to [Add an object or a list](add-an-object-or-a-list).

## Steps

1. Open `urn-forge.config.ts`.
2. Add `postgres`, with `tables`: the names of the objects that become tables.
3. If a property holds the identifier of another table, add it to `references`. The property must have the type of the identifier of that table.
4. If no two rows may share the values of some properties, add them to `unique`.
5. Run `npx urn-forge compile`. It writes `schema.generated.sql` next to `domain.generated.ts`.
6. Apply the schema with your migration tool.

## Example

The insurance domain of the repository stores customers and policies. Its config is `packages/urn-forge/insurance/urn-forge.config.ts`:

<<< @/../packages/urn-forge/insurance/urn-forge.config.ts{10-14}

`holder` is a property of `policy`. Its type is `customer_id`, the identifier of `customer`, so it can refer to the table `customer`. `compile` writes this schema:

<<< @/../packages/urn-forge/insurance/generated/schema.generated.sql{sql}

Examine these parts of the schema:

- The schema of Postgres has the name of the domain, `insurance`.
- A required property is `NOT NULL`. The identifier is the primary key.
- `holder` has the constraint `policy_holder_pattern`, from the rule of `customer_id`, its type.
- `coverages` is a list, so its column is `JSONB`. SQL does not check the rules inside it. The last comment lists them. The harness checks them before the core answers.

To make two properties unique together, use `unique`. Each entry is a list of properties:

```ts
postgres: {
  tables: ['booking'],
  unique: { booking: [['restaurant_ref', 'starts_at']] },
},
```

## What stays in the shell

- The shell reads a row, and puts it in the input as the stored record. Refer to [Model a stored record, the caller and the time](model-the-input).
- The shell writes the output to the table after `runOperation` gives `ok: true`.
- A foreign key, a unique value and a `CHECK` constraint are database facts. They are in the config, not in the manifest, so the manifest stays a contract of values and operations.

## Result

`schema.generated.sql` is in the output folder. Gate 4 compares it with a new compile, as it does for `domain.generated.ts`. If you remove `postgres` from the config, the next `compile` removes the file.

## Related pages

- [The Postgres schema](../reference/postgres-schema)
- [The configuration file](../reference/configuration)
- [Model a stored record, the caller and the time](model-the-input)
