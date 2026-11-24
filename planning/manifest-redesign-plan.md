# urn-forge manifest redesign plan

Nov 24, 2026 · @Shadow Smith

The [redesign notes](./manifest-redesign-notes.md) record 36 decisions for a smaller manifest: definitions, rules and operations, in JSON Schema's words, with rules in a subset of CEL. This plan builds it.

urn-forge is at `0.1.0` and is not published. By decision 28 of the notes, a `0.x` version can change anything. Thus there is no migration tool and no period with two manifests for users. The only manifests to move are ours: the test fixtures, the `example`, `self`, `insurance` and `tutorial` domains, the starter template, and the six contracts of the corpus.

## How

The new compiler is built next to the old one, then it replaces it.

- The new code is in a new workspace package, `packages/urn-forge-next`, which is private. The old package and its CI do not change until the switch.
- Each step adds to the new package, with its own tests. Each commit keeps both packages green.
- At the switch, the new package takes the place of `packages/urn-forge`, under the name `urn-forge`, version `0.2.0`. The old code is deleted.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where the new code is | **A new private workspace package, `packages/urn-forge-next`, moved into `packages/urn-forge` at the switch** | The old tests, fixtures and CI stay as they are while the new code grows. The switch is one move |
| 2 | The CEL subset | **Our own parser, type checker and printer for the subset. The generated code is plain TypeScript, as the rules of today are: no CEL library at run time** | urn-forge must type every rule, translate it to SQL, compare it in `diff`, and find the guards of `has()`. A CEL library evaluates; it does not do these. Generated code with no dependency stays as it is now |
| 3 | The standard set | **A manifest of rules in the package, in urn-forge's namespace, loaded before the user's manifest** | The standard rules are declared as a user's rules are (decision 12). The same code checks both |
| 4 | Generated code | **Valibot schemas and TypeScript types for each definition, with its rules. For each operation, a generated harness: it parses the input, calls the user's function, parses the output, and checks the rules of that output and of the operation** | The same libraries as now. The harness is what `executeOperation` is today, without `changes`, `callers`, `due` and `idempotency` |
| 5 | A failed check | **The result names the rule, the place (the path of the value), and the message with its parameters filled** | Decision 26: an app can show its own text for the rule's name |
| 6 | Gherkin | **The steps give an input and expect an output object, or a rule that fails. Gate 3 asks for a scenario for each output of each operation, and a scenario that breaks each rule that a definition or an operation applies** | The same coverage as now, in terms of the new manifest: outputs in place of errors, rules in place of invariants |
| 7 | The gates | **Gates 1 to 4 stay: completeness (each operation has a function), boundary (the shell calls the harness), Gherkin coverage, and drift (the generated files are up to date)** | They check the user's project, not the manifest. The manifest changes; what they check does not |
| 8 | `diff` | **New rules: a rule added or removed by name, a parameter made narrower or wider, a rule's text changed, an output added or removed, all judged by the side (input or output) and by semver (decision 28)** | The decisions of the notes. The old classifier is deleted at the switch |
| 9 | The Postgres extra | **Schema only: tables, columns, `CHECK` constraints for the rules that SQL can write, child tables. Its config names the tables, the foreign keys and the unique values. No store file** | Decision 36 |
| 10 | The corpus | **After the switch, the six contracts are rewritten in the new manifest, and each promise is judged again with the test of declared. The minimum is the new score, up or down** | Many promises were declared with features that go. The test stays the same; the score must be true |
| 11 | The docs | **Rewritten after the switch, in STE, with real outputs. Until then, they describe `0.1.0`** | Docs for a compiler that is not yet in use would be wrong twice |

## Build order

Each phase is one pull request, with one commit for each step.

