# urn-forge error kind plan

Nov 20, 2026 · @Shadow Smith

The `error` kind is the rest of Milestone 2 (spec §4.6, §5, §7.1–7.2, §8). Today a handler can only succeed: a domain rejection such as "the policy is already cancelled" has no path except throwing. This plan adds declared errors from the manifest through to a Gherkin scenario that expects one, the same chain the MVP built for success.

## What changes for a user

**Before**: a handler returns its output.

```ts
'urn:demo:math:geometry:operation:compute_area':
  ({ radius }) => ({ area: Math.PI * radius ** 2 }),
```

**After**: every handler returns a `Result`, built with two generated helpers.

```yaml
naming.error.invalid_short_key:
  description: The key is not <context>.<kind>.<identifier>
  category: validation
  retryable: false
  message: Short key {short_key} is not <context>.<kind>.<identifier>
  fields: [{ ref: naming.field.short_key }]

naming.operation.parse_short_key:
  description: Split a short key into its segments
  input: naming.entity.short_key_input
  output: naming.entity.short_key_parts
  errors: [naming.error.invalid_short_key]
```

```ts
import { fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

'urn:demo:math:geometry:operation:compute_area':
  ({ radius }) => ok({ area: Math.PI * radius ** 2 }),

'urn:urn_forge:toolchain:naming:operation:parse_short_key': ({ short_key }) => {
  const parsed = parseShortKey(short_key);
  return parsed.ok
    ? ok(parsed.value)
    : fail('urn:urn_forge:toolchain:naming:error:invalid_short_key', { short_key });
},
```

```gherkin
Scenario: A key with two segments is refused
  When I run the operation with:
    | short_key     |
    | geometry.area |
  Then the operation fails with "urn:urn_forge:toolchain:naming:error:invalid_short_key"
```

This is a breaking change to every handler, once. `tsc` (gate 1) names each one, and the fix is mechanical: wrap the return value in `ok(…)`.

## Decisions to confirm

The spec leaves these open, or the MVP's experience suggests a refinement. Each has a recommendation; the build order assumes it.

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Do operations without `errors` also return a `Result`? | **Yes, every handler.** Its error type is `never` | One handler shape. Adding a first error to an operation later does not change its signature again |
| 2 | How does a handler build a `Result`? | **Generated `ok(value)` and `fail(errorUrn, fields)` helpers.** Plain object literals still type-check | `fail` is typed per error URN, so the fields are checked. When events arrive, `ok(value, events)` gains an optional argument instead of breaking every handler a second time |
| 3 | What does the `Result` carry on success? | `{ ok: true, value }` now; `events` is added when the `event` kind exists | Spec §7.2 has `events` on success. Requiring an always-empty `events: []` now is noise, and the helper hides the difference |
| 4 | Are error fields branded? | **No.** A handler passes plain fields, and the shell parses and brands them, as for output | The same rule as spec gap #1 in the MVP plan: the core does not mint brands |
| 5 | What does `executeOperation` return for a declared error? | A new outcome, `{ ok: false, kind: 'DomainError', urn, error }`, where `error` holds the error URN, `category`, `retryable`, the rendered `message` and the parsed `fields` | Spec §7.2 step 4. A distinct `kind` lets a shell map it to a 4xx while `InputRejected` and `ContractViolation` stay separate |
| 6 | What if a handler fails with an error its operation does not declare, or with bad fields? | `ContractViolation` | Spec §7.2 step 4: a bug in the core, not a user error |
| 7 | May a message placeholder name an optional field? | **No: placeholders must name required fields of the error** (pass 6, `unknown-placeholder`) | Then every rendered message is complete. The spec only requires a placeholder to name a field |
| 8 | How does a scenario name the error it expects? | **By full URN**: `Then the operation fails with "<error URN>"`, optionally followed by a table of error fields | Traceability by URN, like tags. Gate 3 can check it without running anything |
| 9 | How strict is error coverage (spec §8 check 3: every declared error has a scenario)? | **A warning now** (`uncovered-error`), which becomes an error when boundary coverage ratchets | Spec §8: coverage checks warn until ratcheted. The gate framework already supports warnings |
| 10 | What about `recordAs`? | **Not yet.** The meta-schema rejects it with a clear message until the `event` kind exists | `recordAs` names an event. Building it now would mean building events |

