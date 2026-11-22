# urn-forge time plan

Nov 22, 2026 · @Shadow Smith

After [callers](./callers-plan.md), the corpus is at 57 of 143 promises (39.9%). E2, "the current time", has 10 promises. They are one rule with different numbers: **a request is allowed only before or after a time that depends on now.**

| Example | Promise |
| --- | --- |
| "A refund can be requested at most 180 days after the payment was captured" | payments.P18 |
| "Refused with HOLD_EXPIRED if received after the hold's expiry time" | ticketing.P09 |
| "Refunds are accepted only until 48 hours before the event's start time, and transfers only until 2 hours before" | ticketing.P23 |
| "An explicit trial end must be in the future" | subscriptions.P06 |
| "A resume date that is at least 1 day and at most 90 days after the request" | subscriptions.P12 |
| "No earlier than 2 hours and no later than 90 days before its start time" | bookings.P07 |
| "Only while the booking is CONFIRMED and at least 2 hours before its start time" | bookings.P14 |
| "A cancellation made 24 hours or more before the start time refunds the full deposit" | bookings.P15 |
| "Only from 15 minutes after its start time onward" | bookings.P16 |
| "The time of the change" in each event | payments.P20 |

Today a pure core cannot know the time, so each contract either sends "today" in the request (subscriptions `requested_on`) or keeps the rule in the core with a fixed clock. The rule language has date arithmetic in days, but a `timestamp` has none.

## What changes for a user

```yaml
payment.operation.refund_payment:
  changes: { entity: payment.entity.payment, from: [captured, partially_refunded], otherwise: payment.error.invalid_state }
  requires:
    - rule: now <= current.captured_at + 180 days
      otherwise: payment.error.refund_window_closed

hold.operation.check_out:
  requires:
    - rule: now < current.expires_at
      otherwise: hold.error.hold_expired

subscription.operation.pause_subscription:
  requires:
    - rule: input.resume_on is absent or input.resume_on >= today + 1 and input.resume_on <= today + 90
      otherwise: subscription.error.invalid_request

payment.operation.capture_payment:
  ensures:
    - event.occurred_at = now
```

```ts
const result = executeOperation(urn, body, core, { now: new Date().toISOString(), current, caller });
```

