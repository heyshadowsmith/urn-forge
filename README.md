# urn-forge

Write the contract of a domain once, in one YAML manifest, and prove in CI that your code keeps it.

A TypeScript type can say that a function returns a `Booking`. It cannot say that only a confirmed booking is seated. With urn-forge, you write that promise as a named rule:

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

Suppose a change makes the core seat a cancelled booking:

- **Without urn-forge**, `tsc` passes: the answer is still a `Booking`. The bug ships.
- **With urn-forge**, the generated harness, `runOperation`, checks every answer, and gives `ContractViolation` with the rule `was_confirmed` in place of the wrong answer.

From the manifest, urn-forge generates one TypeScript file: types, Valibot schemas (Standard Schemas) and `runOperation`, which checks every input before your code runs and every answer after. Optionally, it also writes a Postgres schema with the rules as `CHECK` constraints. `urn-forge verify` fails CI when the core, the shell, the scenarios or the generated files stop agreeing with the manifest, and `urn-forge diff` fails a change that can break callers without a new major version.

The version is 0.2.0, not on npm yet. Read the [documentation](docs/index.md), starting with [the tutorial](docs/tutorials/first-domain.md).

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
| [`packages/urn-forge`](packages/urn-forge) | The CLI (`init`, `compile`, `verify`, `diff`), the Cucumber steps, the tests, and the domains below |
| [`packages/urn-forge/tests/fixtures/booking`](packages/urn-forge/tests/fixtures/booking) | The reference example: a restaurant booking that uses every construct, with a Postgres schema |
| [`packages/urn-forge/tutorial`](packages/urn-forge/tutorial) | The end state of each part of the tutorial: a shipping quote |
| [`packages/urn-forge/templates/starter`](packages/urn-forge/templates/starter) | The project that `urn-forge init` writes |
| [`packages/urn-forge/example`](packages/urn-forge/example), [`insurance`](packages/urn-forge/insurance), [`self`](packages/urn-forge/self) | More domains: a math example, an insurance domain with Postgres, and urn-forge's own compiler functions |
| [`contracts`](contracts) | Six contracts of real domains, each promise with its status |
| [`docs`](docs) | The VitePress documentation site |
| [`contributing`](contributing) | Guides for changing urn-forge; start at [CONTRIBUTING.md](CONTRIBUTING.md) |
| [`planning`](planning) | Plans and decisions; not published |

## Commands

From the repository root, with Node 22 or newer:

```bash
npm ci                           # install every workspace
npm test                         # the Vitest suite
npm run typecheck                # tsc over the package
npm run verify:example           # urn-forge verify on the math example
npm run test:features            # cucumber-js on the math example
npm run verify:self              # urn-forge verify on urn-forge's own domain
npm run test:features:self       # cucumber-js on urn-forge's own domain
npm run verify:insurance         # urn-forge verify on the insurance domain
npm run test:features:insurance  # cucumber-js on the insurance domain
npm run verify:tutorial          # urn-forge verify on the three parts of the tutorial
npm run test:features:tutorial   # cucumber-js on the three parts of the tutorial
npm run corpus                   # the share of the promises of the corpus that are declared
npm run diff:base --workspace urn-forge -- origin/main  # urn-forge diff of each domain against origin/main
npm run docs:dev                 # the docs site with live reload, on http://localhost:5173
npm run docs:build               # a static build of the docs site
```
