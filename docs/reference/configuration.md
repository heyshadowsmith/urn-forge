# The configuration file

The configuration file `urn-forge.config.ts` gives the settings of a project. The `compile` and `verify` commands read it. A command-line option overrides the setting with the same name.

This is the configuration file of the math example:

<<< @/../packages/urn-forge/example/urn-forge.config.ts

## The file

| Item | Value |
| --- | --- |
| Default name | `urn-forge.config.ts` |
| Language | TypeScript or JavaScript. urn-forge loads the file with a dynamic `import()` through tsx. tsx removes the types and does not type-check the file |
| Content | A `export default` of a configuration object |
| Type helper | `defineConfig` from `urn-forge/config`. It returns the object without a change and only gives it the type `UrnForgeConfig`. A plain object is also correct |
| Validation | urn-forge examines the object with a Valibot schema when it loads the file. Refer to [Errors](#errors) |

### How urn-forge finds the file

The `compile` and `verify` commands use the first applicable item:

| Sequence | Condition | Result |
| --- | --- | --- |
| 1 | The command has `--config <file>` | urn-forge loads this file. If it cannot load the file, the command fails with `config-unreadable` |
| 2 | The file `urn-forge.config.ts` is in the current directory | urn-forge loads this file |
| 3 | Neither | urn-forge uses no configuration file. Each setting uses its default |

urn-forge does not look for `urn-forge.config.ts` in the parent directories.

## Settings

All settings are optional. The configuration object cannot have other properties.

| Setting | Type | Default | Option | Command |
| --- | --- | --- | --- | --- |
| `manifest` | `string`, not empty | `domain.manifest.yaml` | `--manifest` | `compile` and `verify` |
| `out` | `string`, not empty | `src/generated` | `--out` | `compile` and `verify` |
| `core` | `string`, not empty | `src/core.ts` | `--core` | `verify` (gate 1) |
| `features` | `string`, not empty | `features` | `--features` | `verify` (gate 3) |
| `tsconfig` | `string`, not empty | `tsconfig.json` | `--tsconfig` | `verify` (gate 1) |
| `boundaryCoverage` | `'warn'` or `'error'` | `'warn'` | None | `verify` (gate 3) |
| `plugins` | An array of plugin entries | `['valibot', 'fcis']`, each with `{}` | None | `compile` and `verify` (gate 4) |

### `manifest`

The manifest file to compile. Refer to [The manifest](./manifest).

### `out`

The directory of the generated files. `compile` writes the files in this directory. Gate 4 compares the files in this directory with a new compile. Gate 1 reads the generated runtime from this directory.

### `core`

The core entry file. One export of this file must use `satisfies DomainCoreImplementation`. Gate 1 type-checks this file.

### `features`

The directory of the `.feature` files. Gate 3 reads this directory and its subdirectories.

### `tsconfig`

The TypeScript configuration file. Gate 1 uses its compiler options for the type check.

### `boundaryCoverage`

The severity of the coverage gaps of gate 3. A coverage gap is an `uncovered-boundary` or an `uncovered-error` diagnostic.

| Value | Coverage gap in a feature with the tag `@urn-forge:strict` | Coverage gap in a different feature |
| --- | --- | --- |
| `'warn'` | Error | Warning |
| `'error'` | Error | Error |

If the value is `'warn'` and each feature has the tag `@urn-forge:strict`, gate 3 shows the note `ratchet-ready`. For the reasons, refer to [Boundary coverage and the ratchet](../explanation/boundary-coverage).

### `plugins`

The plugins to run, in sequence. Refer to [Plugins](#plugins).

## Paths

| Source of the path | A relative path starts from |
| --- | --- |
| A setting in the configuration file | The directory of the configuration file |
| An option on the command line | The current directory |
| A default | The current directory |

Example: the configuration file `example/urn-forge.config.ts` has `out: './generated'`. As a result, the output directory is `example/generated`, also if you run the command from a different directory.

## Plugins

### The plugins

| Name | Version | Makes | Needs (`requires`) | Configuration |
| --- | --- | --- | --- | --- |
| `valibot` | `0.1.0` | `domain.schemas.generated.ts`. Refer to [The generated schemas](./generated-schemas) | None | `{}` only |
| `fcis` | `0.2.0` | `domain.runtime.generated.ts`. Refer to [The generated runtime](./generated-runtime) | `valibot`, because the runtime imports the schemas | `{}` only |

urn-forge 0.1.0 does not have the `gherkin` and `postgres` plugins of the specification. Refer to [Scope](./scope).

### The forms of an entry

Each entry of the `plugins` array has one of these forms:

| Form | Example | Result |
| --- | --- | --- |
| A name | `'valibot'` | The plugin with the configuration `{}` |
| A pair of a name and a configuration | `['valibot', {}]` | The plugin with this configuration |

The two forms are equal. You can use the two forms in one array.

```ts
plugins: ['valibot', 'fcis']
plugins: [['valibot', {}], ['fcis', {}]]
```

### Rules

- Each name must be `valibot` or `fcis`.
- A name can occur only one time.
- If a plugin needs a different plugin (its `requires` list), that plugin must also be in the array. The position in the array is not important.
- The configuration of each plugin must agree with the schema of the plugin. The two plugins accept only `{}`.
- If the `plugins` setting is not there, urn-forge runs `valibot` and then `fcis`, each with `{}`.
- If the array is empty, `compile` runs no plugin and writes no file.

### Plugins and the fingerprint

The fingerprint in the header of each generated file includes the names, the versions, the configurations and the sequence of the plugins. If you change the `plugins` setting, the generated files change. Then gate 4 fails until you run `urn-forge compile` again. For the fingerprint, refer to [Determinism and the fingerprint](../explanation/determinism).

## Errors

urn-forge reports these errors against the configuration file. Each error stops the command with exit code `1`.

| Problem | Code | Example message |
| --- | --- | --- |
| urn-forge cannot load the file: the file is not there, or it has a syntax error | `config-unreadable` | `cannot load config: <reason>` |
| The file has no default export | `config-invalid` | ``config: the file must `export default` the config`` |
| The default export is not an object | `config-invalid` | `config: Invalid type: Expected Object but received 5` |
| An unknown setting | `config-invalid` | `config.foo: unknown option "foo"` |
| A path setting that is an empty string | `config-invalid` | `config.core: must not be empty` |
| A value of the incorrect type | `config-invalid` | `config.boundaryCoverage: Invalid type: Expected ("warn" \| "error") but received "strict"` |
| An unknown plugin | `config-invalid` | `config.plugins[1]: unknown plugin "postgres" (plugins: valibot, fcis)` |
| A plugin that occurs two times | `config-invalid` | `config.plugins[2]: plugin "valibot" is listed more than once` |
| A plugin configuration that is not `{}` | `plugin-config` | `plugin valibot config: Invalid key: Expected never but received "strict"` |
| A plugin needs a plugin that is not in the array | `missing-plugin` | `plugin fcis requires plugin valibot, which is not enabled` |

urn-forge reports all the `config-invalid` errors of the file together. For each code, refer to [Diagnostics](./diagnostics).

## Related pages

- [The CLI](./cli)
- [Set up a project](../how-to/set-up-a-project)
- [Adopt strict coverage](../how-to/adopt-strict-coverage)
- [Boundary coverage and the ratchet](../explanation/boundary-coverage)