## Scope

| In | Not yet |
| --- | --- |
| The `error` kind: `description`, `category` (the five of spec §4.6), `retryable`, `message` with `{placeholders}`, optional `fields` | `recordAs`, `emits`, the `event` kind |
| `errors` on operations | Mapping categories to HTTP statuses (shell code, outside urn-forge) |
| Pass 6 for messages: each placeholder names a required field of the error | Pass 6 for invariant rules (no invariants yet) |
| `Result`, `ok`, `fail`, the `DomainError` outcome | Async handlers (spec §1: synchronous only) |
| Error schemas with a `kind` discriminant (spec §7.1) | |
| The step `Then the operation fails with "<urn>"`, with an optional field table | |
| Gate 3: `undeclared-error` (error), `uncovered-error` (warning) | Boundary coverage of error fields |

## Build order

Each step leaves the repository green and ends with a check you can run.

The work is driven by urn-forge's own domain, the way the math fixture drove the MVP: step 0 writes the target first, and every later step changes what that target produces, in a diff a reviewer can read.

- [x] **0. The target, written first.** `parse_short_key` in urn-forge's own domain, backed by the real `parseShortKey`, written as it will look when the work is done:
  - `tests/fixtures/self-errors/domain.manifest.yaml`: the slice of the `self/` manifest the operation needs: `naming.field.short_key` and `naming.field.kind_segment`, the input and output entities, three errors and `naming.operation.parse_short_key` with `errors` listing them. The fixture harness compiles it, so its expected output records where the work stands.
  - Three errors, not two, because `parseShortKey` has three failure outcomes: `invalid_short_key` (the grammar), `unsupported_kind` (a spec kind such as `event`) and `unknown_kind` (such as `widget`). The last two carry the kind as written in `kind_segment`.
  - `self/pending/core.ts` and `self/pending/features/parse_short_key.feature`: the handler (`ok(parsed.value)`, or `fail(…)` by the code `parseShortKey` returns) and nine scenarios: three valid keys, four invalid ones, and one for each kind error with its fields. They use the step `Then the operation fails with "<urn>"` and its table form, `Then the operation fails with "<urn>":` followed by a table of error fields. `self/pending/` is excluded from `tsc` and not read by `verify` or Cucumber until the steps that make it run (`self/pending/README.md`).
  - *Check:* the fixture fails with `unsupported-kind` for each of the three errors and `unknown-property` for `errors`, each at its line. That is today's compiler describing the gap.
- [x] **1. The kind.**
  - A descriptor in `src/kinds/error.ts`: its schema, and `fields` reference slots like an entity's.
  - `IRError` in the IR, and `errors` on `IROperation`, with an `errors.*` reference slot that may name only errors.
  - Pass 6: parse `message` into text and placeholders, and report `unknown-placeholder` for a name that is not a required field.
  - An entity's duplicate-property check is shared with errors.
  - No plugin declares `error` support yet, so a manifest that uses errors fails with `unsupported-construct`. That is the support check doing its job.
  - Also done here: the shared field-reference code (`src/kinds/field-refs.ts`); `errors` on an operation reports a repeated error as `duplicate-ref`; a placeholder is `{…}` with no whitespace inside, so prose braces stay text but `{Quantity}` is still checked; `manifestHash` leaves out empty kind groups, so adding a kind to urn-forge does not change the hash of a manifest that does not use it. `self/`'s `naming.field.kind` gained `error`, as its registry test required.
  - *Check:* the `self-errors` fixture's expected diagnostics change to `unsupported-construct`, from both plugins, for each of its three errors; `invalid-structure` and `broken-references` gain the new problems (`recordAs`, a bad category, a placeholder typo, an `errors` entry that names an entity).
