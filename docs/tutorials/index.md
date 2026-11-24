# Tutorials

In these three tutorials, you build one small domain, `shipping`, step by step. The domain has one operation, `quote_shipping`, that calculates the price to send a parcel.

Do the tutorials in this sequence. Each tutorial starts where the tutorial before it stops.

| Tutorial | What you do | Result |
| --- | --- | --- |
| [1. Build the shipping domain](./first-domain) | Write a manifest, compile it, write the core and the scenarios, and run `verify` | `verify passed (gates 1, 2, 3, 4)` |
| [2. Add a refusal](./declared-errors) | Add a second output that refuses a parcel, with the rules that say when each output comes back | The harness catches a core that breaks a rule |
| [3. Make the domain strict](./strict-coverage) | Set `coverage: 'error'`, and add scenarios at the edges of the rules | A gap in the scenarios fails `verify` |

## Before you start

You must have **Node.js 22** or a later version, and **npm**.

urn-forge is not on npm at this time. To get the file `urn-forge-0.2.0.tgz`, do the steps in [Install urn-forge](../how-to/install). In tutorial 1, you install this file in a new project.

## If your result is different

The urn-forge repository has the end state of each tutorial in [`packages/urn-forge/tutorial/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tutorial/). CI runs these folders. Compare your files with them:

- `tutorial/1-first-domain/`
- `tutorial/2-declared-errors/`
- `tutorial/3-strict-coverage/`

The time that Cucumber shows on its last line is different on each run.

## Related pages

- [Install urn-forge](../how-to/install)
- [The contract](../explanation/the-contract)
- [The manifest](../reference/manifest)
