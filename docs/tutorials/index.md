# Tutorials

These three tutorials teach urn-forge from the start. In them, you build one small domain, `shipping`, step by step. The domain has one operation, `quote_shipping`, that calculates the price to send a parcel.

Do the tutorials in this sequence. Each tutorial starts where the tutorial before it stops.

| Tutorial | What you do | Result |
| --- | --- | --- |
| [1. Build the shipping domain](./first-domain) | Write a manifest, compile it, write the core and the scenarios, and run `verify` | `verify passed with 2 warning(s)` |
| [2. Add a declared error](./declared-errors) | Declare an error, return it from the core, and write a scenario that expects it | The error has a scenario, and `verify` passes |
| [3. Make the domain strict](./strict-coverage) | Tag the feature as strict, add the boundary scenarios, and set `boundaryCoverage: 'error'` | `verify passed` with no warnings |

## Before you start

You must have:

- **Node.js 22** or a later version.
- **Git** and **npm**.

urn-forge is not on npm at this time. Thus, you use it from a clone of the repository. Do these steps one time:

1. Clone the repository:

   ```bash
   git clone https://github.com/heyshadowsmith/urn-forge.git
   ```

2. Go into the clone and install the packages:

   ```bash
   cd urn-forge
   npm ci
   ```

3. Go into the package of the tool:

   ```bash
   cd packages/urn-forge
   ```

All the commands in the tutorials run from `packages/urn-forge`.

## The files of the tutorials

You write your files in a new folder, `packages/urn-forge/my-shipping/`. The repository also contains the end state of each tutorial, in `packages/urn-forge/tutorial/`. CI tests these three folders. Thus, if your result is different, compare your files with them:

| Tutorial | Folder with its end state |
| --- | --- |
| 1 | `tutorial/1-first-domain/` |
| 2 | `tutorial/2-declared-errors/` |
| 3 | `tutorial/3-strict-coverage/` |

Do not edit the files in `tutorial/`. CI examines them.

## Related pages

- [Install urn-forge](../how-to/install)
- [How-to guides](../how-to/)
- [The traceability chain](../explanation/traceability)
- [The manifest](../reference/manifest)
