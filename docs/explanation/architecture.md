# How urn-forge is built

This page is for people who want to change urn-forge. It tells how a manifest becomes generated files and a verdict. It also tells how the registries hold the knowledge about each primitive and kind, and how `tsc` keeps the registries complete. The code is in `packages/urn-forge/src`.

## The pipeline

`compile` and `verify` share one pipeline. Each stage reads only the result of the stage before it:

```
domain.manifest.yaml
   │
   ▼  pass 1: meta-schema          src/meta-schema.ts, the schema of each kind
   │
   ▼  passes 2–4, 6, 7: IR builder  src/ir/build.ts, the build of each kind
   │
UniversalIR (canonical, sorted by URN)
   │
   ▼  support check                src/engine.ts, the `supports` of each plugin
   │
   ▼  plugins: valibot, fcis       src/plugins/
   │
   ▼  header, line endings, sort   src/engine.ts
   │
generated files ──▶ compile writes them      (src/cli.ts, src/write.ts)
                └─▶ verify gives them, with the IR and the feature index,
                    to gates 1, 3 and 4       (src/verify/)
```

The stages have these jobs:

1. **The meta-schema** (pass 1) validates the structure of the manifest with Valibot. It builds its schema from the descriptor of each kind and each primitive.
2. **The IR builder** expands the short keys (pass 2), checks that URNs and brand identifiers are unique (pass 3) and resolves each reference (pass 4). Then each kind builds its IR node. The build runs the checks that belong to one kind: message placeholders for an error (pass 6) and constraint coherence for a field (pass 7).
3. **The support check** compares the IR with what each plugin says that it supports. It runs before any plugin writes output.
4. **The plugins** each turn the IR into file contents. They do not read the YAML, and they do not read the output of a different plugin.
5. **The engine** adds the `@generated` header with the fingerprint, sets the line endings and sorts the files by path.

The engine has no access to the file system, the clock or the environment. The CLI writes what the engine returns. This keeps the engine deterministic. Refer to [Determinism and the fingerprint](./determinism).

`verify` compiles in memory, then builds one context for all gates: the IR, the fresh files, the paths and the feature index. Each gate is an entry in the `GATES` registry, with a number, a name and a `run` function. A gate passes when none of its problems is an error. Thus a gate can give warnings and notes and still pass. Boundary coverage needs this for its warn-then-ratchet mode.

## The registries

The [foundations plan](../project/foundations-plan) found that the knowledge about each primitive was in six places, and nothing kept them in step. The meta-schema, the IR types, the Valibot plugin, the FCIS plugin and the step library each had a list of primitives. The IR builder also had a branch for each kind.

The plan put each kind of knowledge in a registry:

| Registry | Where | One entry holds | Consumers |
| --- | --- | --- | --- |
| Primitives | `src/primitives/` | The constraints and the schema of each constraint value, coherence (pass 7), the parse of a table cell, the boundary cases | The meta-schema, the IR, the plugins, the step library, gate 3 |
| Kinds | `src/kinds/` | The schema of an entry, the reference slots, the build of the IR node | The meta-schema, the IR builder |
| Plugins | `src/plugins/index.ts` | A plugin, by name | The configuration file, the engine |
| Gates | `src/verify/index.ts` | A gate, by number | `verify` |

A reference slot is a path in an entry and the kinds that it can name, such as `{ path: ['fields', '*', 'ref'], targets: ['field'] }`. Pass 4 is one loop over the slots of every kind. A new kind brings its slots, and it gets reference checks, with positions, with no new pass code.

### How `tsc` keeps the registries complete

The foundations plan used the idea of urn-forge on urn-forge itself. Gate 1 uses `tsc` to find a handler that is not there. In the same way, each consumer that must handle every primitive or every kind declares a table that `tsc` checks:

