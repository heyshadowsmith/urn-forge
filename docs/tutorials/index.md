# Tutorials

These three tutorials teach urn-forge from the start. In them, you build one small domain, `shipping`, step by step. The domain has one operation, `quote_shipping`, that calculates the price to send a parcel.

Do the tutorials in this sequence. Each tutorial starts where the tutorial before it stops.

| Tutorial | What you do | Result |
| --- | --- | --- |
| [1. Build the shipping domain](./first-domain) | Write a manifest, compile it, write the core and the scenarios, and run `verify` | `verify passed with 2 warning(s)` |
| [2. Add a declared error](./declared-errors) | Declare an error, return it from the core, and write a scenario that expects it | The error has a scenario, and `verify` passes |
| [3. Make the domain strict](./strict-coverage) | Tag the feature as strict, add the boundary scenarios, and set `boundaryCoverage: 'error'` | `verify passed` with no warnings |

## Before you start

You must have **Node.js 22** or a later version, and **npm**.

urn-forge is not on npm at this time. Thus, you install it from a tarball. To make the tarball, do the steps in [Install urn-forge](../how-to/install#make-the-tarball). Then you have the file `urn-forge-0.1.0.tgz`. In [tutorial 1](./first-domain), you install it in a new project.

## The files of the tutorials

You write your files in a new project folder, `my-shipping/`. The repository of urn-forge contains the end state of each tutorial, in [`packages/urn-forge/tutorial/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tutorial/). CI tests these three folders, and it runs the end state of tutorial 3 in a project made from the tarball. Thus, if your result is different, compare your files with them:

| Tutorial | Folder with its end state |
| --- | --- |
| 1 | `tutorial/1-first-domain/` |
| 2 | `tutorial/2-declared-errors/` |
| 3 | `tutorial/3-strict-coverage/` |

Each folder has the files that you change: `urn-forge.config.ts`, `domain.manifest.yaml`, `src/core.ts`, the feature, and the generated files. It also has a copy of the `tsconfig.json` and the `features/support/steps.ts` that `init` writes.

## Related pages

- [Install urn-forge](../how-to/install)
- [How-to guides](../how-to/)
- [The traceability chain](../explanation/traceability)
- [The manifest](../reference/manifest)
