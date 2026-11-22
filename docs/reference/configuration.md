# The configuration file

The configuration file `urn-forge.config.ts` gives the settings of a project. `compile` and `verify` read it. `diff` reads only the `tables` of the `postgres` plugin. A command-line option overrides the setting with the same name.

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/urn-forge.config.ts

## The file

- The file is TypeScript or JavaScript, with an `export default` of a configuration object. urn-forge loads it through tsx, which does not type-check it.
- `defineConfig` from `urn-forge/config` gives the object the type `UrnForgeConfig`. A plain object is also correct.
- With `--config <file>`, urn-forge loads that file. Else it loads `urn-forge.config.ts` from the current directory, if it is there. It does not look in the parent directories. With no file, each setting uses its default.

## Settings

All settings are optional. Other properties cause `config-invalid`.

| Setting | Type | Default | Option | Used by |
| --- | --- | --- | --- | --- |
| `manifest` | string | `domain.manifest.yaml` | `--manifest` | `compile`, `verify` |
| `out` | string | `src/generated` | `--out` | `compile`; `verify` gates 1 and 4 |
| `core` | string | `src/core.ts` | `--core` | `verify` gates 1 and 2 |
| `features` | string | `features` | `--features` | `verify` gate 3 |
| `tsconfig` | string | `tsconfig.json` | `--tsconfig` | `verify` gates 1 and 2 |
| `shell` | string array | None | None | `verify` gate 2 |
| `boundaryCoverage` | `'warn'` or `'error'` | `'warn'` | None | `verify` gate 3 |
| `referenceDate` | `'YYYY-MM-DD'` | None | `--reference-date` | `compile`, `verify` |
| `plugins` | An array of plugin entries | `['valibot', 'fcis']` | None | `compile`, `verify` gate 4. `diff` reads `postgres` `tables` |

- `out` is the directory of the generated files.
- `core` is the core entry file. One export must use `satisfies DomainCoreImplementation`.
- `features` is the directory of the `.feature` files, with its subdirectories.
- A path setting cannot be an empty string.

### `shell`

The files and directories of the shell, for example `shell: ['./src/shell', './src/server.ts']`. Gate 2 examines each `.ts`, `.tsx`, `.mts` and `.cts` file in them. It does not examine as shell files:

- a core file,
- a file in the `out` directory,
- a `.d.ts` file,
- a file in `node_modules` or in a directory whose name starts with `.`.

An item that adds no file gives the warning `shell-not-found`.

### `boundaryCoverage`

The severity of the coverage gaps of gate 3: `uncovered-boundary`, `uncovered-error`, `uncovered-event`, `uncovered-record` and `uncovered-invariant`.

| Value | Gap in a feature with `@urn-forge:strict` | Gap in a different feature |
| --- | --- | --- |
| `'warn'` | Error | Warning |
| `'error'` | Error | Error |

With `'warn'`, if each feature is strict and gate 3 passes, gate 3 shows the note `ratchet-ready`.

### `referenceDate`

The day that urn-forge compares each `sunsetDate` with. If a `sunsetDate` is on or before this day, a reference to the atom from an active or a deprecated atom is `sunset-ref`. urn-forge never reads the clock. Without a reference date, it does not compare sunset dates.

## Paths

| Source of the path | A relative path starts from |
| --- | --- |
| A setting in the configuration file | The directory of the configuration file |
| A default, with a configuration file | The directory of the configuration file |
| An option on the command line | The current directory |
| A default, with no configuration file | The current directory |

## Plugins

| Name | Makes | Needs | Configuration |
| --- | --- | --- | --- |
| `valibot` | `domain.schemas.generated.ts` | None | `{}` |
| `fcis` | `domain.runtime.generated.ts` | `valibot` | `{}` |
| `postgres` | `schema.generated.sql`, and `domain.store.generated.ts` if `tables` is not empty | `valibot` | `tables`: short keys of entities with a `key`, default `[]`. `unenforced`: `'warn'` (default) or `'error'` |

An entry is a name, or a pair of a name and a configuration. The two forms are equal:

```ts
plugins: ['valibot', 'fcis']
plugins: [['valibot', {}], ['fcis', {}]]
```

- A plugin with options needs the pair form: `['postgres', { tables: ['policy.entity.policy'] }]`.
- Each name occurs one time. A needed plugin must also be in the array, at any position.
- The array cannot be empty.
- A change to `plugins` changes the generated files. Run `urn-forge compile` again.

For the `postgres` plugin, refer to [The Postgres schema](./postgres-schema).

## Errors

Each error stops the command with exit code `1`.

| Problem | Code | Example message |
| --- | --- | --- |
| The file cannot load | `config-unreadable` | `cannot load config: <reason>` |
| No default export | `config-invalid` | ``config: the file must `export default` the config`` |
| An unknown setting | `config-invalid` | `config.foo: unknown option "foo"` |
| An empty path | `config-invalid` | `config.core: must not be empty` |
| A value of the wrong type | `config-invalid` | `config.boundaryCoverage: Invalid type: Expected ("warn" \| "error") but received "strict"` |
| A `referenceDate` that is not a calendar day | `config-invalid` | `config.referenceDate: must be a date YYYY-MM-DD` |
| An unknown plugin | `config-invalid` | `config.plugins[1]: unknown plugin "mysql" (plugins: valibot, fcis, postgres)` |
| A plugin two times | `config-invalid` | `config.plugins[2]: plugin "valibot" is listed more than once` |
| An empty `plugins` | `config-invalid` | `config.plugins: must list one or more plugins` |
| A plugin configuration that is not correct | `plugin-config` | `plugin valibot config: unknown option "strict"` |
| A needed plugin is not there | `missing-plugin` | `plugin fcis requires plugin valibot, which is not enabled` |
| A `tables` item that is not an entity with a `key` | `wrong-ref-kind`, `unresolved-ref` or `missing-key` | `urn:demo:store:shop:entity:plain: is a table in the postgres config, so it needs a key: one of its own required, single-valued fields` |

## Related pages

- [The CLI](./cli)
- [Set up a project](../how-to/set-up-a-project)
- [Close boundary gaps](../how-to/close-boundary-gaps)
