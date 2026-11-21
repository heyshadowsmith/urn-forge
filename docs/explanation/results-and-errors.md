# Results and declared errors

A handler can refuse an operation. For example, a policy is already cancelled, or a parcel is too heavy for express delivery. urn-forge calls this a declared error. Every handler returns a `Result`, and the `Result` holds either the output and its events, or one declared error. This page tells why, how a declared error differs from the other ways that a call can fail, and how an event differs from an error.

## Why every handler returns a `Result`

Before the `error` kind, a handler could only succeed. A refusal had no path except an exception. An exception has three problems for urn-forge:

- **The type does not show it.** A function type in TypeScript does not list the exceptions that the function can throw. Thus `tsc` cannot make sure that a caller handles each refusal.
- **The manifest does not name it.** A refusal that has no URN cannot be part of the chain. Gate 3 cannot ask for a scenario that expects it.
- **It looks like a bug.** The shell cannot tell a refusal from a fault in the code without a convention that each team writes again.

A `Result` solves the three problems. The handler type lists the declared errors of the operation:

```ts
export type QuoteQuoteShippingHandler = (
  input: s.ParcelParcel,
) => Result<s.QuoteQuoteInput, s.QuoteTooHeavyForExpressInput>;
```

The generated helpers `ok(value, events)` and `fail(errorUrn, fields)` build the two cases. `fail` is typed for each error URN, so `tsc` checks the fields of each error. If a handler fails with an error that its operation does not declare, `tsc` refuses the handler at gate 1.

Every handler returns a `Result`, also when its operation declares no errors. Its error type is then `never`. This gives one shape for all handlers. When a project adds the first error to an operation, the signature of the handler does not change again. The cost was one change that broke every handler, once: each return value went into `ok(…)`. `tsc` named each handler that needed the change.

## Four ways that a call fails

`executeOperation` gives one result for each call. A call that does not succeed fails in one of four ways, and each way has a different cause:

| Outcome | Cause | Who must act |
| --- | --- | --- |
| `DomainError` | The handler refused with `fail(…)` and a declared error. Nothing changed | The caller. The request was correct in form, but the domain refused it |
| `InputRejected` | The payload did not pass the input schema. The handler did not run | The caller. The request was not correct in form |
| `ContractViolation` | The handler broke its contract: its output, error fields or event fields did not pass their schema, it failed with an error that its operation does not declare, it returned an event that its operation does not emit, or it did not return a `Result` | The team that owns the core. This is a bug |
| An exception | The handler threw. `executeOperation` does not catch it | The shell, as for any other fault |

A fifth outcome, `UnknownOperation`, occurs when the URN names no operation of the domain.

The separation lets the shell map each outcome to a different response. For an HTTP shell, a `DomainError` can become a 4xx status, an `InputRejected` a 400, and a `ContractViolation` a 500-class failure. urn-forge does not make this map. It gives each outcome a different `kind`, so the shell can make it.

Here is a real `DomainError` from urn-forge's own domain, for the short key `policy.widget.x`:

```json
{
  "ok": false,
  "kind": "DomainError",
  "urn": "urn:urn_forge:toolchain:naming:operation:parse_short_key",
  "error": {
    "urn": "urn:urn_forge:toolchain:naming:error:unknown_kind",
    "category": "validation",
    "retryable": false,
    "message": "Kind widget in policy.widget.x is not a kind",
    "fields": {
      "kind": "urn:urn_forge:toolchain:naming:error:unknown_kind",
      "short_key": "policy.widget.x",
      "kind_segment": "widget"
    }
  }
}
```

### Declared errors and exceptions

A declared error is part of the contract. An exception is not. [Specification v1.1](../project/spec-v1-1) says that unexpected failures, such as bugs and I/O faults, "are not declared and are not part of the contract". Thus `executeOperation` does not catch exceptions and does not change them into a `ContractViolation`. The shell handles them as it handles any other fault.

### `validation` and `InputRejected`

The category `validation` can look like `InputRejected`, but the two are different. `InputRejected` means that the payload is not correct in form: a field is absent, or a value breaks a constraint in the manifest. The core never sees such a payload. `validation` means that the core examined a correct payload and found that it breaks a domain rule, such as a coverage limit. Specification v1.1 keeps this line: "Malformed input never reaches the core."

### An invariant or a declared error

An invariant and a declared error can both refuse a request that is correct in each field. Choose with one question: can the rule be decided from the input entity alone, with the [rule language](../reference/rule-language)?

| The rule | Use | Result |
| --- | --- | --- |
| Compares fields of one entity, for example "the expiry date is after the effective date" | An invariant | `InputRejected`, before the core runs. The schema, the generated SQL and gate 3 know the rule |
| Needs data that the entity does not hold, a calculation that the rule language does not have, or a decision of the business, for example "a member can have at most five loans" | A declared error | `DomainError`, from the core. The caller gets the category, `retryable` and a message |

An invariant is the stronger choice when it can express the rule, because every part of the chain knows it. A declared error is the choice for the other rules. Refer to [Add an invariant](../how-to/add-an-invariant) and [Declare an error](../how-to/declare-an-error).

### Data that the input does not carry

The core is a function of its input. It cannot read a database, a clock or the session of the caller. If a rule needs such data, for example the tier of a member or the number of loans that a member has, the shell gets the data before the call and puts it in the input:

