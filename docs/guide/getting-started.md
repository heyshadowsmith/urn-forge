# Getting started

This guide builds the math example that ships in the repository: two operations (`compute_area` and `safe_divide`) traced from a manifest to passing Cucumber scenarios. Every file shown here is the real file from `packages/urn-forge/`.

## Prerequisites

- **Node.js 22** or newer. The repository's `.nvmrc` pins 22.
- **npm**. The repository is an npm-workspaces monorepo.

urn-forge isn't published to npm yet, so you run it from a clone:

```bash
git clone https://github.com/heyshadowsmith/urn-forge.git
cd urn-forge
npm ci
npx urn-forge --version
```

`npm ci` links the `urn-forge` bin into `node_modules/.bin`, so `npx urn-forge` works anywhere in the repository. The bin runs the TypeScript sources through `tsx`, so there's no build step.

## 1. Declare the domain

A manifest has a header, then one entry per atom, keyed by a short key of the form `<context>.<kind>.<identifier>`:

<<< @/../packages/urn-forge/tests/fixtures/math.manifest.yaml

- **Fields** carry a primitive and constraints. `notEqual: 0` on the divisor is what keeps the core from ever dividing by zero.
- **Entities** list field references. Every reference is required unless it says `required: false`.
- **Operations** name an input entity and an output entity.

See [Writing a manifest](./manifest) for every key.

## 2. Compile it

```bash
cd packages/urn-forge
npx urn-forge compile --manifest tests/fixtures/math.manifest.yaml --out example/generated
```

```
wrote      example/generated/domain.runtime.generated.ts
wrote      example/generated/domain.schemas.generated.ts
fingerprint sha256:<64 hex digits>
```

Run it again and both lines say `unchanged`: the output is deterministic. Commit the generated files. Gate 4 checks that they stay equal to a fresh compile. [Generated code](./generated-code) explains what's inside them.

## 3. Implement the core

The core is one object, keyed by operation URN, that `satisfies` the generated `DomainCoreImplementation`:

<<< @/../packages/urn-forge/example/core.ts

Each handler receives branded input (`radius` is a `GeometryRadius`, not just a `number`) and returns a plain object. TypeScript infers the parameter types from `satisfies`, so there are no annotations to write. Delete a handler or return the wrong shape, and `tsc` fails.

## 4. Describe the behavior

Tag each feature with the URN of the operation it exercises, and use field names as table headers:

<<< @/../packages/urn-forge/example/features/safe_divide.feature{gherkin}

Wire the generic steps to your generated runtime and core in a support file:

<<< @/../packages/urn-forge/example/features/support/steps.ts

Then point Cucumber at the features. The first `import` entry registers `tsx`, so Cucumber can load TypeScript support code:

<<< @/../packages/urn-forge/cucumber.json

```bash
npx cucumber-js
```

```
7 scenarios (7 passed)
21 steps (21 passed)
```

[Gherkin steps](./gherkin-steps) covers the step wording and how table cells are converted.

## 5. Verify the chain

```bash
npx urn-forge verify \
  --manifest tests/fixtures/math.manifest.yaml \
  --out example/generated \
  --core example/core.ts \
  --features example/features
```

```
gate 1  completeness  PASS  tsc: 0 error(s) over example/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  2 feature(s), 4 scenario(s), 2/2 operations tagged
gate 4  drift         PASS  2 generated file(s) compared byte for byte against example/generated
verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
```

Inside this repository, `npm run verify:example` runs the same command. [Verification gates](./verify) shows what each gate catches.

## 6. Run it in CI

The repository's workflow runs the whole chain on every push to `main` and every pull request. The CLI job is:

```yaml
- run: npm ci
- run: npm test
- run: npx urn-forge verify --manifest … --out … --core … --features …
- run: npx cucumber-js
```

The last three steps run even if an earlier one fails, so each broken link reports under its own step.
