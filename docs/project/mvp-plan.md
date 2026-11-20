# urn-forge MVP implementation plan

Nov 19, 2026 · @Shadow Smith

The MVP proves one claim: a URN declared in YAML traces to a typed handler and a passing Gherkin scenario, and CI fails when any link in that chain breaks.

## Scope

The MVP keeps the four links of the traceability chain, which are the manifest, the IR, the generated contracts and the Gherkin check. It cuts everything that only adds breadth.

| Area | MVP keeps | MVP cuts (back in later) |
| --- | --- | --- |
| Atom kinds | `field`, `entity`, `operation` | `invariant`, `event`, `error`, lifecycle metadata |
| Primitives | `integer`, `float`, `string` | `decimal`, `boolean`, `timestamp`, `list`, `record`, `ref` |
| Constraints | `min`, `max`, `notEqual`, `minLength`, `maxLength` | `regex`, `format`, `oneOf`, `precision` |
| Optionality | `required` per field ref (default `true`) | `nullable` |
| Compiler passes | Meta-schema, expansion, uniqueness, references | Cycles, rule typing, constraint coherence, lifecycle |
| Determinism | Sorted output, no clock, fingerprint header | Cross-locale CI run, `referenceDate` |
| Plugins | Valibot, FCIS (sync, handlers return output directly) | `Result` type, Gherkin parameter types, Postgres |
| Gates | 1 completeness (`tsc` + `satisfies`), 3 tags + headers, 4 drift | 2 lint profile, 3 boundary coverage, 5 compatibility |
| CLI | `compile`, `verify` | `init`, `diff`, `inspect`, `graph` |
| Fixtures | Math | Insurance |

Handlers return output directly, with no `Result` wrapper, because the MVP has no declared errors. Adding the `error` kind later changes the handler return type in one generated file, and `tsc` then flags every handler that needs updating.

## Math fixture

The MVP is done when these three files compile, type-check and pass. Write them first, because they double as the acceptance test for the whole build.

**`tests/fixtures/math.manifest.yaml`**

```yaml
manifest:
  namespace: demo
  domain: math
  version: 0.1.0

geometry.field.radius:      { primitive: float, min: 0 }
geometry.field.area:        { primitive: float, min: 0 }
arithmetic.field.dividend:  { primitive: float }
arithmetic.field.divisor:   { primitive: float, notEqual: 0 }
arithmetic.field.quotient:  { primitive: float }

geometry.entity.circle:
  description: A circle by radius
  fields: [{ ref: geometry.field.radius }]
geometry.entity.circle_area:
  description: Area of a circle
  fields: [{ ref: geometry.field.area }]
arithmetic.entity.division:
  description: A division to perform
  fields: [{ ref: arithmetic.field.dividend }, { ref: arithmetic.field.divisor }]
arithmetic.entity.division_result:
  description: The quotient
  fields: [{ ref: arithmetic.field.quotient }]

geometry.operation.compute_area:
  description: Area from radius
  input: geometry.entity.circle
  output: geometry.entity.circle_area
arithmetic.operation.safe_divide:
  description: Divide; the divisor is never zero
  input: arithmetic.entity.division
  output: arithmetic.entity.division_result
```

**`example/core.ts`**, the hand-written functional core:

```ts
import type { DomainCoreImplementation } from './generated/domain.runtime.generated';

export const core = {
  'urn:demo:math:geometry:operation:compute_area':
    ({ radius }) => ({ area: Math.PI * radius ** 2 }),
  'urn:demo:math:arithmetic:operation:safe_divide':
    ({ dividend, divisor }) => ({ quotient: dividend / divisor }),
} satisfies DomainCoreImplementation;
```

The handlers receive branded inputs but return plain output shapes. The shell parses and brands the output (see Spec gaps).

**`example/features/safe_divide.feature`**

```gherkin
@urn:demo:math:arithmetic:operation:safe_divide
Feature: Safe division

  Scenario Outline: Valid divisions
    When I run the operation with:
      | dividend   | divisor   |
      | <dividend> | <divisor> |
    Then the output is:
      | quotient   |
      | <quotient> |

    Examples:
      | dividend | divisor | quotient |
      | 10       | 2       | 5        |
      | -9       | 3       | -3       |

  Scenario: A zero divisor is rejected at the boundary
    When I run the operation with:
      | dividend | divisor |
      | 1        | 0       |
    Then the input is rejected on "divisor"
```

