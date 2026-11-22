# Add a plugin

This guide is for contributors who change urn-forge itself. A codegen plugin turns the IR into generated files. urn-forge has three plugins at this time: `valibot` writes the schemas, `fcis` writes the runtime, and `postgres` writes the SQL. A project enables plugins by name in its config.

The example plugin on this page is `urn-list`. It writes one file with every URN of the manifest. urn-forge does not have this plugin. It is a small example that compiles and runs.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You know the IR. Refer to [How urn-forge is built](./architecture.md).

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Know the contract

A plugin is a value of type `CodegenPlugin`, from `src/plugins/plugin.interface.ts`:

<<< @/../packages/urn-forge/src/plugins/plugin.interface.ts{49-59}

| Member | What it gives |
| --- | --- |
| `name` | The name that a config uses to enable the plugin |
| `version` | Part of the fingerprint. Increase it when the output changes, so the change shows as drift |
| `configSchema` | A Valibot schema. The engine parses the config of the plugin with it before any plugin runs |
| `C` and `I` | The two type parameters. `C` is the config that `emit` gets, after defaults. `I` is the config that a user writes, before defaults. By default, `I` is the same as `C` |
| `supports` | The kinds that the plugin handles, and for each primitive the constraints that it translates |
| `requires` | The plugins whose output this plugin imports |
| `emit` | A function from the IR and the parsed config to files and diagnostics |

`emit` must be a pure function. It must not read the clock, random values, the environment or the file system. The engine adds the `@generated` header with the fingerprint, and the CLI writes the files.

## Write the plugin

1. Make the file `src/plugins/<name>.plugin.ts`.
2. Write the plugin. This is the full `urn-list` plugin:

   ```ts
   import * as v from 'valibot';
   import type { CodegenPlugin } from './plugin.interface.js';

   const ConfigSchema = v.strictObject({
     /** The name of the exported constant. Default: `URNS`. */
     exportName: v.optional(v.pipe(v.string(), v.regex(/^[A-Za-z_$][\w$]*$/u, 'exportName must be a JavaScript identifier'))),
   });
   export type UrnListPluginConfig = v.InferOutput<typeof ConfigSchema>;

   /** Every URN of the manifest, sorted, as one exported array. */
   export const urnListPlugin: CodegenPlugin<UrnListPluginConfig> = {
     name: 'urn-list',
     version: '0.1.0',
     configSchema: ConfigSchema,
     // Reads only the URN of each atom: it handles every kind, and translates no constraint.
     supports: { kinds: ['field', 'entity', 'invariant', 'operation', 'event', 'error'] },
     emit(ir, config) {
       const urns = [ir.fields, ir.entities, ir.invariants, ir.operations, ir.events, ir.errors].flatMap((group) => Object.keys(group)).sort();
       const lines = [
         `export const ${config.exportName ?? 'URNS'} = [`,
         ...urns.map((urn) => `  ${JSON.stringify(urn)},`),
         `] as const;`,
       ];
       return { artifacts: [{ relativePath: 'domain.urns.generated.ts', content: `${lines.join('\n')}\n` }], diagnostics: [] };
     },
   };
   ```

3. Use a `v.strictObject` for the config, so that an unknown option is an error. Use `v.strictObject({})` if the plugin has no options.
4. Give each default in one place. Select one of these two methods:
   - Give the default in `emit`, as `urn-list` does with `?? 'URNS'`. Then `CodegenPlugin<C>` is correct.
   - Give the default in the schema, with the second argument of `v.optional`. Then declare the input type too, as the `postgres` plugin does: `CodegenPlugin<v.InferOutput<typeof ConfigSchema>, v.InferInput<typeof ConfigSchema>>`.

   With one type parameter, the input type and the output type of `configSchema` must be the same, so `tsc` refuses a default in the schema. `defineConfig` types the config of a plugin with `I`, so a user can leave out each option that has a default.
5. Declare `supports` correctly:
   - List each kind whose atoms the plugin handles. The engine reports each atom of a kind that is not in the list as `unsupported-construct`.
   - If the plugin translates constraints, give `constraints`: for each primitive, the constraint keys that it translates. Make it from the translation table, as the Valibot plugin does, so that the two cannot disagree.
   - If the plugin does not read primitives or constraints, leave out `constraints`.
