# urn-forge callers plan

Nov 22, 2026 · @Shadow Smith

After [event delivery](./event-delivery-plan.md), the corpus is at 52 of 143 promises (36.4%). D2, "who can call", has 10 promises. Eight of them have one shape: **only a caller of some kind may call an operation, often only on the records that it owns.**

| Group | Example | Promises |
| --- | --- | --- |
| A role for each operation | "Only the order system may call ReserveStock …; only warehouse supervisors may call AdjustStock" (inventory.P21) | inventory.P21, payments.P22, subscriptions.P22 |
| A role and the record | "Only the claimant's manager may approve or reject a claim, a caller may never approve their own claim" (claims.P19) | bookings.P19, claims.P18, claims.P19, payments.P16, ticketing.P21 |
| A role and the time | "Can be marked NO_SHOW only by restaurant staff and only from 15 minutes after its start time" (bookings.P16) | bookings.P16: also needs the current time (E2) |
| Not about the caller | "Every refusal answer carries exactly one error code from …" (inventory.P09) | inventory.P09 |

Today a contract can declare a `forbidden` error, and the core decides when to answer it. The core gets no caller, so most cores have no such rule, and nothing outside the core knows who may call.

This plan separates two jobs. **Authentication** (who the caller is: a token, a key, a session) stays in the shell. **Authorization** (what that caller may do) moves into the manifest, as rules that the runtime checks before the handler runs.

## What changes for a user

```yaml
manifest:
  namespace: corpus
  domain: claims
  version: 1.0.0
  caller: auth.entity.caller

auth.entity.caller:
  description: Who calls, as the shell authenticated them
  fields:
    - ref: auth.field.role
    - ref: claim.field.employee_id

claim.operation.approve_claim:
  description: Approve a submitted claim
  input: claim.entity.decision
  output: claim.entity.claim
  changes: { entity: claim.entity.claim, from: [SUBMITTED], to: APPROVED, otherwise: claim.error.invalid_state }
  callers:
    allow:
      - caller.role = 'manager' and caller.employee_id = current.manager_id and caller.employee_id != current.employee_id
    otherwise: claim.error.forbidden
  errors: [claim.error.invalid_state, claim.error.forbidden]

claim.operation.read_claim:
  description: Read a claim
  input: claim.entity.claim_ref
  output: claim.entity.claim
  reads: { entity: claim.entity.claim, missing: claim.error.not_found }
  callers:
    allow:
      - caller.employee_id = current.employee_id
      - caller.employee_id = current.manager_id
      - caller.role = 'finance'
    otherwise: claim.error.forbidden
  errors: [claim.error.not_found, claim.error.forbidden]
```

```ts
const caller = await authenticate(request); // the shell's job
const result = executeOperation(urn, body, core, { caller, current });
```

