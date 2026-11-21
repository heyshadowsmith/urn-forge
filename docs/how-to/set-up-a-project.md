# Set up a project

This guide makes a project in which `urn-forge compile`, `urn-forge verify` and Cucumber run. The fast way is `urn-forge init`. To add urn-forge to a project that you have, or to learn what each file does, set up the files by hand.

## Before you start

- [Install urn-forge](install) in the project folder.
- Know the domain that you want to declare: at least one operation, with its input and its output.

## Start a project with init

1. Go to the project folder, and run this command:

   ```bash
   npx urn-forge init
   ```

   `init` writes a starter project, then compiles it:

   ```
   wrote      cucumber.json
   wrote      domain.manifest.yaml
   wrote      features/split.feature
   wrote      features/support/steps.ts
   wrote      register-tsx.mjs
   wrote      src/core.ts
   wrote      tsconfig.json
   wrote      urn-forge.config.ts
   updated    package.json
   wrote      src/generated/domain.runtime.generated.ts
   wrote      src/generated/domain.schemas.generated.ts
   fingerprint sha256:7e99af3b34de3a7fe30c17fe40ea2eebd4c85a999ded0d08fae9aaa9bf517845
   next: npm run verify, then npm run test:features
   ```

2. Run `npm run verify`. All gates pass, with no warning:

   ```
   gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; `core` satisfies DomainCoreImplementation
   gate 3  gherkin       PASS  1 feature(s), 5 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features (boundaryCoverage: error)
   gate 4  drift         PASS  2 generated file(s) compared byte for byte against src/generated
   verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
   ```

3. Run `npm run test:features`. All scenarios pass:

   ```
   ...........................

   9 scenarios (9 passed)
   27 steps (27 passed)
   0m 0.015s (0m 0.004s executing your code)
   ```

4. Change the starter domain to your domain. Edit `domain.manifest.yaml`, run `npm run compile`, then do what `verify` tells you.

The starter splits a bill into equal shares between a list of people. It has three fields, two entities, one operation and one declared error. The field `people` is a list of 1 to 10 names, with no name two times. Its scenarios test each boundary, and `boundaryCoverage` is `'error'`. Thus each new gap makes `verify` fail. To declare a list, refer to [Add an entity](add-an-entity).

- `--namespace` and `--domain` set the header of the manifest and the URNs. The defaults are `app` and `starter`. Example: `npx urn-forge init --namespace acme --domain billing`.
- If one of the starter files is in the folder, `init` writes no file and stops with exit code 1.
- `init` sets `"type": "module"` in `package.json`, and adds the scripts `compile`, `verify` and `test:features`. It keeps the other values. It does not replace a script that you have with the same name.
- If `package.json` has `"type": "commonjs"`, `init` writes no file and stops with exit code 1.

## Set up the files by hand

Do these steps to add urn-forge to a project that you have. The examples come from `packages/urn-forge/tutorial/1-first-domain/`, which CI tests.

A project has these files:

| File | Contents |
| --- | --- |
| `package.json` | `"type": "module"` and the npm scripts |
| `domain.manifest.yaml` | The manifest: the fields, entities, errors and operations |
| `urn-forge.config.ts` | Where the manifest, the generated files, the core and the features are |
| `tsconfig.json` | The compiler options that gate 1 uses |
| `generated/` | The files that `compile` writes. Do not edit them |
| `core.ts` | The handlers, with `satisfies DomainCoreImplementation` |
| `features/*.feature` | The scenarios |
| `features/support/steps.ts` | The Cucumber support file |
| `register-tsx.mjs` | Registers `tsx` for Cucumber |
| `cucumber.json` | The Cucumber configuration |

### 1. Make the project folder

1. Make a folder for the project.
2. Make a `package.json` in it.
3. Add `"type": "module"` to `package.json`. The generated files and the support file use `import`. Without it, Cucumber stops with `ERR_VM_MODULE_LINK_FAILURE`.

::: warning
Do not leave out `package.json`. Without it, `npx` runs `urn-forge` in the nearest parent folder that has a `package.json`. Then the CLI reads the wrong configuration file.
:::

You add the scripts in step 9.

### 2. Write the manifest

Make `domain.manifest.yaml`. Start with the header, then add the atoms:

<<< @/../packages/urn-forge/tutorial/1-first-domain/domain.manifest.yaml{yaml}

For each key, refer to [The manifest](../reference/manifest). To add atoms later, refer to [Add a field](add-a-field), [Add an entity](add-an-entity) and [Add an operation](add-an-operation).

### 3. Write the configuration file

Make `urn-forge.config.ts`:

<<< @/../packages/urn-forge/tutorial/1-first-domain/urn-forge.config.ts

- The paths are relative to the configuration file.
- The tutorial uses `../../tsconfig.json`, the tsconfig of the package. In your project, point `tsconfig` to your own file.
- A flag on the command line overrides the value in the file.
- If you leave out a key, the CLI uses its default. For example, the default of `out` is `src/generated`.

