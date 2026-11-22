# urn-forge refusals plan

Nov 22, 2026 · @Shadow Smith

After [compatibility](./compatibility-plan.md), the corpus is at 73 of 143 promises (51.0%). A2, "request and answer", is the largest hole, with 14 promises. They are not one construct. Each promise needs one or more of these:

| Group | What the promise needs | Promises |
| --- | --- | --- |
| 1. A refusal | "A refusal changes nothing"; a rejected input answers with a named code; a rule on what a refusal carries | claims.P13, inventory.P08, ticketing.P08, ticketing.P09, bookings.P12, subscriptions.P09 |
| 2. Several events in one success | One event for each item of a list, such as a TicketIssued for each ticket | inventory.P20, ticketing.P19 |
| 3. Rules on many stored records | "The refund is at most the amount paid for the tickets", "the new on-hand is the previous on-hand plus the received quantity" for each line | inventory.P11, inventory.P12, inventory.P22, ticketing.P16 |
| 4. The transport | The status code 201, the request id, rate limits | subscriptions.P08, part of subscriptions.P09 |

This plan is group 1: what a refusal is, and what it carries. Group 2 is a smaller plan of its own, close to [event delivery](./event-delivery-plan.md). Group 3 needs records other than the one that `changes` loads, which is close to C1. Group 4 is the shell's.

## What a refusal is today

- `executeOperation` answers one of four kinds:
  - a success;
  - `DomainError`: a declared error, from the core, a `requires` rule, `callers` or `changes`;
  - `InputRejected`: the input did not parse, with the issues;
  - `ContractViolation`: a bug.
- **The core cannot change anything.** It is pure. A refusal has no output and no events. But the shell writes the record and the events, and nothing states that it writes nothing for a refusal. Five promises say "a refused request changes nothing", "a refused hold holds nothing" or "no ticket is issued".
- **`InputRejected` has no name.** The promises call it `INVALID_REQUEST` or `invalid_request`, a code beside the declared ones, with a message.
- **No rule reads what a refusal carries.** The core fills a declared error. `requires` fills it from the input. Nothing checks a rule on the payload of an error that the core gives, such as "each alternative time is on the requested date".

## What changes for a user

```yaml
booking.operation.create_booking:
  # A request that does not parse answers request.error.invalid_request, with the issues.
  rejects: request.error.invalid_request
  refuses:
    - error: booking.error.no_availability
      ensures:
        - all(alt in error.alternatives: date(alt.starts_at) = input.date)
        - all(alt in error.alternatives: alt.party_size = input.party_size)
```

