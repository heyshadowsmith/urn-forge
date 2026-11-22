# urn-forge

Declare a domain in YAML, generate typed contracts and a runtime gatekeeper, and fail CI when the chain from a URN to a passing Gherkin scenario breaks, or when a change breaks the callers of a URN.

## Repository layout

This is an npm-workspaces monorepo:

| Path | What it is |
| --- | --- |
| [`packages/urn-forge`](packages/urn-forge) | The CLI (`urn-forge compile`, `urn-forge verify`, `urn-forge diff`), the Cucumber step library, tests, and the math example |
| [`packages/urn-forge/self`](packages/urn-forge/self) | urn-forge's own domain: the toolchain's pure functions, declared and traced with urn-forge |
| [`packages/urn-forge/insurance`](packages/urn-forge/insurance) | The insurance domain: dates, exact decimals, an optional field, invariants, a link to a customer and an embedded list of coverages, strict from the start, with a Postgres schema for its customers and policies, a deprecated field that a replacement supersedes, events that its operations emit, and a declared error that records as an event |
| [`docs`](docs) | The VitePress documentation site, for users |
| [`contributing`](contributing) | The guides for persons who change urn-forge; start at [CONTRIBUTING.md](CONTRIBUTING.md) |
| [`planning`](planning) | The plans, the scope charter and the roadmap; not published |

## Commands

Run these from the repository root with Node 22 or newer:

```bash
npm ci                           # install every workspace
npm test                         # the CLI's Vitest suite
npm run verify:example           # urn-forge verify on the math example
npm run test:features            # cucumber-js on the math example
npm run verify:self              # urn-forge verify on urn-forge's own domain
npm run test:features:self       # cucumber-js on urn-forge's own domain
npm run verify:insurance         # urn-forge verify on the insurance domain
npm run test:features:insurance  # cucumber-js on the insurance domain
npm run diff:base --workspace urn-forge -- origin/main  # urn-forge diff of each domain against origin/main
npm run docs:dev                 # the docs site with live reload, on http://localhost:5173
npm run docs:build               # a static build of the docs site
```

## Try it in your own project

```bash
npm run pack:tarball                      # in this repository: makes urn-forge-0.1.0.tgz
# then, in a new folder:
npm init -y
npm install /path/to/urn-forge-0.1.0.tgz
npx urn-forge init                        # a starter domain that passes at once
npm run verify
npm run test:features
```

Refer to [Install urn-forge](docs/how-to/install.md) and [Set up a project](docs/how-to/set-up-a-project.md). To retire a URN and to check each change for breaks, refer to [Change the contract](docs/how-to/change-the-contract.md).

Start with the docs' [first tutorial](docs/tutorials/first-domain.md). The docs follow [Diátaxis](https://diataxis.fr/): tutorials, how-to guides, reference and explanation.
