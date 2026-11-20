# First steps

This procedure builds the math example in the repository. The example has two operations, `compute_area` and `safe_divide`. Each operation traces from the manifest to Cucumber scenarios that pass. Each file on this page is the real file from `packages/urn-forge/`.

## Before you start

You must have:

- **Node.js 22** or a later version. The `.nvmrc` file of the repository sets version 22.
- **npm**. The repository is an npm workspaces monorepo.

urn-forge is not on npm at this time. Run it from a clone of the repository:

```bash
git clone https://github.com/heyshadowsmith/urn-forge.git
cd urn-forge
npm ci
npx urn-forge --version
```

The `npm ci` command puts the `urn-forge` bin in `node_modules/.bin`. As a result, `npx urn-forge` operates in all directories of the repository. The bin uses `tsx` to run the TypeScript source files. You do not build the CLI before you use it.

## 1. Declare the domain

A manifest has a header and one entry for each atom. The key of each entry is a short key, in the format `<context>.<kind>.<identifier>`:

<<< @/../packages/urn-forge/tests/fixtures/math.manifest.yaml

- A **field** has a primitive and constraints. The `notEqual: 0` constraint on the divisor prevents a division by zero in the core.
- An **entity** has a list of field references. Each reference is mandatory. A reference with `required: false` is optional.
- An **operation** has an input entity and an output entity.

For each key, refer to [The manifest](./manifest).

## 2. Compile the manifest

Run this command:

```bash
cd packages/urn-forge
npx urn-forge compile --manifest tests/fixtures/math.manifest.yaml --out example/generated
```

The command shows this output:

```
wrote      example/generated/domain.runtime.generated.ts
wrote      example/generated/domain.schemas.generated.ts
fingerprint sha256:<64 hex digits>
```

Run the command again. Both lines then show `unchanged`, because the output is deterministic.

Commit the generated files to the repository. Gate 4 makes sure that these files are the same as a new compile. For the contents of the files, refer to [Generated code](./generated-code).

## 3. Write the core

The core is one object. Its keys are operation URNs, and it `satisfies` the generated `DomainCoreImplementation`:

<<< @/../packages/urn-forge/example/core.ts

Each handler receives branded input. For example, `radius` is a `GeometryRadius`, not only a `number`. Each handler returns a plain object.

TypeScript finds the parameter types from the `satisfies` clause. As a result, you do not write type annotations. If you remove a handler or return the wrong shape, `tsc` fails.

## 4. Write the behavior

Put the URN of the operation in a tag on each feature. Use field names as table headers:

<<< @/../packages/urn-forge/example/features/safe_divide.feature{gherkin}

Connect the generic steps to your generated runtime and your core in a support file:

<<< @/../packages/urn-forge/example/features/support/steps.ts

Then set the feature directory in the Cucumber configuration. The first `import` entry registers `tsx`. Then Cucumber can load support code in TypeScript.

<<< @/../packages/urn-forge/cucumber.json

Run Cucumber:

```bash
npx cucumber-js
```

The command shows this output:

```
7 scenarios (7 passed)
21 steps (21 passed)
```

For the words of the steps and the conversion of table cells, refer to [Gherkin steps](./gherkin-steps).

## 5. Verify the chain

Run this command:

```bash
npx urn-forge verify \
  --manifest tests/fixtures/math.manifest.yaml \
  --out example/generated \
  --core example/core.ts \
  --features example/features
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over example/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  2 feature(s), 4 scenario(s), 2/2 operations tagged
gate 4  drift         PASS  2 generated file(s) compared byte for byte against example/generated
verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
```

The example also has a [configuration file](../reference/config), `example/urn-forge.config.ts`, that contains these paths. Thus this command does the same check:

```bash
npx urn-forge verify --config example/urn-forge.config.ts
```

In this repository, `npm run verify:example` runs this command. For the errors that each gate finds, refer to [Verification gates](./verify).

## 6. Run the chain in CI

The workflow of the repository runs the full chain for each push to `main` and for each pull request. These are the steps of the CLI job:

```yaml
- run: npm ci
- run: npm test
- run: npx urn-forge verify --config example/urn-forge.config.ts
- run: npx cucumber-js
```

The last three steps run also if a step before them fails. As a result, each broken link shows its error in a different step.
