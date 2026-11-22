# Emit an event

An event records a fact: the operation happened, and other systems can learn of it. This guide declares an event, emits it from the handler, publishes it from the shell, and tests it with a scenario. It then states how many events a success has, delivers the events in order through an outbox, and records a refusal as an event with `recordAs`.

The examples come from [`packages/urn-forge/insurance/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/insurance/). The commands ran from `packages/urn-forge`. In your project, run them from the folder of `urn-forge.config.ts`, and leave out `--config`.

## Before you start

- You have an operation with a handler and a feature. Refer to [Add an operation](add-an-operation).
- Use an event only for a success. A refusal is a declared error, and an operation that refuses emits no event.

## 1. Declare the event and list it on the operation

1. Add an entry with the short key `<context>.event.<identifier>`. Give it a `description` and, as in an entity, `fields`.
2. Add the short key of the event to `emits` on the operation:

```yaml
policy.event.policy_issued:
  description: A policy was issued
  fields:
    - ref: policy.field.policy_id
    - link: customer.entity.customer
      as: holder
    - ref: policy.field.premium
policy.event.policy_cancelled:
  description: A policy stopped, with the refund for the days it does not cover
  fields:
    - ref: policy.field.cancellation_date
    - ref: policy.field.refund

policy.operation.issue_policy:
  description: Issue a policy as requested
  input: policy.entity.policy
  output: policy.entity.policy
  emits: [policy.event.policy_issued]
```

Obey these rules, or `compile` stops:

- An event has no `key`. urn-forge does not store events.
- No property of the event can have the name `kind`. The payload uses `kind` for the URN of the event.
- `emits` names only events.

An operation can list more than one event, and one event can be on more than one operation. The handler can return each listed event zero times or more. For the full rules, refer to [The manifest](../reference/manifest).

## 2. Emit the event from the handler

Run `compile`. The generated runtime then has `emit`. Give `ok` the output and a list of events:

```ts
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

export const core = {
  'urn:acme:insurance:policy:operation:issue_policy': (policy) =>
    ok({ ...policy }, [
      emit('urn:acme:insurance:policy:event:policy_issued', { policy_id: policy.policy_id, holder: policy.holder, premium: policy.premium }),
    ]),
  // …
} satisfies DomainCoreImplementation;
```

- `emit` adds `kind` itself. If the event has no fields, call `emit` with the URN only.
- A handler that returns `fail(…)` returns no event.
- If the operation does not list the event, gate 1 fails with a type error.

Gate 1 does not find an event that the handler does not return. Only a scenario finds it (step 4).

## 3. Publish the events from the shell

On success, `executeOperation` gives `events` after `output`. Each event has `urn` and `fields`. The fields are parsed and branded, and include `kind`:

```ts
const result = executeOperation('urn:acme:insurance:policy:operation:issue_policy', body, core);
if (result.ok) for (const event of result.events) publish(event.urn, event.fields);
```

`publish` is your code, for example a message queue. To write the events in the transaction of the change, and to send them in order, use the outbox of the Postgres extra (step 6).

If the handler returns an event that its operation does not list, or that does not match its schema, the result is `ContractViolation`. Refer to [Call an operation from the shell](call-an-operation).

## 4. Expect the event in a scenario

Add `Then the operation emits "<event URN>"` after the step that checks the output. To check the fields, add a table after a colon. After a declared error, add `Then the operation emits no event` (highlighted):

<<< @/../packages/urn-forge/insurance/features/cancel_policy.feature{12-14,51 gherkin}

- The table columns must be fields of the event. An empty cell means that the field must be absent.
- The step does not check the count or the order of the events.

If the handler does not return the event, the step fails:

```
Error: urn:acme:insurance:policy:operation:cancel_policy did not emit urn:acme:insurance:policy:event:policy_cancelled (emitted: nothing)
```

Gate 3 makes sure that a scenario expects each event of a tagged operation. If no scenario expects one, gate 3 reports `uncovered-event`. If a step names an event that the operation does not list, gate 3 reports `undeclared-event`. Refer to [Close boundary gaps](close-boundary-gaps).

## 5. Say how many events a success has

An event in `emits` can come zero or more times. To promise one event for each change, write the item as `{ event }`. To promise it only for some answers, add a `when` rule. The rule reads `input.`, `current.` and `output.`, as an `ensures` rule does:

```yaml
payment.operation.create_payment:
  description: Create a payment, which the bank authorizes now or later
  input: payment.entity.request
  output: payment.entity.payment
  emits:
    - event: payment.event.authorized
      when: output.status = 'authorized'
    - event: payment.event.pending
      when: output.status = 'pending'
  ensures:
    - event.payment_id = output.payment_id
    - event.status = output.status
```

- On each success where the rule holds, the handler must return exactly one of the event. Where the rule does not hold, it must return none.
- When each item of `emits` has this form, an `ensures` rule can name `event.<property>`: the one event of the success. The property must be in each of those events.

`executeOperation` examines the count and the rules. A handler that does not obey them gets a `ContractViolation`:

```text
urn:demo:delivery:payment:operation:create_payment emitted 0 urn:demo:delivery:payment:event:authorized, but it emits exactly one when output.status = 'authorized'
```

```text
the handler for urn:demo:delivery:payment:operation:capture_payment answered a value that breaks ensures: event.previous_status = current.status
```

Gate 3 asks for a scenario that emits an event with `when`, and for a successful scenario without it. Write the second with this step:

```gherkin
    Then the operation emits no "urn:demo:delivery:payment:event:pending"
```

## 6. Deliver the events in order

A consumer must drop a duplicate event, and must get the events of one record in the order of their changes. Add `delivery` to the event:

```yaml
payment.event.authorized:
  description: A payment was authorized
  fields:
    - ref: event.field.event_id
    - ref: event.field.sequence
    - ref: payment.field.payment_id
    - ref: payment.field.status
    - ref: payment.field.amount
  delivery:
    id: event_id
    orderBy: payment_id
    sequence: sequence
```

1. The shell gives each event its id. The core does not set the id or the sequence, and the type of `emit` does not have them:

   ```ts
   const result = executeOperation(urn, body, core, { current, newEventId: () => crypto.randomUUID() });
   ```

   Without `newEventId`, the result is a `ContractViolation`:

   ```text
   urn:demo:delivery:payment:operation:create_payment emitted urn:demo:delivery:payment:event:authorized, whose delivery needs an event id: pass newEventId to executeOperation
   ```

   In `features/support/steps.ts`, give a `newEventId` that makes the same ids each time, so a scenario can check `event_id`.

2. Add the Postgres extra to the config. It does not need a table. The schema then has the table `"outbox"."<domain>"`, and the store file has three functions. Refer to [The Postgres schema](../reference/postgres-schema#the-outbox).

3. Write the events in the transaction of the change:

   ```ts
   for (const { text, values } of [...replacePaymentFrom(result.output, ['authorized']), ...insertEvents(result.events)]) {
     await tx.query(text, values);
   }
   ```

4. In a different process, send the events, and mark each one after your transport takes it:

   ```ts
   const { text, values } = nextEvents(100);
   for (const row of (await db.query<OutboxRow>(text, values)).rows) {
     await send(row.urn, row.payload);
     const marked = markPublished(row.id);
     await db.query(marked.text, marked.values);
   }
   ```

What each part keeps:

| Promise | Kept by |
| --- | --- |
| No event is lost | The events commit in the transaction of the change |
| At least once | A row stays until `markPublished`. A process that stops before it sends the event again |
| A unique id | The id is the primary key of the outbox |
| In order for each record | `nextEvents` gives the events in the order they were written. The sequence is 1 more for each event of one `orderBy` value |
| The transport | Your code: a queue, a broker or a webhook |

Send the events of one `orderBy` value one at a time. If a send fails, stop that value until the next call of `nextEvents`.

## 7. Record a refusal with recordAs

A declared error is not an event. To keep a refusal in an audit trail, set `recordAs` on the error to an event. The runtime makes the event from the fields of the error:

```yaml
policy.event.refund_refused:
  description: A cancellation was refused because its refund was below the minimum, for an audit trail
  fields:
    - ref: policy.field.refund
    - ref: policy.field.cancellation_date
      required: false

policy.error.refund_below_minimum:
  description: The refund is too small to pay out
  category: precondition
  retryable: false
  message: A refund of {refund} is below the minimum of 1.00
  fields:
    - ref: policy.field.refund
  recordAs: policy.event.refund_refused
```

- The event must have each property of the error, with the same target, `required` and `many`.
- Each other property of the event must be optional.

If not, `compile` stops with `invalid-record-as`:

```
insurance/domain.manifest.yaml:162:13  error  invalid-record-as  urn:acme:insurance:policy:error:refund_below_minimum: recordAs urn:acme:insurance:policy:event:refund_refused has no property "refund", which the error has
```

When the handler returns the error, the `error` of the `DomainError` result has `record`, with `urn` and `fields`. The `record` is not in `events`. To test it, add a step after the step that expects the error:

```gherkin
    Then the operation fails with "urn:acme:insurance:policy:error:refund_below_minimum":
      | refund |
      | 0.00   |
    And the operation emits no event
    And the refusal is recorded as "urn:acme:insurance:policy:event:refund_refused":
      | refund |
      | 0.00   |
```

## 8. Check compatibility

A consumer of the events handles each event that it knows. Thus `urn-forge diff` treats a new event in `emits` as a breaking change. Here the old manifest has no `emits` on `cancel_policy`:

```
breaking    urn:acme:insurance:policy:operation:cancel_policy  the new event urn:acme:insurance:policy:event:policy_cancelled widens a value that callers receive, which breaks callers that receive it
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

An event that you remove from `emits` is a compatible change:

```
compatible  urn:acme:insurance:policy:operation:cancel_policy  removing the event urn:acme:insurance:policy:event:policy_cancelled narrows a value that callers receive
diff passed: 0 breaking, 1 compatible, 0 lifecycle change(s)
```

The fields of an event have the Out use. A new `{ event }` or `{ event, when }` item is compatible: it promises more. A removed or changed one is breaking, and so is each change of `delivery`. Refer to [Change the contract](change-the-contract).

## Result

`npx urn-forge verify --config insurance/urn-forge.config.ts` shows that a scenario expects each event:

```
gate 1  completeness  PASS  tsc: 0 error(s) over insurance/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  2 feature(s), 15 scenario(s), 2/2 operations tagged, 1/1 errors expected, 2/2 events expected, 1/1 records expected, 5/5 invariants broken, strict: 2/2 features (boundaryCoverage: error)
gate 4  drift         PASS  4 generated file(s) compared byte for byte against insurance/generated
```

## Related pages

- [Core and shell](../explanation/core-and-shell)
- [Gherkin steps](../reference/gherkin-steps)
- [Declare an error](declare-an-error)
