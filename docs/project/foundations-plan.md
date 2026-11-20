# urn-forge foundations plan

Nov 20, 2026 · @Shadow Smith

The MVP proved the traceability chain on the math fixture. Before adding breadth (new primitives, kinds, plugins and gates), this plan turns each hard-coded part into a registry, so that later additions are additive: one new module, plus an entry in each consumer, with `tsc` naming every consumer that still lacks one.

## The problem

Knowledge of each primitive is spread across six places, and nothing keeps them in step:

| Where | What it hard-codes |
| --- | --- |
| `src/meta-schema.ts` | `MVP_PRIMITIVES`, `CONSTRAINTS_BY_PRIMITIVE`, a hand-written schema per primitive |
| `src/ir/types.ts` | `constraints: Record<string, number>`, which cannot hold `regex`, `oneOf` or `precision` |
| `src/plugins/valibot.plugin.ts` | `BASE_BY_PRIMITIVE`, `ACTION_BY_CONSTRAINT`, number-only literal rendering |
| `src/plugins/fcis.plugin.ts` | The `FieldInfo.primitive` union |
| `src/gherkin/steps.ts` | Its own `Primitive` type and a number-only `coerceCell` |
| Gate 3 (future) | Boundary values per constraint |

Kinds are the same: `buildIr` branches per kind, and reference resolution is written out for `ref`, `input` and `output`, where the spec has eleven reference properties. The plugins are coupled too: `fcis` imports `schemaNames` from `valibot`.

## The principle

Use the product's own idea on itself. Each consumer that must handle every primitive or kind declares a table with `satisfies Record<Primitive, …>`. Adding a primitive then turns `tsc` red at every place that has not handled it yet, the same way a missing handler fails gate 1.

## Phases

Each phase is one PR and leaves the repo green. Phases 2 to 4 must leave the golden files byte-identical: they move code, they do not change output.

- [x] **1. Structured diagnostics.** One `Diagnostic` type with a stable `code`, `severity`, `message`, optional `urn`, `file` and `line:col`. Manifest positions come from the YAML node ranges; gate problems are diagnostics too. Text and `--format json` renderings. A test keeps `docs/reference/diagnostics.md` in step with the codes. *Check:* every manifest diagnostic shows `file:line:col`; JSON lines cover `compile` and `verify`.
- [x] **2. Primitive registry.** One module per primitive in `src/primitives/` with its constraint schemas, constraint coherence (pass 7: `min <= max`, …) and cell parsing. The meta-schema is built from it; IR constraints become JSON values; the step library reads cells through it, so `steps.ts` drops its own primitive list. Plugin-specific translation stays in each plugin, typed `{ readonly [P in Primitive]: Translation<P> }`. CI now runs `tsc`, so the type-level tests are enforced. *Check:* golden output unchanged; adding a primitive to the registry fails `tsc` only at the Valibot translation table. Boundary values and widen/tighten rules wait for the code that consumes them: boundary coverage (phase 5) and gate 5 (see *Not in scope*).
- [x] **3. Kind registry and generic passes.** Each kind in `src/kinds/` declares its meta-schema, its reference slots (`{ path: ['fields', '*', 'ref'], targets: ['field'] }`) and how its IR node is built. Pass 4 is one loop over the slots; `ValidManifest` is derived from the registry, and `tsc` checks that the registry covers `KindName` and that its groups match `UniversalIR`. *Check:* golden output unchanged; every reference diagnostic still fires with the same text; adding an `event` kind took a descriptor, a registry entry and an IR group, and got reference checking with no new pass code. The cycle check (pass 5) waits for `list` or embedded entities: with the MVP kinds, nothing can contain an entity, so no cycle is possible.
- [x] **4. Plugin host and naming module.** Shared naming (`schemaNames`, `handlerName`, brand identifiers) moves to `src/naming.ts`. Plugins declare `supports` (kinds, and per primitive the constraints they translate) and `requires`; before any plugin emits, the engine reports each unsupported construct as `unsupported-construct` with its URN and position (spec §7), and a missing required plugin as `missing-plugin`. The Valibot plugin derives its `supports` from its translation table, so the two cannot disagree. A plugin registry, and `urn-forge.config.ts` with `defineConfig`: paths and plugins, flags overriding the config, paths relative to the config file. Plugin names are typed by the registry and each plugin's config is checked against its `configSchema`. The example and `self/` each have a config, and the scripts and CI use it. *Check:* generated output unchanged, with explicit and with bare plugin names.
- [x] **5. Gate framework and feature index.** A `Gate` is a number, a name and a `run(context)`; `verify` builds one context (IR, fresh files, paths, feature index) and runs the `GATES` registry. A gate passes when it has no errors, so warnings are possible (needed for the boundary-coverage ratchet), and the CLI counts them. Gherkin parsing moves into `src/verify/feature-index.ts`: scenarios with their tags in scope, background and own steps, tables with cell positions, and `Examples` values. Gate 3 reads it. The spec §8 gap is fixed as `missing-column`: the table of `When I run the operation with:` must have a column for every required input field (an empty cell still sends a missing value). *Check:* gates 1 and 4 unchanged; sabotage #2 now reports both the unknown and the missing column.
- [x] **6. Public surface.** `package.json` `exports`: `urn-forge` (engine, verify, `defineConfig`, diagnostics, IR and plugin types, registries, naming), `urn-forge/config` and `urn-forge/cucumber`, pointing at the TypeScript source (no build step yet); the example and `self/` configs and step wiring use them, and `tests/public-api.test.ts` lists every export. A fixture harness: each directory under `tests/fixtures/` holds a manifest and `expected/` with exactly what `compile` produces (IR and generated files, or diagnostics); it replaces the per-plugin golden tests and adds `shop` (every primitive and constraint, an optional ref), `invalid-structure` and `broken-references`. Determinism (spec §6, §9): a test compiles every passing fixture in a child process under the Turkish locale and the Chatham time zone, and a `determinism` CI job runs the suite, both compiles (no diff allowed) and both verifies under the same settings.

