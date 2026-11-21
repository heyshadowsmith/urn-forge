# Documentation style guide

This file is not published (`srcExclude` in `.vitepress/config.mts`). Every page under `tutorials/`, `how-to/`, `reference/` and `explanation/` follows it. The Project section (`project/`) is source material and keeps its own style.

## 1. Diátaxis

Each page is exactly one of four types. Do not mix them on one page; link to the other type instead.

| Type | Folder | Serves | Shape | Do not |
| --- | --- | --- | --- | --- |
| Tutorial | `tutorials/` | Learning. A newcomer does it once, with you | One path from start to a working result. Numbered steps. Each step gives the action and the visible result. The reader does every step | Explain why at length, give choices, or cover alternatives |
| How-to guide | `how-to/` | A goal. A person who already uses urn-forge wants to get something done | A title that is the goal ("Declare an error"). A short "Before you start". Numbered steps. A "Result" or check | Teach the basics, or describe every option |
| Reference | `reference/` | Information. A person looks up a fact | Complete, accurate, consistent. Tables. The same order everywhere. Dry | Give instructions, or explain the design |
| Explanation | `explanation/` | Understanding. A person wants to know why | Discussion, context, alternatives that were rejected, the limits | Give steps, or list every option |

## 2. ASD-STE100 Simplified Technical English

All four types use STE. These are the rules that this site applies.

1. **Use approved words with their approved meaning.** Use one word for one meaning, and one meaning for one word. Prefer: *make* (not *create, generate*), *start* (not *launch*), *stop*, *show* (not *display*), *use* (not *utilize*), *examine* (not *inspect*), *make sure* (not *ensure, verify*), *if* (not *in case*), *thus* or *as a result* (not *therefore* in the middle of text), *necessary* (not *required*, except in field names), *give* (not *provide*), *get* (not *obtain*), *possible*, *correct*, *incorrect*.
   - Technical names are always correct as they are: `verify`, `compile`, `required: false`, `boundaryCoverage`, *Scenario Outline*, *handler*, *URN*, *brand*, *manifest*, *schema*. Put code, commands, keys, file names and values in backticks.
2. **No -ing forms** as nouns, adjectives or in continuous tenses. Write "when you run" (not "when running"), "the steps that follow" (not "the following steps"), "to make a test" (not "testing"). Technical terms such as *string*, *drift* and *Gherkin* are names, not -ing forms.
3. **No contractions.** Write "do not", "it is".
4. **Active voice** in procedures, and in descriptions when you can. Write "`compile` writes the files" (not "the files are written").
5. **Procedural sentences: 20 words at most.** Start with the verb: "Run this command." One instruction in each sentence, unless the actions occur at the same time.
6. **Descriptive sentences: 25 words at most.** One topic in each sentence.
7. **Paragraphs: six sentences at most**, one topic in each.
8. **Use vertical lists** for sequences and for groups of three or more items.
9. **Use articles** (*a*, *an*, *the*) where English usually has them. Do not write telegraphic text.
10. **Give the conditions first:** "If the gate fails, run `urn-forge compile`."
11. **Warnings and cautions** start with the hazard: "Do not edit the generated files. `verify` fails at gate 4."

## 3. Conventions of this site

- **Real code only.** Show files with VitePress snippet imports, for example `<<< @/../packages/urn-forge/tutorial/1-first-domain/core.ts`. The tutorial snapshots, `example/`, `self/` and `tests/fixtures/` are tested in CI, so a snippet import cannot drift. Write code inline only for short fragments that no file contains, and then make sure that it is correct.
- **Real output only.** Copy command output from a real run in this repository. Shorten long URNs with `…` only where the line is too long, and keep one full example on the page.
- **Commands** run from `packages/urn-forge` unless the page says otherwise. Show them in `bash` blocks.
- **Links** go to other pages with relative paths, for example `[Diagnostics](../reference/diagnostics)`. Link to a page, not to a heading on a page that someone else writes.
- **Headings** use sentence case. A how-to title is the goal. A reference title is the name of the thing.
- **Terms** follow [the glossary](reference/glossary.md). Use *atom* for a field, entity, operation or error. Use *operation*, not *use case* or *command*. Use *the core* for the handlers and *the shell* for the code that calls `executeOperation`.
- **Versions:** urn-forge 0.1.0. Do not promise future work. To say that a part is not built, write "urn-forge does not have … at this time", and link to [Scope](reference/scope.md).
- **Every page** ends with a short "Related pages" list of two to five links, to other Diátaxis types where possible.

