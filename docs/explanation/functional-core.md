# The functional core and brands

urn-forge divides an application into two parts. The core holds the business logic. The shell holds everything else: the parse of untrusted data, the I/O, and the call to `executeOperation`. Brands mark the line between the two parts in the type system. This page tells why urn-forge uses this design, and what it costs.

## Functional core, imperative shell

The core is a set of handlers, one for each operation, with the URN of the operation as the key. A handler is a plain, synchronous function. It receives data and returns data. It does no I/O.

The shell does the work that the core must not do. It reads a request, loads data, parses the payload, calls `executeOperation`, and writes the result. The generated `executeOperation` is part of the shell, and so is the code that calls it.

This division has these advantages:

- **A handler is easy to test.** It is a function from data to data, so a scenario only has to give a payload and read the result. The Cucumber steps of urn-forge do exactly this.
- **A handler is deterministic.** It has no clock, no network and no database, so the same input always gives the same result.
- **Untrusted data has one entrance.** [Specification v1.1](../project/spec-v1-1) states the principle as "parse at the edge, trust in the core". The shell parses each payload once. The core never sees a value that did not pass the schema.

## Brands as proof of a parse

The Valibot plugin ends each field schema with `v.brand('<field URN>')`:

```ts
export const ParcelWeightGramsSchema = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(1),
  v.maxValue(30000),
  v.brand("urn:demo:shipping:parcel:field:weight_grams"),
);
```

The output type of this schema is not `number`. It is `number & Brand<"urn:demo:shipping:parcel:field:weight_grams">`. A plain `number` cannot go where this type is necessary. The usual way to get a value of this type is to parse it with the schema. Thus, when a handler receives a `ParcelWeightGrams`, the type tells the handler that the value is a safe integer from 1 to 30000. The handler does not have to examine the value again.

A `decimal`, a `date` and a `timestamp` are branded strings in the core. A `decimal` stays a string, so no binary float holds it. The core converts it with a decimal library if it does arithmetic. A list property is a list of branded values.

The brand holds the URN of the field, not only its primitive. Two fields with the same primitive have two different branded types. Thus a function in the core that takes a branded price does not accept a branded weight.

### The limit of a brand

A TypeScript brand exists only in the types. At run time, a branded value is a plain number or string. Code can make a false brand with a type assertion such as `as`, and `tsc` accepts it.

Specification v1.1 plans gate 2, a lint profile, to stop this. Its rule `no-brand-construction` would not let the core import Valibot's `brand` or the generated schemas, and other rules would forbid type assertions. urn-forge does not have gate 2 at this time. Thus a brand is proof of a parse only while the core does not use type assertions. Refer to [Scope](../reference/scope).

## Branded input, plain output

A handler receives branded input, but it returns plain output:

```ts
export type QuoteQuoteShippingHandler = (
  input: s.ParcelParcel,
) => Result<s.QuoteQuoteInput, never>;
```

`s.ParcelParcel` is the branded output type of the input schema. `s.QuoteQuoteInput` is the plain input type of the output schema. This is different from specification v1.1, which gives handlers a branded output type.

The [MVP plan](../project/mvp-plan) found that the specification asks for two things that cannot both be true:

1. The handler returns branded output.
2. Gate 2 forbids the core to make brands.

A handler can only get a branded value from a parse or from a type assertion. Gate 2 forbids both in the core. The MVP plan thus changed the first rule. The handler returns the plain shape, and `executeOperation` parses the output against the output schema. The parse checks the output and adds the brands. The fields of a declared error follow the same rule.

This choice has these results:

- **A bad output is a run-time failure, not a type error.** If a handler returns a value that breaks a constraint of the output, `executeOperation` gives a `ContractViolation`. For example, a `self/` handler that returns `Not a URN` for a field with a `regex` constraint gives this result:

  ```json
  {"ok":false,"kind":"ContractViolation","urn":"urn:urn_forge:toolchain:naming:operation:to_urn","issues":[{"path":"urn","fieldUrn":"urn:urn_forge:toolchain:naming:field:urn","message":"Invalid format: Expected /^(?:urn(:[a-z][a-z0-9_]{0,62}){5})$/u but received \"Not a URN\""}]}
  ```

- **A handler can pass input values through.** A branded type is narrower than its plain type. Thus a handler can put a branded input value into its output with no conversion.
- **The types do not stop all mistakes in the output.** A handler can put a weight into a price field, because both are plain numbers in the output type. Only the constraints of the output field, and the scenarios, can find this mistake.

## Why handlers are synchronous

Specification v1.1 decided "synchronous only" for handlers, and all I/O stays in the shell. An asynchronous handler would invite I/O into the core. Then the core would no longer be deterministic, and a scenario would need a database or a network to test it.

The generated handler type returns a `Result`, not a `Promise`. Thus `tsc` refuses an `async` handler at gate 1:

```
Type 'Promise<Success<{ price_cents: number & Brand<"urn:demo:shipping:parcel:field:weight_grams">; }>>' is not assignable to type 'Result<{ price_cents: number; }, never>'.
```

If a handler gets past the types and returns a `Promise`, `executeOperation` gives a `ContractViolation`, because a `Promise` is not a `Result`.

If an operation needs data from a database, the shell loads the data before the call and puts it in the input. If the result must be stored, the shell stores it after the call.

## What the design costs

The design has costs, and a project pays them every day:

- **A branded value cannot always act as its plain type.** For example, a branded `enum` value cannot index an object. `BASE_CENTS[zone]` fails with `TS7053`, because the brand intersection is not a key type:

  ```
  TS7053: Element implicitly has an 'any' type because expression of type '("domestic" | "international") & Brand<"urn:demo:shipping:parcel:field:zone">' can't be used to index type '{ readonly domestic: 500; readonly international: 1500; }'.
  ```

  The fix is to assign the value to its plain type first. The tutorial core shows this:

  <<< @/../packages/urn-forge/tutorial/1-first-domain/core.ts{8-9}

  [Use branded values in the core](../how-to/use-branded-values) gives the other cases.
- **Type messages are long.** A brand includes the full URN, so a type error that names a branded type is long.
- **The shell has more work.** Each read and write moves to the shell, before or after the call. An operation that needs data in the middle of its logic must become two operations, or must get all the data before the call.

## Related pages

- [Use branded values in the core](../how-to/use-branded-values)
- [Call an operation from the shell](../how-to/call-an-operation)
- [The generated runtime](../reference/generated-runtime)
- [Results and declared errors](./results-and-errors)
- [Departures from the specification](./departures-from-the-spec)