```gherkin
Given the time is "2026-11-22T18:00:00Z"
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where the time comes from | **The shell: `executeOperation(…, { now })`, a UTC timestamp. The core does not get it** | The core stays pure, and the scenarios fix the time, so a test gives the same result on each day. The shell owns the clock, as it owns ids and the caller |
| 2 | How a rule names it | **`now`, a `timestamp`, and `today`, the `date` of `now` in UTC.** In `requires`, `ensures`, `when` and `callers`; not in invariants | An invariant is a rule on a value alone, which a stored record must keep at any time. A rule with `now` belongs to one call |
| 3 | Arithmetic on time | **`t ± <n> minutes`, `hours` or `days` gives a `timestamp`; `<n>` is a number or an `integer` expression. `t1 - t2` is not in this plan**; compare `t1` with `t2 ± …` instead | The promises say "at least 2 hours before" and "at most 180 days after". A duration type would be a second kind of value for one form of rule |
| 4 | `today` and dates | **`today` is the UTC date of `now`, with the day arithmetic that dates have** | subscriptions.P06 and P12 compare dates. A zone other than UTC is D3 |
| 5 | A rule with `now` and no time | **A domain whose rules read `now` or `today` needs `now` in the options: without it, a `ContractViolation`** | As with `caller`: a shell without a clock has a bug |
| 6 | "The time of the change" | **`ensures: event.occurred_at = now`, and `output.x = now`** | The core cannot know `now`, so the shell gives it to the core too: the handler gets `now` as a third parameter, only in an operation whose rules read it. Without that, the core cannot make an answer that keeps the rule |
| 7 | Gate 3 | **Each scenario of an operation whose rules read `now` gives the time with `Given the time is "<timestamp>"` (else `invalid-time`). The `otherwise` errors need scenarios, as today.** No coverage of both sides of each rule | The callers plan showed that coverage of each part of a rule needs the rule to be evaluated on each scenario. That is a plan of its own: the scenarios at the edge are the writer's, as for an invariant |
| 8 | `diff` | **The same rules as for `requires` and `ensures`.** A changed number is a changed rule: breaking | No new relation |
| 9 | SQL | **Not in the SQL.** No invariant can read `now` | A `CHECK` with `now()` would refuse rows that were valid when written |

## Scope

- **In scope:** `now` and `today`; `± minutes`, `hours`, `days` on a `timestamp`; `now` in the options and, where a rule reads it, for the handler; `Given the time is`; gate 3; the docs; the corpus promises below.
- **Out of scope:**
  - Time zones (D3): "the restaurant's local start time".
  - The time between two timestamps as a value.
  - Months and years.
  - Things that happen with no call, such as a hold that expires by itself (E3).

## The promises that this plan can move

| Promise | Now | After | How |
| --- | --- | --- | --- |
| payments.P18 | workaround | declared | `requires: now <= current.captured_at + 180 days` |
| ticketing.P09 | workaround | declared | `requires: now < current.expires_at`, with the other refusals of check-out as they are |
| subscriptions.P06 | workaround | declared | `requires: input.trial_end is absent or input.trial_end > today` |
| subscriptions.P12 | workaround | declared | `requires` with `today + 1` and `today + 90` |
| ticketing.P23 | workaround | to check | needs the start of the event on the record that refund and transfer read |
| bookings.P07, P14, P15, P16 | workaround | to check | the start is a local date and time in the restaurant's zone (D3). They move only if a stored UTC start is a faithful reading |
| payments.P20 | workaround | workaround | `event.occurred_at = now` states the time, but some moves have no operation (E3) |

If each one passes the strict test, these 4 to 9 promises take the score from 57 to 61–66 of 143 (42.7–46.2%). The contract builders apply the same strict test as before.

## The target, written first

Step 0 adds `tests/fixtures/time`: a payment refund with a 180-day window, a hold that expires, a pause with a resume date, and a capture whose event carries `now`. It also adds `tests/time.test.ts`, which runs the generated runtime at fixed times on each side of each rule.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `now`, `today` and the units in the rule language | The parser, the printer and the type checker. `now` in an invariant, `t + 2` on a `timestamp`, or `hours` on a `date` is a `rule-type` error with a clear message |
| 2 | The generated code | Exact arithmetic on UTC instants in the condition functions; `now` in the options; the handler's third parameter where a rule reads `now`. Every other domain's output is the same |
| 3 | Gherkin and gate 3 | `Given the time is`; `invalid-time` |
| 4 | The corpus | The four contracts; the minimum is the new score |
| 5 | Docs | The rule language, the manifest, generated code, Gherkin and diagnostics pages; "Declare preconditions and postconditions" shows a window of time |

## Sabotages at the end

Each must turn CI red:

1. Change `+ 180 days` to `+ 181 days` with no change to the scenarios → the scenario on day 181 fails.
2. Make the payments steps pass no `now` → a `ContractViolation`, and the scenarios fail.
3. Write `now` in an invariant → `compile` stops.
4. Write `current.captured_at + 2` → `compile` stops with `rule-type`.
5. Make the payments core put a fixed time in an event → a `ContractViolation` that names `event.occurred_at = now`.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say that the shell owns the clock.

## Risks

- **A wrong clock in the shell.** urn-forge cannot know that `now` is the time. The docs put the clock in the shell, with its tests.
- **The edge of a window.** "At most 180 days" is `<=`, and "until 48 hours before" is `<`. The scenarios at the edge are the writer's (decision 7): sabotage 1 checks that the corpus has them.
- **Time zones.** Every time is UTC. A promise in a local zone stays a workaround until D3.
