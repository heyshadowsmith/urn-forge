---
layout: home

hero:
  name: urn-forge
  text: "A contract your coding agent can't get around."
  tagline: "The agent writes the rules of your domain in one short file, and you review it. urn-forge turns that file into checks that fail CI when the agent's code or tests break a rule."
  actions:
    - theme: brand
      text: Try it in your project
      link: "#try-it-in-your-project"
    - theme: alt
      text: Start the tutorial
      link: /tutorials/first-domain
---

## How it works

### 1. The config says where each part is.

<div class="uf-pairs">
<div class="uf-pair">
<div class="uf-pair-text">

#### Where the files are

`urn-forge init` writes `urn-forge.config.ts`. It says where the contract, the generated file, the code, the tests and the tsconfig are.

These are the defaults, so the file can leave them out.

</div>
<div class="uf-pair-code">

```ts
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  manifest: 'domain.manifest.yaml',
  out: 'src/generated',
  core: 'src/core.ts',
  features: 'features',
  tsconfig: 'tsconfig.json',
});
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### Strict tests

A missing test fails CI. Without this line, it is only a warning.

`init` turns this on.

</div>
<div class="uf-pair-code">

```ts
  coverage: 'error',
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### The shell

The files of your application that call the code, such as HTTP handlers. Gate 2 checks that they call it only through the harness.

</div>
<div class="uf-pair-code">

```ts
  shell: ['src/shell'],
```

</div>
</div>
</div>

### 2. The agent writes the contract. You review it.

The contract is one file, `domain.manifest.yaml`. Each part of it says in YAML what you would say in plain English. You review this file, not the code. This is a complete one:

<div class="uf-pairs">
<div class="uf-pair">
<div class="uf-pair-text">

#### Domain

The booking domain, at version 0.1.0.

</div>
<div class="uf-pair-code">

```yaml
manifest:
  namespace: demo
  domain: booking
  version: 0.1.0
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### Definitions

A booking has a state: confirmed, seated or cancelled.

A refusal gives the state of the booking that it refused.

</div>
<div class="uf-pair-code">

```yaml
definitions:
  state:
    description: The state of a booking
    type: string
    rules:
      - enum: [confirmed, seated, cancelled]

  booking:
    description: A booking
    type: object
    properties: [state]
    rules:
      - required: [state]

  refusal:
    description: The booking cannot be seated
    type: object
    properties: [state]
    rules:
      - required: [state]
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### Rules

The booking was confirmed, or it was not.

The answer is seated.

</div>
<div class="uf-pair-code">

```yaml
rules:
  was_confirmed:
    description: The booking was confirmed
    rule: input.state == 'confirmed'
    message: The booking was not confirmed

  was_not_confirmed:
    description: The booking was not confirmed
    rule: input.state != 'confirmed'
    message: The booking was confirmed

  is_seated:
    description: The booking is seated
    rule: output.state == 'seated'
    message: The booking is not seated
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### Operations

To seat a booking, there are two possible answers.

If the booking was confirmed, the answer is the booking, now seated.

If it was not confirmed, the answer is a refusal.

</div>
<div class="uf-pair-code">

```yaml
operations:
  seat_booking:
    description: Seat a booking
    input: booking
    output:
      - booking: [was_confirmed, is_seated]
      - refusal: [was_not_confirmed]
```

</div>
</div>
</div>

### 3. urn-forge generates the types and a harness.

`urn-forge compile` writes one file, `src/generated/domain.generated.ts`, which no one edits. From the contract above, it gives:

<div class="uf-pairs">
<div class="uf-pair">
<div class="uf-pair-text">

#### Types

Each definition becomes a type in `domain.generated.ts`.

</div>
<div class="uf-pair-code">

```ts
export type State = "confirmed" | "seated" | "cancelled";

export interface Booking {
  readonly state: State;
}

export interface Refusal {
  readonly state: State;
}
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### The operation

The operation becomes the type of a function. It takes a booking, and it answers with a booking or a refusal.

</div>
<div class="uf-pair-code">

```ts
export type SeatBookingAnswer =
  | Answer<"booking", Booking>
  | Answer<"refusal", Refusal>;

export interface DomainCore {
  readonly seat_booking: (input: Booking) => SeatBookingAnswer;
}
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### The code

The agent writes that function in `src/core.ts`. If the function is missing, or has the wrong type, gate 1 fails.

</div>
<div class="uf-pair-code">

```ts
import { answer, type DomainCore } from './generated/domain.generated';

export const core = {
  seat_booking: (booking) =>
    booking.state === 'confirmed'
      ? answer('booking', { state: 'seated' })
      : answer('refusal', { state: booking.state }),
} satisfies DomainCore;
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### The harness

Your application calls the function through the harness. The harness checks the input before the code runs, and the answer after it. An input that breaks a rule never reaches the code.

</div>
<div class="uf-pair-code">

```ts
runOperation(core, 'seat_booking', { state: 'confirmed' });
// ok: true, output: 'booking', value: { state: 'seated' }

runOperation(core, 'seat_booking', { state: 'cancelled' });
// ok: true, output: 'refusal', value: { state: 'cancelled' }

runOperation(core, 'seat_booking', { state: 'lost' });
// ok: false, kind: 'InputRejected', rule: enum of state
```

</div>
</div>
</div>

### 4. Five gates check each change in CI.

