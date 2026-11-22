# urn-forge states plan

Nov 22, 2026 · @Shadow Smith

The first score of the [contract corpus](./corpus-plan.md) is 26 of 143 promises (18.2%). The two holes with the most promises are A2 (19) and C3 (16). A2 is three different gaps under one name: postconditions, rules against the stored state, and named refusals for a rejected input. No one construct moves most of it. C3 is one construct. In six of the six contracts, a record has states, a closed set of moves between them, and final states, and a call that asks for a move that is not allowed gets a named refusal:

> A booking is always in exactly one of the states CONFIRMED, SEATED, COMPLETED, CANCELLED or NO_SHOW, and the only allowed moves are CONFIRMED to SEATED, CANCELLED or NO_SHOW, and SEATED to COMPLETED; CANCELLED, COMPLETED and NO_SHOW are final. (bookings.P13)

> Only an authorized payment that has not been captured can be voided, and only a captured or partially refunded payment can be refunded. (payments.P14)

Today a manifest can declare the states, as an `enum` field. It cannot declare the moves, and an operation cannot say which states it starts from, because the core gets only the request. Each corpus core fakes the stored record. This plan gives an operation the record that it changes, and the manifest the moves.

## What changes for a user

```yaml
booking.field.state:
  primitive: enum
  values: [confirmed, seated, completed, cancelled, no_show]
  moves:                       # the only allowed moves; a state with no moves out is final
    confirmed: [seated, cancelled, no_show]
    seated: [completed]
  description: The state of a booking

booking.operation.seat_booking:
  description: Staff seat the party of a booking
  input: booking.entity.booking_ref
  output: booking.entity.booking
  changes:                     # the stored record that this call changes
    entity: booking.entity.booking
    from: [confirmed]
    to: seated
    otherwise: booking.error.invalid_state
  errors: [booking.error.booking_not_found, booking.error.invalid_state]
```

```ts
// The handler gets the record as it is now, parsed and branded, after the request.
'urn:corpus:bookings:booking:operation:seat_booking': (input, current) => ok({ ...current, state: 'seated' }),

// The shell loads the record and passes it.
const current = await loadBooking(db, body.reference);
const result = executeOperation(SEAT_BOOKING, body, core, { current });
```