1. Declare a field for each value, for example `member.field.tier` and `member.field.open_loans`.
2. Put the fields in the input entity, or embed an entity that holds them.
3. In the shell, read the values, add them to the payload, and call `executeOperation`.

The values then pass their schemas, as the other input does, and a scenario can send them in a column. The same is true for the date of today: the shell sends it as a `date` field, and the core never reads the clock. Thus each scenario gives the same result on each day.

## Categories and `retryable` belong to the shell

Each declared error has a `category` and a `retryable` flag. The five categories are `validation`, `conflict`, `not_found`, `forbidden` and `precondition`. The core never reads these values. They go into the `DispatchMap` and into the `DomainError`, for the shell. A shell can use them to select an HTTP status, or to decide if a client can send the request again.

The metadata is in the manifest, not in the shell code, for two reasons. First, the person who declares the error is the person who knows if it is a conflict or a record that does not exist. Second, every shell that calls the domain reads the same values.

## Message templates

Each declared error has a message template, such as `Kind {kind_segment} in {short_key} is not a kind`. Each `{placeholder}` names a field of the error. `executeOperation` fills the template from the parsed fields.

The compiler checks each placeholder (pass 6). A placeholder must name a field of the error with `required: true`. Specification v1.1 only asks that a placeholder names a field. urn-forge adds the requirement because an optional field can be absent, and then the message would contain `undefined`. With this rule, every message that urn-forge makes is complete.

A placeholder is `{…}` with no space inside. Thus text such as `{ and }` stays text, but a typo such as `{kind_segmnt}` is still a placeholder, and the compiler reports it:

```
domain.manifest.yaml:107:12  error  unknown-placeholder  urn:urn_forge:toolchain:naming:error:unknown_kind: message placeholder {kind_segmnt} names no field of the error (required fields: short_key, kind_segment)
```

## Why error fields are plain

A handler gives plain values to `fail`, and `executeOperation` parses and brands them. This is the same rule as for output: the core does not make brands. [The functional core and brands](./functional-core) tells why.

The parse also applies the constraints of each field. Thus a value of an error must be a value that its field accepts. If the field of an error property has `max: 28`, the error cannot carry `29`: `executeOperation` gives `ContractViolation`, not the error. To report a value that the input refused to accept, declare a field without that limit for the error. A scenario that expects the error with the edge value finds such a mistake.

The parsed error has a `kind` property that holds the error URN. Callers can switch on it. As a result, no property of an error can have the name `kind`. The compiler reports such a field as `reserved-property`.

## Events: facts beside refusals

An operation can also tell other systems what happened, for example that a policy was issued. urn-forge calls this an event. A handler returns its events with its output: `ok(policy, [emit('…:event:policy_issued', { … })])`. `executeOperation` parses each event, and the shell gets the events in `events`. The shell can then publish them, or keep them in an outbox.

An error and an event look alike. Both have a URN, fields, and a `kind` property in the payload. They have opposite meanings:

| | A declared error | An event |
| --- | --- | --- |
| Meaning | A refusal: the operation did not happen | A fact: the operation happened |
| When | Only on a failure | Only on a success |
| How many | Exactly one | Zero, one or more, of the kinds in `emits` |
| Who reads it | The caller | The shell, and the systems that it publishes to |

A failure has no events. [Specification v1.1](../project/spec-v1-1) gives the reason: an event never tells of a refusal, "so anything that consumes an event stream can trust every item in it". A refusal that changed nothing is not a fact that other systems must know. Thus `Failure` has no `events` property, and the step `Then the operation emits no event` passes after a declared error.

The handler type lists only the events of its operation. Thus, at gate 1, `tsc` refuses an event that is not in the `emits` of the operation. `executeOperation` also refuses it at run time, with `ContractViolation`. It also refuses an event whose fields break its schema. In both cases, the shell gets no output and no events. Thus a shell never publishes an event that breaks the contract.

The manifest does not set how many events of each kind an operation returns, or their sequence. One call can emit one `line_added` event for each line of an order, so a count depends on the input. A count rule would be a second rule language. A scenario that must show a count can show it in the output table.

`ok(value)` with no events stays correct, and gives `events: []`. Thus a handler of an operation with no events did not change when urn-forge added events.

## `recordAs`: an audit record of a refusal

A refusal is not an event, but a team can still want a record of it, for example in an audit trail. `recordAs` is the one bridge between the two kinds. An error can name an event in `recordAs`. The core never returns this event. When the handler fails with the error, `executeOperation` makes the event from the fields of the error, and gives it as `record` on the `DomainError`. The shell can store it. It is not one of the events of the operation, so it never gets into the stream of facts.

The specification says that the fields of the event must be "a superset of the error's". urn-forge is stricter: each other property of the event must be optional. If the event had a mandatory property that the error does not have, the runtime could not make the event from the error. Pass 6 thus refuses such an event with `invalid-record-as`, and the build of each record is sure to succeed. If a team needs more data in the audit record, the shell can make its own record from the `DomainError`.

## Related pages

- [Tutorial: add a declared error](../tutorials/declared-errors)
- [Declare an error](../how-to/declare-an-error)
- [Call an operation from the shell](../how-to/call-an-operation)
- [The generated runtime](../reference/generated-runtime)
- [Emit an event](../how-to/emit-an-event)
