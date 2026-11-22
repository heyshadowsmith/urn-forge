# Declare states and moves

A record often has states, and only some moves between them: a booking is confirmed, then seated, then completed, and a cancelled booking never changes again. This guide declares the states and the moves, and makes an operation change a record only from the states that you allow. urn-forge then refuses a wrong state before your handler runs.

The examples come from [`packages/urn-forge/tests/fixtures/states/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/states/).

## Before you start

- You have an entity that the shell stores, with an `enum` field that holds its state.
- You have a declared error for a state that does not allow the change. Refer to [Declare an error](declare-an-error).

## 1. Declare the moves on the state field

Add `moves` to the `enum` field. For each state, list the states that it can move to. A state with no moves out is final.

```yaml
booking.field.state:
  primitive: enum
  values: [confirmed, seated, completed, cancelled]
  moves:
    confirmed: [seated, cancelled]
    seated: [completed]
  description: The state of a booking
```

Here `completed` and `cancelled` are final.

## 2. Say which record an operation changes

Add `changes` to the operation:

| Key | Value |
| --- | --- |
| `entity` | The entity of the record. It has exactly one field with `moves`, required and not a list |
| `from` | The states that the operation starts from |
| `to` | The state of the record after the operation, or a list of states when it depends on the request. Leave it out when the state stays |
| `otherwise` | The declared error for each other state. It must be in `errors` |
| `missing` | Optional. The declared error when the shell finds no record, for example `not_found`. It must be in `errors`, and the input must have each of its required fields |

```yaml
booking.operation.seat_booking:
  description: Seat the party of a booking
  input: booking.entity.booking_ref
  output: booking.entity.booking
  changes:
    entity: booking.entity.booking
    from: [confirmed]
    to: seated
    otherwise: booking.error.invalid_state
  errors: [booking.error.invalid_state]
```

urn-forge fills the fields of the `otherwise` error from the record and the request, by property name. Thus each required field of the error must be a property of the entity or of the input. Here `invalid_state` has `reference` and `state`, which the booking has.

Each state of `from` must reach a state of `to` by a move, or be that state: staying in a state is not a move. If a state cannot, `compile` stops:

```text
domain.manifest.yaml:96:9  error  invalid-changes  urn:demo:states:booking:operation:cancel_booking: changes: confirmed cannot move to cancelled: urn:demo:states:booking:field:state has no such move
```

When the end state depends on the request, list each one. A seated party completes, and a confirmed booking that closes is cancelled:

```yaml
booking.operation.close_booking:
  description: Close a booking, which ends completed or cancelled
  input: booking.entity.booking_ref
  output: booking.entity.booking
  changes:
    entity: booking.entity.booking
    from: [confirmed, seated]
    to: [completed, cancelled]
    otherwise: booking.error.invalid_state
  errors: [booking.error.invalid_state]
```

## 3. Use the record in the handler

The handler gets a second parameter, `current`: the record as the shell stored it, parsed and branded. The handler runs only when the state of `current` is in `from`.

```ts
export const core = {
  'urn:demo:states:booking:operation:seat_booking': (_input, current) => ok({ ...current, state: 'seated' }),
  // …
} satisfies DomainCoreImplementation;
```

When the output has the state field of the record, `executeOperation` examines the answer. Its state must be in `to`, reached from the state of the record by a move or the same state, or stay the same without `to`. When the output has the key field, the key must not change. The output can be the entity or a smaller shape. Else the result is a `ContractViolation`:

```text
the handler for urn:demo:states:booking:operation:seat_booking answered state "completed", but the operation moves to "seated"
```

## 4. Pass the record from the shell

The shell loads the record, and passes it to `executeOperation`:

```ts
const current = await loadBooking(db, body.reference);
const result = executeOperation('urn:demo:states:booking:operation:seat_booking', body, core, { current });
```

- If the state of the record is not in `from`, the result is the declared `otherwise` error, and the handler does not run.
- If the shell finds no record, it passes `{ current: null }`. The result is the declared `missing` error, filled from the request, and the handler does not run. Without `missing`, it is a `ContractViolation`.
- If the shell passes no record, or a record that does not parse, the result is a `ContractViolation` on `current`.
- `executeOperation` cannot know that the record is the one that the request names. The shell must load the correct record.

To store the changed record, use `replace<Entity>From` of the [Postgres extra](store-in-postgres). It deletes the old row only while it is in one of the `from` states. Check that it deleted one row, and roll back if not: a second call moved the record first.

## 5. Write the scenarios

1. In `features/support/steps.ts`, pass the options to `executeOperation`:

   ```ts
   registerOperationSteps({
     dispatch: DispatchMap,
     execute: (urn, payload, options) => executeOperation(urn, payload, core, options),
   });
   ```

2. Give the record with `Given the current <entity> is:` before the operation runs. The word is the identifier of the entity, for example `booking`. For a scenario where the shell finds no record, write `Given there is no current <entity>`, and expect the `missing` error.
3. Write a scenario for each state in `from`, and one for a state outside `from` that expects the `otherwise` error:

```gherkin
@urn:demo:states:booking:operation:seat_booking
Scenario: A cancelled booking cannot be seated
  Given the current booking is:
    | reference | state     | party_size |
    | KMPQXRTA  | cancelled | 4          |
  When I run the operation with:
    | reference |
    | KMPQXRTA  |
  Then the operation fails with "urn:demo:states:booking:error:invalid_state"
```

Gate 3 reports a missing scenario as `uncovered-state`, with the coverage mode of boundaries:

```text
urn:demo:states:booking:operation:seat_booking starts from state "confirmed", which no scenario gives; add one with Given the current booking is: and state confirmed
```

## Result

- The manifest states the states, the moves and the final states of the record.
- An operation changes a record only from the states in `from`. Each other state gets the declared error, with no code in the handler.
- `urn-forge diff` reports a removed move, a removed `from` state or a changed `to` as breaking. Refer to [Change the contract](change-the-contract).

## Related pages

- [The manifest](../reference/manifest)
- [The generated code](../reference/generated-code)
- [Gherkin steps](../reference/gherkin-steps)
