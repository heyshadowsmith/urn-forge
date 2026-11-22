# Contribute to urn-forge

This guide is for persons who change urn-forge itself. To use urn-forge in a project, read the [documentation](docs/index.md).

## Set up

Use Node 22 or newer. Run these commands from the root of the repository:

```bash
npm ci        # install each workspace
npm test      # the Vitest suite of the CLI
npm run docs:build
```

The [README](README.md) gives each command, for example `npm run verify:insurance`.

## How urn-forge is built

- [How urn-forge is built](contributing/architecture.md): the compiler passes, the IR and the plugins.
- [Dogfooding](contributing/dogfooding.md): urn-forge declares and traces its own domain.

## Change urn-forge

- [Add a primitive](contributing/add-a-primitive.md)
- [Add a constraint](contributing/add-a-constraint.md)
- [Add a kind](contributing/add-a-kind.md)
- [Add a plugin](contributing/add-a-plugin.md)
- [Add a test fixture](contributing/add-a-fixture.md)

## Write documentation

The pages in `docs/` are for users. They follow the [documentation style guide](contributing/docs-style.md). A page quotes only output that urn-forge really gives.

## The contract corpus

The [`contracts/`](contracts) folder measures how much of a real contract a manifest can declare. Each contract has a `promises.yaml`: its promises, each with a status (`declared`, `workaround` or `not-declarable`). A promise that is not declared names the hole of the roadmap that would declare it. Each contract is also a domain that passes `verify` with strict coverage.

```bash
npm run corpus    # the score: declared ÷ all promises, and the count by hole
```

CI fails if the score falls below the `minimum` of `contracts/corpus.yaml`. A change that declares more promises sets their status to `declared`, and raises the minimum to the new score.

## Plans

The [`planning/`](planning) folder keeps the plans, the scope charter, the feature audit and the roadmap. The documentation site does not publish them, and user pages do not link to them. Start with the [contract completeness roadmap](planning/contract-completeness-roadmap.md).
