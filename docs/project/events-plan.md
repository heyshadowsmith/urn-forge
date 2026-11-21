# urn-forge events plan

Nov 21, 2026 · @Shadow Smith

An event records a fact that happened: a policy was issued, a policy was cancelled (spec §4.5). Today `event` is a URN kind that the compiler refuses (`unsupported-kind`), and a handler can return only its output or a declared error. A shell that wants to publish "policy issued" to other systems, or to keep an audit trail, has nothing in the contract to say what that message is. This plan adds the last kind of the spec: the `event` atom, `emits` on operations, events in `Result`, and `recordAs` on errors.

## What changes for a user

```yaml
policy.event.policy_issued:
  description: A policy was issued
  fields:
    - ref: policy.field.policy_id
    - link: customer.entity.customer
      as: holder
    - ref: policy.field.premium

policy.operation.issue_policy:
  description: Issue a policy as requested
  input: policy.entity.policy
  output: policy.entity.policy
  emits: [policy.event.policy_issued]
```

```ts
// The core returns its output and the events of the operation, typed by its emits.
'urn:acme:insurance:policy:operation:issue_policy': (policy) =>
  ok(policy, [emit('urn:acme:insurance:policy:event:policy_issued', { policy_id: policy.policy_id, holder: policy.holder, premium: policy.premium })]),
```

```ts
// The shell gets each event parsed and branded, after the output.
const result = executeOperation('urn:acme:insurance:policy:operation:issue_policy', body, core);
if (result.ok) for (const event of result.events) publish(event.urn, event.fields);
```

```gherkin
Then the operation emits "urn:acme:insurance:policy:event:policy_issued":
  | policy_id                            | holder                               | premium |
  | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 120.00  |
```

## The model

| Kind | What it is | Who sees it |
| --- | --- | --- |
| Entity | A value: what goes in and out of an operation | The caller |
| Error | A refusal: the operation did not happen | The caller |
| Event | A fact: the operation happened, and this is what other systems may learn of it | The shell, which publishes it |

An event is only a success fact (spec §4.5). An error is never an event, so anything that reads the events of operations can trust each one. `recordAs` is the one bridge: an error may name an event for the shell to record in an audit trail, apart from the events that operations emit.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | What does an event declare? | **`description` and `fields`, with the same field references as an entity**: `ref` to a field or an entity, `link`, `as`, `required`, `many`. No `key`, and no invariant `on` an event | One reference model for every payload. An event is not stored by this plugin set, so it needs no key. An embedded entity keeps its own invariants, so an event that needs a rule embeds the entity that holds it |
| 2 | What does an event payload look like? | **`kind: '<event URN>'` plus its fields**, as an error payload has. `kind` is a reserved property in an event too (`reserved-property`) | The shell and a consumer switch on `kind` exhaustively, the same way for errors and events |
| 3 | How does an operation declare its events? | **`emits: [<event>, …]`** (spec §4.4). Zero or more events of each declared kind per call, in the order the handler gives them | The set of kinds is the contract. How many depends on the input (one `line_added` per line), and a count rule would be a second language |
| 4 | How does a handler return events? | **`ok(output, [emit('<event URN>', fields), …])`**. `emit` builds the payload, as `fail` does for an error. `ok(output)` with no events stays valid. The handler type allows only the operation's `emits`, so `tsc` refuses another event (gate 1) | No change for existing cores. The type check catches an undeclared event before any test runs |
| 5 | What does `executeOperation` return? | **`events: readonly { urn, fields }[]`** on success, each parsed and branded against its schema. An event that the operation does not emit, or that does not parse, is `ContractViolation`, and no output is returned | Spec §7.2 step 5. The shell never publishes an event that breaks the contract |
| 6 | `recordAs` on an error | **Built**: the event's properties must be the error's properties, with the same targets and presence, plus optional properties only (`invalid-record-as` in pass 6). The runtime builds the event from the error's fields and returns it as `record` on the `DomainError`. The core never emits it | Spec §4.6 says "a superset". With a required property that the error does not have, the runtime could not build the event; optional extras keep the superset the spec asks for |
| 7 | Scenario steps | **`Then the operation emits "<event URN>"`**, with an optional table that compares the fields as the output table does; **`Then the operation emits no event`** | One step for each thing a scenario asserts. The count and the order are not asserted: a scenario that needs them can assert the output instead |
| 8 | Gate 3 | **`undeclared-event`**: a step names an event that the operation does not emit. **`uncovered-event`**: a declared event that no scenario of the operation expects, a warning or a strict error, as `uncovered-error` | Error coverage, applied to events. An event that no scenario shows is an event nobody has seen happen |
| 9 | Diff and lifecycle | An event's fields have the **Out** use. A new event in `emits` widens Out (breaking); a removed one is compatible. Lifecycle keys work on events as on every kind | A consumer of the event stream receives events. The same rule as a new declared error (lifecycle plan, decision 12) |
| 10 | Postgres | **No table for events.** The plugin handles the kind by writing nothing | An event store or an outbox is the shell's choice. A table for it can be a later plan |
| 11 | IR | **`IREvent`** with the shape of `IREntity` without `key`; **`emits: readonly Urn[]` on every operation**, `[]` when it has none, as `errors` is; **`recordAs?` on `IRError`** | One shape for each list. The fingerprint of every manifest changes once, which a version of urn-forge does anyway |
| 12 | Target | **Extend `insurance/`**: `issue_policy` emits `policy_issued`; `cancel_policy` emits `policy_cancelled`; `refund_below_minimum` records as `refund_refused`. The features expect each event | Insurance has two operations and a declared error, so every part of the plan runs on a real domain. It is a test domain, so nothing here depends on a date |
| 13 | One PR? | **Yes**, one commit per step, as before | |

