# The configuration file

`urn-forge.config.ts` gives the paths of a project and its options. The CLI reads it from the working folder, or from the path of `--config`. Without a config file, each option has its default.

## Format

```ts
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  coverage: 'error',
});
```

The file is TypeScript. The CLI loads it through `tsx`. `defineConfig` returns the object unchanged. It only gives the object its type.

A path in the config is relative to the config file. A path of a flag on the command line is relative to the working folder. A flag overrides the config.

## Options

| Option | Default | Used by | Value |
| --- | --- | --- | --- |
| `manifest` | `domain.manifest.yaml` | `compile`, `verify` | The manifest |
| `out` | `src/generated` | `compile`, `verify` | The folder of the generated files |
| `core` | `src/core.ts` | `verify` | The core file, which exports a value that `satisfies DomainCore` |
| `features` | `features` | `verify` | The folder of the `.feature` files. Gate 3 reads each `.feature` file under it |
| `tsconfig` | `tsconfig.json` | `verify` | The tsconfig of gate 1 |
| `shell` | none | `verify` | A list of files and folders of the shell. Gate 2 checks them for calls that skip the harness |
| `coverage` | `'warn'` | `verify` | `'warn'` or `'error'`: whether a gap in the scenarios is a warning or an error of gate 3 |
| `postgres` | none | `compile`, `verify` | Write a Postgres schema, `schema.generated.sql`, and the store file, `domain.store.generated.ts`. Refer to [The Postgres schema](./postgres-schema) |

`shell` and `postgres` have no flag. Only the config sets them.

## Examples

The config of the starter:

<<< @/../packages/urn-forge/templates/starter/urn-forge.config.ts

The config of the insurance domain, with paths and a Postgres schema:

<<< @/../packages/urn-forge/insurance/urn-forge.config.ts

The config of the booking fixture:

<<< @/../packages/urn-forge/tests/fixtures/booking/urn-forge.config.ts

The booking fixture imports `defineConfig` from a relative path because it is inside the package. In your project, import it from `urn-forge/config`.

## Errors

A config that cannot be loaded or is not valid stops the command with exit code `1`:

```
bad.config.ts  error  config-invalid  config.plugins is not an option; the options are manifest, out, core, features, tsconfig, shell, coverage, postgres
bad.config.ts  error  config-invalid  config.coverage must be 'warn' or 'error'
```

| Code | Cause |
| --- | --- |
| `config-unreadable` | `--config` names a file that does not exist |
| `config-invalid` | The config does not load, has no default export, has an option that is not in the table above, or has a value of the wrong type |

## Related pages

- [The CLI](./cli)
- [Set up a project](../how-to/set-up-a-project)
- [Store objects in Postgres](../how-to/store-in-postgres)
