# urn-forge time zones plan

Nov 23, 2026 · @Shadow Smith

After [refusals](./refusals-plan.md), the corpus is at 74 of 143 promises (51.7%). D3, "time zones and calendar time", has 8 promises:

| Promise | What it needs |
| --- | --- |
| bookings.P03 | A local date and time on a 15-minute boundary in the restaurant's IANA zone, and the zone name in every answer |
| bookings.P07 | A booking at least 2 hours and at most 90 days before its local start |
| bookings.P14 | A change or a cancel at least 2 hours before the local start |
| bookings.P15 | A full refund 24 hours or more before the local start, else none |
| bookings.P16 | NO_SHOW from 15 minutes after the local start |
| ticketing.P22 | Each event states its start in its venue's IANA zone, beside the UTC time |
| inventory.P17 | Timestamps with exactly 3 digits after the second |
| subscriptions.P23 | A monthly period that starts on a day that the next month lacks ends on that month's last day |

The four bookings windows (P07, P14, P15, P16) are rules that `now` can already state, except for one thing. The start is a local date and time in a zone, and no rule can turn it into an instant. A UTC `starts_at` that the shell computes would let the rules hold on a value that nothing ties to the local time. Bookings P12, "alternatives within 2 hours", is in A2 but needs the same thing.

## The hard part: the same verdict on every machine

The rules of a zone change by law, and the zone database (tzdb) has a new version several times a year. Today urn-forge gives the same bytes and the same verdict for one commit on any machine; CI checks this in the zone Pacific/Chatham with a Turkish locale. Node's `Intl` uses the zone data of its ICU, which differs from one Node version to the next, and Postgres has its own copy. A rule that converted a zone with either would give two verdicts for one commit.

## What changes for a user

