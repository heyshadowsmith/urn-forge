# Declare who may call

Many promises name who may call an operation: "only the claimant's manager may approve a claim", "only the owner, their manager and finance may read it". This guide declares the caller and the rules for each operation. urn-forge then refuses a caller that no rule allows, before your handler runs.

The shell still decides who the caller is: it reads the token, the key or the session. urn-forge decides what that caller may do.

The examples come from [`packages/urn-forge/tests/fixtures/callers/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/callers/).

## Before you start

- You have a declared error for a refusal, for example `forbidden`. Refer to [Declare an error](declare-an-error).
- To compare the caller with a stored record, the operation has `changes` (refer to [Declare states and moves](declare-states)), or `reads` (step 3).

## 1. Declare the caller

Add an entity with the values that the shell knows after it authenticates the caller. Name it in the header with `caller`:

```yaml
manifest:
  namespace: demo
  domain: callers
  version: 1.0.0
  caller: auth.entity.caller

auth.field.role:
  primitive: enum
  values: [employee, manager, finance]
  description: The role of the caller
auth.entity.caller:
  description: Who calls, as the shell authenticated them
  fields:
    - ref: auth.field.role
    - ref: auth.field.employee_id
```

## 2. Say who may call each operation

With a `caller` in the header, each operation must have `callers`. An operation without it stops `compile`:

```text
urn:demo:callers:claim:operation:check_claim_id: states no callers, but the manifest names the caller urn:demo:callers:auth:entity:caller; add callers, with allow: any for every caller
```

| Key | Value |
| --- | --- |
| `allow` | A list of rules. The call is allowed when one rule holds. Or `any`: every caller that the shell authenticated |
| `otherwise` | The declared error for each other caller. It must be in `errors` |

A rule reads `caller.`, `input.` and, with `changes` or `reads`, `current.`:

```yaml
claim.operation.approve_claim:
  description: Approve a submitted claim
  input: claim.entity.claim_ref
  output: claim.entity.claim
  changes:
    entity: claim.entity.claim
    from: [SUBMITTED]
    to: APPROVED
    otherwise: claim.error.invalid_state
  callers:
    allow:
      - caller.role = 'manager' and caller.employee_id = current.manager_id and caller.employee_id != current.employee_id
    otherwise: claim.error.forbidden
  errors: [claim.error.invalid_state, claim.error.forbidden]

claim.operation.check_claim_id:
  description: Check the form of a claim id, for any caller
  input: claim.entity.claim_ref
  output: claim.entity.claim_ref
  callers:
    allow: any
    otherwise: claim.error.forbidden
  errors: [claim.error.forbidden]
```

urn-forge fills the fields of `otherwise` from the caller, the record and the request, by property name. Each required field of the error must be a property of one of them. To hide a record from a caller that may not see it, use the error that the caller gets when there is no record, for example `not_found`.

## 3. Read a record without a change

To compare the caller with a record that the operation only reads, add `reads`. The handler gets the record as `current`, as with `changes`, and the rules can read `current.`:

```yaml
claim.operation.read_claim:
  description: Read a claim
  input: claim.entity.claim_ref
  output: claim.entity.claim
  reads:
    entity: claim.entity.claim
    missing: claim.error.not_found
  callers:
    allow:
      - caller.employee_id = current.employee_id
      - caller.employee_id = current.manager_id
      - caller.role = 'finance'
    otherwise: claim.error.forbidden
  errors: [claim.error.not_found, claim.error.forbidden]
```

An operation cannot have both `reads` and `changes`.

## 4. Pass the caller from the shell

The shell authenticates the request, then gives the caller to `executeOperation`:

```ts
const caller = await authenticate(request);
const current = await loadClaim(db, body.claim_id);
const result = executeOperation('urn:demo:callers:claim:operation:approve_claim', body, core, { caller, current });
```

`executeOperation` does these steps in this order:

1. The input parses.
2. The caller parses. Without a caller, the result is a `ContractViolation`:

   ```text
   urn:demo:callers:claim:operation:check_claim_id needs the caller, as the shell authenticated them: pass it as { caller }
   ```

3. The record parses. With `current: null`, the result is the `missing` error.
4. The callers. If no rule holds, the result is the `otherwise` error, and the handler does not run.
5. The state of `changes`, then the `requires` rules, then the handler.

The callers come before the state and before `requires`, so a caller who may not call does not learn the state or the values of the record from another refusal. The core does not get the caller: do not check it again in the handler.

## 5. Write the scenarios

1. In `features/support/steps.ts`, give the caller entity to the steps:

   ```ts
   import { CallerContract, DispatchMap, executeOperation } from '../../src/generated/domain.runtime.generated';

   registerOperationSteps({
     dispatch: DispatchMap,
     caller: CallerContract,
     execute: (urn, payload, options) => executeOperation(urn, payload, core, options),
   });
   ```

2. Give the caller in each scenario of an operation with `callers`, with `Given the caller is:`. Write a scenario for each rule of `allow`, and one that expects `otherwise`:

```gherkin
@urn:demo:callers:claim:operation:approve_claim
Scenario: A manager cannot approve their own claim
  Given the caller is:
    | role    | employee_id |
    | manager | E-2000      |
  And the current claim is:
    | claim_id       | state     | employee_id | manager_id |
    | CLM-0000000001 | SUBMITTED | E-2000      | E-2000     |
  When I run the operation with:
    | claim_id       |
    | CLM-0000000001 |
  Then the operation fails with "urn:demo:callers:claim:error:forbidden"
```

Gate 3 reports a scenario with no caller as `invalid-caller`:

```text
urn:demo:callers:claim:operation:read_claim states who may call it; give the caller with "Given the caller is:" before the operation runs
```

## Result

- The manifest states who may call each operation, and on which records.
- A caller that no rule allows gets the declared error, with no code in the handler.
- `urn-forge diff` reports a new `allow` rule as compatible, and a removed rule, new `callers`, or a new required field of the caller as breaking. Refer to [Change the contract](change-the-contract).

## Related pages

- [The manifest](../reference/manifest)
- [The generated code](../reference/generated-code)
- [Gherkin steps](../reference/gherkin-steps)
