# urn-forge date arithmetic plan

Nov 21, 2026 · @Shadow Smith

A rule over two dates can compare them, `expiry_date > effective_date`, but it cannot count the days between them. "A loan lasts 28 days at most" or "a policy lasts one year at most" cannot be an invariant. The blind trial hit this: half of the rule lived in the core, where the schemas, the generated SQL and the scenarios of the invariant could not see it. This plan adds days to the rule language: `date + integer`, `date - integer` and `date - date`.

## What changes for a user

```yaml
loan.invariant.loan_at_most_28_days:
  description: A loan lasts 28 days at most
  on: loan.entity.loan
  rule: due_date <= loan_date + 28
  message: The due date must be at most 28 days after the loan date

policy.invariant.term_at_most_a_year:
  description: A policy lasts one year at most
  on: policy.entity.policy
  rule: expiry_date - effective_date <= 366
  message: A policy can last 366 days at most
```

```ts
// domain.schemas.generated.ts: exact, with no time zone
export const PolicyTermAtMostAYearRule = (p: v.InferOutput<typeof PolicyPolicyFields>): boolean =>
  (epochDay((p.expiry_date as string)) - epochDay((p.effective_date as string))) <= 366;
```

```sql
-- schema.generated.sql: the same rule, with Postgres's own date arithmetic
CONSTRAINT "term_at_most_a_year" CHECK ("expiry_date" - "effective_date" <= 366)
```

## The model

| Expression | Left | Right | Result | Meaning |
| --- | --- | --- | --- | --- |
| `d + n` | `date` | `integer` | `date` | The day `n` days after `d` |
| `d - n` | `date` | `integer` | `date` | The day `n` days before `d` |
| `d1 - d2` | `date` | `date` | `integer` | The number of days from `d2` to `d1`. Negative if `d1` is before `d2` |

