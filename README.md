# urn-forge

Declare a domain in YAML, generate typed contracts and a runtime gatekeeper, and fail CI when the chain from a URN to a passing Gherkin scenario breaks.

## Repository layout

This is an npm-workspaces monorepo:

| Path | What it is |
| --- | --- |
| [`packages/urn-forge`](packages/urn-forge) | The CLI (`urn-forge compile`, `urn-forge verify`), the Cucumber step library, tests, and the math example |
| [`docs`](docs) | The VitePress documentation site, including the [MVP plan](docs/project/mvp-plan.md) and [spec v1.1](docs/project/spec-v1-1.md) |

## Commands

Run these from the repository root with Node 22 or newer:

```bash
npm ci                    # install every workspace
npm test                  # the CLI's Vitest suite
npm run verify:example    # urn-forge verify on the math example
npm run test:features     # cucumber-js on the math example
npm run docs:dev          # the docs site with live reload, on http://localhost:5173
npm run docs:build        # a static build of the docs site
```

Start with the docs' [Getting started](docs/guide/getting-started.md) guide.