```gherkin
@urn:corpus:bookings:booking:operation:seat_booking
Scenario: A cancelled booking cannot be seated
  Given the current booking is:
    | reference | state     | … |
    | K7M2P9QX  | cancelled | … |
  When I run the operation with:
    | reference |
    | K7M2P9QX  |
  Then the operation fails with "urn:corpus:bookings:booking:error:invalid_state"
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where the moves are | **On the `enum` field: `moves`, from each state to the states it can reach.** A state with no moves out is final | The moves are a property of the states, not of one operation. Each entity that uses the field gets the same machine |
| 2 | How an operation states its move | **`changes: { entity, from, to, otherwise }`.** `from` is the list of states it starts from, `to` the state it ends in, `otherwise` the declared error for any other state | One block holds the whole promise: "only from these states, to this state, else this refusal" |
| 3 | Which field is the state | **The one field of the entity that has `moves`.** An entity with two such fields is a compile error in this plan | Each contract of the corpus has one state for each record |
| 4 | Where the record comes from | **The shell loads it and passes it: `executeOperation(urn, body, core, { current })`.** The handler gets it as its second parameter | The core stays pure. The record that the shell stored passed the contract once; the runtime parses it again, and a stored value that does not parse is a `ContractViolation` |
| 5 | Who refuses a wrong state | **The runtime, before the handler runs.** It fills the fields of the `otherwise` error from the current record and the request, by property name. A required field of the error that neither has is a compile error | The refusal is contract, not logic. The handler of `seat_booking` never sees a cancelled booking |
| 6 | The answer | **If the output is the changed entity, its state must be `to` and its key must not change,** or the result is a `ContractViolation` | "Seated" in the manifest means seated in the answer |
| 7 | Every move, not only the declared ones | **Compile error if a `from` → `to` of an operation is not in `moves`** | The two parts of the manifest cannot disagree |
| 8 | Gate 3 | **A new step, `Given the current <entity> is:`. Strict coverage needs a scenario for each `from` state, and one with a state outside `from` that expects `otherwise`** | The same rule as boundary coverage: the edges of the promise must be shown |
| 9 | SQL | **The store file gets `replace<Brand>From(value, from)`: its `DELETE` has `AND "state" = ANY($2)`. The shell checks that it deleted one row.** No trigger | Two calls that move the same record at once cannot both win. A trigger cannot see the move, because `replace` deletes and inserts |
| 10 | `diff` | **A new move or a new `from` state: compatible. A removed move, a removed `from` state or a changed `to`: breaking** | A caller that made the move can no longer; a reader that expected the state gets another |
| 11 | Scope of the record | **Only the record that the call changes.** Reads of other records stay in the shell | One record covers the corpus promises. More is a query language |

## Scope

- **In scope:** `moves` on an `enum` field, `changes` on an operation, the current record in the runtime and the handler type, the refusal of a wrong state, the check of the answer, the Gherkin step and coverage, `replace<Brand>From`, `diff`, the six corpus contracts, and the docs.
- **Out of scope:**
  - A move that happens after a time, with no request ("expires after 7 days", hole E3).
  - Fields that cannot change in some states ("once a claim leaves DRAFT its lines cannot be changed", claims.P11).
  - "Exactly one event for each move".
  - Who may make a move (hole D2).

## The promises that this plan moves

| Promise | Now | After |
| --- | --- | --- |
| bookings.P13: states, moves, final states | workaround | declared |
| claims.P10: states and moves | workaround | declared |
| inventory.P14: states, moves, final states | workaround | declared |
| payments.P13: moves; any other move refused as `invalid_state` | workaround | declared |
| payments.P14: only an authorized payment can be voided, only a captured one refunded | not declarable | declared |
| subscriptions.P13: a canceled or expired subscription never moves; a change is refused | workaround | declared |
| subscriptions.P16: invoice states; paid and void are final | workaround | declared |
| ticketing.P12: ticket moves; three final states | workaround | declared |

These 8 promises take the score from 26 to 34 of 143 (23.8%). Six promises keep their hole for a part that is still missing:
- **The current time (E2):** bookings.P14 and subscriptions.P12.
- **Frozen fields:** claims.P11.
- **Seats no longer held (C1):** ticketing.P11.
- **Events:** claims.P20.
- **An entry answer that is given only one time:** ticketing.P18.

Their comments get the new part that is declared.

## The target, written first

Step 0 changes the bookings contract to the target: `moves` on `booking.field.state`, `changes` on each operation that moves a booking, a core that reads `current` instead of faking it, and `Given the current booking is:` scenarios. It also adds `tests/states.test.ts`. That test compiles the contract, runs `seat_booking` on a cancelled booking, and expects `invalid_state` from the runtime, without the handler. Both fail until step 3.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target: bookings with states, and `tests/states.test.ts` | Both fail for the reason expected |
| 1 | `moves` and `changes` in the manifest and the IR | Compile errors for: an unknown state in `moves`, an entity with two state fields, a `changes` entity with no state field, a `from` → `to` that is not a move, an `otherwise` that the operation does not declare, and an error field that cannot be filled. One fixture for each |
| 2 | The runtime and the handler type | `executeOperation` takes `{ current }`, refuses a wrong state with `otherwise`, and checks the answer. The handler type has `current`. Gate 1 refuses a handler that ignores the type |
| 3 | Gherkin | The `Given the current <entity> is:` step, and gate 3 coverage of each `from` state and of `otherwise`. The bookings target passes |
| 4 | SQL | `replace<Brand>From`, with a PGlite test: the second of two moves of one record deletes 0 rows |
| 5 | `diff` | One `tests/diff/` pair for each rule of decision 10 |
| 6 | The corpus | The other five contracts use `moves` and `changes`. The eight promises are declared. The minimum is raised to the new score |
| 7 | Docs | A how-to guide, "Declare states and moves". The manifest, gates, Gherkin, generated code and Postgres reference pages. `the-contract` explanation: C3 leaves the holes |

## Sabotages at the end

Each must turn CI red:

1. Remove a move from `moves` that an operation uses → compile error.
2. Make a handler return `state: 'completed'` from `seat_booking` → `ContractViolation`, and the scenario fails.
3. Remove the scenario that expects `invalid_state` → gate 3 fails (`uncovered-state`).
4. Remove `confirmed` from the `from` of `cancel_booking` in a new manifest → `diff` reports a breaking change.
5. Run two `replace<Brand>From` moves of one booking in one PGlite database → the second deletes 0 rows.

## Done

- The 8 promises are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs have a how-to guide for states, and the reference pages state each rule.

## Risks

- **A second parameter for each handler that changes a record.** The handler of an operation without `changes` keeps one parameter, so no existing core changes.
- **The shell loads the wrong record.** The runtime cannot know that `current` is the record that the request names. The docs say so, and the scenario step sets it explicitly. A rule that ties the key of `current` to a field of the request is a small addition. Decision 6 already ties the key of the answer to the key of `current`.
- **One record is not enough.** Some promises need two records (claims.P15: "the payment equals the approved total"). Decision 11 keeps them out. The corpus shows whether they come next.
