# Install urn-forge

urn-forge is not on npm at this time. You make a tarball from a clone of its repository, and install the tarball in your project. Refer to [Scope](../reference/scope).

## Before you start

- Install Node.js 22 or later.
- Get a clone of the urn-forge repository.

## Make the tarball

1. Go to the root folder of the clone.
2. Install the dependencies:

   ```bash
   npm ci
   ```

3. Make the tarball:

   ```bash
   npm run pack:tarball
   ```

   The command writes `urn-forge-0.1.0.tgz` in the root folder of the clone.

The tarball has the CLI, the source and the starter template. It does not have the tests and the examples.

## Install the tarball in your project

1. Go to your project folder. If the folder has no `package.json`, make one:

   ```bash
   npm init -y
   ```

2. Install the tarball. Give the path of the file:

   ```bash
   npm install /path/to/urn-forge-0.1.0.tgz
   ```

   npm also installs the packages that urn-forge uses: Valibot, Cucumber, TypeScript and `tsx`.

3. Make sure that the CLI starts:

   ```bash
   npx urn-forge --version
   ```

   The command shows the version:

   ```
   0.1.0
   ```

When you make a new tarball, install it again with the same command.

## Run urn-forge from the clone

To change urn-forge, or to do the tutorials, run it from the clone:

1. Go to the root folder of the clone, and run `npm ci`.
2. Go to `packages/urn-forge`.
3. Run `npx urn-forge --version`.

urn-forge has no build step. The CLI runs the TypeScript source through `tsx`.

## Import urn-forge in TypeScript

The package has four entry points:

| Import | Use |
| --- | --- |
| `urn-forge/config` | `defineConfig`, for `urn-forge.config.ts` |
| `urn-forge/cucumber` | `registerOperationSteps`, for the Cucumber support file |
| `urn-forge/register-tsx` | Registers `tsx`, so that Cucumber can load TypeScript support files |
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

The generated files do not import urn-forge. Your shell code needs only `valibot` at run time. If you deploy the shell without urn-forge, add `valibot` to the `dependencies` of your project.

## Result

`npx urn-forge --version` shows `0.1.0`. Next, [set up a project](set-up-a-project).

## Related pages

- [Tutorial: build the shipping domain](../tutorials/first-domain)
- [Set up a project](set-up-a-project)
- [The CLI](../reference/cli)
- [The package API](../reference/public-api)
- [Scope](../reference/scope)
