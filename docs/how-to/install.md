# Install urn-forge

urn-forge is not on npm at this time. You run it from a clone of its repository. A package in the same npm workspace can use it as a dependency. Refer to [Scope](../reference/scope).

## Before you start

- Install Node.js 22 or later.
- Get a clone of the urn-forge repository.

## Run urn-forge from a clone

1. Go to the root folder of the clone.
2. Install the dependencies:

   ```bash
   npm ci
   ```

3. Go to the package folder:

   ```bash
   cd packages/urn-forge
   ```

4. Make sure that the CLI starts:

   ```bash
   npx urn-forge --version
   ```

   The command shows the version:

   ```
   0.1.0
   ```

urn-forge has no build step. The CLI runs the TypeScript source through `tsx`.

## Use urn-forge from another package in the workspace

The root `package.json` of the clone lists `packages/*` as workspaces. Put your package in a folder below `packages/`.

1. Add urn-forge and the packages that your project uses to the `package.json` of your package:

   ```json
   {
     "devDependencies": {
       "urn-forge": "0.1.0",
       "@cucumber/cucumber": "^13.3.0",
       "tsx": "^4.23.15",
       "typescript": "~5.9"
     },
     "dependencies": {
       "valibot": "^1.5.0"
     }
   }
   ```

   - `urn-forge` has the version of the workspace package, so npm links it from `packages/urn-forge`.
   - `valibot` is a runtime dependency, because the generated files import it.
   - `tsx` is necessary, because urn-forge gives TypeScript source, not JavaScript.

2. Run `npm install` from the root folder of the clone.
3. Make sure that the CLI starts from your package folder:

   ```bash
   npx urn-forge --version
   ```

## Import urn-forge in TypeScript

The package has three entry points:

| Import | Use |
| --- | --- |
| `urn-forge/config` | `defineConfig`, for `urn-forge.config.ts` |
| `urn-forge/cucumber` | `registerOperationSteps`, for the Cucumber support file |
| `urn-forge` | The compiler, `verify` and the registries, for your own tools |

Each entry point is a `.ts` file. Plain Node.js cannot load it. Load your code through `tsx`:

- The CLI loads `urn-forge.config.ts` through `tsx`. You do not do more.
- Cucumber loads the support file. Register `tsx` first, as [Set up a project](set-up-a-project) shows.
- For your own script, run it with `npx tsx`.

If you run a script that imports `urn-forge` with plain `node`, it fails:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/urn-forge/packages/urn-forge/src/engine.js' imported from /home/user/urn-forge/packages/urn-forge/src/index.ts
```

The same script works with `npx tsx`.

The generated files do not import urn-forge. Your shell code needs only `valibot` at run time.

## Result

`npx urn-forge --version` shows `0.1.0`. Next, [set up a project](set-up-a-project).

## Related pages

- [Tutorial: build the shipping domain](../tutorials/first-domain)
- [Set up a project](set-up-a-project)
- [The CLI](../reference/cli)
- [The package API](../reference/public-api)
- [Scope](../reference/scope)