```yaml
manifest:
  version: 1.0.0
  timeZones: 2026e

booking.field.local_time:
  primitive: time
  description: The start, HH:MM in the time zone of the restaurant
booking.field.time_zone:
  primitive: string
  format: time-zone
  description: The IANA time zone of the restaurant

booking.operation.cancel_booking:
  requires:
    - rule: now <= at(current.local_date, current.local_time, current.time_zone) - 2 hours
      otherwise: booking.error.change_deadline_passed
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where the zone data comes from | **urn-forge ships one pinned copy of the zone data: each zone's offsets and transitions from 1970 to 2100, made once by a script from a named tzdb version and committed. A domain that uses zones gets `domain.zones.generated.ts` with that data.** Never `Intl` and never Postgres at run time | One commit, one verdict, on every machine and every Node. The data is a file in the repository, so a reviewer sees each change |
| 2 | How a domain names the version | **`timeZones: 2026e` in the header: the version that the domain checks with. `compile` stops when urn-forge does not ship it (`unknown-time-zones`). `diff` reports a new version as a change of the contract** | The rules of a zone are part of the contract: a new law changes when 2 hours before a booking is. The change is in the manifest, and so in the pull request |
| 3 | A zone name | **`format: time-zone` on a `string`: one of the zone names of that version** | Bookings P03: "a real IANA zone". A regex cannot say it |
| 4 | A local time | **A primitive `time`: `HH:MM` or `HH:MM:SS`, ordered, with the constraints of the other ordered primitives (`min`, `max`, `multipleOf` in minutes)** | Bookings P03 (a 15-minute boundary: `multipleOf: 15`) and P12 compare local times |
| 5 | From local to instant | **`at(date, time, zone)` in the rule language: the instant, a `timestamp`. A time that the zone skips (a gap) moves on by the length of the gap; a time that occurs twice takes the first** | The same choices as `Temporal` with `disambiguation: 'compatible'`, and as RFC 5545. Each local time then has exactly one instant |
| 6 | From instant to local | **`date(t, zone)` and `time(t, zone)`**, beside `date(t)` in UTC | Ticketing P22: the local start of an event, from its UTC start |
| 7 | SQL | **A rule with a zone is `unenforced-in-sql`** | Postgres converts with its own zone data, which can differ from the pinned version. The runtime checks it |
| 8 | Exact precision | **`precision: 3` on a `timestamp`: exactly 3 digits after the second** | Inventory P17. Today a timestamp accepts 0 to 3 digits |
| 9 | Calendar months | **`d + n months` and `d - n months` on a `date`: a month from a day that the target month lacks is that month's last day** | Subscriptions P23. The same calendar rule as the `notice` of [compatibility](./compatibility-plan.md) |
| 10 | Gherkin | **No new step.** A scenario gives local dates, times and zones as values, and `Given the time is` gives `now` | The values are text in the tables |

## Scope

- **In scope:**
  - The script that makes the zone data, and the first pinned version.
  - `timeZones` in the header, `format: time-zone`, the `time` primitive, `precision`.
  - `at`, `date(t, zone)`, `time(t, zone)` and months, in the rule language, the runtime, and `unenforced-in-sql`.
  - `diff`.
  - The corpus promises below, and the docs.
- **Out of scope:**
  - Zones before 1970 or after 2100.
  - Leap seconds.
  - Calendars other than the Gregorian.

## The promises that this plan can move

| Promise | After |
| --- | --- |
| bookings.P07, P14, P15, P16 | declared, if a rule with `at` states each window, and the scenarios show each edge, including a day when the clocks change |
| bookings.P03 | declared, if `format: time-zone` and `multipleOf: 15` state the parts, and each answer carries the zone |
| ticketing.P22 | to check: the event's local start, with `ensures` over `date(starts_at, zone)` and `time(starts_at, zone)` |
| inventory.P17 | declared, with `precision: 3` on each timestamp |
| subscriptions.P23 | to check: `period_end = period_start + 1 months` where the period is stated |
| bookings.P12 (A2) | to check: alternatives within 2 hours, with `at` |

If they pass the strict test, 6 to 9 promises take the score from 74 to 80–83 of 143 (55.9–58.0%). The contract builders apply the same strict test as before.

## The target, written first

Step 0 adds `tests/fixtures/time-zones`: a booking in a zone, with a cancel deadline of 2 hours before its local start, and a period of one calendar month. It also adds `tests/time-zones.test.ts`, with:

- the day of a spring gap and of an autumn overlap in Europe/Paris;
- a zone with a 30-minute offset;
- the same verdicts with `TZ` set to other zones.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | The zone data | The script, the pinned version, and a test that compares it with `Intl` of the same version at many instants |
| 2 | `timeZones`, `format: time-zone`, `time`, `precision` | The manifest, the IR, Valibot, Postgres types; `unknown-time-zones` |
| 3 | `at`, `date(t, zone)`, `time(t, zone)`, months | The rule language, the runtime with the zones file, `unenforced-in-sql` |
| 4 | `diff` | A new version, a new zone format, and `precision` |
| 5 | The corpus | The contracts; the minimum is the new score |
| 6 | Docs | A how-to guide, "Use local times"; the manifest, primitives, rule language and diagnostics pages |

## Sabotages at the end

Each must turn CI red:

1. Make the bookings core accept a cancel 1 hour before a local start on the day the clocks change → its scenario fails.
2. Change one transition in the pinned data → the data test fails.
3. Write `format: time-zone` and give `Europe/Pariss` → the input is rejected.
4. Give a timestamp with 2 digits after the second to inventory → the input is rejected.
5. Change `timeZones` in a new manifest → `diff` reports it.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say which version a domain uses, how to move to a new one, and what a gap and an overlap give.

## Risks

- **The size of the data.** All zones from 1970 to 2100, as offsets and transitions, are some hundreds of kilobytes. The zones file is made only for a domain that uses zones. A smaller range or a list of zones in the manifest are options if it is too large.
- **The data falls behind.** A law can change a zone before urn-forge ships its version. The domain stays on its version until it moves; the docs say how to move.
- **The shell uses other zone data.** A shell that shows a local time with its own zone data can show another time near a change of law. The docs say to use `at` and the zones file for each conversion that the contract depends on.
