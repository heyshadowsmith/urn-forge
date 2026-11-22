# Emit an event

An event records a fact: the operation happened, and other systems can learn of it. This guide declares an event, lists it on an operation, emits it from the handler and tests it with a scenario. It also publishes the event from the shell, and records a refusal as an event with `recordAs`.

The examples come from [`packages/urn-forge/insurance/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/insurance/), which CI tests. `issue_policy` emits `policy_issued`. `cancel_policy` emits `policy_cancelled`. The error `refund_below_minimum` records as `refund_refused`.

The commands on this page ran in a clone of the urn-forge repository, from `packages/urn-forge`. In your project, run them from the folder of `urn-forge.config.ts`, and leave out `--config`.

## Before you start

- You have an operation with a handler and a feature. Refer to [Add an operation](add-an-operation).
- Declare the fields that the event carries. Refer to [Add a field](add-a-field).
- Use an event only for a success. A refusal is a declared error, and an operation that refuses emits no event. Refer to [Results and declared errors](../explanation/results-and-errors).

## 1. Write the event entry

Add an entry with the short key `<context>.event.<identifier>`. The insurance manifest has three events, and each operation lists its event under `emits` (highlighted):

<<< @/../packages/urn-forge/insurance/domain.manifest.yaml{135-154,169,176 yaml}

| Key | Value |
| --- | --- |
| `description` | Necessary. The fact that the event records |
| `fields` | Optional. Field references, as in an entity: `ref`, `link`, `as`, `required` and `many`. The default is no fields |

For the full rules, refer to [The manifest](../reference/manifest).

## 2. Obey the event rules

- **An event has no `key`.** urn-forge does not store events, so an event needs no key.
- **No property of the event can have the name `kind`.** The event payload uses the property `kind` for the URN of the event. A field with the identifier `kind` is correct if `as` gives it another name.
- **`emits` names only events.**

If you do not obey these rules, `compile` stops. Here `policy_issued` has a `key`:

```
insurance/domain.manifest.yaml:138:3  error  unknown-property  policy.event.policy_issued.key: unknown property "key"
```

Here a field of `policy_issued` has `as: kind`, and `emits` of `issue_policy` names an entity:

```
insurance/domain.manifest.yaml:143:11  error  reserved-property  urn:acme:insurance:policy:event:policy_issued: fields[2] becomes property "kind", which an event reserves for its URN; choose another name with as
insurance/domain.manifest.yaml:170:11  error  wrong-ref-kind  urn:acme:insurance:policy:operation:issue_policy: emits[0] "policy.entity.policy" must name an event, but urn:acme:insurance:policy:entity:policy is an entity
```

## 3. List the event on the operation

Add the short key of the event to `emits` on the operation, as lines 169 and 176 do. `emits` is a list:

- An operation can list more than one event. One event can be on more than one operation.
- An operation without `emits` emits no event.
- The handler can return each listed event zero times or more, in the order that it gives them. The manifest does not set a count.

## 4. Compile

Run this command:

```bash
npx urn-forge compile --config insurance/urn-forge.config.ts
```

```
insurance/domain.manifest.yaml:79:12  warning  deprecated-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, which is deprecated (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30)
wrote      insurance/generated/domain.runtime.generated.ts
wrote      insurance/generated/domain.schemas.generated.ts
wrote      insurance/generated/domain.store.generated.ts
wrote      insurance/generated/schema.generated.sql
fingerprint sha256:cdd7f3a5a0f84f5f5d6d2f874a7e15be48b16ddf85506fbf72fc053a65322dd2
```

The generated runtime now has `emit`, and the result type of each handler allows only the events of its operation. The `deprecated-ref` warning is about the field `note`. Refer to [Retire a URN](retire-a-urn).

## 5. Emit the event from the handler

Import `emit` from the generated runtime. Give `ok` the output and a list of events. Call `emit` with the URN of the event and its fields (highlighted):

<<< @/../packages/urn-forge/insurance/core.ts{3,22-26,37-39}

- `emit` does not take `kind`. It adds `kind` itself.
- If the event has no fields, call `emit` with the URN only.
- `ok(output)` with no list is still correct. It returns no event.
- A handler that returns `fail(…)` returns no event.

If the operation does not list the event, gate 1 fails. Here the handler of `issue_policy` also emits `policy_cancelled`:

```
gate 1  completeness  FAIL  tsc: 1 error(s) over insurance/core.ts; `core` satisfies DomainCoreImplementation
    insurance/core.ts:24:5  error  type-error  TS2322: Type 'Success<{ policy_id: string & Brand<"urn:acme:insurance:policy:field:policy_id">; holder: string & Brand<"urn:acme:insurance:customer:field:customer_id">; coverages: { ...; }[]; effective_date: string & Brand<...>; expiry_date: string & Brand<...>; premium: string & Brand<...>; deductible?: (string & Brand<...>) | u...' is not assignable to type 'Result<{ policy_id: string; holder: string; coverages: { peril: "fire" | "flood" | "theft"; limit: string; note?: string | undefined; remark?: string | undefined; }[]; effective_date: string; expiry_date: string; premium: string; deductible?: string | undefined; }, never, { ...; }>'.
      Type 'Success<{ policy_id: string & Brand<"urn:acme:insurance:policy:field:policy_id">; holder: string & Brand<"urn:acme:insurance:customer:field:customer_id">; coverages: { ...; }[]; effective_date: string & Brand<...>; expiry_date: string & Brand<...>; premium: string & Brand<...>; deductible?: (string & Brand<...>) | u...' is not assignable to type 'Success<{ policy_id: string; holder: string; coverages: { peril: "fire" | "flood" | "theft"; limit: string; note?: string | undefined; remark?: string | undefined; }[]; effective_date: string; expiry_date: string; premium: string; deductible?: string | undefined; }, { ...; }>'.
        Type '{ kind: "urn:acme:insurance:policy:event:policy_cancelled"; cancellation_date: string; refund: string; } | { kind: "urn:acme:insurance:policy:event:policy_issued"; policy_id: string; holder: string; premium: string; }' is not assignable to type '{ kind: "urn:acme:insurance:policy:event:policy_issued"; policy_id: string; holder: string; premium: string; }'.
          Type '{ kind: "urn:acme:insurance:policy:event:policy_cancelled"; cancellation_date: string; refund: string; }' is missing the following properties from type '{ kind: "urn:acme:insurance:policy:event:policy_issued"; policy_id: string; holder: string; premium: string; }': policy_id, holder, premium
```

To fix it, remove the `emit` call, or add the event to `emits` of the operation.

Gate 1 does not find an event that the handler does not return. A handler of `cancel_policy` that returns `ok({ refund })` passes gate 1. Only a scenario finds it. Refer to step 7.

## 6. Publish the events from the shell

On success, `executeOperation` gives `events` after `output`. Each event has `urn` and `fields`. The fields are parsed and branded, and include `kind`:

```ts
const result = executeOperation('urn:acme:insurance:policy:operation:issue_policy', body, core);
if (result.ok) for (const event of result.events) publish(event.urn, event.fields);
```

`publish` is your code, for example a message queue or an outbox table. urn-forge does not have an event store or a publisher at this time. Refer to [Scope](../reference/scope).

For a valid policy, `result.events` has one event:

```
urn:acme:insurance:policy:event:policy_issued {"kind":"urn:acme:insurance:policy:event:policy_issued","policy_id":"123e4567-e89b-12d3-a456-426614174000","holder":"9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d","premium":"120.00"}
```

If the handler returns an event that its operation does not list, or an event that does not match its schema, the result is `ContractViolation`. Each value of an event must pass all the constraints of its field, as a value of an error must. The shell gets no output and no event. To handle each result, refer to [Call an operation from the shell](call-an-operation).

## 7. Expect the event in a scenario

Add `Then the operation emits "<event URN>"` after the step that checks the output. To check the fields of the event, add a table after a colon. After a declared error, add `Then the operation emits no event` (highlighted):

<<< @/../packages/urn-forge/insurance/features/cancel_policy.feature{12-14,51 gherkin}

- The step must name an event that the operation lists under `emits`. If not, gate 3 fails with `undeclared-event`.
- The table columns must be fields of the event. A field that is not in the table is not checked. An empty cell means that the field must be absent.
- One event with this URN must match the table. The step does not check the count or the order of the events.
- `Then the operation emits no event` passes after a success with no event, or after a declared error.

Run the scenarios:

```bash
npx cucumber-js --profile insurance
```

If the handler does not return the event, the step fails:

```
Error: urn:acme:insurance:policy:operation:cancel_policy did not emit urn:acme:insurance:policy:event:policy_cancelled (emitted: nothing)
```

If a field is not correct, the step gives the difference. Here the handler gives the effective date as the cancellation date:

```
Error: urn:acme:insurance:policy:event:policy_cancelled fields differ: cancellation_date: expected 2026-07-02, got 2026-01-01
```

## 8. Make sure that gate 3 covers each event

Gate 3 counts the events that a scenario expects. Each event of a tagged operation needs a scenario that expects it. If no scenario expects one, gate 3 reports `uncovered-event`. The insurance features are strict, so it is an error. Here lines 12 to 14 of `cancel_policy.feature` are not there:

```
gate 3  gherkin       FAIL  2 feature(s), 15 scenario(s), 2/2 operations tagged, 1/1 errors expected, 1/2 events expected, 1/1 records expected, 5/5 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features  error  uncovered-event  event urn:acme:insurance:policy:event:policy_cancelled of urn:acme:insurance:policy:operation:cancel_policy has no scenario that expects it; add one with Then the operation emits "urn:acme:insurance:policy:event:policy_cancelled"
```

In a feature that is not strict, it is a warning. Refer to [Adopt strict coverage](adopt-strict-coverage).

If a step names an event that the operation does not list, gate 3 reports `undeclared-event`. Here line 12 names `policy_issued`:

```
gate 3  gherkin       FAIL  2 feature(s), 15 scenario(s), 2/2 operations tagged, 1/1 errors expected, 1/2 events expected, 1/1 records expected, 5/5 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features/cancel_policy.feature:12:5  error  undeclared-event  "urn:acme:insurance:policy:event:policy_issued" is not an event of urn:acme:insurance:policy:operation:cancel_policy (emits: urn:acme:insurance:policy:event:policy_cancelled)
    insurance/features  error  uncovered-event  event urn:acme:insurance:policy:event:policy_cancelled of urn:acme:insurance:policy:operation:cancel_policy has no scenario that expects it; add one with Then the operation emits "urn:acme:insurance:policy:event:policy_cancelled"
```

To fix it, use a URN from the `emits` list in the message. The `uncovered-event` problem goes away with it.

## 9. Record a refusal with recordAs

A declared error is not an event. But the shell can keep a refusal in an audit trail. To do this, set `recordAs` on the error to an event. The runtime then makes the event from the fields of the error. The handler does not emit it.

In the insurance manifest, `refund_below_minimum` records as `refund_refused` (highlighted):

<<< @/../packages/urn-forge/insurance/domain.manifest.yaml{148-163 yaml}

The fields of the error must make the event. Thus:

- The event must have each property of the error, with the same target, the same `required` and the same `many`.
- Each other property of the event must be optional. Here `cancellation_date` has `required: false`.

If not, `compile` stops with `invalid-record-as`. Here `cancellation_date` is required:

```
insurance/domain.manifest.yaml:162:13  error  invalid-record-as  urn:acme:insurance:policy:error:refund_below_minimum: recordAs urn:acme:insurance:policy:event:refund_refused has the required property "cancellation_date", which the error does not have; make it optional, so the error's fields can build the event
```

Here the event has no `refund`:

```
insurance/domain.manifest.yaml:162:13  error  invalid-record-as  urn:acme:insurance:policy:error:refund_below_minimum: recordAs urn:acme:insurance:policy:event:refund_refused has no property "refund", which the error has
```

When the handler returns the error, the `DomainError` result has `record`. A cancellation on the last day of the term gives this result:

```json
{
  "ok": false,
  "kind": "DomainError",
  "urn": "urn:acme:insurance:policy:operation:cancel_policy",
  "error": {
    "urn": "urn:acme:insurance:policy:error:refund_below_minimum",
    "category": "precondition",
    "retryable": false,
    "message": "A refund of 0.00 is below the minimum of 1.00",
    "fields": {
      "kind": "urn:acme:insurance:policy:error:refund_below_minimum",
      "refund": "0.00"
    },
    "record": {
      "urn": "urn:acme:insurance:policy:event:refund_refused",
      "fields": {
        "kind": "urn:acme:insurance:policy:event:refund_refused",
        "refund": "0.00"
      }
    }
  }
}
```

The `record` is not in `events`. The scenario of line 51 expects no event after the error, and it passes.

To test the record, add `the refusal is recorded as "<event URN>"` after the step that expects the error. With a colon and a table, the step also compares the fields of the record:

```gherkin
    Then the operation fails with "urn:acme:insurance:policy:error:refund_below_minimum":
      | refund |
      | 0.00   |
    And the operation emits no event
    And the refusal is recorded as "urn:acme:insurance:policy:event:refund_refused":
      | refund |
      | 0.00   |
```

Gate 3 counts the records that a scenario expects, as `1/1 records expected` in its summary. A record that no scenario expects is `uncovered-record`: a warning, or an error in strict coverage. A step that names an event that no declared error of the operation records as is `undeclared-record`.

## 10. Check compatibility

A consumer of the events handles each event that it knows. Thus `urn-forge diff` treats a new event in `emits` as a breaking change. Here the old manifest has no `emits` on `cancel_policy`:

```bash
npx urn-forge diff old.manifest.yaml insurance/domain.manifest.yaml --config insurance/urn-forge.config.ts
```

```
breaking    urn:acme:insurance:policy:operation:cancel_policy  the new event urn:acme:insurance:policy:event:policy_cancelled widens a value that callers receive, which breaks callers that receive it
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

An event that you remove from `emits` is a compatible change:

```
compatible  urn:acme:insurance:policy:operation:cancel_policy  removing the event urn:acme:insurance:policy:event:policy_cancelled narrows a value that callers receive
diff passed: 0 breaking, 1 compatible, 0 lifecycle change(s)
```

The fields of an event have the Out use, as the fields of an output do. Refer to [Check compatibility in CI](check-compatibility).

## Result

`npx urn-forge verify --config insurance/urn-forge.config.ts` shows that a scenario expects each event:

```
gate 1  completeness  PASS  tsc: 0 error(s) over insurance/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  2 feature(s), 15 scenario(s), 2/2 operations tagged, 1/1 errors expected, 2/2 events expected, 1/1 records expected, 5/5 invariants broken, strict: 2/2 features (boundaryCoverage: error)
gate 4  drift         PASS  4 generated file(s) compared byte for byte against insurance/generated
```

## Related pages

- [Results and declared errors](../explanation/results-and-errors)
- [The manifest](../reference/manifest)
- [The generated runtime](../reference/generated-runtime)
- [Gherkin steps](../reference/gherkin-steps)
- [Declare an error](declare-an-error)
