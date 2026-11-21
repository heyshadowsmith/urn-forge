# urn-forge reportOn plan

Nov 21, 2026 · @Shadow Smith

When an invariant does not hold, the issue goes on the first field that its rule names. The second blind trial showed the cost: `party_size <= 6 or deposit is present` refuses a party of 7 with no deposit, and the issue says `path: "party_size"`, while the caller must add a deposit. A form that puts each issue next to its input then marks the wrong input.

Today the only fix is to write the rule in another order. That is not always possible, and it has costs:

- An optional field must be guarded on the left (`opt is absent or …`), so in `opt is absent or b < opt` the issue can never go on `b`.
- The canonical text of the rule changes, and `diff` cannot compare two rules, so the new order counts as breaking for each use.
- A scenario with `Then the input is rejected on "<field>"` that matched the old first field fails.
- A reader cannot see that the order was chosen for the issue, and a later edit can undo it.

This plan adds an optional key, `reportOn`, that names the field of the issue.

## What changes for a user

```yaml
booking.invariant.large_party_has_deposit:
  description: A party of 7 or more pays a deposit
  on: booking.entity.request
  rule: party_size <= 6 or deposit is present
  reportOn: deposit
  message: A party of 7 or more must pay a deposit
```

```ts
// domain.schemas.generated.ts
v.forward(v.check(BookingLargePartyHasDepositRule, "A party of 7 or more must pay a deposit"), ["deposit"]),
```

```json
{ "path": "deposit", "fieldUrn": "urn:demo:resto:booking:field:deposit", "invariantUrn": "urn:demo:resto:booking:invariant:large_party_has_deposit", "message": "A party of 7 or more must pay a deposit" }
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The name | **`reportOn`** | It reads with `on`: the rule is on the entity, and it reports on the field. `field` and `path` are vaguer, and `path` suggests a nested path, which decision 4 does not allow |
| 2 | The value | **A property name of the `on` entity**, as the rule writes it (with `as`, the `as` name). Not a short key | The issue path holds property names, and the rule names properties, not URNs. One field can be two properties of one entity (with `as`), so a URN would not say which |
| 3 | Which properties | **Only a property that the rule names**, at any place in the rule, also in a presence condition. Else pass 6 reports `invalid-report-on` | An issue on a field that the rule does not read sends the caller to a field that cannot fix it |
| 4 | A nested path | **No.** One property of the `on` entity | An invariant names only the properties of its own entity. For an embedded entity, the invariant is on that entity, and its issue already goes inside the object (`coverages.0.limit`) |
| 5 | More than one field | **No.** One field | A form can mark one input for one rule. Two issues for one broken rule would count it twice. A rule that needs two marks can be two invariants |
| 6 | Default | **The first field that the rule names, as today** | No change for a manifest without `reportOn`. The IR has the key only when it is set, so no fingerprint changes |
| 7 | `diff` | **A change of `reportOn` is compatible**, with the message `reports its issue on "<a>" → "<b>"`, as a change of `message` is | The set of values that the rule accepts does not change. Only the description of the refusal changes |
| 8 | Postgres | **No change** | A `CHECK` names the invariant, not a field. The constraint name maps to the invariant URN, as today |
| 9 | Scenarios | **No new step.** `Then the input is rejected on "<field>"` reads the head of the issue path, so it follows `reportOn` | The step already checks the field that the caller sees |
| 10 | Target | **The rules fixture** gets `report_on_guarded` (`opt is absent or d1 < opt`, `reportOn: d1`), the case that no order can fix. **A new fixture**, `tests/fixtures/report-on/`, has the restaurant rule of the blind trial. The insurance domain does not change: each of its invariants already reports on the field to correct | The fixture shows the case that reordering cannot fix. The restaurant rule is the case that the trial found. Insurance stays a test of what it already does |
| 11 | One PR? | **Yes**, one commit per step | |

## Scope

**In:** the `reportOn` key in the manifest, the IR and pass 6 (`invalid-report-on`); the Valibot `v.forward` path; `diff`; the fixtures; the docs (the manifest reference, Add an invariant, the generated schemas, the diagnostics, and the advice to reorder a rule, which this replaces).

**Out:** nested paths; more than one field; a different message for each field; any change to the rule language.

## The target, written first

Step 0 adds the two fixtures. Until step 1, `compile` refuses `reportOn` with `unknown-property` for each invariant that has it; that is the check of step 0.

## Build order

One PR (decision 11), one commit per step. Each step leaves the repository green and ends with a check.

- [x] **0. The target.** As above. *Check:* `compile` gives exactly one `unknown-property` for each `reportOn`.
  - *Done.* The check was met: one `unknown-property` for each of the two fixtures. The restaurant fixture also has a property with `as` (`guest_notes`), to test decision 2. The target went in with step 1, because CI compiles the fixtures.
- [x] **1. Manifest, IR and pass 6.** `reportOn` in the invariant schema; `reportOn?` on `IRInvariant`; `invalid-report-on` when the rule does not name the property. *Check:* the fixtures compile; a case for a property that the rule does not name, and for one that the entity does not have; the IRs of the other domains do not change.
  - *Done.* The check was met: gate 4 passes for every domain with no compile. `namesIn` gives the properties of a rule, in a value or in a presence condition. The message says which of two faults it is: a property that the rule does not name, or no property of the entity (also a short key).
- [x] **2. Valibot and the runtime.** The `v.forward` path is `reportOn`, else the first field. *Check:* the expected schemas of the fixtures; a parse of the restaurant request gives the issue on `deposit`, with the `fieldUrn` of `deposit`; `rejected on "deposit"` passes in a scenario.
  - *Done.* The check was met. Only one line of the generator changed; the runtime finds the `fieldUrn` from the path, as before, so it needed no change.
- [x] **3. `diff`, docs and notes.** *Check:* a diff case for a changed `reportOn` (compatible); CI green; every sabotage below fails.
  - *Done.* `diff` compares the field that the issue goes on, not the key: `reportOn` set to the field that was first already moves nothing, so it is no change. A move is `reports its issue on "qty" → "pack"` (case `invariant-report-on`). The advice in Add an invariant to write the rule in another order is replaced by a section on `reportOn`.

## Done

| Sabotage | What catches it | Result |
| --- | --- | --- |
| `reportOn: seats`, which the rule does not name | Pass 6, `invalid-report-on` | Caught: `is a property that the rule does not name` |
| `reportOn: nope`, which the entity does not have | Pass 6, `invalid-report-on` | Caught: `is not a property of the entity` |
| `reportOn: booking.field.deposit`, a short key | Pass 6, `invalid-report-on` | Caught: `is not a property of the entity` |
| `reportOn` on a manifest that had none | No fingerprint changes in the other domains | Met: gate 4 passes for each domain, and no insurance invariant has the key in its IR |
| A scenario `rejected on "party_size"` for the restaurant rule with `reportOn: deposit` | Cucumber: the issue is on `deposit` | Caught: `rejected the input, but not on "party_size"` |

**Met.**

## Risks

- **A second place that decides the issue.** A reader of a rule must now look for `reportOn` to know where the issue goes. The default stays the same, and the key is next to the rule.
- **Two invariants of one entity on one field.** Each gives its own issue, with its own `invariantUrn`, as two invariants on one first field do today.
