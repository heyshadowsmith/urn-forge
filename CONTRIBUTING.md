# Contribute to urn-forge

This guide is for persons who change urn-forge itself. To use urn-forge in a project, read the [documentation](docs/index.md).

This guide describes urn-forge 0.2.0: a manifest of definitions, rules and operations, with rules in a subset of CEL. The decisions behind it are in the [redesign notes](planning/manifest-redesign-notes.md). The [redesign plan](planning/manifest-redesign-plan.md) tells where the build differs from the notes, in the section "What was built".

## Set up

Use Node 22 or newer (the version is in `.nvmrc`). Run this command from the root of the repository:

```bash
npm ci        # install each workspace: packages/urn-forge and docs
```

The code is in `packages/urn-forge`. The root `package.json` sends most commands to that workspace.

## Run the checks

Run these commands from the root of the repository. CI runs each of them. A pull request must pass all of them.

| Command | What it checks |
| --- | --- |
| `npm test` | The Vitest suite in `packages/urn-forge/tests` |
| `npm run typecheck` | `tsc` over `src`, `tests`, `example`, `self` and `insurance`. Vitest does not type-check, so this command is necessary |
| `npm run verify:example` | `urn-forge verify` on the math example: gates 1 to 4 |
| `npm run verify:self` | `urn-forge verify` on urn-forge's own domain |
| `npm run verify:insurance` | `urn-forge verify` on the insurance domain |
| `npm run verify:tutorial` | `urn-forge verify` on the three tutorial snapshots |
| `npm run test:features` | Cucumber on the math example |
| `npm run test:features:self` | Cucumber on `self/` |
| `npm run test:features:insurance` | Cucumber on the insurance domain |
| `npm run test:features:tutorial` | Cucumber on the three tutorial snapshots |
| `npm run corpus` | The score of the contract corpus. It fails below the minimum |
| `npm run docs:build` | The VitePress site. A broken page, a dead link or a snippet file that does not exist fails it |
| `npm run test:tarball` | Packs urn-forge, installs the tarball in a new project, and runs `init`, `compile`, `verify` and the scenarios. It needs the npm registry |

CI also runs these checks:

- **The corpus job** runs `verify` and Cucumber on each contract in `contracts/`. To do this for one contract, run these commands from the root:

  ```bash
  node packages/urn-forge/bin/urn-forge.js verify --config contracts/bookings/urn-forge.config.ts
  (cd contracts/bookings && npx cucumber-js --import ../../packages/urn-forge/src/gherkin/register-tsx.mjs --import 'features/support/**/*.ts' 'features/**/*.feature')
  ```

- **The determinism job** runs `npm test` with `TZ=Pacific/Chatham` and `LC_ALL=tr_TR.UTF-8`. Then it compiles `example`, `self` and `insurance` again, and `git diff --exit-code` must show no change.
- **The compatibility job** runs `urn-forge diff` on each domain against the base branch, as a report. To do this locally, run `npm run diff:base -- origin/main --report` from `packages/urn-forge`.

## Compile the generated files again

The generated files are committed. If you change the generated code (`src/generate/`), each generated file changes. Gate 4 then fails for each domain until you compile it again. Run these commands from `packages/urn-forge`:

```bash
npm run compile:example
npm run compile:self
npm run compile:insurance
for step in 1-first-domain 2-declared-errors 3-edges; do node bin/urn-forge.js compile --config tutorial/$step/urn-forge.config.ts; done
node bin/urn-forge.js compile --config tests/fixtures/booking/urn-forge.config.ts
for dir in ../../contracts/*/; do node bin/urn-forge.js compile --config "$dir/urn-forge.config.ts"; done
```

Examine the diff of the generated files. Make sure that each change is a change that you intended.

## How urn-forge is built

- [How urn-forge is built](contributing/architecture.md): the path from the YAML to the model, the rule uses, the generated file and the gates.
- [Dogfooding](contributing/dogfooding.md): urn-forge declares and tests its own functions, and each large change starts from a target.

## Change urn-forge

urn-forge gives general constructs only (decision 10 of the [contract completeness roadmap](planning/contract-completeness-roadmap.md)). Before you add a rule, a form of CEL or a step, make sure that it passes the three tests of that decision.

- [Add a standard rule](contributing/add-a-standard-rule.md)
- [Add a form to the CEL subset](contributing/add-a-cel-form.md)
- [Add a Gherkin step](contributing/add-a-gherkin-step.md)
- [Add a diagnostic](contributing/add-a-diagnostic.md)
- [Add a test fixture](contributing/add-a-fixture.md)
- [Add a domain](contributing/add-a-domain.md)

## Write documentation

The pages in `docs/` are for users. They follow the [documentation style guide](contributing/docs-style.md). A page quotes only output that urn-forge really gives. The pages in `contributing/` follow the same English rules.

## The contract corpus

The [`contracts/`](contracts) folder measures how much of a real contract a manifest can declare. Each contract has a `promises.yaml`: its promises, each with a status (`declared`, `workaround` or `not-declarable`). A promise that is not declared names the hole of the roadmap that would declare it. Each contract is also a domain that passes `verify` with strict coverage.

```bash
npm run corpus    # the score: declared ÷ all promises, and the count by hole
```

CI fails if the score falls below the `minimum` of `contracts/corpus.yaml`. The score of 0.2.0 is 64 of 143 promises (44.8%). A change that declares more promises sets their status to `declared`, and raises the minimum to the new score.

A promise is `declared` only if a core that breaks it fails a generated check. The [test of declared](docs/explanation/why-urn-forge.md) gives the rule. If every check passes while the promise breaks, the promise is a `workaround`, with a comment that names the break.

## Plans

The [`planning/`](planning) folder keeps the plans, the scope charter, the feature audit and the roadmap. The documentation site does not publish them, and user pages do not link to them. Start with the [contract completeness roadmap](planning/contract-completeness-roadmap.md). Plans before the redesign describe urn-forge 0.1. Some of their links go to pages of 0.1 that no longer exist.
