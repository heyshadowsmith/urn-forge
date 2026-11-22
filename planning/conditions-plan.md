# urn-forge conditions plan

Nov 22, 2026 · @Shadow Smith

After [states and moves](./states-plan.md), the corpus is at 34 of 143 promises (23.8%). The hole with the most promises is A2, "rules between the request and the answer", with 19. Its promises fall into five groups:

| Group | Example | Promises |
| --- | --- | --- |
| A rule on the request, with a named refusal | "Requests for 13 or more guests are refused with PARTY_TOO_LARGE_FOR_ONLINE" (bookings.P02) | bookings.P02, P08 |
| A rule on the stored record and the request, with a named refusal | "The sum of all refunds never exceeds the captured amount, otherwise amount_exceeds_captured" (payments.P11) | payments.P10, P11, inventory.P12 |
| A rule between the request, the record and the answer | "Its new version is 1 higher than the version sent" (claims.P12) | claims.P12, P14, payments.P10, subscriptions.P08, P11 |
| A list of the answer tied to a list of the request | "One line per requested line, with the same SKU" (inventory.P10) | inventory.P08, P10, P22, ticketing.P08, bookings.P12 |
| A part that the shell keeps | the codes of an input rejection, "a refusal changes nothing", the status 201 | claims.P13, subscriptions.P08, P09, and parts of others |

The first three groups are one construct: **conditions on an operation**. A *requires* rule must hold before the handler runs; when it does not, the runtime answers a declared error. An *ensures* rule must hold for the answer; when it does not, the core has a bug. Both read the request (`input.`), the record that the operation changes (`current.`, from [states](./states-plan.md)), and, for ensures, the answer (`output.`). The roadmap allowed `input.` and `output.` in the rule language (decision 8). The fourth group needs rules over lists (A1), and the fifth is not contract.

Today a corpus core holds each of these rules, and nothing outside the core knows them.

## What changes for a user

```yaml
booking.operation.create_booking:
  description: Make a booking
  input: booking.entity.booking_request
  output: booking.entity.confirmation
  requires:
    - rule: input.party_size < 13
      otherwise: booking.error.party_too_large_for_online
    - rule: input.party_size < 7 or input.deposit_token is present
      otherwise: booking.error.deposit_required
  errors: [booking.error.party_too_large_for_online, booking.error.deposit_required]

claim.operation.submit_claim:
  description: Submit a draft claim
  input: claim.entity.change_request
  output: claim.entity.answer
  changes: { entity: claim.entity.claim, from: [DRAFT], to: SUBMITTED, otherwise: claim.error.invalid_state }
  requires:
    - rule: input.version = current.version
      otherwise: claim.error.version_conflict
  ensures:
    - output.version = input.version + 1
  errors: [claim.error.invalid_state, claim.error.version_conflict]
```

`executeOperation` checks the `requires` rules in order, after the input parses and after the state of `changes`, and answers the `otherwise` of the first that does not hold, without a call of the handler. It checks the `ensures` rules on a success, after the output parses; one that does not hold is a `ContractViolation` that names the rule.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where the rules are | **On the operation: `requires` and `ensures`, each a list.** Not new kinds of atom | A condition belongs to one operation. Its URN is the operation's, and its `otherwise` error has a URN of its own. A new kind would need names for rules that a caller never sees |
| 2 | What a rule can name | **`input.<property>`, `current.<property>` (only with `changes`), and in `ensures`, `output.<property>`.** One level, as today | The three values that the runtime holds at the check. Paths into lists and embedded entities are A1 |
| 3 | The rule language | **The same language: comparisons, `and`, `or`, `not`, guards, and exact `+` and `-` on integers, decimals and days.** No new operators | The six promises below need nothing more. Decision 8 of the roadmap keeps the language small |
| 4 | When `requires` runs | **After the input parses, and after the state of `changes`; in the order of the list; the first rule that fails answers.** | A request that does not parse has no values to compare. A record in a wrong state answers `otherwise` of `changes` first, as a caller expects |
| 5 | The answer of a failed `requires` | **Its declared `otherwise` error, filled from the request and the record by property name, as `changes` does.** Each required field of the error must be a property of the input or of the record | The same rule as states, so one mechanism fills each runtime refusal |
| 6 | The answer of a failed `ensures` | **`ContractViolation`, with the rule's text in the message** | The answer comes from the core. A broken postcondition is a bug, not a refusal |
| 7 | An input invariant and a `requires` rule | **Both stay.** An invariant is a rule on the shape of one entity and answers `InputRejected` on its property. A `requires` rule answers a declared error | bookings.P02 promises the error PARTY_TOO_LARGE_FOR_ONLINE, not a rejection of the input |
| 8 | Gate 3 | **Each `requires` rule needs a scenario that expects its `otherwise` error (the existing error coverage).** No new coverage for `ensures`: each success scenario runs them | The edges of a free rule cannot be found as the boundaries of a constraint are. The scenarios at the edge are the writer's, as for an invariant |
| 9 | `diff` | **A new `requires` rule, or a changed one: breaking. A removed `requires` rule: compatible. A new `ensures` rule: compatible. A removed or changed `ensures` rule: breaking** | A new precondition refuses calls that worked (In narrows). A new postcondition promises more about the answer (Out narrows) |
| 10 | SQL | **Not in the SQL.** The rules need the request, which a table does not hold | The store file stores what the runtime let through |
| 11 | Unchanged output | **The runtime emits the condition code only in a domain with `requires` or `ensures`** | Every other domain keeps its generated files and its fingerprint, as with states |

