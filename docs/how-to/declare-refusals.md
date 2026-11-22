# Declare what a refusal carries

A refusal is an answer too. Callers read its code, and some read what it carries, such as "the alternative times are on the requested day". This guide names the error of an input that does not parse, states rules on the payload of a refusal, and writes nothing for a refusal.

The examples come from [`packages/urn-forge/tests/fixtures/refusals/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/refusals/).

## Before you start

- The operation declares its errors. Refer to [Declare an error](declare-an-error).
- You know rules over the request: `input.`. Refer to [Declare preconditions and postconditions](declare-conditions).
- For step 3, the config has the Postgres extra. Refer to [Store entities in Postgres](store-in-postgres).

## 1. Name the error of an input that does not parse

An input that does not parse answers `InputRejected`, which has no name in the contract. To answer a declared error, add `rejects` to the operation:

```yaml
booking.error.invalid_request:
  description: The request does not parse
  category: validation
  retryable: false
  message: The request is not valid

booking.operation.create_booking:
  input: booking.entity.booking_request
  output: booking.entity.booking
  rejects: booking.error.invalid_request
  errors: [booking.error.invalid_request, booking.error.no_availability]
```

- The error must be in `errors`.
- The error has no required property: the runtime has only the issues of the input to fill it.

`executeOperation` then answers the error as a `DomainError`, with the issues:

```json
{
  "ok": false,
  "kind": "DomainError",
  "urn": "urn:demo:refusals:booking:operation:create_booking",
  "error": {
    "urn": "urn:demo:refusals:booking:error:invalid_request",
    "category": "validation",
    "retryable": false,
    "message": "The request is not valid",
    "fields": {
      "kind": "urn:demo:refusals:booking:error:invalid_request"
    }
  },
  "issues": [
    {
      "path": "party_size",
      "fieldUrn": "urn:demo:refusals:booking:field:party_size",
      "message": "Invalid value: Expected >=1 but received 0"
    }
  ]
}
```

An error with a required property stops `compile`:

```text
urn:demo:refusals:booking:operation:create_booking: rejects: urn:demo:refusals:booking:error:no_availability has the required properties date, which an input that does not parse cannot fill; make them optional
```

The steps `Then the input is rejected on "<field>"` and `Then the input is rejected by "<invariant URN>"` accept this answer. Thus your scenarios do not change.

## 2. State rules on the payload of a refusal

Add `refuses` to the operation: for a declared error, the rules that its payload keeps. A rule reads the request (`input.`), the record (`current.`, with `changes` or `reads`), the time (`now`, `today`), and the payload of the error (`error.`):

```yaml
booking.operation.create_booking:
  refuses:
    - error: booking.error.no_availability
      ensures:
        - 'all(alt in error.alternatives: date(alt.starts_at) = input.date)'
        - 'all(alt in error.alternatives: alt.party_size = input.party_size)'
```

- Put each rule in quotes. A rule with `: ` is not a string in YAML.
- `all(x in list: rule)` holds when the rule holds for each item; `any(…)` when it holds for one. `date(t)` is the date of a timestamp in UTC. Refer to [The rule language](../reference/rule-language#lists-and-embedded-entities).
- A rule of `refuses` cannot read `output.` or `event.`, which a refusal does not have:

  ```text
  urn:demo:refusals:booking:operation:create_booking: refuses.0.ensures.1: "output.party_size" reads the answer of a success, which a refusal does not have; read error.
  ```

The runtime checks the rules on each refusal with the error. A refusal that breaks one is a bug in the core, a `ContractViolation`:

```json
{
  "ok": false,
  "kind": "ContractViolation",
  "urn": "urn:demo:refusals:booking:operation:create_booking",
  "issues": [
    {
      "path": "",
      "message": "the handler for urn:demo:refusals:booking:operation:create_booking refused with urn:demo:refusals:booking:error:no_availability, whose payload breaks refuses: all(alt in error.alternatives: date(alt.starts_at) = input.date)"
    }
  ]
}
```

## 3. Write nothing for a refusal

The core cannot change anything: it is pure. The shell writes the record and the events. The store file of the Postgres extra has `commit`, which gives the statements of a call:

| The result | The statements |
| --- | --- |
| A refusal: a declared error or a rejected input | None |
| A success | The new record of an operation that changes a stored record and answers it, then the statements of `writes`, then the events of the outbox |

Run them in the transaction of the call, and write nothing else:

```ts
await db.transaction(async (tx) => {
  const result = executeOperation(urn, body, core, { current, now, newEventId });
  for (const statement of commit(result, (output) => [/* other writes of a success */])) await tx.query(statement.text, statement.values);
});
```

- `writes` runs only for a success. Thus the statements that you build in it are written only for a success.
- An operation whose output is not the record that it changes gives no record by itself: build it in `writes`.
- `commit` is in the store file of a domain with an operation that changes a stored record, or with an outbox.

## 4. Write the scenarios

1. In `features/support/steps.ts`, give the steps the `commit` of the store file:

   ```ts
   import { commit } from '../../src/generated/domain.store.generated';

   registerOperationSteps({
     dispatch: DispatchMap,
     execute: (urn, payload, options) => executeOperation(urn, payload, core, options),
     commit,
   });
   ```

2. After a refusal, write `Then nothing changes`. It checks that the call refused, and that `commit` gives no statement for it:

   ```gherkin
   @urn:demo:refusals:booking:operation:cancel_booking
   Scenario: A cancelled booking cannot be cancelled again, and nothing changes
     Given the current booking is:
       | booking_id   | status    | date       | starts_at            | party_size |
       | bkg_abcd1234 | CANCELLED | 2026-11-22 | 2026-11-22T19:00:00Z | 4          |
     When I run the operation with:
       | booking_id   |
       | bkg_abcd1234 |
     Then the operation fails with "urn:demo:refusals:booking:error:invalid_state"
     And nothing changes
   ```

   After a success, the step fails:

   ```text
   urn:demo:refusals:booking:operation:create_booking succeeded; expected it to refuse and change nothing
   ```

3. Write a scenario for each `refuses` rule, with values at its edges, for example the first and the last instant of the requested day.

## Result

- The manifest names the answer of an input that does not parse, and the rules that a refusal keeps.
- The runtime refuses a payload that breaks a rule, as a bug.
- A refusal gives no statement to write.
- `urn-forge diff` reports a new `refuses` rule as compatible, a removed one as breaking, and any change of `rejects` as breaking. Refer to [Change the contract](change-the-contract).

## Related pages

- [The manifest](../reference/manifest)
- [The rule language](../reference/rule-language)
- [The Postgres schema](../reference/postgres-schema)
- [Gherkin steps](../reference/gherkin-steps)
