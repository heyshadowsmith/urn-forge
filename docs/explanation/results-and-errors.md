# Results and declared errors

A handler can refuse an operation. For example, a policy is already cancelled, or a parcel is too heavy for express delivery. urn-forge calls this a declared error. Every handler returns a `Result`, and the `Result` holds either the output or one declared error. This page tells why, and how a declared error differs from the other ways that a call can fail.

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

The generated helpers `ok(value)` and `fail(errorUrn, fields)` build the two cases. `fail` is typed for each error URN, so `tsc` checks the fields of each error. If a handler fails with an error that its operation does not declare, `tsc` refuses the handler at gate 1.

Every handler returns a `Result`, also when its operation declares no errors. Its error type is then `never`. This gives one shape for all handlers. When a project adds the first error to an operation, the signature of the handler does not change again. The cost was one change that broke every handler, once: each return value went into `ok(…)`. `tsc` named each handler that needed the change.

## Four ways that a call fails

`executeOperation` gives one result for each call. A call that does not succeed fails in one of four ways, and each way has a different cause:

| Outcome | Cause | Who must act |
| --- | --- | --- |
| `DomainError` | The handler refused with `fail(…)` and a declared error. Nothing changed | The caller. The request was correct in form, but the domain refused it |
| `InputRejected` | The payload did not pass the input schema. The handler did not run | The caller. The request was not correct in form |
| `ContractViolation` | The handler broke its contract: its output or error fields did not pass their schema, it failed with an error that its operation does not declare, or it did not return a `Result` | The team that owns the core. This is a bug |
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

## Categories and `retryable` belong to the shell

Each declared error has a `category` and a `retryable` flag. The five categories are `validation`, `conflict`, `not_found`, `forbidden` and `precondition`. The core never reads these values. They go into the `DispatchMap` and into the `DomainError`, for the shell. A shell can use them to select an HTTP status, or to decide if a client can send the request again.

The metadata is in the manifest, not in the shell code, for two reasons. First, the person who declares the error is the person who knows if it is a conflict or a record that does not exist. Second, every shell that calls the domain reads the same values.

## Message templates

Each declared error has a message template, such as `Kind {kind_segment} in {short_key} is not a kind`. Each `{placeholder}` names a field of the error. `executeOperation` fills the template from the parsed fields.

The compiler checks each placeholder (pass 6). A placeholder must name a field of the error with `required: true`. Specification v1.1 only asks that a placeholder names a field. urn-forge adds the requirement because an optional field can be absent, and then the message would contain `undefined`. With this rule, every message that urn-forge makes is complete.

A placeholder is `{…}` with no space inside. Thus text such as `{ and }` stays text, but a typo such as `{kind_segmnt}` is still a placeholder, and the compiler reports it:

```
domain.manifest.yaml:98:12  error  unknown-placeholder  urn:urn_forge:toolchain:naming:error:unsupported_kind: message placeholder {kind_segmnt} names no field of the error (required fields: short_key, kind_segment)
```

## Why error fields are plain

A handler gives plain values to `fail`, and `executeOperation` parses and brands them. This is the same rule as for output: the core does not make brands. [The functional core and brands](./functional-core) tells why.

The parsed error has a `kind` property that holds the error URN. Callers can switch on it. As a result, no property of an error can have the name `kind`. The compiler reports such a field as `reserved-property`.

## Why events and `recordAs` wait

Specification v1.1 has two more parts that touch errors and results:

- A successful `Result` holds the events that the operation emits.
- An error can name an event in `recordAs`, which the shell can record for an audit trail.

Both parts name events, and urn-forge does not have the `event` kind at this time. To build them now would mean to build events first. Thus a successful `Result` holds only `{ ok: true, value }`, and the manifest refuses `recordAs` with the message that it "needs the event kind". Refer to [Scope](../reference/scope).

The helpers keep the shape of a `Result` out of the handlers. A handler calls `ok(…)` and does not write the object itself. Thus a handler does not have to write an `events` list that is always empty.

## Related pages

- [Tutorial: add a declared error](../tutorials/declared-errors)
- [Declare an error](../how-to/declare-an-error)
- [Call an operation from the shell](../how-to/call-an-operation)
- [The generated runtime](../reference/generated-runtime)
- [The functional core and brands](./functional-core)