```ts
await db.transaction(async (tx) => {
  const result = executeOperation(urn, body, core, { current, now, newEventId });
  for (const s of commit(result, { from: ['PENDING'] })) await query(tx, s);
});
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | "A refusal changes nothing" | **A generated `commit(result)` in the store file: the statements of a result, the record of `changes` and the events of the outbox, in one list. For a refusal, the list is empty.** The docs put it in the transaction of the call. The runtime's types already give a refusal no output and no events | The writes of a call then come from one place, and a refusal has none. It is the same pattern as `runOnce`: urn-forge writes the code, and the shell calls it |
| 2 | Gherkin | **`Then nothing changes`: the scenario's refusal has no events, and `commit` gives no statement.** Gate 3 asks for it on a scenario of each declared error of an operation with `changes` | It shows the promise in a scenario |
| 3 | A rejected input as a declared error | **`rejects: <error>` on an operation: an input that does not parse answers that declared error, as a `DomainError`, with the issues as the property `issues`. The error must have no required field.** It can also go in the header, for every operation | The promises name the code. One error for every rejection keeps the set of answers closed: "exactly one of the codes" |
| 4 | Rules on a refusal | **`refuses: [{ error, ensures }]` on an operation: rules that the payload of that error keeps when the core gives it. They read `input.`, `current.`, the time, and `error.`.** A broken rule is a `ContractViolation`, as for `ensures` | The same check as `ensures`, on the other answer |
| 5 | Lists in those rules | **`all(x in list: rule)` and `any(x in list: rule)`, in every rule, next to `sum`.** No other new function | Bookings P12, inventory P08 and ticketing P08 state a rule for each item of a list. They also help A1 |
| 6 | Dates of a time | **`date(t)`: the UTC date of a timestamp.** No other part of a time | Bookings P12 needs "on the same date". A date in another zone is D3 |
| 7 | `diff` | **A new `rejects` or `refuses` rule: breaking (callers get another answer, or less). A removed one: compatible. `commit` is not in the manifest** | The same as `ensures` |

## Scope

- **In scope:**
  - `commit` in the store file of the Postgres extra.
  - `Then nothing changes`, and gate 3.
  - `rejects`.
  - `refuses`, with `error.` in rules.
  - `all`, `any` and `date` in the rule language: the runtime, the SQL of the Postgres extra where a rule goes there, and `diff`.
  - The corpus promises below, and the docs.
- **Out of scope:**
  - Groups 2, 3 and 4.
  - The name of a code on the wire, such as `NOT_FOUND`. The URN is the code, and the shell maps it.

## The promises that this plan can move

| Promise | Now | After |
| --- | --- | --- |
| ticketing.P09 | workaround | declared: `commit` and `Then nothing changes`, for "no ticket is issued" |
| claims.P13 | workaround | declared, if the codes as URNs pass the strict test: `rejects` for INVALID_REQUEST, and `commit` |
| bookings.P12 | workaround | declared: `refuses` with `all` and `date` |
| inventory.P08 | workaround | to check: `refuses` with `all(s in error.lines: any(l in input.lines: …))`, and `commit` |
| ticketing.P08 | workaround | to check: "every requested seat that cannot be held" needs the stored seats (group 3) |
| subscriptions.P09 | workaround | stays a workaround: the request id and rate limits are the shell's (group 4) |

If each passes the strict test, 3 to 4 promises take the score from 73 to 76–77 of 143 (53.1–53.8%). The contract builders apply the same strict test as before.

## The target, written first

Step 0 adds `tests/fixtures/refusals`, with:

- a booking that `rejects` with `invalid_request`;
- a `no_availability` refusal whose alternatives keep `refuses` rules with `all` and `date`;
- an operation with `changes`, for `commit`.

It also adds `tests/refusals.test.ts`, which shows that:

- a rejected input answers the declared error with its issues;
- an alternative on another date is a `ContractViolation`;
- `commit` gives the record and the events of a success, and nothing for a refusal, on PGlite.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `all`, `any` and `date` in the rule language | Parse, type, print, the runtime, and SQL or `unenforced-in-sql` |
| 2 | `rejects` | `invalid-rejects` for an error with a required field, or not in `errors`; the runtime answers it |
| 3 | `refuses` | `invalid-refuses` for an error not in `errors`, or a rule that reads `output.`; the runtime checks it |
| 4 | `commit` and `Then nothing changes` | The store file; the step; gate 3 `uncovered-refusal` |
| 5 | `diff` | One `tests/diff` case for each rule of decision 7 |
| 6 | The corpus | The contracts; the minimum is the new score |
| 7 | Docs | A how-to guide, "Declare what a refusal carries"; the manifest, rule language, Postgres, Gherkin and diagnostics pages |

## Sabotages at the end

Each must turn CI red:

1. Make the bookings core answer an alternative on the next day → its scenario fails with a `ContractViolation`.
2. Make `commit` give the events of a refusal → the PGlite test and `Then nothing changes` fail.
3. Remove `rejects` from claims → its scenario of an invalid request fails.
4. Write `all(x in input.party_size: …)` on an integer → `compile` stops with `rule-type`.
5. Add a `refuses` rule in a new manifest → `diff` reports a breaking change.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say that the shell writes only what `commit` gives, in the transaction of the call.

## Risks

- **A shell that writes without `commit`.** urn-forge cannot know. The docs put `commit` in the shell, as for `runOnce`.
- **`all` and `any` make the rule language larger.** They are the quantifiers that the roadmap lists for A1 (decision 8 of the roadmap). No user function is added.
- **SQL for `all` and `any`.** A rule with them on a stored list needs a subquery on a child table. Where the Postgres extra cannot write it, it reports `unenforced-in-sql`, as it does today.