## Scope

- **In scope:** `requires` and `ensures` on an operation; `input.`, `current.` and `output.` in the rule language for them; the runtime checks; the type of each rule against the three entities; gate 3; `diff`; the six corpus promises below; and the docs.
- **Out of scope:**
  - Rules over the items of a list (A1), the fourth group.
  - "A refusal changes nothing", input rejections with a declared code, and status codes.
  - Rules that need the current time (E2).

## The promises that this plan moves

| Promise | Now | After | The rule |
| --- | --- | --- | --- |
| bookings.P02: 13 or more guests are refused with PARTY_TOO_LARGE_FOR_ONLINE | workaround | declared | `requires: input.party_size < 13` |
| bookings.P08: 7 or more guests need a deposit token, else DEPOSIT_REQUIRED | workaround | declared | `requires: input.party_size < 7 or input.deposit_token is present` |
| claims.P12: the new version is 1 higher than the version sent | workaround | declared | `ensures: output.version = input.version + 1` |
| payments.P10: a capture is at most the authorized amount, and an omitted amount captures all of it | workaround | declared | a `requires` and an `ensures` over `input.amount` and `current.authorized_amount` |
| payments.P11: all refunds never exceed the captured amount, else amount_exceeds_captured | workaround | declared | `requires: current.refunded_amount + input.amount <= current.captured_amount` |
| subscriptions.P11: at_period_end shows the new plan as scheduled and keeps the current plan | workaround | declared | an `ensures` over `input.proration`, `output.` and `current.` |

These 6 promises take the score from 34 to 40 of 143 (28.0%). The contract builders may find more. They must apply the same strict test: the whole promise, shown by the scenarios.

## The target, written first

Step 0 adds `tests/fixtures/conditions`: a booking with the two `requires` rules of bookings.P02 and P08, and a claim with a `changes`, a `requires` over `current.` and an `ensures` over `output.`. It also adds `tests/conditions.test.ts`, which runs the generated runtime. Each test is `it.fails` until its step is built.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `input.`, `current.` and `output.` in the rule language | The parser reads a prefix; the type checker takes three sets of properties. An unknown prefix, `current.` without `changes`, or `output.` in `requires` is a `rule-type` error with a clear message. Invariant rules do not change |
| 2 | `requires` and `ensures` in the manifest and the IR | Compile errors for each problem: a rule that does not type, an `otherwise` that is not in `errors`, an error field that the input and the record do not have. One fixture for each |
| 3 | The runtime | `requires` answers its `otherwise` without the handler; `ensures` is a `ContractViolation` with the rule. Every other domain's output is the same |
| 4 | Gate 3 and `diff` | Error coverage counts the `otherwise` of each `requires` rule; one `tests/diff` case for each rule of decision 9 |
| 5 | The corpus | Bookings, claims, payments and subscriptions use `requires` and `ensures`; the six promises are declared; the minimum is the new score |
| 6 | Docs | A how-to guide, "Declare preconditions and postconditions"; the manifest, rule language, generated code and diagnostics pages; the contract explanation |

## Sabotages at the end

Each must turn CI red:

1. Change `input.party_size < 13` to `< 14` with no change to the scenarios → the scenario of 13 guests fails.
2. Make the claims core answer `version: input.version` → `ContractViolation`, and the scenario fails.
3. Remove the scenario that expects `deposit_required` → gate 3 `uncovered-error`.
4. Add a `requires` rule in a new manifest → `diff` reports a breaking change.
5. Write `output.version` in a `requires` rule → `compile` stops.

## Done

- The 6 promises are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs have a how-to guide, and the reference pages state each rule.

## Risks

- **The rule language becomes a programming language.** The plan adds three prefixes and nothing else. A rule that needs a loop or a function is out, by decision 8 of the roadmap.
- **A rule that holds only in the core.** A writer can keep a rule in the core when a condition could state it. The corpus review checks each `workaround` comment for a rule that now fits.
- **Fields that the record does not hold.** payments.P11 needs the refunded amount on the payment record. If a contract does not keep it, the promise stays a workaround, and the report says why.
