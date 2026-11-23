# urn-forge UTC times plan

Nov 23, 2026 · @Shadow Smith

After [refusals](./refusals-plan.md), the corpus is at 74 of 143 promises (51.7%). D3, "time zones and calendar time", has 8 promises:

| Promise | What it needs | Zone data? |
| --- | --- | --- |
| bookings.P07 | A booking at least 2 hours and at most 90 days before its start | No, with a UTC start |
| bookings.P14 | A change or a cancel at least 2 hours before the start | No, with a UTC start |
| bookings.P15 | A full refund 24 hours or more before the start, else none | No, with a UTC start |
| bookings.P16 | NO_SHOW from 15 minutes after the start | No, with a UTC start |
| inventory.P17 | Timestamps with exactly 3 digits after the second | No |
| subscriptions.P23 | A monthly period that starts on a day that the next month lacks ends on that month's last day | No |
| bookings.P03 | The booking time is a local date and time in the restaurant's IANA zone | Yes |
| ticketing.P22 | Each event also states its start in its venue's IANA zone | Yes |

## The choice: UTC, and no zone data

The rules of a zone change by law, and Node and Postgres each carry their own copy of the zone data. A rule that converted a local time with either could give two verdicts for one commit; urn-forge gives one. Thus the contract keeps every instant in UTC, as today, and adds no zone data:

- A start is an instant, however a person writes it. Bookings states its start as `starts_at`, a UTC timestamp, and the four windows become rules over `now` that work today.
- The conversion from a local time to UTC is the client's, outside the contract.
- Bookings P03 and ticketing P22 promise local times in a zone. They stay workarounds. A later plan can add zones with Node's zone data and a check of its version, if these promises matter.

## What changes for a user

```yaml
item.field.received_at:
  primitive: timestamp
  precision: 3
  description: When the goods arrived, in UTC, with milliseconds

billing.operation.renew:
  ensures:
    - output.period_end = output.period_start + 1 months
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Local times | **None in the contract. Every instant is a UTC `timestamp`.** A contract can still carry a local date, time and zone as plain values, which no rule converts | One verdict for one commit, on every machine. No zone data to ship or keep current |
| 2 | Exact precision | **`precision: n` on a `timestamp`, 0 to 3: exactly `n` digits after the second.** Without it, 0 to 3 digits, as today | Inventory P17: "millisecond precision" |
| 3 | Calendar months | **`t + n months` and `t - n months` on a `timestamp`, and on a `date`, in UTC. A day that the target month lacks is that month's last day; the time of day stays** | Subscriptions P23. The same calendar rule as the `notice` of [compatibility](./compatibility-plan.md) |
| 4 | Months in SQL | **The same rule in SQL: Postgres's `+ INTERVAL 'n month'` on a `DATE`, or on a `TIMESTAMPTZ` at UTC, ends a short month on its last day** | It is the same calendar, with no zone, so the `CHECK` and the runtime agree |
| 5 | Bookings | **The contract builder moves the start of a booking to `starts_at` (UTC) in the request, the record and the answers, and keeps the local date, time and zone as the values that the guest gave.** The windows read `starts_at` | The windows are rules over the instant of the start. The local values are what P03 promises, and no rule ties them to `starts_at`: P03 stays a workaround |
| 6 | `diff` | **A new or larger `precision`: breaking for what callers send, and compatible for what they receive. A new months rule: as any rule** | The relation of the values, as for every constraint |

## Scope

- **In scope:**
  - `precision` on a `timestamp`: the manifest, Valibot, Postgres, `diff`.
  - `months` on a `timestamp` and a `date`: the rule language, the runtime, SQL.
  - The corpus promises below, and the docs.
- **Out of scope:**
  - Time zones, local times, and zone data. A later plan, if needed.
  - Leap seconds.

## The promises that this plan can move

| Promise | After |
| --- | --- |
| inventory.P17 | declared, with `precision: 3` on each timestamp |
| subscriptions.P23 | declared, if `period_end = period_start + 1 months` is stated where each period is made |
| bookings.P07, P14, P15, P16 | to check, by the strict test: the windows are rules over `starts_at`. The question is whether `starts_at` is "the start" when the request also carries the local time that the guest gave. The builder decides, and says why |
| bookings.P03, ticketing.P22 | stay workarounds: they need zone data |

If they pass the strict test, 2 to 6 promises take the score from 74 to 76–80 of 143 (53.1–55.9%).

## The target, written first

Step 0 adds `tests/fixtures/utc-times`:

- a timestamp with `precision: 3`;
- a period of one calendar month, which starts on 31 January, 29 February and 31 December;
- a cancel deadline of 2 hours before `starts_at`.

It also adds `tests/utc-times.test.ts`, which checks the same verdicts with `TZ` set to other zones, and the SQL of months on PGlite.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `precision` | The manifest, the IR, Valibot, the Postgres domain, `diff`; `constraint-not-allowed` on another primitive |
| 2 | Months | The rule language, the runtime and SQL, at the end of each month and of a leap February |
| 3 | The corpus | The contracts; the minimum is the new score |
| 4 | Docs | The primitives, rule language and diagnostics pages; a section "Keep times in UTC" in Declare preconditions and postconditions |

## Sabotages at the end

Each must turn CI red:

1. Give inventory a timestamp with 2 digits after the second → the input is rejected.
2. Make the subscriptions core end a period that starts on 31 January on 3 March → a ContractViolation.
3. Make the bookings core accept a cancel 1 hour before `starts_at` → its scenario fails.
4. Change `precision: 3` to `precision: 2` in a new manifest → `diff` reports it.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say that a contract keeps instants in UTC, and that the client converts local times.

## Risks

- **A client converts a local time wrongly.** The windows then hold on the wrong instant. The contract cannot see it, as it has no zone data. The docs say so.
- **The two zone promises stay open.** If they matter, a later plan adds zones with Node's zone data, and a check that refuses to run on another version.
