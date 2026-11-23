# Keep values unique

Some promises are about all the stored records: "at most one live subscription for each customer and plan", "a reference is never used for another booking". The core sees one call, so it cannot keep them. The database can. This guide states the rule in the manifest. urn-forge then writes the index, and gives the declared refusal when a call clashes.

The examples come from [`packages/urn-forge/tests/fixtures/uniqueness/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/uniqueness/).

## Before you start

- The entity is a table of the Postgres extra. Refer to [Store entities in Postgres](store-in-postgres).
- The shell writes each call with `commit`. Refer to [Declare what a refusal carries](declare-refusals#_3-write-nothing-for-a-refusal).

## 1. Declare the unique values

Add `unique` to the entity: a list of entries.

```yaml
subscription.entity.subscription:
  description: A subscription of a customer to a plan
  key: subscription.field.subscription_id
  fields:
    - ref: subscription.field.subscription_id
    - ref: subscription.field.customer_id
    - ref: subscription.field.plan_id
    - ref: subscription.field.status
  unique:
    - by: [customer_id, plan_id]
      when: status = 'active'
      otherwise: subscription.error.conflict
    - by: [subscription_id]
      forever: true
```

| Key | Value |
| --- | --- |
| `by` | The properties whose values no two stored records share. Each is a field or a link of the entity, with one value |
| `when` | Optional. A rule over the record: only the records where it holds take part. Here, a canceled subscription does not keep the plan |
| `otherwise` | Optional. The declared error of a clash. The store fills it by name from the answer |
| `forever` | Optional. `true`: a value is never used by another record, also after the first record is gone. Not with `when` or `otherwise` |

A wrong entry stops `compile`:

```text
urn:demo:unique:subscription:entity:subscription: unique.0: by: "plan" is not a property of the entity (properties: subscription_id, customer_id, plan_id, status)
```

## 2. Read the SQL

For each entry, the schema has a unique index, partial for `when`:

```sql
CREATE UNIQUE INDEX "subscription_customer_id_plan_id_unique" ON "subscription"."subscription" ("customer_id", "plan_id") WHERE "status" = 'active';
```

For a `forever` entry, the schema has a table of used values. No statement deletes its rows:

```sql
CREATE TABLE "used"."subscription" (
  "by" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  CONSTRAINT "subscription_used" PRIMARY KEY ("by", "value", "owner"),
  CONSTRAINT "subscription_once" UNIQUE ("by", "value")
);
```

- `insert<Entity>` claims each value. A value that a record used before is refused, also if that record is gone.
- `replace<Entity>` can write the values of its own record again.
- The database refuses a clash also between two calls at the same time: the second transaction fails.

## 3. Write each call with commitOnce

The store file has `commitOnce`. It runs the statements of `commit` in a savepoint, in the transaction of the call:

```ts
await db.transaction(async (tx) => {
  const query = (s: Statement) => tx.query(s.text, s.values);
  const result = await commitOnce(query, executeOperation(urn, body, core, { now }), (output) => insertSubscriptionSubscription(output));
  // result: the success, or the declared refusal of a clash.
});
```

| The statements | The result |
| --- | --- |
| Written with no clash | The success |
| A clash with an entry that has `otherwise` | The declared error, filled by name from the answer. The savepoint is rolled back, so the call writes nothing |
| Any other error of the database, also a clash with a `forever` value | Thrown as it is |

For a second live subscription of a customer to a plan, the result is:

```json
{
  "ok": false,
  "kind": "DomainError",
  "urn": "urn:demo:unique:subscription:operation:create_subscription",
  "error": {
    "urn": "urn:demo:unique:subscription:error:conflict",
    "category": "conflict",
    "retryable": false,
    "message": "Customer cus_0001 already has plan pln_gold",
    "fields": {
      "kind": "urn:demo:unique:subscription:error:conflict",
      "customer_id": "cus_0001",
      "plan_id": "pln_gold"
    }
  }
}
```

The operation must declare the error in `errors`. If it does not, `commitOnce` throws the error of the database.

## 4. Write the scenarios

1. In `features/support/steps.ts`, give the steps the unique values of the runtime:

   ```ts
   import { DispatchMap, executeOperation, refusalOf, UniqueContract } from '../../src/generated/domain.runtime.generated';

   registerOperationSteps({
     dispatch: DispatchMap,
     execute: (urn, payload, options) => executeOperation(urn, payload, core, options),
     unique: { contract: UniqueContract, refusalOf },
   });
   ```

2. Give the stored records with `Given these <entity> records are stored:`. After a success, the steps check the answer against them as the indexes do, and give a clash with `otherwise` as `commitOnce` gives it:

   ```gherkin
   @urn:demo:unique:subscription:operation:create_subscription
   Scenario: A customer cannot take a plan twice
     Given these subscription records are stored:
       | subscription_id | customer_id | plan_id  | status |
       | sub_00000001    | cus_0001    | pln_gold | active |
     When I run the operation with:
       | subscription_id | customer_id | plan_id  |
       | sub_00000002    | cus_0001    | pln_gold |
     Then the operation fails with "urn:demo:unique:subscription:error:conflict"
   ```

Gate 3 reports an entry with `otherwise` that no scenario makes clash as `uncovered-unique`:

```text
urn:demo:unique:subscription:entity:subscription refuses a second record with the same customer_id, plan_id where status = 'active' with urn:demo:unique:subscription:error:conflict, and no scenario shows it; add one with Given these subscription records are stored: and Then the operation fails with "urn:demo:unique:subscription:error:conflict"
```

## Result

- The manifest states which values are unique, among which records, and for how long.
- The database refuses a clash, also between two calls at the same time, and `commitOnce` gives the declared refusal.
- `urn-forge diff` reports a new, changed or removed `unique` entry as breaking. Rows already stored may clash with a new entry: clean them before you create its index.

## Related pages

- [The manifest](../reference/manifest)
- [The Postgres schema](../reference/postgres-schema)
- [Gherkin steps](../reference/gherkin-steps)