- [x] **2. Valibot.**
  - One `v.object` per error, with `kind: v.literal('<error URN>')` and the error's fields, exporting `<Brand>Schema`, `<Brand>` and `<Brand>Input`. A manifest without errors gets no `// Errors` section, so existing generated files are byte-identical.
  - The plugin declares `error` support.
  - Because the payload's `kind` holds the URN, an error field whose identifier is `kind` is now a compile error, `reserved-property`.
  - *Changed from the plan:* the `shop` fixture cannot gain an error yet, because FCIS would refuse it and the fixture's generated code (which tests import) would disappear. Instead, a fixture may now hold an `urn-forge.config.ts` choosing its plugins (the harness and the determinism test load it), and a new `errors-valibot` fixture runs the Valibot plugin alone. `shop` gains its error in step 3.
  - *Check:* the `self-errors` fixture's diagnostics narrow to the FCIS plugin only. The `errors-valibot` fixture's error schemas parse a valid error (with and without its optional field, and an error with no fields) and reject a wrong `kind`, a missing field and a field that breaks its constraint; `tsc` types `kind` as the literal URN.
- [x] **3. FCIS.**
  - Generate `Result`, `ok`, `fail`, the handler types (`Result<OutputInput, ErrorInput | …>`) and `DispatchMap.errors` (schema, `category`, `retryable` and the message template for each error).
  - `executeOperation` adds `DomainError` and the two new `ContractViolation` causes.
  - Migrate `example/core.ts` and `self/core.ts` to `ok(…)`, and declare `error` support.
  - The `shop` fixture gains an error with fields (moved here from step 2).
  - The `self-errors` fixture now compiles. Its manifest slice moves into `self/domain.manifest.yaml`, and its handler moves from `self/pending/core.ts` into `self/core.ts`, so gate 1 checks it. The fixture directory is removed.
  - *Check:* `tsc` names every handler before the migration and none after; all existing scenarios still pass; the successful `parse_short_key` scenario passes; runtime tests for each outcome.
  - *Done, with these findings:*
    - `tsc` named all four handlers before the migration (`Type '{ area: number; }' is not assignable to type 'Result<{ area: number; }, never>'`) and none after.
    - The target had a naming bug that step 0 could not show, because plugins refused errors until now: the entity `short_key_input` and the field `short_key` both export `NamingShortKeyInput`. `export-collision` reported it; the entity is now `short_key_request`.
    - Only the successful scenarios moved into `self/features/` here, so gate 3 sees the operation tagged; the error scenarios wait in `self/pending/` for step 4's step.
    - `fail`'s mapped types give readable messages (`… is not assignable to parameter of type 'ErrorFields<"urn:…:unsupported_kind">'`), so the one-helper-per-error fallback in *Risks* was not needed.
    - The FCIS plugin's version is now 0.2.0, since its output changed; its string literals now escape newlines, which an error message may contain.
- [x] **4. Steps.**
  - `Then the operation fails with {string}`, plus the table form `Then the operation fails with {string}:` that checks error fields. Cells are converted by each error field's primitive, from `DispatchMap.errors`.
  - `the output is:` needed no change: `executeOperation` unwraps `ok(…)`, so the output step still reads `output`.
  - *Added:* gate 3 checks the headers of a `fails with` table against the fields of the error it names, not the operation's input and output. Without this, `verify:self` would have failed on `kind_segment`.
  - *Sabotage check:* mapping `widget` to `invalid_short_key` in `self/core.ts` fails its scenario with `… failed with …:invalid_short_key (Short key policy.widget.x is not …); expected …:unknown_kind`.
  - The error scenarios move from `self/pending/` into `self/features/`, and `self/pending/` is removed.
  - *Check:* step-library unit tests for each failure message; every `parse_short_key` scenario passes.
