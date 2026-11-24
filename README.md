# urn-forge

Write the contract of a domain in one YAML manifest: definitions, rules and operations, in the words of JSON Schema, with rules in a subset of CEL. urn-forge compiles it into a TypeScript harness that checks each input before your core runs and each answer after it. `urn-forge verify` fails CI when the core, the scenarios or the generated files no longer agree with the manifest, and `urn-forge diff` fails it when a change breaks callers without a new major version.

```yaml
definitions:
  weight_grams:
    description: The weight of the parcel in grams
    type: integer
    rules:
      - minimum: 1
      - maximum: 30000

rules:
  names_the_weight:
    description: The refusal names the weight of the parcel
    rule: output.weight_grams == input.weight_grams
    message: The refusal names another weight

operations:
  quote_shipping:
    description: Calculate the price to send a parcel
    input: parcel
    output:
      - quote: [fits_express]
      - too_heavy_for_express: [over_express_limit, names_the_weight]
```

The version is 0.2.0. It is not on npm at this time.

## Repository layout

This is an npm-workspaces monorepo:

| Path | What it is |
| --- | --- |
| [`packages/urn-forge`](packages/urn-forge) | The CLI (`urn-forge init`, `compile`, `verify` and `diff`), the Cucumber steps, the tests, and the domains below |
| [`packages/urn-forge/example`](packages/urn-forge/example) | The math example: the area of a circle, and a division whose divisor is never zero |
| [`packages/urn-forge/self`](packages/urn-forge/self) | urn-forge's own domain: pure functions of the compiler, declared and tested with urn-forge |
| [`packages/urn-forge/insurance`](packages/urn-forge/insurance) | The insurance domain: policies with a list of coverages, times and amounts in cents, a stored policy in the input of a cancellation, events in the outputs, and a Postgres schema |
| [`packages/urn-forge/tutorial`](packages/urn-forge/tutorial) | The end state of each of the three tutorials: a shipping quote |
| [`packages/urn-forge/templates/starter`](packages/urn-forge/templates/starter) | The project that `urn-forge init` writes |
| [`contracts`](contracts) | The contract corpus: six contracts of real domains, each promise with its status |
| [`docs`](docs) | The VitePress documentation site, for users |
| [`contributing`](contributing) | The guides for persons who change urn-forge; start at [CONTRIBUTING.md](CONTRIBUTING.md) |
| [`planning`](planning) | The plans, the decisions and the roadmap; not published |

## Commands

Run these from the repository root with Node 22 or newer:

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
npm run verify:tutorial          # urn-forge verify on the three tutorials
npm run test:features:tutorial   # cucumber-js on the three tutorials
npm run corpus                   # the share of the promises of the corpus that are declared
npm run diff:base --workspace urn-forge -- origin/main  # urn-forge diff of each domain against origin/main
npm run docs:dev                 # the docs site with live reload, on http://localhost:5173
npm run docs:build               # a static build of the docs site
```

## Try it in your own project

```bash
npm run pack:tarball                      # in this repository: makes urn-forge-0.2.0.tgz
# then, in a new folder:
npm init -y
npm install /path/to/urn-forge-0.2.0.tgz
npx urn-forge init                        # a starter domain whose scenarios cover it
npx urn-forge compile
npx urn-forge verify
npx cucumber-js
```

Refer to [Install urn-forge](docs/how-to/install.md) and [Set up a project](docs/how-to/set-up-a-project.md). To check a change for breaks, refer to [Change the contract](docs/how-to/change-the-contract.md).

Start with the docs' [first tutorial](docs/tutorials/first-domain.md). The docs follow [Diátaxis](https://diataxis.fr/): tutorials, how-to guides, reference and explanation.