6. If the output imports the output of a different plugin, list that plugin in `requires`. The FCIS plugin requires `valibot`.
7. Make the output deterministic:
   - Sort with the default sort or with code-unit order, never with `localeCompare`.
   - Use `\n` line endings.
   - Use `JSON.stringify` or `numberLiteral` to write values as TypeScript literals.
8. Give each `relativePath` a name with `.generated.` in it. Gate 4 looks for such files, and reports one that no plugin makes as `generated-orphan`.

## Add it to the registry

1. Import the plugin in `src/plugins/index.ts`.
2. Add it to `PLUGINS` under its name:

   ```ts
   export const PLUGINS = { valibot: valibotPlugin, fcis: fcisPlugin, postgres: postgresPlugin, 'urn-list': urnListPlugin } as const;
   ```

   Use the `name` of the plugin as the key. A config enables the plugin by the key, and `requires` names the plugin by its `name`. `PluginName` and the config type come from this object, so `defineConfig` accepts the new name and types its config.

3. Decide whether to add the plugin to `DEFAULT_PLUGINS`. A project without a `plugins` list runs the default plugins: `valibot` and `fcis`. If you add a plugin there, the output of each such project changes. `postgres` is not a default plugin.
4. Run `npm run typecheck` from the root folder.

## Enable it in a config

1. Add the plugin to `plugins` in `urn-forge.config.ts`, with its config:

   ```ts
   plugins: ['valibot', 'fcis', ['urn-list', { exportName: 'SHIPPING_URNS' }]],
   ```

2. Run `compile`. With the manifest of tutorial 3, the output is:

   ```
   wrote      generated/domain.runtime.generated.ts
   wrote      generated/domain.schemas.generated.ts
   wrote      generated/domain.urns.generated.ts
   fingerprint sha256:9bb7836dde79bb81a422ad69258cb5f8577fd5e7a1b920346a63b92473227c55
   ```

   The new file is:

   ```ts
   // @generated by urn-forge 0.1.0 — do not edit
   // fingerprint: sha256:9bb7836dde79bb81a422ad69258cb5f8577fd5e7a1b920346a63b92473227c55

   export const SHIPPING_URNS = [
     "urn:demo:shipping:parcel:entity:parcel",
     "urn:demo:shipping:parcel:field:express",
     "urn:demo:shipping:parcel:field:weight_grams",
     "urn:demo:shipping:parcel:field:zone",
     "urn:demo:shipping:quote:entity:quote",
     "urn:demo:shipping:quote:error:too_heavy_for_express",
     "urn:demo:shipping:quote:field:price_cents",
     "urn:demo:shipping:quote:operation:quote_shipping",
   ] as const;
   ```

If the config is not correct, `compile` stops before any plugin runs:

- A value that `configSchema` refuses:

  ```
  urn-forge.config.ts  error  plugin-config  plugin urn-list config: exportName: exportName must be a JavaScript identifier
  ```

- A plugin that a different plugin requires is not enabled:

  ```
  urn-forge.config.ts  error  missing-plugin  plugin fcis requires plugin valibot, which is not enabled
  ```

- A name that is not in `PLUGINS`:

  ```
  urn-forge.config.ts  error  config-invalid  config.plugins[2]: unknown plugin "urn-lists" (plugins: valibot, fcis, postgres, urn-list)
  ```

## Test the plugin

1. Add a test file, for example `tests/urn-list.plugin.test.ts`, for the output and for each diagnostic.
2. Add a fixture with an `urn-forge.config.ts` that enables the plugin. The fixture harness and the determinism test then compile it with that plugin list. Refer to [Add a test fixture](./add-a-fixture.md).
3. Run `npm test` from the root folder.

## Document the plugin

1. Add the plugin and its options to [The configuration file](../docs/reference/configuration.md).
2. Describe the files that it makes on a reference page, as [The generated schemas](../docs/reference/generated-code.md) does for Valibot.
3. Update [Scope](../docs/explanation/the-contract.md).

## Result

`npm test` and `npm run typecheck` pass. A project that lists the plugin in its config gets the new file from `compile`, and gate 4 compares it with the committed copy.

## Related pages

- [Add a test fixture](./add-a-fixture.md)
- [Add a kind](./add-a-kind.md)
- [The configuration file](../docs/reference/configuration.md)
- [How urn-forge is built](./architecture.md)
- [Determinism and the fingerprint](../docs/explanation/how-urn-forge-proves-it.md)