- [x] **5. Gate 3.**
  - `undeclared-error`: the URN in the step is not an error of the scenario's operation.
  - `uncovered-error` (a warning): a declared error that no scenario expects. It is counted in the warnings line.
  - *Check:* `verify` passes with a warning for an uncovered error, and fails for an undeclared one. `verify:self` passes with no warnings, because all three of `parse_short_key`'s errors have scenarios.
  - *Done.* Both checks also count the plain form of the step (without a table), which the old step loop skipped. Gate 3's summary gains `N/M errors expected` when the domain declares errors (`verify:self`: `3/3 errors expected`). Both sabotages, run through the CLI on `self/`: removing the `unknown_kind` scenario gives `verify passed with 1 warning(s)` and exit 0, the first warning any gate has made; naming an undeclared error fails gate 3 at the step, listing the operation's errors.
- [x] **6. Docs.**
  - The error kind in the manifest guide, `Result` in generated code, the new step, the new codes, and the scope table.
  - The `self/` backlog: `parse_short_key` is done. The message renderer stays blocked: its input is a template and a map of values, which needs the `record` primitive.

## Done

Error handling is done when CI is green and turns red on each of these sabotages:

| Sabotage | What catches it | Result |
| --- | --- | --- |
| A handler still returns a plain object | Gate 1 (`tsc`) | Caught (step 3): `Type '{ area: number; }' is not assignable to type 'Result<{ area: number; }, never>'` |
| A handler fails with an error its operation does not declare | The scenario, as a `ContractViolation` | Caught earlier than planned, by gate 1: `Type 'Failure<{ kind: "…:invalid_short_key"; … }>' is not assignable to type 'Result<{ urn: string; }, never>'`. A handler that bypasses the types gets the `ContractViolation` at runtime (`tests/results.test.ts`) |
| A message says `{keyy}` | `compile` (`unknown-placeholder`) | Caught: `self/domain.manifest.yaml:98:12  error  unknown-placeholder  … {kind_segmnt} names no field of the error (required fields: short_key, kind_segment)` |
| A scenario expects an error the operation does not declare | Gate 3 (`undeclared-error`) | Caught (step 5), at the step, listing the declared errors |
| A declared error has no scenario | Gate 3 warning (`uncovered-error`) | Caught (step 5): `verify passed with 1 warning(s)`, exit 0 |

And urn-forge's own `parse_short_key` passes every scenario, including all three errors, with `verify:self` reporting no warnings. **Met:** 27 `self/` scenarios pass and gate 3 reports `3/3 errors expected`.

**Status:** the error kind is done, and with it Milestone 2 apart from events (`emits`, `recordAs`, and `events` in `Result`), which wait for the `event` kind. Next, in the MVP plan's order: boundary coverage and the lint profile (Milestone 3), then the insurance fixture, the Postgres plugin and the real-project dogfooding track (Milestones 3–4).

## Risks

- **What `self/` cannot test.** urn-forge's own errors are all `validation` errors. The other categories (`conflict`, `not_found`, `forbidden`, `precondition`) and `retryable: true` only meet real use in a business domain. That is the second dogfooding track (spec §10: one real project before M4 exits), and errors are where it pays off most.
- **Two plugins and the core change at once.** The generated runtime grows the most since the MVP. Fixtures and the harness catch unintended output changes, and step 3 is the largest PR.
- **`fail`'s typing.** `fail(urn, fields)` must narrow `fields` to the error named by `urn`, through a generated map from error URN to its input type. Rejecting an error the operation does not declare needs nothing extra: `fail` returns a `Result` whose error type is that one error, and the handler's declared return type refuses it. If the mapped type gives unreadable messages, a fallback is one helper per error (`failInvalidShortKey(fields)`), which `tsc` checks just as well.