## 4. The pages

| Page | Type |
| --- | --- |
| `tutorials/index.md` | Tutorial: the overview of the three tutorials |
| `tutorials/first-domain.md` | Tutorial 1: build the shipping domain |
| `tutorials/declared-errors.md` | Tutorial 2: add a declared error |
| `tutorials/strict-coverage.md` | Tutorial 3: make the domain strict |
| `how-to/index.md` | How-to: the list of guides |
| `how-to/install.md` | Install urn-forge |
| `how-to/set-up-a-project.md` | Set up a project |
| `how-to/add-a-field.md` | Add a field |
| `how-to/add-an-entity.md` | Add an entity |
| `how-to/add-an-operation.md` | Add an operation |
| `how-to/declare-an-error.md` | Declare an error |
| `how-to/add-an-invariant.md` | Add an invariant |
| `how-to/write-scenarios.md` | Write scenarios |
| `how-to/use-branded-values.md` | Use branded values in the core |
| `how-to/call-an-operation.md` | Call an operation from the shell |
| `how-to/store-in-postgres.md` | Store entities in Postgres |
| `how-to/regenerate-code.md` | Regenerate the code after a manifest change |
| `how-to/fix-a-failing-gate.md` | Fix a gate that fails |
| `how-to/adopt-strict-coverage.md` | Adopt strict coverage |
| `how-to/waive-a-boundary.md` | Waive a boundary |
| `how-to/run-verify-in-ci.md` | Run verify in CI |
| `how-to/add-a-primitive.md` | Contributor: add a primitive |
| `how-to/add-a-constraint.md` | Contributor: add a constraint |
| `how-to/add-a-kind.md` | Contributor: add a kind |
| `how-to/add-a-plugin.md` | Contributor: add a plugin |
| `how-to/add-a-fixture.md` | Contributor: add a test fixture |
| `reference/index.md` | Reference: the list |
| `reference/cli.md` | The CLI |
| `reference/configuration.md` | The configuration file |
| `reference/manifest.md` | The manifest |
| `reference/rule-language.md` | The rule language |
| `reference/primitives.md` | Primitives and constraints |
| `reference/naming.md` | URNs and names |
| `reference/compiler-passes.md` | Compiler passes |
| `reference/generated-schemas.md` | The generated schemas |
| `reference/generated-runtime.md` | The generated runtime |
| `reference/postgres-schema.md` | The Postgres schema |
| `reference/gherkin-steps.md` | Gherkin steps |
| `reference/verification-gates.md` | Verification gates |
| `reference/diagnostics.md` | Diagnostics |
| `reference/json-output.md` | JSON output |
| `reference/public-api.md` | The package API |
| `reference/glossary.md` | Glossary |
| `reference/scope.md` | Scope |
| `explanation/index.md` | Explanation: the list |
| `explanation/traceability.md` | The traceability chain |
| `explanation/urns.md` | URNs as permanent names |
| `explanation/functional-core.md` | The functional core and brands |
| `explanation/results-and-errors.md` | Results and declared errors |
| `explanation/determinism.md` | Determinism and the fingerprint |
| `explanation/what-the-gates-show.md` | What the gates show |
| `explanation/boundary-coverage.md` | Boundary coverage and the ratchet |
| `explanation/primitives-model.md` | The MECE model of primitives |
| `explanation/architecture.md` | How urn-forge is built |
| `explanation/dogfooding.md` | Dogfooding |
| `explanation/departures-from-the-spec.md` | Departures from the specification |