## Scope

**In:** the `event` kind (pass 1 to 4, pass 6 for `recordAs`, pass 8 through the generic lifecycle); `emits`; Valibot schemas for events; `Result`, `ok`, `emit`, and the handler types in the FCIS plugin; `executeOperation` with `events` and `record`; the two steps; gate 3 coverage; `diff` and the uses; the Postgres plugin's support of the kind; `insurance/`; the docs.

**Out:** an event store, an outbox table or a publisher; ordering or count rules for events; events that an invariant constrains directly; events across manifests; `urn-forge graph`.

## The target, written first

Step 0 adds to `insurance/` the three events, `emits` on both operations, `recordAs` on the error, the core's `emit` calls, and the scenario steps. Until step 1, `compile` refuses the manifest with `unsupported-kind` for each event key, and pass 1 refuses `emits` and `recordAs`; that is the check of step 0. As in the lifecycle plan, the target is committed with step 1, because CI compiles insurance.

## Build order

One PR (decision 13), one commit per step. Each step leaves the repository green and ends with a check.

- [x] **0. The target.** As above. *Check:* `compile` refuses exactly the event keys, `emits` and `recordAs`.
  - *Done* in parts, because CI compiles insurance and runs its scenarios: the manifest with step 1, the core's `emit` calls with step 2, and the scenario steps with step 3. Each part went in with the step that makes it pass.
- [x] **1. The kind.** `event` in the registry and the IR; `emits` and `recordAs` in pass 1 and pass 4; `invalid-record-as` in pass 6; `reserved-property` on events; events in `liveIr`, the Postgres plugin's `supports`, and `diff`'s uses. *Check:* insurance builds an IR with three events; a fixture for each new diagnostic; the other IRs change only by `emits: []`.
  - *Done*, with one consequence the plan did not name: every kind of the spec is now built, so `unsupported-kind` cannot happen, and it left the compiler and the docs. In `self/`, the error `unsupported_kind` retired through the lifecycle: `status: sunset`, out of `parse_short_key`'s errors, its scenario removed. `event` joined the kind enum, and strict coverage asked for an example of it. The new codes are tested in `tests/events.test.ts` and `tests/every-code.test.ts`, not in fixtures.
- [x] **2. Valibot and the FCIS runtime.** Event schemas; `emit`, `ok(value, events)`, the handler types; `executeOperation` with `events` and `record`; `ContractViolation` for an undeclared or a malformed event. *Check:* a core that emits an undeclared event fails `tsc`; one that emits a malformed event gets `ContractViolation`; insurance's cores pass `verify`.
  - *Done.* The check was met in `tests/events.test.ts`: an `@ts-expect-error` on a handler that emits another operation's event, a `ContractViolation` that names `premium` and its field URN for a malformed event, and `record` on the refused cancellation. A domain with no events types `events` as `never[]`, so the runtime casts its success result through `unknown`.
- [x] **3. Steps and gate 3.** The two steps; `undeclared-event` and `uncovered-event`. *Check:* the insurance scenarios expect each event and pass; a removed scenario gives exactly one `uncovered-event`.
  - *Done.* The check was met: 29 scenarios pass, and removing the expectation of `policy_cancelled` gives exactly one `uncovered-event`. `Then the operation emits no event` also passes after a declared refusal, which has no events by definition (spec §4.5), so a scenario can say so after `fails with`; it fails after `InputRejected` or `ContractViolation`.
- [x] **4. Ship.** The docs: the kind, the steps, the runtime, the codes, a how-to to emit an event, the model in the explanation pages. *Check:* CI green; every sabotage below fails.
  - *Done.* A new diff case, `event-added`, shows a new event in `emits` as breaking. New page: "Emit an event" (how-to).

## Done

| Sabotage | What catches it | Result |
| --- | --- | --- |
| `emits` names an entity | Pass 4, `wrong-ref-kind` | Caught |
| An event field named `kind` | Pass 3, `reserved-property` | Caught |
| `recordAs` names an event with a required property that the error does not have | Pass 6, `invalid-record-as` | Caught |
| A core that emits an event its operation does not declare | Gate 1, `tsc` | Caught (an `@ts-expect-error` that `tsc` checks); at run time it is also a `ContractViolation` |
| A core that emits an event with a field that breaks its constraint | Cucumber: `ContractViolation` with the field URN | Caught: `premium: 1.005` gives `path: premium` and its field URN |
| A scenario that expects an event its operation does not emit | Gate 3, `undeclared-event` | Caught |
| The scenario that expects `policy_cancelled` removed | Gate 3, `uncovered-event` | Caught: exactly one |
| A new event in `emits` | `diff`, `breaking-change` | Caught (case `event-added`) |

**Met.**

## Risks

- **`Result` changes shape.** `Success` gains `events`, and `ok` gains a second argument. A core that builds a `Result` by hand, not with `ok`, must add `events: []`. The generated `ok` covers the usual case, and gate 1 names each place that needs the change.
- **`recordAs` is stricter than the spec.** The spec allows any superset. This plan allows only optional extra properties, so the runtime can build the event. A domain that needs more data in the audit event can build it in the shell from the `DomainError`.
- **Events without a count.** A scenario cannot assert "exactly two `line_added` events" with the steps of this plan. The output table can show the count when it matters; a count step can come later as an addition.
- **Fingerprints.** `emits: []` on every operation changes every fingerprint once. Each domain needs one `compile`, which gate 4 asks for.
