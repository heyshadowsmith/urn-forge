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
- [ ] **3. Kind registry and generic passes.** Each kind declares its meta-schema and its reference slots (`{ path: 'input', targets: ['entity'] }`). Passes 3 and 4 become loops over the slots; the cycle check (pass 5) is a walk over the same graph. *Check:* golden output unchanged; every reference diagnostic still fires.
- [ ] **4. Plugin host and naming module.** Shared naming (`schemaNames`, brand identifiers) moves out of the Valibot plugin. Plugins declare the primitives, constraints and kinds they handle, and the engine reports anything else as `unsupported-construct` with its URN (spec §7). `urn-forge.config.ts` and `defineConfig`, composed from each plugin's `configSchema`.
- [ ] **5. Gate framework and feature index.** Gates register themselves and may return warnings (needed for the boundary-coverage ratchet). Gherkin parsing moves into a feature index (scenarios with resolved tags, tables and example values) that the current checks, boundary coverage and error coverage all read. Fix the missing-required-header gap from spec §8.
- [ ] **6. Public surface.** `src/index.ts` exports the engine, `defineConfig` and plugin types; the step library becomes a `urn-forge/cucumber` subpath. A fixture harness (a directory per fixture with its manifest, expected IR, generated files and diagnostics). The cross-locale, cross-time-zone CI run from spec §9.

## Acceptance tests for the architecture

After phase 4, two small additions test whether the registries work, the way the math fixture tested the MVP:

1. **`boolean` with `mustBe`.** It should take one new primitive module plus one translator entry per plugin, with `tsc` listing each of those.
2. **`oneOf` on `string`.** The first non-numeric constraint. It exercises the new constraint value type, rendering, boundaries ("every value plus one outside") and a `string[]` value end to end.

If either sprawls beyond that, fix the registry before adding `decimal`, `list` or `ref`. The `error` kind is then the real test of phase 3.

## Dogfooding

Two tracks set the order of the breadth work after the phases:

- **`packages/urn-forge/self/`**: urn-forge declares its own pure functions with urn-forge. Its [backlog](https://github.com/heyshadowsmith/urn-forge/blob/main/packages/urn-forge/self/README.md) lists what it cannot yet declare about itself: `regex`, `oneOf`, `boolean` and the `error` kind.
- **One real project** (spec §10 requires this before M4 exits). It pulls on what a business domain needs: `decimal`, `timestamp`, `ref` and invariants.

## Not in scope

- A third-party plugin API, loader or discovery. v1 is for the author's own projects; plugins stay in-tree and typed.
- Speculative fields in the registry descriptors. A property is added when a real consumer needs it: boundaries for gate 3, widen/tighten for gate 5.