```gherkin
Scenario: A manager cannot approve their own claim
  Given the caller is:
    | role    | employee_id |
    | manager | E-1001      |
  And the current claim is:
    | claim_id       | state     | employee_id | manager_id |
    | CLM-0000000001 | SUBMITTED | E-1001      | E-1001     |
  When I run the operation with:
    | claim_id       |
    | CLM-0000000001 |
  Then the operation fails with "urn:corpus:claims:claim:error:forbidden"
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where the shape of the caller is | **The manifest header names one entity, `caller`.** Each property is a value that the shell knows after it authenticates the caller: a role, an id, a merchant | One domain has one kind of caller identity. Its fields are ordinary fields, with their constraints and brands |
| 2 | How an operation states who may call | **`callers: { allow: [rule, …], otherwise: <error> }`. The call is allowed when any rule holds.** `allow: any` allows every authenticated caller | "Only X or Y" is a list of alternatives. One `otherwise` error for the refusal, as with `changes` |
| 3 | Must every operation say | **Yes, in a domain with a `caller`: an operation without `callers` stops `compile` (`invalid-callers`)** | An operation that forgets its callers is open to all. Writing `allow: any` makes that a decision |
| 4 | What a rule reads | **`caller.`, `input.` and, with `changes` or `reads`, `current.`** | The ownership rules compare the caller with the record ("their own claim") or with the request ("the bookings whose reference and email they present") |
| 5 | Reading a record without changing it | **`reads: { entity, missing? }` gives the handler and the rules `current`, as `changes` does, with no states** | "Only that employee, their manager and finance users may read it" needs the record of a read |
| 6 | When the check runs | **After the input and the caller parse; after `missing`; before the state of `changes` and before `requires`.** A refusal answers `otherwise`, filled from the caller, the request and the record, by name | A caller who may not see a record must not learn its state or its values from another refusal. payments.P16 answers `not_found` for a payment of another merchant, so `otherwise` can be any declared error |
| 7 | The caller from the shell | **`executeOperation(…, { caller })`. A caller that is absent or does not parse is a `ContractViolation`** | Authentication is the shell's. A shell that passes no caller has a bug, not a refused request |
| 8 | Gate 3 | **Each scenario of an operation with `callers` gives the caller with `Given the caller is:` (else `invalid-caller`). The `otherwise` error needs a scenario, as any declared error does.** Each `allow` rule needs a scenario where only that rule holds | Every alternative and the refusal are shown |
| 9 | `diff` | **A new `allow` rule: compatible (more callers may call). A removed or changed rule, or `callers` on an operation that had none: breaking. The fields of the caller entity have the In use** | A caller that could call and now cannot is broken |
| 10 | Lists that a caller may see only in part | **Out of scope.** "May list their own subscriptions" filters a list, which a rule on one record cannot state | A filter is a query, not a check |

## Scope

- **In scope:** `caller` in the header; `callers` and `reads` on an operation; `caller.` in the rule language; the runtime check; the Gherkin step `Given the caller is:`; gate 3; `diff`; the corpus promises below; and the docs.
- **Out of scope:**
  - Authentication: tokens, keys, sessions. The shell's.
  - Filters on lists (decision 10).
  - Membership in a list, such as "staff assigned to the event" when the caller holds a list of events.
  - Rules on the current time (E2), such as "from 15 minutes after its start time" (bookings.P16).

## The promises that this plan can move

| Promise | Now | After | How |
| --- | --- | --- | --- |
| inventory.P21 | not declarable | declared | `callers` with a role on each operation; `allow: any` on GetStock |
| claims.P18 | not declarable | declared | the owner on each change, and three alternatives on a read with `reads` |
| claims.P19 | not declarable | declared | a manager who is not the claimant; finance for mark paid |
| payments.P16 | workaround | declared | `caller.merchant_id = current.merchant_id`, `otherwise: not_found` |
| payments.P22 | not declarable | to check | a secret key and a read-only key are two roles; "unauthorized" is authentication, the shell's |
| bookings.P19 | workaround | to check | a guest who presents the reference and the email or phone; staff of the restaurant of the booking |
| ticketing.P21 | not declarable | to check | "box-office staff assigned to the event" may need membership in a list |
| subscriptions.P22 | not declarable | workaround | "list their own" is a filter (decision 10) |
| bookings.P16 | workaround | workaround | needs the current time (E2) |
| inventory.P09 | workaround | workaround | not about the caller |

If each one passes the strict test, these 7 promises take the score from 52 to 59 of 143 (41.3%). The contract builders apply the same strict test as before.

## The target, written first

Step 0 adds `tests/fixtures/callers`: a claim with a caller entity, an approve operation with an ownership rule, a read operation with `reads` and three alternatives, and an operation with `allow: any`. It also adds `tests/callers.test.ts`, which runs the generated runtime.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `caller` and `callers` in the manifest and the IR | `invalid-callers` for an operation without `callers`, a rule that does not type, an `otherwise` not in `errors`, or `caller` that is not an entity |
| 2 | `reads` | The handler and the rules get `current`; `missing` answers its error |
| 3 | The runtime | The check, in the order of decision 6; the caller in `ExecuteOptions`. Every other domain's output is the same |
| 4 | Gherkin and gate 3 | `Given the caller is:`; `invalid-caller`; the coverage of each `allow` rule |
| 5 | `diff` | One `tests/diff` case for each rule of decision 9 |
| 6 | The corpus | The six contracts; the minimum is the new score |
| 7 | Docs | A how-to guide, "Declare who may call"; the manifest, generated code, Gherkin, gates and diagnostics pages |

## Sabotages at the end

Each must turn CI red:

1. Make the claims core approve without the manager rule, and remove the rule from the manifest in a new version → `diff` reports a breaking change.
2. Remove `callers` from an operation of a domain with a `caller` → `compile` stops with `invalid-callers`.
3. Remove the scenario where a manager approves their own claim → gate 3 reports the `allow` rule as not covered.
4. Make the inventory shell pass no caller in the steps → a `ContractViolation`, and the scenarios fail.
5. Write `caller.role = 3` → `compile` stops with `rule-type`.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say what the shell must do (authenticate, pass the caller) and what urn-forge does (decide).

## Risks

- **A shell that passes the wrong caller.** urn-forge cannot know that the caller is the one that the token names. The docs put authentication in the shell, with its tests.
- **Rules that leak.** A refusal filled from the record can show its values. The check runs before the state and before `requires`, and `otherwise` names the error that the caller sees.
- **A domain with several kinds of caller,** such as a user and a system. One caller entity with a `role`, and optional fields for each kind, covers the corpus. A union of caller shapes waits for a promise that needs it.