`urn-forge verify` runs five gates. Each one fails CI with a stable code, and one sentence that tells the agent what to do. This is what each gate prints when the agent breaks it:

<div class="uf-pairs">
<div class="uf-pair">
<div class="uf-pair-text">

#### Gate 1 · Completeness

Each operation has a function in the code, of the generated type.

The agent's code has no `seat_booking`:

</div>
<div class="uf-pair-code">

```
gate 1  completeness  FAIL  tsc: 1 error(s) over src/core.ts; core satisfies DomainCore
    src/core.ts:3  error  type-error  TS1360: Type '{}' does not satisfy the expected type 'DomainCore'.
  Property 'seat_booking' is missing in type '{}' but required in type 'DomainCore'.
      fix: Correct the type error at the line that the problem gives; do not suppress it.
verify failed: gate 1
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### Gate 2 · Boundary

Your application calls the code only through the harness.

A file in `src/shell`, which the config names, calls `core.seat_booking` directly:

</div>
<div class="uf-pair-code">

```
gate 2  boundary      FAIL  1 core file(s), 1 shell file(s): 1 problem(s)
    src/shell/seat.ts:3  error  direct-call  core.seat_booking runs the core without the harness; call runOperation(core, …), which checks the input and the answer
      fix: Call the core through runOperation(core, operation, input), which checks the input and the answer.
verify failed: gate 2
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### Gate 3 · Scenarios

Each operation, answer and rule has a test.

The agent adds a `cancel_booking` operation and its code, but no test:

</div>
<div class="uf-pair-code">

```
gate 3  gherkin       FAIL  1 feature(s), 6 scenario(s), 1/2 operation(s) run, 3 rule(s) broken
    features  error  uncovered-operation  no scenario runs cancel_booking; add one with When I run "cancel_booking" with:
      fix: Add a scenario with When I run "<operation>" with:.
verify failed: gate 3
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### Gate 4 · Drift

No one edits the generated file.

The agent adds a state to `domain.generated.ts` by hand:

</div>
<div class="uf-pair-code">

```
gate 4  drift         FAIL  1 generated file(s) compared byte for byte against src/generated
    src/generated/domain.generated.ts:211  error  drift  the generated file is not current; run urn-forge compile
      fix: Run urn-forge compile, and do not edit a generated file by hand.
verify failed: gate 4
```

</div>
</div>
<div class="uf-pair">
<div class="uf-pair-text">

#### Gate 5 · Contract

The contract does not get weaker without a new version.

The agent removes `was_confirmed` from the booking answer, and `verify --base main` compares the change with the main branch:

</div>
<div class="uf-pair-code">

```
gate 5  contract      FAIL  1 change(s) make the contract weaker than main, and the version 0.1.0 → 0.1.0 does not allow it
    domain.manifest.yaml:48  error  removed-rule  the rule was_confirmed is removed from operations.seat_booking.booking
      fix: Put the rule back. If the change is on purpose, stop and ask a person: only a person decides a new manifest.version.
verify failed: gate 5
```

</div>
</div>
</div>

## The agent tries to cheat

Take the operation above: only a confirmed booking can be seated (`was_confirmed`). The agent changes how seating works, and gets it wrong.

**The code breaks the rule.** The agent's new code seats every booking:

```ts
seat_booking: () => answer('booking', { state: 'seated' }),
```

The types still check, because the answer is still a booking.

**The harness catches it, and a test fails.** For a cancelled booking, the harness gives this result in place of the answer:

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

**The agent deletes the tests that fail.** That is the fastest way to green. Now every test that is left passes.

**CI fails.** `urn-forge verify --base main` compares the change with the main branch:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       FAIL  1 feature(s), 4 scenario(s), 1/1 operation(s) run, 3 rule(s) broken
    features  error  uncovered-output  no scenario of seat_booking answers refusal; add one that ends with Then the output is "refusal"
      fix: Add a scenario of the operation that ends with Then the output is "<output>".
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
gate 5  contract      FAIL  1 change(s) make the contract weaker than main, and the version 0.1.0 → 0.1.0 does not allow it
    features/seat.feature  error  removed-scenario  2 of the 2 scenarios "A booking that is not confirmed is refused" are removed
      fix: Put the scenario back. If the change is on purpose, stop and ask a person: only a person decides a new manifest.version.
verify failed: gate 3, 5
```

The agent cannot get to green without the tests. The only other way is a new version of the contract, and you see that in the review.

## Try it in your project

You must have Node 22 or newer. In your project, run:

```bash
npm install https://github.com/heyshadowsmith/urn-forge/releases/download/v0.2.0/urn-forge-0.2.0.tgz
npx urn-forge init
npx urn-forge compile
npx urn-forge verify
npx cucumber-js
```

`init` writes a starter domain with scenarios that cover it. It also writes `AGENTS.md`, which tells your coding agent the loop of the project and when to stop and ask you. Then ask your agent to change the domain.

## Where next

- [Build a domain with a coding agent](/tutorials/first-domain): the tutorial, from `init` to a strict `verify`, in about 20 minutes.
- [Set up a project for an agent](/how-to/work-with-a-coding-agent): protect the contract, name the shell, and turn on gate 5 in CI.
- [Review an agent's change](/how-to/review-an-agents-change): what to read in a change, and what urn-forge cannot check for you.
