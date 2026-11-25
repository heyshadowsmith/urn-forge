---
layout: home

hero:
  name: urn-forge
  text: Write the contract once. Prove that the code keeps it.
  tagline: You write the rules of a domain in one YAML manifest. urn-forge generates the types, the schemas and a harness that checks each input and each answer of your code. CI fails when the code, the scenarios or a change break a rule.
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
    details: Write definitions, rules and operations in YAML, with the words of JSON Schema (type, required, enum, minimum). Write your own rules as expressions in a subset of CEL.
  - icon:
      light: /icons/contracts-light.svg
      dark: /icons/contracts-dark.svg
    title: Generate
    details: urn-forge generates TypeScript types, Valibot schemas (Standard Schemas) and runOperation, a harness around your code. It can also generate a Postgres schema, with the rules as constraints.
  - icon:
      light: /icons/gate-light.svg
      dark: /icons/gate-dark.svg
    title: Prove
    details: verify fails CI when the code, the scenarios or the generated files do not agree with the manifest. diff fails CI when a change breaks callers and the major version does not increase.
---

## The problem

A restaurant booking has a contract. You seat only a confirmed booking, and when you seat it, only its state changes. A TypeScript type can say that the function returns a `Booking`. It cannot say these two rules. The rules are in a ticket and in tests that have no link to them. When the code changes, nothing fails.

## What you write

You write each rule in a manifest, with a name. This is part of the [booking example](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/booking):

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

`seat_booking` gives one of two answers: a `booking`, or the refusal `invalid_state`. Each answer lists the rules that are true when the core gives it. Your business logic is an ordinary function. Its type is the generated `DomainCore`:

<<< @/../packages/urn-forge/tests/fixtures/booking/core.ts

## What it finds

A change removes the check, and now the core seats all bookings:

```ts
seat_booking: ({ stored_booking }) => answer('booking', { ...stored_booking, state: 'seated' }),
```

**Without urn-forge**, `tsc` passes, because the answer is still a `Booking`. You release the bug.

**With urn-forge**, your application calls the core through the generated `runOperation(core, 'seat_booking', input)`. For a cancelled booking, `runOperation` gives this result in place of the answer:

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

An input that breaks a rule gets `InputRejected` before the core runs. A refusal such as `invalid_state` is a normal answer.

## What you get

- **One generated TypeScript file**: a type and a Valibot schema for each definition, and `runOperation`, the harness. Each schema is a [Standard Schema](https://standardschema.dev), so tRPC, Hono and form libraries can use it. The file imports only `valibot`.
- **Cucumber steps that work with each manifest.** You write the `.feature` files.
- **`urn-forge verify`**, five gates for CI:

  | Gate | It fails when |
  | --- | --- |
  | 1. Completeness | An operation has no function in the core, or the function has the wrong type |
  | 2. Boundary | Your application calls the core without the harness |
  | 3. Gherkin | An operation, an output or a rule has no scenario |
  | 4. Drift | A generated file is not the same as the file that `compile` writes now |
  | 5. Contract | With `--base <ref>`: a change removes a rule, an output or a scenario, or makes a rule accept more, and the version does not increase |

- **`urn-forge diff`**, which fails a change that can break callers, unless the major version increases.
- **A Postgres schema, if you want one.** It has a `CHECK` constraint for each rule that SQL can state. urn-forge also gives the statements that write and read the rows.

- **Made for coding agents.** `init` writes an `AGENTS.md` for the agent. The package has a reference of one page and a JSON Schema of the manifest. Each problem has a stable code and a fix, also as JSON with `--format json`. Refer to [Work with a coding agent](./how-to/work-with-a-coding-agent).

urn-forge is a harness, not a framework. It does not route requests or open transactions, and your logic stays in your code. This site describes urn-forge 0.2.0. This version is not on npm yet.

[Start the tutorial](./tutorials/first-domain). In about 20 minutes, it takes you from `urn-forge init` to a strict `verify`.