A day is a calendar day, with no time and no time zone. This is the meaning that the `date` primitive already has, so the arithmetic is exact: `'2028-02-28' + 1` is `'2028-02-29'`, and `'2026-03-01' - '2026-02-28'` is `1`.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Which operations? | **`date + integer`, `date - integer`, `date - date`** (the model above). The date is on the left. `integer + date`, `date + date` and `integer - date` cause `rule-type` | These three are what Postgres has for `date`, with the same meaning. A fixed order gives one way to write each rule, so a canonical text stays canonical |
| 2 | The unit | **Days only.** No months, years or weeks | A day is exact. A month is not: `'2026-01-31'` plus one month has no single answer, and each library gives a different one. A rule that means "one year" writes `366` or `365` and says which in its description. Weeks are `7 * n`, and the language has no `*`, so a week is `7` |
| 3 | Literals | **A literal gets its primitive from the operator:** in `d + 28`, `28` is an `integer`; in `d - '2026-01-01'`, the text is a `date`; in `d1 - d2 <= 28`, `28` is an `integer`, from the result of `d1 - d2` | The same rule as today ("a literal gets the primitive of the other side"), with the result type of the arithmetic as the other side |
| 4 | An `integer` field as the days | **Allowed**: `due_date <= loan_date + max_days`, with `max_days` an `integer` field of the entity | The number of days can be data, for example a loan period that depends on a tier. The guards for an optional field apply as they do now |
| 5 | Timestamps | **Not in this plan.** `timestamp + …` stays `rule-type` | An instant plus a duration needs a unit (seconds, hours) and a rule for daylight saving time if the unit is a day. That is a different decision. It can be a later plan |
| 6 | "Today" | **Not in the language.** A rule cannot read the clock | Determinism (spec §1). The shell sends today as a `date` field, as [Results and declared errors](../explanation/results-and-errors#data-that-the-input-does-not-carry) tells, and a rule compares it: `due_date <= today + 28` |
| 7 | The TypeScript translation | **Through day numbers.** `epochDay(d)` gives the number of days since `1970-01-01` (with `Date.UTC`, exact for every `YYYY-MM-DD`). `d + n` is `epochDay(d) + n`, and a comparison with a date that has arithmetic compares day numbers. `epochDay` is written into the generated schemas, as `compareDecimal` is | Numbers have no range problem: a day after the year 9999 is still a correct number, and Postgres compares it the same way. A result that is turned back into `YYYY-MM-DD` text would need a format for years with five digits |
| 8 | The Postgres translation | **Native**: `"d" + n`, `"d" - n`, `"d1" - "d2"` on `DATE` columns | Postgres has these operators, with the same meaning (`date - date` gives an `integer` of days). The CHECK stays readable and is the rule as it is written |
| 9 | Out of range | **No new check.** A sum past the last day of Postgres (year 5874897) is an error at `INSERT` in Postgres and a number in TypeScript. The docs say so, and recommend a `max` on an `integer` field that is used as days | An `integer` field with no `max` is the only way to get there. A check in pass 6 would refuse correct rules for a case that no real domain meets |
| 10 | IR and fingerprints | **No new IR node.** `+` and `-` keep their nodes; the type checker gives each node its primitive. The fingerprint of a manifest with no date arithmetic does not change | The tree already holds the rule. The meaning comes from the types, which the compiler derives the same way each time |
| 11 | Canonical text | **No change** to the rules of the printer. `loan_date + 28` prints as written; `(d1 - d2) - 1` keeps the order of `-` | The printer already handles `+` and `-` |
| 12 | Gate 3 and `diff` | **No change.** An invariant with date arithmetic needs a scenario that breaks it (`uncovered-invariant`), as each invariant does. A changed rule is classified by the existing invariant rules of `diff` | The coverage and the compatibility of an invariant do not depend on its operators |
| 13 | Target | **The rules fixture** gets one invariant for each new operation, with its expected Valibot and SQL files. **The insurance domain** gets `term_at_most_a_year: expiry_date - effective_date <= 366`, and a scenario that sends a 367-day term | The fixture tests each operation alone. Insurance shows a real rule in the schemas, the SQL (on PGlite) and a scenario. Its fixed `referenceDate` and its dates in 2026 do not depend on the day that CI runs |
| 14 | One PR? | **Yes**, one commit per step, as before | |

## Scope

**In:** the three operations in the type checker (pass 6), with their `rule-type` messages; literals typed by the operation; the Valibot translation with `epochDay`; the Postgres translation; the rules fixture; the insurance invariant and its scenario; the docs (the rule language reference, Add an invariant, and the explanation of the primitives model).

**Out:** timestamp arithmetic; months, years and weeks; multiplication; a "today" value; functions such as `day_of_week`; arithmetic in the boundary cases of gate 3.

## The target, written first

Step 0 adds the target. In the rules fixture, one invariant for each operation:

| Invariant | Rule |
| --- | --- |
| `date_plus_days` | `d2 <= d1 + 28` |
| `date_minus_days` | `d1 - 7 < d2` |
| `days_between` | `d2 - d1 >= 1` |
| `days_from_field` | `d2 <= d1 + days` (with `days` an `integer` field) |
| `days_between_literal` | `d1 - '2026-01-01' >= 0` |

In insurance, `term_at_most_a_year`, its `message`, and a scenario of `issue_policy` with `expiry_date` 367 days after `effective_date` and `Then the input is rejected by "urn:acme:insurance:policy:invariant:term_at_most_a_year"`.

Until step 1, `compile` refuses each new rule with `rule-type` (`"+" works on integer and decimal only, not on date`); that is the check of step 0. As in the earlier plans, the insurance part goes in with the step that makes it pass, because CI compiles insurance.

## Build order

One PR (decision 14), one commit per step. Each step leaves the repository green and ends with a check.

- [x] **0. The target.** As above. *Check:* `compile` gives exactly one `rule-type` for each new invariant, with the message of today.
  - *Done.* The check was met: five `rule-type` problems, one for each rule, with three different messages of today (`28 is not a date …`, `"-" works on integer and decimal only …`, and `"+" has a date on the left and an integer on the right …`). The fixture uses its own fields: `dt1`, `dt2`, and `i1` as the days. As planned, the fixture rules went in with step 2, and insurance with step 3.
- [x] **1. The type checker.** The three operations, the literal typing of decision 3, the `rule-type` messages for the refused forms (`"+" needs the date on the left and an integer of days on the right`, `"-" of two dates gives days; it cannot be part of a date`), and the guards. *Check:* the fixture compiles; a case for each refused form gives its message; the IRs of the other domains and their fingerprints do not change.
  - *Done.* The check was met: gate 4 passes for every domain with no compile, so no fingerprint changed. The message for an arithmetic on a primitive with none (`"+" works on integer, decimal and date only, not on timestamp`) now comes before the message for a literal that does not fit it. `valueType` gives the primitive of each value to both translations, so the two cannot disagree about a type.
- [x] **2. Valibot.** `epochDay` in the generated schemas when a rule needs it; the translation of decision 7. *Check:* the expected schemas of the fixture; a test for each rule at its edge (`28` days passes, `29` fails), across a month end, a year end and 29 February; the insurance scenario passes.
  - *Done*, in one commit with step 3, because the Postgres tests run the same edge cases (`tests/rule-cases.ts`) as the Valibot tests. A date with no days in its comparison still compares as text, so no generated file of the other domains changed. A test runs `epochDay` one day at a time from the year 1 to the year 9999, in both copies (the generated helper and `src/primitives/exact.ts`).
- [x] **3. Postgres.** The native translation. *Check:* the expected SQL of the fixture; on PGlite, the insurance CHECK accepts 366 days and refuses 367, with the URN of the invariant in the mapped error.
  - *Done.* The check was met. One finding: Postgres has `date + integer` but not `date + bigint`, and an `integer` column can be `BIGINT`. A field or a sum used as days is cast to `INTEGER`; a number stays a number. Every edge case agrees with the Valibot rule, also the year 1 minus 7 days (a day BC in Postgres) and `9999-12-31` plus 28 days. The insurance invariant and its two scenarios are at the end of their files, so the line numbers that the docs quote did not move.
- [x] **4. Ship.** The docs and the notes of this plan. *Check:* CI green; every sabotage below fails.
  - *Done.* New section [Days](../reference/rule-language#days) in the rule language reference, and updates in the Postgres schema reference, Add an invariant, the primitives model, and the departures from the spec. Each quoted output of the insurance domain changed by the new invariant and its two scenarios was run again.

## Done

| Sabotage | What catches it | Result |
| --- | --- | --- |
| `loan_date + due_date` | Pass 6, `rule-type` | Caught: `"+" cannot add two dates; "-" of two dates gives the days between them` |
| `28 + loan_date` | Pass 6, `rule-type` (the date goes on the left) | Caught: `"+" needs the date on the left and an integer of days on the right` |
| `loan_date + 1.5` | Pass 6, `rule-type` (`1.5 is not an integer`) | Caught: `1.5 is not an integer, so it cannot be the days in "+"` |
| `at + 1`, with `at` a `timestamp` | Pass 6, `rule-type` | Caught: `"+" works on integer, decimal and date only, not on timestamp` |
| `epochDay` off by one day across a month end | The edge tests of step 2 | Caught: a helper one day off in March fails the edge test at `2028-03-01` (`expected 21245 to be 21244`), and the generated file no longer matches the fixture |
| A CHECK that differs from the TypeScript at 29 February | The PGlite test of step 3, with the same dates | Met: both agree on every case; the first form of the SQL, with no cast, was refused by Postgres for a `BIGINT` column |
| The 367-day scenario removed | Gate 3, `uncovered-invariant` | Caught, before the scenario was written |

**Met.**

## Risks

- **Two translations of one rule.** TypeScript counts days with `Date.UTC`; Postgres counts them itself. Both use the proleptic Gregorian calendar, so they agree for every date the `date` primitive accepts. The step 3 test compares them at the edges.
- **"One year" is not a number of days.** A rule that writes `366` lets a 366-day term in a year with no 29 February. The docs say this, and tell the author to choose the number in the description. Month and year arithmetic can be a later plan, with a stated rule for the end of a month.
- **The days as data.** An `integer` field used as days with no `max` can make a date past the range of Postgres. Decision 9 accepts this, and the docs recommend a `max`.
