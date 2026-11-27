# urn-forge

Coding agents write the code. You own the contract. urn-forge proves in CI that the code keeps it.

A coding agent writes code that looks right, and it writes the tests too. A TypeScript type can say that a function returns a `Booking`. It cannot say that you seat only a confirmed booking. With urn-forge, you write that rule in a short contract that you review, with a name:

```yaml
rules:
  was_confirmed:
    description: The booking was confirmed
    rule: input.stored_booking.state == 'confirmed'
    message: The booking was not confirmed

operations:
  seat_booking:
    description: Seat the party of a booking
    input: seat_request
    output:
      - booking: [was_confirmed, is_seated, keeps_the_party]
      - invalid_state: [was_not_confirmed, names_the_request]
```

An agent's change makes the code seat a cancelled booking:

- **Without urn-forge**, `tsc` passes, because the answer is still a `Booking`. You release the bug.
- **With urn-forge**, the generated harness, `runOperation`, checks each answer. In place of the wrong answer, it gives `ContractViolation` with the rule `was_confirmed`. If the agent then deletes the rule or its test, gate 5 fails the change. It passes only with a new version of the contract, which you see in the review.

From the contract, urn-forge generates one TypeScript file. It has no dependency: the types, a check for each definition, and `runOperation`. `runOperation` checks each input before the code runs, and each answer after it.

- `urn-forge verify` fails CI when the code, the shell, the scenarios or the generated files do not agree with the contract. It also fails when a change makes the contract weaker.
- Each problem has a stable code and a fix, as text or JSON.
- `urn-forge init` writes an `AGENTS.md` for the agent, and a skill for Claude Code.

The version is 0.2.0. This version is not on npm yet. Read the [documentation](docs/index.md) and [the methodology](docs/methodology.md). The reference is [`AGENTS.md` of the package](packages/urn-forge/AGENTS.md).

## Try it

```bash
npm ci
npm run pack:tarball                      # makes urn-forge-0.2.0.tgz
# then, in a new folder:
npm init -y
npm install /path/to/urn-forge-0.2.0.tgz
npx urn-forge init                        # a starter domain whose scenarios cover it
npx urn-forge compile
npx urn-forge verify
npx cucumber-js
```

## Repository layout

An npm-workspaces monorepo:

| Path | What it is |
| --- | --- |
| [`packages/urn-forge`](packages/urn-forge) | The CLI (`init`, `compile`, `verify`, `diff`), the steps of the scenarios, the skill, the tests, and the projects in the rows below |
| [`packages/urn-forge/tests/fixtures/booking`](packages/urn-forge/tests/fixtures/booking) | The reference example: a restaurant booking that uses all constructs |
| [`packages/urn-forge/templates/starter`](packages/urn-forge/templates/starter) | The project that `urn-forge init` writes |
| [`packages/urn-forge/self`](packages/urn-forge/self) | urn-forge's own domain: functions of the compiler, which its scenarios test |
| [`docs`](docs) | The VitePress documentation site |
| [`contributing`](contributing) | Guides for people who change urn-forge. Start at [CONTRIBUTING.md](CONTRIBUTING.md) |
| [`planning`](planning) | Plans and decisions. We do not publish them |

## Commands

Run these commands from the root of the repository, with Node 22 or newer:

```bash
npm ci                           # install every workspace
npm run check                    # every check that CI runs, in one command
npm test                         # the Vitest suite
npm run typecheck                # tsc over the package
npm run verify:self              # urn-forge verify on urn-forge's own domain
npm run test:features            # cucumber-js on urn-forge's own domain
npm run diff:base --workspace urn-forge -- origin/main  # urn-forge diff of each domain against origin/main
npm run docs:dev                 # the docs site with live reload, on http://localhost:5173
npm run docs:build               # a static build of the docs site
```