- The Valibot plugin declares its translations as `{ readonly [P in Primitive]: ValibotTranslation<P> }`. Each translation has one entry for each constraint of its primitive. A new primitive or constraint makes `tsc` fail at this table until it has an entry.
- The kind registry uses `satisfies { readonly [K in KindName]: KindDescriptor<K, any, unknown> }`. A new name in `KindName` makes `tsc` fail until the registry has a descriptor.
- A type-level check compares the groups of the kind registry with the records of `UniversalIR`. If the two disagree, `tsc` fails.
- The list of kinds in the specification that urn-forge does not support has a type that excludes the supported kinds. A kind cannot be on the list and in the registry at the same time.
- Each member of a descriptor is necessary. When `boundaries` became a member of the primitive descriptor, `tsc` named all four primitives until each had its rules.

CI runs `npm run typecheck`, so these checks fail the build, and not only the editor.

## What a plugin supports

Specification v1.1 says that each plugin "must handle every IR construct or fail compilation naming the construct it cannot handle". A plugin that skips a construct without a sign is worse than a plugin that fails. The generated code would look complete, but it would not be.

Each plugin thus declares `supports`: the kinds that it handles and, for each primitive, the constraints that it translates. Before any plugin writes output, the engine compares the IR with these declarations. Each construct that a plugin does not support becomes an `unsupported-construct` diagnostic, with its URN and its position in the manifest.

The Valibot plugin derives its `supports` from its translation table. Thus the declaration and the code that writes the output cannot disagree.

A plugin also declares `requires`: the plugins whose output its own output imports. The FCIS runtime imports the Valibot schemas. If a configuration enables `fcis` without `valibot`, the compile stops with `missing-plugin`.

The support check also made it possible to add the `error` kind in small steps. When the compiler first accepted errors, no plugin supported them. A manifest with an error stopped with `unsupported-construct` from both plugins. After the next step, it stopped with a diagnostic from the FCIS plugin only. After the step after that, it compiled.

## The feature index

Gate 3 needs the features in a form that it can compare with the IR. `src/verify/feature-index.ts` parses every `.feature` file once, with `@cucumber/gherkin`. The index holds these parts of each feature:

- The scenarios, with their tags in scope.
- The steps of the background and of each scenario.
- The tables, with the position of each cell.
- The `Examples` values.
- The comments.


Gate 3 reads the index for tags, headers, declared errors and waivers. `inputValues` reads the same index to collect the values that each operation receives, for boundary coverage. It converts each cell with the primitive of its field, as the steps do.

The texts of the generic steps are in `src/gherkin/phrases.ts`. The step library registers these texts, and gate 3 reads them to find the input table of a scenario. Thus the step library and gate 3 cannot disagree about which table is the input.

## Why a new primitive or kind is one place

The registries make breadth additive. The first additions after the foundations work show this:

- **`boolean` with `mustBe`.** It took one module in `src/primitives/`, one line in the registry and one entry in the Valibot translations. `tsc` named that table and nothing else. The meta-schema, `FieldInfo`, the cell parse and the support check took it with no change.
- **`oneOf` on `string`.** It was the first constraint whose value is not a number. It took the constraint in the `string` descriptor and one Valibot entry. `tsc` typed the value as `string[]` in that entry.
- **A trial `event` kind.** `tsc` asked for a descriptor, a registry entry and an IR group. The kind then got reference checks with no new pass code. The trial was then removed.

The registries do not hold speculative properties. A property goes into a descriptor when a part of urn-forge that is not a plugin needs it. Boundary cases came with gate 3, and not before. Plugin details stay in the plugins.

## The limits

- urn-forge has no API for plugins from other packages. The plugins are part of the repository, and their names are typed by the registry.
- Pass 5 (cycles) and pass 8 (lifecycle) are not in urn-forge at this time. With the current kinds, no entity can contain an entity, so no cycle is possible.
- A new kind is still more work than a new primitive. Each plugin must decide what to write for it. The `error` kind changed both plugins, the step library and gate 3.

## Related pages

- [Compiler passes](../reference/compiler-passes)
- [Contributor: add a primitive](../how-to/add-a-primitive)
- [Contributor: add a kind](../how-to/add-a-kind)
- [Contributor: add a plugin](../how-to/add-a-plugin)
- [Dogfooding](./dogfooding)