All six phases are done. Next come the two acceptance tests below, then the dogfooding backlog.

## Acceptance tests for the architecture

After phase 4, two small additions test whether the registries work, the way the math fixture tested the MVP:

1. **`boolean` with `mustBe`.** It should take one new primitive module plus one translator entry per plugin, with `tsc` listing each of those.
   *Result: passed.* The code took `src/primitives/boolean.ts`, one line in the registry and one entry in the Valibot translations; `tsc` named exactly that table and nothing else. The meta-schema, `FieldInfo`, cell parsing and the support check picked it up with no change. It also found a gap: the generated runtime lists every primitive, so its bytes changed, but the fingerprint did not, because it covered the IR and plugin versions but not the registries. The registries (each primitive's constraint keys, and the kind names) are now a fingerprint input, so a registry change shows in every header without a version bump.
2. **`oneOf` on `string`.** The first non-numeric constraint. It exercises the new constraint value type, rendering, boundaries ("every value plus one outside") and a `string[]` value end to end.

If either sprawls beyond that, fix the registry before adding `decimal`, `list` or `ref`. The `error` kind is then the real test of phase 3.

## Dogfooding

Two tracks set the order of the breadth work after the phases:

- **`packages/urn-forge/self/`**: urn-forge declares its own pure functions with urn-forge. Its [backlog](https://github.com/heyshadowsmith/urn-forge/blob/main/packages/urn-forge/self/README.md) lists what it cannot yet declare about itself: `regex`, `oneOf`, `boolean` and the `error` kind.
- **One real project** (spec §10 requires this before M4 exits). It pulls on what a business domain needs: `decimal`, `timestamp`, `ref` and invariants.

## Not in scope

- A third-party plugin API, loader or discovery. v1 is for the author's own projects; plugins stay in-tree and typed.
- Speculative fields in the registry descriptors. A property is added when a real consumer needs it: boundaries for gate 3, widen/tighten for gate 5.