For each key and its default, refer to [The configuration file](../reference/configuration).

### 4. Write the tsconfig

Gate 1 of `verify` type-checks the core with the `compilerOptions` of this file. It starts from the core file and follows its imports. It does not use `include`.

This tsconfig is sufficient:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["core.ts", "generated", "features"]
}
```

Two options are important for gate 1:

- **`strict: true`** is recommended. With it, TypeScript examines the core more carefully, for example for `undefined` values. The generated runtime type-checks with or without it.
- **The module resolution** must find the import in `core.ts`. With `Bundler`, the import `./generated/domain.runtime.generated` has no extension. With `NodeNext`, write `./generated/domain.runtime.generated.js`. If you do not, gate 1 fails with `TS2307: Cannot find module`.

The generated files use `.js` in their own imports, so they work with both settings.

### 5. Compile the manifest

Run this command from the project folder:

```bash
npx urn-forge compile
```

`compile` writes the generated files:

```
wrote      generated/domain.runtime.generated.ts
wrote      generated/domain.schemas.generated.ts
fingerprint sha256:aded2f13d2ed2e8accfdf2cd9f56fc86cf8b0742bb5522ea91c99da97a64edd6
```

Commit the files in `generated/`. Gate 4 compares them with a fresh compile. Refer to [Regenerate the code after a manifest change](regenerate-code).

### 6. Write the core

Make `core.ts`. Export one object that has a handler for each operation, and end it with `satisfies DomainCoreImplementation`:

<<< @/../packages/urn-forge/tutorial/1-first-domain/core.ts

The `satisfies` clause is necessary:

- It gives each handler the types of its input and its result.
- It makes `tsc` find a handler that is not there, or that has an incorrect type.
- Gate 1 looks for it. If no export uses it, gate 1 fails:

```
core.ts  error  missing-satisfies  no export uses `satisfies DomainCoreImplementation` from generated/domain.runtime.generated.ts; declare the core as `export const core = { … } satisfies DomainCoreImplementation;`
```

The core does not import urn-forge. For the rules of the core, refer to [Use branded values in the core](use-branded-values).

### 7. Write the Cucumber support file

Make `features/support/steps.ts`. It connects the generic steps of urn-forge to your generated runtime and your core:

<<< @/../packages/urn-forge/tutorial/1-first-domain/features/support/steps.ts

Write the same file in each project. Only the import paths change.

### 8. Configure Cucumber

1. Make `register-tsx.mjs` with this content:

   <<< @/../packages/urn-forge/src/gherkin/register-tsx.mjs{js}

2. Make `cucumber.json`. Put `register-tsx.mjs` first in `import`:

   ```json
   {
     "default": {
       "paths": ["features/**/*.feature"],
       "import": ["register-tsx.mjs", "features/support/**/*.ts"],
       "format": ["progress"],
       "strict": true
     }
   }
   ```

`tsx` must register before Cucumber loads the support file. If it does not, Node.js cannot load the extensionless imports of the support file, and Cucumber stops with `ERR_MODULE_NOT_FOUND`.

You can also use the module that urn-forge exports, and not make `register-tsx.mjs`. Then remove `register-tsx.mjs` from `import`, and start Cucumber with this command:

```bash
NODE_OPTIONS="--import urn-forge/register-tsx" npx cucumber-js
```

The urn-forge package uses the same pattern, with one profile for each domain:

<<< @/../packages/urn-forge/cucumber.json

### 9. Add the npm scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "compile": "urn-forge compile",
    "verify": "urn-forge verify",
    "test:features": "cucumber-js"
  }
}
```

### 10. Write a feature

Make a `.feature` file in `features/`. Tag it with the URN of the operation:

<<< @/../packages/urn-forge/tutorial/1-first-domain/features/quote_shipping.feature{gherkin}

For the steps, refer to [Write scenarios](write-scenarios).

### Result

1. Run `npm run verify`. The command shows each gate:

   ```
   gate 1  completeness  PASS  tsc: 0 error(s) over core.ts; `core` satisfies DomainCoreImplementation
   gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, strict: 0/1 features
       features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
       features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
   gate 4  drift         PASS  2 generated file(s) compared byte for byte against generated
   verify passed with 2 warning(s) (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
   ```

   The warnings show boundaries that no scenario tests. To remove them, refer to [Adopt strict coverage](adopt-strict-coverage).

2. Run `npm run test:features`. The command runs the scenarios:

   ```
   ...............

   5 scenarios (5 passed)
   15 steps (15 passed)
   0m 0.012s (0m 0.002s executing your code)
   ```

## Related pages

- [Tutorial: build the shipping domain](../tutorials/first-domain)
- [The configuration file](../reference/configuration)
- [The CLI](../reference/cli)
- [Verification gates](../reference/verification-gates)
- [Run verify in CI](run-verify-in-ci)
