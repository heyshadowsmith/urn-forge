# Set up a project

Make a project in which `urn-forge compile`, `urn-forge verify` and Cucumber run.

## Before you start

- [Install urn-forge](install) in the project folder.

## Start with init

1. Go to the project folder, and run this command:

   ```bash
   npx urn-forge init
   ```

   `init` writes a starter project:

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
   next: npm install, then npx urn-forge compile, then npx urn-forge verify
   ```

2. Run `npx urn-forge compile`. It writes `src/generated/domain.generated.ts`.
3. Run `npx urn-forge verify`. All gates pass, with no warning.
4. Run `npx cucumber-js`. All 11 scenarios pass.
5. Change the starter domain to your domain. Edit `domain.manifest.yaml`, run `npx urn-forge compile`, then do what `verify` tells you.

The starter splits a bill between a list of people. Its config sets `coverage: 'error'`, so each new gap in the scenarios makes `verify` fail.

<<< @/../packages/urn-forge/templates/starter/domain.manifest.yaml

- `--namespace` and `--domain` set the header of the manifest. The defaults are `app` and `starter`. A name is lowercase snake_case that starts with a letter.
- If a starter file is already in the folder, `init` writes no file and stops with exit code 1:

  ```
  init writes no file: these exist already: cucumber.json, domain.manifest.yaml, features/split.feature, features/support/steps.ts, register-tsx.mjs, src/core.ts, tsconfig.json, urn-forge.config.ts
  ```

- `init` sets `"type": "module"` in `package.json` and adds the scripts `compile`, `verify` and `test:features`. It does not change the other scripts. If the folder has no `package.json`, `init` writes one.

## Set up the files by hand

Do these steps to add urn-forge to a project that you have. The files come from `packages/urn-forge/templates/starter/`, the files that `init` writes.

1. Make a `package.json` with `"type": "module"`. urn-forge and the starter files are ES modules.
2. Make `domain.manifest.yaml`. Refer to [The manifest](../reference/manifest).
3. Make `urn-forge.config.ts`. Each path has a default, so the object can be empty. Refer to [The configuration file](../reference/configuration).

   <<< @/../packages/urn-forge/templates/starter/urn-forge.config.ts

4. Make `tsconfig.json`. Gate 1 type-checks the core with its `compilerOptions`. With `"moduleResolution": "NodeNext"`, write the import in the core as `./generated/domain.generated.js`.

   <<< @/../packages/urn-forge/templates/starter/tsconfig.json

5. Run `npx urn-forge compile`. Commit the files in `src/generated/`.
6. Make `src/core.ts`. Export one object with a function for each operation, and end it with `satisfies DomainCore`. Gate 1 fails without this clause.

   <<< @/../packages/urn-forge/templates/starter/src/core.ts

7. Make `features/support/steps.ts`. It connects the steps of urn-forge to your generated file and your core. Write the same file in each project.

   <<< @/../packages/urn-forge/templates/starter/features/support/steps.ts

8. Make `register-tsx.mjs`:

   <<< @/../packages/urn-forge/templates/starter/register-tsx.mjs{js}

9. Make `cucumber.json`. Put `register-tsx.mjs` first in `import`, so that Cucumber can load TypeScript:

   <<< @/../packages/urn-forge/templates/starter/cucumber.json

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

11. Make a feature in `features/`. Refer to [Write scenarios](write-scenarios).

::: warning
Do not leave out `package.json`. Without it, `npx` runs `urn-forge` from a parent folder, and the CLI reads the wrong configuration file.
:::

## Result

`npx urn-forge verify` shows each gate. For the starter, it shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 11 scenario(s), 1/1 operation(s) run, 9 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

## Related pages

- [Tutorial: build the shipping domain](../tutorials/first-domain)
- [The configuration file](../reference/configuration)
- [Verification gates](../reference/verification-gates)
