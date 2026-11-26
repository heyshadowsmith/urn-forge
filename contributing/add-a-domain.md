# Add a domain

This guide is for contributors who change urn-forge itself. A domain is a full urn-forge project inside the package, such as `example`, `self` or `insurance`. CI compiles it, verifies it, runs its scenarios, and diffs its manifest against the base branch. Thus a domain tests urn-forge as a user meets it, through the package exports `urn-forge/config` and `urn-forge/cucumber`.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You know what the domain adds that the other domains do not have.

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Choose the kind of domain

| Kind | Folder | Use it for |
| --- | --- | --- |
| A sample domain | `packages/urn-forge/<name>/` | A real use of constructs that the other domains do not use together. `insurance` has times, amounts in cents, a stored record in the input, events in the outputs and a Postgres schema |
| A tutorial snapshot | `packages/urn-forge/tutorial/<n>-<name>/` | The end state of one tutorial. The pages in `docs/tutorials/` import their code from it |
| A contract of the corpus | `contracts/<name>/` | A real contract, with a `promises.yaml` that the corpus scores. Refer to [CONTRIBUTING.md](../CONTRIBUTING.md), the section "The contract corpus" |
| `self/` | `packages/urn-forge/self/` | urn-forge's own functions. Refer to [Dogfooding](./dogfooding.md) |

A domain is not a fixture. A fixture tests one part of urn-forge with Vitest. Refer to [Add a test fixture](./add-a-fixture.md).

## Make the files of a sample domain

Copy the layout of `insurance/`:

| File | Content |
| --- | --- |
| `domain.manifest.yaml` | The manifest |
| `urn-forge.config.ts` | `defineConfig` from `urn-forge/config`, with `out: 'generated'`, `core: 'core.ts'`, `tsconfig: '../tsconfig.json'` and `coverage: 'error'`. Add `postgres` if the domain has tables |
| `core.ts` | The core: `export const core = { … } satisfies DomainCore` |
| `features/*.feature` | The scenarios |
| `features/support/steps.ts` | Calls `registerSteps` from `urn-forge/cucumber` with the generated file and the core |
| `generated/` | The files that `compile` writes. They are committed |

A tutorial snapshot uses the defaults of a new project instead: `src/core.ts`, `src/generated/` and its own `tsconfig.json`. Copy the layout of `tutorial/3-edges/`.

## Compile and verify the domain

1. Compile the domain:

   ```bash
   node bin/urn-forge.js compile --config <name>/urn-forge.config.ts
   ```

2. Verify the domain:

   ```bash
   node bin/urn-forge.js verify --config <name>/urn-forge.config.ts
   ```

   Gates 1 to 4 must pass with no warning.

3. Add a profile for the domain to `cucumber.json`, as `insurance` has. Then run the scenarios:

   ```bash
   npx cucumber-js --profile <name>
   ```

## Connect the domain to the checks

Each of these files lists the domains. Add the new domain to each:

1. `packages/urn-forge/package.json`: the scripts `compile:<name>`, `verify:<name>` and `test:features:<name>`, as for `insurance`.
2. `package.json` at the root: the scripts `verify:<name>` and `test:features:<name>`, which call the workspace.
3. `packages/urn-forge/cucumber.json`: the profile of the domain, which you added above.
4. `packages/urn-forge/tsconfig.json`: the folder in `include`, so that `npm run typecheck` type-checks the core. A tutorial snapshot has its own tsconfig, and gate 1 type-checks it.
5. `packages/urn-forge/scripts/diff-base.mjs`: the manifest in `DOMAINS`, so that the compatibility job diffs it.
6. `.github/workflows/ci.yml`:
   - two steps in the `traceability` job: `urn-forge verify (<name>)` and `cucumber-js (<name>)`;
   - the domain in the `determinism` job: `npm run compile:<name>` and `npm run verify:<name>`.
7. `README.md`: a row in the table of the layout, and the commands in the list of commands.

A contract of the corpus needs none of these. The `corpus` job of CI finds each folder in `contracts/`.

## Run the checks

Run these commands from the root folder:

```bash
npm test
npm run typecheck
npm run verify:<name>
npm run test:features:<name>
```

## Result

CI compiles, verifies and tests the domain on each pull request, in any locale and time zone, and reports each breaking change of its manifest.

## Related pages

- [Add a test fixture](./add-a-fixture.md)
- [Dogfooding](./dogfooding.md)
- [Set up a project](../docs/tutorials/first-domain.md)
- [Run verify in CI](../docs/how-to/run-verify-in-ci.md)
