# Core and shell

urn-forge divides an application into two parts. The core holds the business logic. The shell holds everything else: the parse of untrusted data, the I/O, and the call to `executeOperation`. Brands mark the line between the two parts in the type system, and a `Result` carries each answer of the core back to the shell. This page tells why urn-forge uses this design, and what it costs.

## Functional core, imperative shell

The core is a set of handlers, one for each operation, with the URN of the operation as the key. A handler is a plain, synchronous function. It receives data and returns data. It does no I/O.

The shell reads a request, loads data, calls `executeOperation`, and writes the result. The generated `executeOperation` parses the input, calls the handler, and parses its answer.

This division has these advantages:

- **A handler is easy to test.** A scenario only has to give a payload and read the result. The Cucumber steps of urn-forge do exactly this.
- **A handler is deterministic.** It has no clock, no network and no database, so the same input always gives the same result.
- **Untrusted data has one entrance.** The rule is "parse at the edge, trust in the core". The core never sees a value that did not pass the schema.

Handlers are synchronous for the same reason. An asynchronous handler would invite I/O into the core. The generated handler type returns a `Result`, not a `Promise`, so `tsc` refuses an `async` handler at gate 1. If an operation needs data from a database, the shell loads the data and puts it in the input. The same is true for the date of today: the shell sends it as a `date` field, and the core never reads the clock.

## Brands as proof of a parse

The generated schema of each field ends with `v.brand('<field URN>')`:

```ts
export const ParcelWeightGramsSchema = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(1),
  v.maxValue(30000),
  v.brand("urn:demo:shipping:parcel:field:weight_grams"),
);
```

The output type of this schema is not `number`. It is `number & Brand<"urn:demo:shipping:parcel:field:weight_grams">`. The correct way to get a value of this type is to parse it with the schema. Thus, when a handler receives a `ParcelWeightGrams`, the type tells it that the value is a safe integer from 1 to 30000. The handler does not have to examine the value again.

The brand holds the URN of the field, not only its primitive. Thus a function in the core that takes a branded price does not accept a branded weight. A `decimal`, a `date` and a `timestamp` are branded strings, so no binary float holds a decimal. For arithmetic on them, the core uses `urn-forge/exact`. Refer to [The package API](../reference/public-api).

A brand exists only in the types. At run time, a branded value is a plain number or string. Code can make a false brand with a type assertion, with a value of type `any`, or with a comment that turns off the type check. This site calls such a value a *forged* brand. Gate 2 refuses the three forms in the core and in the shell. It also refuses a value import of the generated schemas or of `valibot` in a core file. With gate 2, a branded type is proof of a parse: only a generated parser makes a branded value.

## Branded input, plain output

A handler receives branded input, but it returns plain output:

```ts
export type QuoteQuoteShippingHandler = (
  input: s.ParcelParcel,
) => Result<s.QuoteQuoteInput, s.QuoteTooHeavyForExpressInput>;
```

The core cannot make brands, so it cannot return branded values. `executeOperation` parses the output against the output schema. The parse checks the output and adds the brands. The fields of a declared error and of an event follow the same rule.

This choice has these results:

- **A bad output is a run-time failure, not a type error.** If a handler returns a value that breaks a constraint of the output, `executeOperation` gives a `ContractViolation`.
- **A handler can pass input values through.** A branded type is narrower than its plain type, so it fits into the output with no conversion.
- **The types do not stop all mistakes in the output.** A handler can put a weight into a price field, because both are plain numbers in the output type. Only the constraints of the output field, and the scenarios, find this mistake.

## Why every handler returns a `Result`

A handler can refuse an operation. For example, a parcel is too heavy for express delivery. An exception is a bad way to refuse:

- The type of a function does not list its exceptions, so `tsc` cannot make sure that a caller handles each refusal.
- A refusal with no URN cannot be part of the chain, so gate 3 cannot ask for a scenario that expects it.
- The shell cannot tell a refusal from a bug.

A `Result` holds either the output and its events, or one declared error. The handler type above lists the declared errors of the operation. The generated helpers `ok(value, events)` and `fail(errorUrn, fields)` make the two cases, and `emit` makes an event. If a handler fails with an error that its operation does not declare, `tsc` refuses the handler at gate 1. An operation with no declared errors has the error type `never`. Thus all handlers have one shape, and the first error of an operation does not change its signature.

## Four ways that a call fails

A call to `executeOperation` that does not succeed fails in one of four ways:

| Outcome | Cause | Who must act |
| --- | --- | --- |
| `DomainError` | The handler refused with `fail(…)` and a declared error. Nothing changed | The caller. The request was correct in form, but the domain refused it |
| `InputRejected` | The payload did not pass the input schema. The handler did not run | The caller. The request was not correct in form |
| `ContractViolation` | The handler broke its contract, for example with an output that does not pass its schema | The team that owns the core. This is a bug |
| An exception | The handler threw. `executeOperation` does not catch it | The shell, as for any other fault |

A fifth outcome, `UnknownOperation`, occurs when the URN names no operation of the domain. Each outcome has a different `kind`, so the shell can map each one to a response, for example an HTTP status. urn-forge does not make this map.

A declared error is part of the contract, and an exception is not. Each declared error has a `category` and a `retryable` flag. The core never reads them. They are in the manifest so that the person who declares the error says what it means, and every shell reads the same values.

### An invariant or a declared error

Both can refuse a request that is correct in each field. Choose with one question: can the rule be decided from the input entity alone, with the [rule language](../reference/rule-language)? If yes, use an invariant. The schema, the generated SQL and gate 3 then know the rule, and a bad request gets `InputRejected` before the core runs. If the rule needs data that the entity does not hold, or a calculation that the rule language does not have, use a declared error.

## Events beside refusals

An event and an error look alike: both have a URN, fields and a `kind` property. Their meanings are opposite. An error is a refusal: the operation did not happen. An event is a fact: the operation happened.

Thus a failure has no events. Anything that reads a stream of events can trust each item in it. The handler type lists only the events in `emits`, and `executeOperation` parses each event. If an event breaks its schema, the shell gets a `ContractViolation` and no events, so it never publishes an event that breaks the contract.

If a team wants an audit record of a refusal, an error can name an event in `recordAs`. `executeOperation` makes that event from the fields of the error, and gives it as `record` on the `DomainError`. It never goes into the stream of facts.

## What the design costs

- **A branded value cannot always act as its plain type.** For example, a branded `enum` value cannot index an object. Assign the value to its plain type first. [Use branded values in the core](../how-to/use-branded-values) gives the cases.
- **Type messages are long.** A brand includes the full URN.
- **The shell has more work.** Each read and write moves to the shell. An operation that needs data in the middle of its logic must become two operations, or must get all the data before the call.

## Related pages

- [Call an operation from the shell](../how-to/call-an-operation)
- [Declare an error](../how-to/declare-an-error)
- [The generated code](../reference/generated-code)
