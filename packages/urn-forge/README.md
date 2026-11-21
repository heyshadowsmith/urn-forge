# urn-forge

urn-forge compiles a YAML domain manifest to Valibot schemas and a functional-core runtime, and `urn-forge verify` makes sure that the manifest, the core, the Gherkin scenarios and the generated files agree.

## Start a project

In a new folder, with Node.js 22 or later:

```bash
npm init -y
npm install /path/to/urn-forge-0.1.0.tgz
npx urn-forge init
npm run verify
npm run test:features
```

`init` writes a starter domain that passes at once. Change `domain.manifest.yaml`, run `npm run compile`, and follow what `verify` tells you.

## Documentation

The documentation is in the `docs/` folder of the urn-forge repository: the tutorials, the how-to guides (start with "Set up a project"), the reference and the explanation.
