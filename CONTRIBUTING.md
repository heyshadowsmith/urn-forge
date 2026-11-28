# Contribute to urn-forge

This guide is for persons who change urn-forge itself. To use urn-forge in a project, read the [documentation](docs/index.md).

This guide describes urn-forge 0.2.3: a manifest of definitions, rules and operations, with rules in a subset of CEL. The decisions behind it are in the [redesign notes](planning/manifest-redesign-notes.md). The [redesign plan](planning/manifest-redesign-plan.md) tells where the build differs from the notes, in the section "What was built".

## Set up

Use Node 22 or newer (the version is in `.nvmrc`). Run this command from the root of the repository:

```bash
npm ci        # install each workspace: packages/urn-forge and docs
```

The code is in `packages/urn-forge`. The root `package.json` sends most commands to that workspace.

## Run the checks

Run every check with one command, from the root of the repository:

```bash
npm run check                         # every check
npm run check -- --base origin/main   # and compare with the main branch: diff, and gate 5 on each contract
npm run check -- --quick              # leave out the tarball test and the docs build
```

CI runs `npm run check -- --base` with the base branch on each pull request, in one job. A pull request must pass it. A change only to `planning/` or `contributing/` runs no check. Each check runs even when one before it fails, and the last lines list the checks that failed.

`npm run check` runs these commands. Run one of them alone to work on its failure:

| Command | What it checks |
| --- | --- |
| `npm test` | The Vitest suite in `packages/urn-forge/tests` |
| `npm run typecheck` | `tsc` over `src`, `tests` and `self`. Vitest does not type-check, so this command is necessary |
| `npm run verify:self` | `urn-forge verify` on urn-forge's own domain |
| `npm run test:features` | Cucumber on `self/` |
| `npm run docs:build` | The VitePress site. A broken page, a dead link or a snippet file that does not exist fails it |
| `npm run test:tarball` | Packs urn-forge, installs the tarball in a new project, and runs `init`, `compile`, `verify` and the scenarios. It needs the npm registry |

A second workflow, **Determinism**, runs once a week and on demand. It runs `npm test` with `TZ=Pacific/Chatham` and `LC_ALL=tr_TR.UTF-8`. Then it compiles `self` and the booking fixture again, and `git diff --exit-code` must show no change. To start it, open Actions → Determinism → Run workflow.

## Compile the generated files again

The generated files are committed. If you change the generated code (`src/generate/`), each generated file changes. Gate 4 then fails for `self/` and for the booking fixture until you compile them again. Run these commands from `packages/urn-forge`:

```bash
npm run compile:self
node bin/urn-forge.js compile --config tests/fixtures/booking/urn-forge.config.ts
```

Examine the diff of the generated files. Make sure that each change is a change that you intended.

## How urn-forge is built

- [How urn-forge is built](contributing/architecture.md): the path from the YAML to the model, the rule uses, the generated file and the gates.
- [Dogfooding](contributing/dogfooding.md): urn-forge declares and tests its own functions, and each large change starts from a target.

## Change urn-forge

urn-forge gives general constructs only (decision 10 of the [contract completeness roadmap](planning/contract-completeness-roadmap.md)). Before you add a rule, a form of CEL or a step, make sure that it passes the three tests of that decision.

- [Add a standard rule](contributing/add-a-standard-rule.md)
- [Change the rule language](contributing/add-a-cel-form.md)
- [Add a Gherkin step](contributing/add-a-gherkin-step.md)
- [Add a diagnostic](contributing/add-a-diagnostic.md)
- [Add a test fixture](contributing/add-a-fixture.md)

## Write documentation

The pages in `docs/` are for users. They follow the [documentation style guide](contributing/docs-style.md). A page quotes only output that urn-forge really gives. The pages in `contributing/` follow the same English rules.

## Plans

The [`planning/`](planning) folder keeps the plans, the scope charter, the feature audit and the roadmap. The documentation site does not publish them, and user pages do not link to them. Start with the [contract completeness roadmap](planning/contract-completeness-roadmap.md). Plans before the redesign describe urn-forge 0.1. Some of their links go to pages of 0.1 that no longer exist.
