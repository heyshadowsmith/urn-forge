# Install urn-forge

Install urn-forge in your project from a tarball. urn-forge is not on npm at this time.

## Before you start

- Install Node.js 22 or later.
- Get a clone of the urn-forge repository.

## Steps

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

4. Go to your project folder. If the folder has no `package.json`, run `npm init -y`.
5. Install the tarball. Give the path of the file:

   ```bash
   npm install /path/to/urn-forge-0.1.0.tgz
   ```

   npm also installs Valibot, Cucumber, TypeScript and `tsx`.

6. Make sure that the CLI starts:

   ```bash
   npx urn-forge --version
   ```

To do the tutorials, you can also run urn-forge from the clone. Run `npm ci` in the root folder, then go to `packages/urn-forge`.

## Load urn-forge in TypeScript

urn-forge has no build step. Its entry points are `.ts` files, so plain `node` cannot load them:

- The CLI loads `urn-forge.config.ts` through `tsx`. You do not do more.
- Cucumber must register `tsx` first. [Set up a project](set-up-a-project) shows how.
- To run your own script that imports `urn-forge`, use `npx tsx`.

The generated files do not import urn-forge. At run time, your shell needs only `valibot`. If you deploy the shell without urn-forge, add `valibot` to `dependencies`.

## Result

`npx urn-forge --version` shows the version:

```
0.1.0
```

Next, [set up a project](set-up-a-project).

## Related pages

- [Tutorial: build the shipping domain](../tutorials/first-domain)
- [The CLI](../reference/cli)
- [The package API](../reference/public-api)
