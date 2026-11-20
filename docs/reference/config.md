# Configuration file

A configuration file keeps the paths and the plugins of a project in one location. Then the commands do not need the path options.

```ts
// urn-forge.config.ts
import { defineConfig } from '../src/config.js';

export default defineConfig({
  manifest: '../tests/fixtures/math.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../tsconfig.json',
  plugins: [
    ['valibot', {}],
    ['fcis', {}],
  ],
});
```

This is the configuration file of the math example. urn-forge is not on npm at this time. As a result, the file imports `defineConfig` from the source of urn-forge with a relative path. `defineConfig` only gives types to the object. You can also export a plain object.

## Find the file

The `compile` and `verify` commands use the first applicable item:

1. The file that `--config <file>` gives. If urn-forge cannot load this file, the command fails.
2. The file `urn-forge.config.ts` in the current directory, if it exists.
3. No configuration file. Each setting uses its default.

urn-forge loads the file as TypeScript. The file must `export default` the configuration.

## Settings

Each setting comes from the first applicable source:

1. The option on the command line, relative to the current directory.
2. The configuration file, relative to the directory of the configuration file.
3. The default, relative to the current directory.

| Setting | Option | Default | Command |
| --- | --- | --- | --- |
| `manifest` | `--manifest` | `domain.manifest.yaml` | Both |
| `out` | `--out` | `src/generated` | Both |
| `core` | `--core` | `src/core.ts` | `verify` |
| `features` | `--features` | `features` | `verify` |
| `tsconfig` | `--tsconfig` | `tsconfig.json` | `verify` |
| `plugins` | None | All plugins, each with an empty configuration | Both |

## Plugins

`plugins` is a list of the plugins to run, in sequence. Each item is the name of a plugin, or a pair of the name and the configuration of the plugin. The name alone is the same as the name with `{}`.

| Plugin | Makes | Requires |
| --- | --- | --- |
| `valibot` | `domain.schemas.generated.ts` | None |
| `fcis` | `domain.runtime.generated.ts` | `valibot`, because the runtime imports the schemas |

The two plugins do not have configuration options at this time. Thus their configuration must be `{}`.

The plugin configurations are part of the fingerprint. If you change the plugins, the generated files change, and you must run `urn-forge compile` again.

## Errors

| Problem | Code |
| --- | --- |
| urn-forge cannot load the file | `config-unreadable` |
| The file has no default export, an unknown setting, a value of the wrong type, an unknown plugin, or a plugin two times | `config-invalid` |
| A plugin requires a plugin that is not in the list | `missing-plugin` |
| The configuration of a plugin is not valid | `plugin-config` |
| A plugin cannot make code for a part of the manifest | `unsupported-construct` |

For each code, refer to [Diagnostics](./diagnostics).
