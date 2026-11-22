# Set up a project

Make a project in which `urn-forge compile`, `urn-forge verify` and Cucumber run.

## Before you start

- [Install urn-forge](install) in the project folder.

## Start with init

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
   fingerprint sha256:1ec93ba0f7bf6c19c0ef98157bdaa97679a8ad1b52a5d7124381b3c4b2da2722
   next: npm run verify, then npm run test:features
   ```

2. Run `npm run verify`. All gates pass.
3. Run `npm run test:features`. All scenarios pass.
4. Change the starter domain to your domain. Edit `domain.manifest.yaml`, run `npm run compile`, then do what `verify` tells you.

The starter splits a bill between a list of people. Its features are strict, so each new coverage gap makes `verify` fail.

- `--namespace` and `--domain` set the header of the manifest. The defaults are `app` and `starter`.
- If a starter file is already in the folder, `init` writes no file and stops with exit code 1.
- `init` sets `"type": "module"` in `package.json` and adds the scripts `compile`, `verify` and `test:features`. It does not replace a script that you have.

## Set up the files by hand

Do these steps to add urn-forge to a project that you have. The files come from `packages/urn-forge/tutorial/1-first-domain/`.

1. Make a `package.json` with `"type": "module"`. Without it, Cucumber stops with `ERR_VM_MODULE_LINK_FAILURE`.
2. Make `domain.manifest.yaml`. Refer to [The manifest](../reference/manifest).

   <<< @/../packages/urn-forge/tutorial/1-first-domain/domain.manifest.yaml{yaml}

3. Make `urn-forge.config.ts`. Each path has a default, so this file can be empty. Refer to [The configuration file](../reference/configuration).

   <<< @/../packages/urn-forge/tutorial/1-first-domain/urn-forge.config.ts

4. Make `tsconfig.json`. Gate 1 type-checks the core with its `compilerOptions`. With `NodeNext`, write the import in the core as `./generated/domain.runtime.generated.js`.

   <<< @/../packages/urn-forge/tutorial/1-first-domain/tsconfig.json

5. Run `npx urn-forge compile`:

   ```
   wrote      src/generated/domain.runtime.generated.ts
   wrote      src/generated/domain.schemas.generated.ts
   fingerprint sha256:40bd31f60e13cbb2b5a8223690a04d4856b7e8b3c82fb1a732a2af1dbe8f8d92
   ```

   Commit the files in `src/generated/`.

6. Make `src/core.ts`. Export one object with a handler for each operation, and end it with `satisfies DomainCoreImplementation`. Gate 1 fails without this clause.

   <<< @/../packages/urn-forge/tutorial/1-first-domain/src/core.ts

7. Make `features/support/steps.ts`. It connects the generic steps to your runtime and your core. Write the same file in each project.

   <<< @/../packages/urn-forge/tutorial/1-first-domain/features/support/steps.ts

8. Make `register-tsx.mjs`:

   <<< @/../packages/urn-forge/src/gherkin/register-tsx.mjs{js}

9. Make `cucumber.json`. Put `register-tsx.mjs` first in `import`, or Cucumber stops with `ERR_MODULE_NOT_FOUND`:

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

10. Add these scripts to `package.json`:

    ```json
    {
      "scripts": {
        "compile": "urn-forge compile",
        "verify": "urn-forge verify",
        "test:features": "cucumber-js"
      }
    }
    ```

11. Make a feature in `features/`, tagged with the URN of the operation. Refer to [Write scenarios](write-scenarios).

    <<< @/../packages/urn-forge/tutorial/1-first-domain/features/quote_shipping.feature{gherkin}

::: warning
Do not leave out `package.json`. Without it, `npx` runs `urn-forge` from a parent folder, and the CLI reads the wrong configuration file.
:::

## Result

`npx urn-forge verify` shows each gate:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, strict: 0/1 features
    features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against src/generated
verify passed with 2 warning(s) (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

The warnings show boundaries that no scenario tests. To close them, refer to [Close boundary gaps](close-boundary-gaps). `npm run test:features` runs the scenarios.

## Related pages

- [Tutorial: build the shipping domain](../tutorials/first-domain)
- [The configuration file](../reference/configuration)
- [Verification gates](../reference/verification-gates)
