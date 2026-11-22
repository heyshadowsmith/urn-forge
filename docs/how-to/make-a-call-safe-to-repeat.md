# Make a call safe to repeat

A caller that gets no answer sends the request again. Without care, the second request makes a second payment. This guide gives an operation an idempotency key: a repeat with the same key in a window returns the first answer, and changes nothing. urn-forge keeps the answers in Postgres and gives the function that the shell calls.

The examples come from [`packages/urn-forge/tests/fixtures/idempotency/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/idempotency/).

## Before you start

- The input of the operation has a text field for the key, such as `idempotency_key`.
- The config has the Postgres extra. It needs no table for this. Refer to [Store values in Postgres](store-in-postgres).
- For a key that each caller owns, the domain has a caller. Refer to [Declare who may call](declare-callers).

## 1. Declare the key

Add `idempotency` to the operation:

| Key | Value |
| --- | --- |
| `key` | A text property of the input, with its prefix: `input.idempotency_key`. A call without it runs as any call |
| `scope` | Optional. The values that own the key, from the caller or the input: `caller.merchant_id`. Two merchants can use one key |
| `window` | A time: `24 hours`. After it, the key is free |
| `otherwise` | Optional. The declared error for the same key with another body. Without it, the repeat gets the first answer |

```yaml
payment.operation.create_payment:
  description: Create a payment, once for each key of the merchant in 24 hours
  input: payment.entity.create_request
  output: payment.entity.payment
  idempotency:
    key: input.idempotency_key
    scope: caller.merchant_id
    window: 24 hours
    otherwise: payment.error.idempotency_conflict
  callers:
    allow: any
  emits: [payment.event.created]
  errors: [payment.error.idempotency_conflict]
```

A key that is not a text of the input stops `compile`:

```text
urn:demo:idempotency:payment:operation:create_payment: idempotency.key: "input.amount" is integer; the key is a text that the caller chooses
```

## 2. Call runOnce in the shell

The schema has the table `"idempotency"."<domain>"`, and the store file has `runOnce`. Call it in the transaction of the call, with the query function of your driver, and give it the call of `executeOperation` with the `repeat` that it passes:

```ts
await db.transaction(async (tx) => {
  const query = (s: Statement) => tx.query(s.text, s.values);
  const result = await runOnce(query, urn, body, { caller, now }, (repeat) => executeOperation(urn, body, core, { caller, now, newEventId, repeat }));
  if (result.ok && result.events.length > 0) for (const s of insertEvents(result.events)) await query(s);
});
```

What `runOnce` does:

| The call | The result |
| --- | --- |
| A key, owners and body that it has an answer for, in the window | The first answer, with no events. `executeOperation` gives it once the caller may call; the state and the handler do not run |
| The same key and owners with another body, in the window | The `otherwise` error, or the first answer when there is none, also once the caller may call |
| Any other call | `executeOperation` runs. A success is stored with the time `now`; a refusal is not |

- A caller that `callers` refuses gets its refusal, not the first answer: a key does not open a call to another caller.
- The body is the parsed input, as JSON with sorted properties. Two bodies that parse to one value are one body.
- The operation, the owners and the key are the primary key. A repeat that runs while the first call is in its transaction fails on it: roll back and retry, and the retry finds the first answer.
- The table keeps old answers. Delete the rows older than the window when you want.

## 3. Write the scenarios

1. In `features/support/steps.ts`, give the steps the helper of the runtime. The steps then keep the answers of a scenario with the rules of `runOnce`, and pass a repeat to `execute` as `repeat`:

   ```ts
   import { DispatchMap, executeOperation, idempotencyOf } from '../../src/generated/domain.runtime.generated';

   registerOperationSteps({
     dispatch: DispatchMap,
     execute: (urn, payload, options) => executeOperation(urn, payload, core, options),
     idempotency: { idempotencyOf },
   });
   ```

   To show the window, change the time between the two runs with `And the time is "<timestamp>"`.

2. Repeat the call with `When I run the operation again with:`, and check it with `Then the answer is the first answer`:

```gherkin
@urn:demo:idempotency:payment:operation:create_payment
Scenario: A repeat returns the first payment and creates no other
  Given the caller is:
    | merchant_id |
    | mer_abc123  |
  When I run the operation with:
    | idempotency_key | amount |
    | key-0001        | 500    |
  And I run the operation again with:
    | idempotency_key | amount |
    | key-0001        | 500    |
  Then the answer is the first answer
  And the operation emits no event
```

Gate 3 reports an operation with `idempotency` that no scenario repeats as `uncovered-idempotency`:

```text
urn:demo:idempotency:payment:operation:refund_payment returns the first answer to a repeat with the same idempotency_key, and no scenario repeats a call; add one with When I run the operation again with:
```

## Result

- The manifest states which calls are safe to repeat, who owns each key, and for how long.
- A repeat returns the first answer and changes nothing, with no code in the core.
- `urn-forge diff` reports a new `idempotency` or a longer window as compatible, and the rest as breaking. Refer to [Change the contract](change-the-contract).

## Related pages

- [The manifest](../reference/manifest)
- [The Postgres schema](../reference/postgres-schema)
- [Gherkin steps](../reference/gherkin-steps)