### Phase 1: the language

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target: the booking manifest of the notes in `packages/urn-forge-next/tests/fixtures/booking`, and tests of what `compile` must give for it | The tests fail for the reason expected |
| 1 | The package, the loader and the meta-schema: `manifest`, `definitions`, `rules`, `operations`, and the names between them | A wrong name, a missing definition or a cycle of types is a diagnostic with a path |
| 2 | The CEL subset: parse, type, print, guards | Each form of decisions 23 to 25 parses and types. A form outside the subset is a diagnostic |
| 3 | Rules: parameters, the standard set, `self`, `input`, `output` | `minimum: 1` on an integer types; `seating_keeps_the_party` on a definition is a diagnostic |

### Phase 2: the generated code

| Step | Commit | Done when |
| --- | --- | --- |
| 4 | Valibot and types for definitions, with their rules | The booking fixture's generated files type-check, and its values parse or fail by rule name |
| 5 | The harness for operations, with the rules of each output | A wrong output, or a broken rule, is a failure that names the rule |
| 6 | Gherkin steps and gate 3 | Each output and each rule needs a scenario |
| 7 | Gates 1, 2 and 4, and the CLI: `init`, `compile`, `verify` | The starter template compiles and verifies |

### Phase 3: `diff` and Postgres

| Step | Commit | Done when |
| --- | --- | --- |
| 8 | `diff` | One `tests/diff` case for each rule of decision 8 |
| 9 | The Postgres extra, schema only | The booking fixture's schema runs on PGlite, and a broken `CHECK` refuses a row |

### Phase 4: the switch

| Step | Commit | Done when |
| --- | --- | --- |
| 10 | Rewrite `example`, `self`, `insurance` and `tutorial` in the new manifest | Each compiles and verifies with the new package, and its scenarios pass |
| 11 | The switch: the new package takes the place of the old one, as `urn-forge` `0.2.0`. CI runs the new commands. The old code is deleted | CI is green with one package |

### Phase 5: the corpus and the docs

| Step | Commit | Done when |
| --- | --- | --- |
| 12 | The six contracts, rewritten; each promise judged again | `npm run corpus` gives the new score, and the minimum is that score |
| 13 | The docs, rewritten | The docs build; each output in the docs comes from a real run |

## Done

- One package, `urn-forge` `0.2.0`, with the manifest of the notes.
- The six contracts, the domains and the docs use it.
- The corpus score is true for the new manifest.

## What was built (Nov 24, 2026)

All five phases are in one pull request, with one commit for each step. The build differs from this plan and from the notes in these places:

- **No Valibot.** The generated file is plain TypeScript with no import: a type and a check for each definition, and the harness. The compiler runs the same checks on the arguments of rules.
- **Postgres: JSONB, not child tables.** A property that is a list or an embedded object is a JSONB column. Its rules are named in a comment of the schema, and the harness checks them.
- **`multipleOf` is for integers.** CEL has `%` only for integers.
- **The standard set needs more of CEL:** `exists_one` (for `uniqueItems`), `matches()` (for `pattern` and `format`), and `size()` of a string (for the lengths).
- **Gherkin steps:** `When I run "<operation>" with:`, `When I check a "<definition>" with:`, `Then the output is "<output>"` (with or without a table), `Then the input is rejected by "<rule>" of "<definition>"`, `Then the value is rejected by …` and `Then the value is accepted`.
- **The score:** 64 of 143 promises (44.8%), up from 49 (34.3%). Each promise was judged again with the test of declared. A promise about stored records that two calls at the same time can break is a workaround (C3, C1 or C2), in every contract: no generated check sees the store.

## Risks

- **The corpus score can go down.** Promises declared with `callers`, `idempotency` or `due` are now modelled by users, and some may become workarounds. The score must be true, not high.
- **The rewrite takes longer than the phases say.** Each phase is a pull request that keeps CI green, so the work can stop after any phase with nothing broken.
- **Two compilers for a time.** Only the old one is in CI's domains until step 11. A fix to the old one in that time is not worth it, unless something is broken.
- **The CEL subset grows.** Decision 23 adds a CEL form only for a real need. A form that a contract needs and the subset does not have is a diagnostic, not a quiet addition.
