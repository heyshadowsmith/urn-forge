---
layout: home

hero:
  name: urn-forge
  text: Write the contract once. Prove the code keeps it.
  tagline: One YAML manifest of definitions, rules and operations. urn-forge generates the schemas, the types and a harness that checks every input and every answer of your code, and CI fails when the code, the scenarios or a change break the contract.
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
    details: Definitions, rules and operations in YAML, in the words of JSON Schema (type, required, enum, minimum). Your own rules are expressions in a subset of CEL.
  - icon:
      light: /icons/contracts-light.svg
      dark: /icons/contracts-dark.svg
    title: Generate
    details: Valibot schemas (Standard Schemas), TypeScript types, and runOperation, a harness around your code. Optionally, a Postgres schema with the rules as constraints.
  - icon:
      light: /icons/gate-light.svg
      dark: /icons/gate-dark.svg
    title: Prove
    details: verify fails CI when the core, the shell, the scenarios or the generated files no longer agree with the manifest. diff fails it when a change breaks callers without a new major version.
---

## The problem

Seating a restaurant booking has a contract: only a confirmed booking is seated, seating changes nothing but the state, and a refusal names the booking that was asked for. A TypeScript type can say that the function returns a `Booking`. It cannot say any of these promises. They live in a ticket, in a review comment, and in tests that nobody links back to the spec. When the code drifts from them, nothing fails.

## The contract, in one file

With urn-forge, you write the promises in a manifest. This is part of the booking example of the repository:

```yaml
rules:
  was_confirmed:
    description: The booking was confirmed
    rule: input.stored_booking.state == 'confirmed'
    message: The booking was not confirmed

  is_seated:
    description: The booking is seated
    rule: output.state == 'seated'
    message: The booking is not seated

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

The operation takes a `seat_request` and answers a `booking` or an `invalid_state`. Each output lists the rules that hold when it comes back. The definitions of the same file give the values: a reference is eight capital letters, a party has 1 to 12 guests, a state is one of four.

## Your code stays plain

`urn-forge compile` writes the types. Your business logic is an ordinary function that `satisfies` the generated `DomainCore`:

<<< @/../packages/urn-forge/tests/fixtures/booking/core.ts

## The harness checks every answer

Your application calls the core through the generated `runOperation(core, 'seat_booking', input)`. It checks the input before the core runs, and the answer after. Suppose a change makes the core seat a cancelled booking. The types still pass. The harness does not:

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

A bad input gets `InputRejected`, and the core never runs. A refusal such as `invalid_state` is a normal answer, `ok: true`.

## CI proves the parts agree

`urn-forge verify` runs four gates. Each one checks a link between the manifest and your project:

| Gate | It fails when |
| --- | --- |
| 1. Completeness | An operation has no function in the core, or the function has the wrong type |
| 2. Boundary | Your shell calls the core without the harness |
| 3. Gherkin | An operation, an output or a rule has no scenario |
| 4. Drift | A generated file is not what `compile` writes now |

On the booking example, `verify` shows this. The warning says that the booking still uses a definition that the manifest marks as deprecated:

```
domain.manifest.yaml:124  warning  deprecated-use  booking uses the deprecated definition note
gate 1  completeness  PASS  tsc: 0 error(s) over core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 29 scenario(s), 1/1 operation(s) run, 23 rule(s) broken
gate 4  drift         PASS  3 generated file(s) compared byte for byte against generated
verify passed with 1 warning(s) (gates 1, 2, 3, 4)
```

`urn-forge diff` compares two versions of the manifest. It fails when a change can break a caller and the version keeps the same major number.

## What you get

- **One generated TypeScript file**: a type and a Valibot schema for each definition, `check`, and `runOperation`. Each schema is a [Standard Schema](https://standardschema.dev), so tRPC, Hono and form libraries can use it. The file imports only `valibot`.
- **Gherkin steps for any manifest.** You write `.feature` files; urn-forge gives the steps.
- **Optionally, a Postgres schema**: a column for each value, a child table for each list, and a `CHECK` constraint for each rule that SQL can state, plus pure functions that give the statements to write and read the rows.

urn-forge is a harness, not a framework. It does not route requests, open transactions or own your logic. This site describes urn-forge 0.2.0, which is not on npm yet.

[Start the tutorial](./tutorials/first-domain): from `urn-forge init` to a passing `verify` in about 20 minutes.
