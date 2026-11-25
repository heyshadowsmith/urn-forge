---
layout: home

hero:
  name: urn-forge
  text: Write the contract once. Prove the code keeps it.
  tagline: You write a domain's promises in one YAML manifest. urn-forge generates the types, the schemas and a harness that checks every input and every answer of your code. CI fails when the code, the scenarios or a change break a promise.
  actions:
    - theme: brand
      text: Start the tutorial
      link: /tutorials/first-domain
    - theme: alt
      text: Why it works this way
      link: /explanation/why-urn-forge
  image:
    src: /hero-trace.svg
    alt: The manifest traced through the generated code and the core to a feature that passes

features:
  - icon:
      light: /icons/manifest-light.svg
      dark: /icons/manifest-dark.svg
    title: Declare
    details: Definitions, rules and operations in YAML, in JSON Schema's words (type, required, enum, minimum). Your own rules are expressions in a subset of CEL.
  - icon:
      light: /icons/contracts-light.svg
      dark: /icons/contracts-dark.svg
    title: Generate
    details: TypeScript types, Valibot schemas (Standard Schemas) and runOperation, a harness around your code. Optionally, a Postgres schema with the rules as constraints.
  - icon:
      light: /icons/gate-light.svg
      dark: /icons/gate-dark.svg
    title: Prove
    details: verify fails CI when the code, the scenarios or the generated files no longer agree with the manifest. diff fails it when a change breaks callers without a new major version.
---

## The problem

Seating a restaurant booking has a contract: only a confirmed booking is seated, and seating changes nothing but the state. A TypeScript type can say that the function returns a `Booking`. It cannot say either promise. The promises live in a ticket and in tests that nobody links to them, so when the code drifts, nothing fails.

## What you write

The promises, as named rules in a manifest. This is part of the [booking example](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/booking):

```yaml
rules:
  was_confirmed:
    description: The booking was confirmed
    rule: input.stored_booking.state == 'confirmed'
    message: The booking was not confirmed

  keeps_the_party:
    description: Seating changes the state only
    rule: >-
      output.reference == input.stored_booking.reference &&
      output.party_size == input.stored_booking.party_size &&
      output.contact == input.stored_booking.contact
    message: Seating may change only the state

operations:
  seat_booking:
    description: Seat the party of a booking
    input: seat_request
    output:
      - booking: [was_confirmed, is_seated, keeps_the_party]
      - invalid_state: [was_not_confirmed, names_the_request]
```

`seat_booking` answers a `booking` or a refusal, `invalid_state`, and each answer lists the rules that hold when it comes back. Your business logic stays an ordinary function, typed by the generated `DomainCore`:

<<< @/../packages/urn-forge/tests/fixtures/booking/core.ts

## What it catches

Suppose a change drops the check, and the core seats every booking:

```ts
seat_booking: ({ stored_booking }) => answer('booking', { ...stored_booking, state: 'seated' }),
```

**Without urn-forge**, `tsc` passes: the answer is still a `Booking`. The bug ships.

**With urn-forge**, your application calls the core through the generated `runOperation(core, 'seat_booking', input)`. For a cancelled booking, it gives this in place of the answer:

```json
{
  "ok": false,
  "operation": "seat_booking",
  "kind": "ContractViolation",
  "failures": [
    {
      "definition": "seat_booking",
      "rule": "was_confirmed",
      "path": "",
      "message": "The booking was not confirmed"
    }
  ]
}
```

A bad input gets `InputRejected` before the core runs. A refusal such as `invalid_state` is a normal answer.

## What you get

- **One generated TypeScript file**: a type and a Valibot schema for each definition, and `runOperation`, the harness. Each schema is a [Standard Schema](https://standardschema.dev), so tRPC, Hono and form libraries can use it. The file imports only `valibot`.
- **Cucumber steps for any manifest.** You write the `.feature` files.
- **`urn-forge verify`**, four gates for CI:

  | Gate | It fails when |
  | --- | --- |
  | 1. Completeness | An operation has no function in the core, or the function has the wrong type |
  | 2. Boundary | Your application calls the core without the harness |
  | 3. Gherkin | An operation, an output or a rule has no scenario |
  | 4. Drift | A generated file is not what `compile` writes now |

- **`urn-forge diff`**, which fails a change that can break callers unless the major version goes up.
- **Optionally, a Postgres schema** with a `CHECK` constraint for each rule that SQL can state, and the statements to write and read the rows.

urn-forge is a harness, not a framework: it does not route requests, open transactions or own your logic. This site describes urn-forge 0.2.0, which is not on npm yet.

[Start the tutorial](./tutorials/first-domain): from `urn-forge init` to a strict `verify` in about 20 minutes.