A matching `compute_area.feature` follows the same pattern. Three generic step definitions (`I run the operation with`, `the output is`, `the input is rejected on`) call `executeOperation` with the URN read from the feature's tag. The steps don't depend on the domain, so they ship as part of urn-forge.

## Build order

The plan has ten steps, each ending in a check you can run. Every step leaves the repo green, so you can stop after any of them and still have something that works.

- [x] **1. Repo skeleton.** Node 22, TypeScript strict, ESM, Vitest. Dependencies: `valibot`, `yaml`, `@cucumber/cucumber`, `@cucumber/gherkin`, `@cucumber/messages`, `typescript` (also used as a library). Check: `npm test` runs an empty suite; `tsc --noEmit` passes.
- [x] **2. Fixture files.** Commit the three files from *Math fixture* as written, plus `compute_area.feature`. Nothing compiles yet. Check: the files exist and the YAML parses.
- [x] **3. Meta-schema** (`src/meta-schema.ts`). Valibot schema for the header, short keys (`<context>.<kind>.<identifier>`, snake\_case), the three kinds, the three primitives, and constraint keys per primitive. Check: the math manifest passes; Vitest cases for a bad key, an unknown primitive and `minLength` on a `float` each fail with the key in the message.
- [x] **4. IR builder** (`src/ir/`). Expand short keys to URNs, derive `brandIdentifier`, run uniqueness and reference checks, produce plain sorted objects, and compute the canonical JSON and SHA-256 fingerprint. Check: a golden test snapshots the math IR; tests for a dangling `ref` and a duplicate brand name fail with the URN.
- [x] **5. Valibot plugin.** One `v.pipe(…, v.brand(urn))` per field, one `v.object` per entity, plus exported types. Check: golden file matches; a Vitest case shows `v.safeParse` rejecting `divisor: 0` and accepting `divisor: 2`.
- [x] **6. FCIS plugin.** Handler types (branded input → plain output), `DomainCoreImplementation`, `DispatchMap`, and `executeOperation`, which parses input, calls the handler, then parses and brands the output. Check: golden file matches; `example/core.ts` type-checks; deleting a handler makes `tsc` fail.
- [x] **7. `urn-forge compile`.** CLI reads the manifest, runs both plugins, writes files with the `@generated` + fingerprint header, LF, sorted. Check: running it twice produces no git diff.
- [x] **8. Step library + Cucumber run.** Three generic steps that read the operation URN from the feature tag and call `executeOperation`. Table cells are coerced by the field's primitive before parsing. Check: `cucumber-js` passes both features.
- [x] **9. `urn-forge verify`.** Gate 1: `tsc --noEmit` plus a check that the core export uses `satisfies DomainCoreImplementation`. Gate 3: every `@urn:` tag resolves, every operation has a feature, and every table header is a field key of the operation's input or output entity. Gate 4: compile to a temp dir and byte-compare. Check: passes on the clean repo.
- [ ] **10. CI.** One GitHub Actions workflow: `npm ci` → `npm test` → `urn-forge verify` → `cucumber-js`. Check: green on `main`; the three seeded failures under *Done* each turn it red.

## Done

The MVP is done when CI is green on the clean repo and turns red on each of three one-line sabotages.

| Sabotage | Gate that catches it |
| --- | --- |
| Delete the `safe_divide` handler from `core.ts` | 1, completeness (`tsc`) |
| Rename the `divisor` column to `denominator` in the feature file | 3, headers |
| Hand-edit `domain.schemas.generated.ts` | 4, drift |

At that point, decide go or no-go. If the chain felt worth having on the math fixture, return to spec v1.1 in this order: the `error` kind and `Result` (Milestone 2's remaining scope), then boundary coverage and the lint profile (Milestone 3), then the insurance fixture, Postgres and dogfooding (Milestones 3–4). Each item adds to the MVP without reworking what it built.

## Spec gaps found while planning

Planning the MVP exposed two conflicts in spec v1.1. Both need a fix in the spec, and the MVP builds the proposed fix.

1. **Handlers can't return branded output.** Spec §7.2 types handlers as returning branded output, but Gate 2 forbids the core from minting brands. Proposed fix: handlers return the *unbranded* output shape (`v.InferInput` of the output schema), and the shell's existing output parse does the branding. Inputs stay branded.
2. **Gate 3 header rule is too narrow.** §8 allows only input-entity field keys as table headers, which rules out expected-output columns like `quotient`. Proposed fix: allow field keys from the operation's input or output entity, and later the fields of its declared errors.
