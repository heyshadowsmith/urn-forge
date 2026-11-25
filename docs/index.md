---
layout: home

hero:
  name: urn-forge
  text: Coding agents write the code. You own the contract.
  tagline: You write the rules of a domain in one short file that you can review in minutes. A coding agent writes the code and the tests. urn-forge checks each input and each answer of that code, and fails CI when the code, the tests or a change break a rule. The agent cannot remove a check to make it pass.
  actions:
    - theme: brand
      text: Start the tutorial
      link: /tutorials/first-domain
    - theme: alt
      text: Set up a project for an agent
      link: /how-to/work-with-a-coding-agent
  image:
    src: /hero-trace.svg
    alt: The manifest traced through the generated code and the core to a scenario that passes

features:
  - icon:
      light: /icons/manifest-light.svg
      dark: /icons/manifest-dark.svg
    title: You state the rules
    details: The manifest holds the values, the operations, the answers of each operation and the rules that each answer keeps. Each rule has a name and a message. A change to the rules is a change to one file that you review.
  - icon:
      light: /icons/contracts-light.svg
      dark: /icons/contracts-dark.svg
    title: The agent writes the code
    details: urn-forge generates the types of the code. The agent writes one plain function for each operation, and the tests. Each problem that urn-forge finds has a stable code and one sentence that tells the agent what to do.
  - icon:
      light: /icons/gate-light.svg
      dark: /icons/gate-dark.svg
    title: urn-forge proves it
    details: A harness checks each input and each answer at run time. Five gates check the code, the tests and the generated files in CI. A change that removes a rule, an answer or a test fails, unless you change the version.
---

## The problem

A coding agent writes code that looks right, and it writes the tests too. Both can be wrong in the same way. A type can say that a function returns a booking. A type cannot say "seat only a confirmed booking". When a check fails, the fastest way to green for an agent is to change the check.

## The split

| Who | Does what |
| --- | --- |
| You | Write and review the contract: the rules of the domain. Decide each new version. Say in the tests which answer is correct |
| The coding agent | Writes the code of each operation and the tests, and runs the checks until they pass |
| urn-forge | Generates the types and the checks from the contract. Fails CI when the code, the tests or a change do not agree with the contract |

The agent reads its instructions from `AGENTS.md`, which `urn-forge init` writes. Claude Code also gets a skill that runs the loop. You read this site.

## What you write

This is part of a contract for restaurant bookings ([the full file](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/booking)):

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

`seat_booking` gives one of two answers: a `booking`, or the refusal `invalid_state`. Each answer lists the rules that are true when the code gives it. The agent writes the code as a plain function, with the type that urn-forge generates:

<<< @/../packages/urn-forge/tests/fixtures/booking/core.ts

## What it catches

The agent "simplifies" the code, and now it seats all bookings:

```ts
seat_booking: ({ stored_booking }) => answer('booking', { ...stored_booking, state: 'seated' }),
```

The types still check, because the answer is still a booking. But your application calls the code through the generated harness, `runOperation(core, 'seat_booking', input)`. For a cancelled booking, the harness gives this result in place of the answer:

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

The test of the cancelled booking fails, and so does CI. If the agent then deletes that test, or the rule `was_confirmed`, gate 5 fails the change in CI until you give the contract a new version.

## What you get

- **One generated file**: a type and a schema for each definition, and the harness. Other libraries can use the schemas to check data, for example in a form or an API route. The core and the shell import only this file.
- **Test steps that work with each contract.** The agent writes the scenarios in plain sentences, such as `Then the output is "quote"`.
- **`urn-forge verify`**, five gates for CI:

  | Gate | It fails when |
  | --- | --- |
  | 1. Completeness | An operation has no code, or the code has the wrong type |
  | 2. Boundary | Your application calls the code without the harness, or a file turns off a type check |
  | 3. Scenarios | An operation, an answer or a rule has no test |
  | 4. Drift | A generated file was edited by hand, or is not current |
  | 5. Contract | A change removes a rule, an answer or a test, or makes a rule accept more, and the version does not change |

- **`urn-forge diff`**, which fails a change that can break callers, unless the major version increases.
- **Output for agents.** Each problem has a stable code and a fix, as text or as JSON.
- **A Postgres schema, if you want one**, with the rules as database constraints.

urn-forge proves that the code keeps the contract. It cannot prove that the contract or the expected values in the tests are correct. That is your part. Refer to [Review an agent's change](./how-to/review-an-agents-change).

urn-forge is a harness, not a framework. It does not route requests or open transactions, and the logic stays in your code. This site describes urn-forge 0.2.0, which is not on npm yet.

[Start the tutorial](./tutorials/first-domain). In about 20 minutes, it takes you from `urn-forge init` to a strict `verify`.
