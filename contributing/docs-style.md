# Documentation style guide

This guide is for the pages of the documentation site, in `docs/`. Every page under `tutorials/`, `how-to/`, `reference/` and `explanation/` follows it. The pages in `contributing/` and `CONTRIBUTING.md` follow its English rules (section 2) too.

## 1. Diátaxis

Each page is exactly one of four types. Do not mix them on one page; link to the other type instead.

| Type | Folder | Serves | Shape | Do not |
| --- | --- | --- | --- | --- |
| Tutorial | `tutorials/` | Learning. A newcomer does it once, with you | One path from start to a working result. Numbered steps. Each step gives the action and the visible result. The reader does every step | Explain why at length, give choices, or cover alternatives |
| How-to guide | `how-to/` | A goal. A person who already uses urn-forge wants to get something done | A title that is the goal ("Add a rule"). A short "Before you start". Numbered steps. A "Result" or check | Teach the basics, or describe every option |
| Reference | `reference/` | Information. A person looks up a fact | Complete, accurate, consistent. Tables. The same order everywhere. Dry | Give instructions, or explain the design |
| Explanation | `explanation/` | Understanding. A person wants to know why | Discussion, context, alternatives that were rejected, the limits | Give steps, or list every option |

The guides in `contributing/` are how-to guides for contributors, except [How urn-forge is built](./architecture.md) and [Dogfooding](./dogfooding.md), which are explanations.

## 2. ASD-STE100 Simplified Technical English

All four types use STE. These are the rules that this site applies.

1. **Use approved words with their approved meaning.** Use one word for one meaning, and one meaning for one word. Prefer: *make* (not *create, generate*), *start* (not *launch*), *stop*, *show* (not *display*), *use* (not *utilize*), *examine* (not *inspect*), *make sure* (not *ensure, verify*), *if* (not *in case*), *thus* or *as a result* (not *therefore* in the middle of text), *necessary* (not *required*, except in names), *give* (not *provide*), *get* (not *obtain*), *possible*, *correct*, *incorrect*.
   - Technical names are always correct as they are: `verify`, `compile`, `required`, `runOperation`, `DomainCore`, *Scenario Outline*, *CEL*, *manifest*, *schema*, *harness*. Put code, commands, keys, file names and values in backticks.
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

- **Real code only.** Show files with VitePress snippet imports, for example `<<< @/../packages/urn-forge/tutorial/1-first-domain/src/core.ts`. The tutorial snapshots, `example/`, `self/`, `insurance/` and `tests/fixtures/` are tested in CI, so a snippet import cannot drift. Write code inline only for short fragments that no file contains, and then make sure that it is correct. Snippet imports work only in `docs/`. In `contributing/`, link to the file instead.
- **Real output only.** Copy command output from a real run in this repository. Shorten a long line with `…` only where it is too long, and keep one full example on the page.
- **Commands** are the commands of a user: `npx urn-forge compile`, `npx urn-forge verify` and `npx cucumber-js`, in the root of the project. Show them in `bash` blocks. A page that runs a command in another folder says so.
- **Links** in `docs/` go to other pages with relative paths and no extension, for example `[Diagnostics](./diagnostics)` or `[Add a rule](../how-to/add-a-rule)`. VitePress uses clean URLs. Link to a page, not to a heading on a page that someone else writes. A user page does not link to `planning/` or `contributing/`. Links in `contributing/` keep the `.md` extension, so that they work on GitHub.
- **Headings** use sentence case. A how-to title is the goal. A reference title is the name of the thing.
- **Terms** follow [the glossary](../docs/reference/manifest.md):
  - *definition*, *rule*, *operation*, *input* and *output* are the parts of the manifest. Do not write *field*, *entity*, *kind*, *primitive*, *constraint* or *atom*: they are words of 0.1.
  - A *refusal* is an output. Do not write *error* for it.
  - *The core* is the functions of the operations. *The shell* is the code that calls `runOperation`. *The harness* is `runOperation`.
  - *Standard rules* are the keywords of JSON Schema that urn-forge ships.
- **Versions:** urn-forge 0.2.0. Do not promise future work. To say that a part is not built, write "urn-forge does not have … at this time". [General constructs only](../docs/explanation/why-urn-forge.md) and [The contract](../docs/explanation/why-urn-forge.md) tell why some promises stay outside the manifest.
- **Every page** ends with a short "Related pages" list of two to five links, to other Diátaxis types where possible. The home page and `explanation/index.md` do not have one at this time.
- **The sidebar** is in `docs/.vitepress/config.mts`. When you add or remove a page, change the sidebar and the index page of its section.

## 4. The pages

| Page | Type |
| --- | --- |
| `index.md` | The home page |
| `tutorials/index.md` | Tutorial: the overview of the three tutorials |
| `tutorials/first-domain.md` | Tutorial 1: build the shipping domain |
| `tutorials/declared-errors.md` | Tutorial 2: add a refusal |
| `tutorials/strict-coverage.md` | Tutorial 3: make the domain strict |
| `how-to/index.md` | How-to: the list of guides |
| `how-to/install.md` | Install urn-forge |
| `how-to/set-up-a-project.md` | Set up a project |
| `how-to/add-a-definition.md` | Add a definition |
| `how-to/add-an-object-or-a-list.md` | Add an object or a list |
| `how-to/add-a-rule.md` | Add a rule |
| `how-to/add-an-operation.md` | Add an operation |
| `how-to/declare-a-refusal.md` | Declare a refusal |
| `how-to/model-the-input.md` | Model a stored record, the caller and the time |
| `how-to/write-scenarios.md` | Write scenarios |
| `how-to/call-an-operation.md` | Call an operation |
| `how-to/regenerate-code.md` | Regenerate code |
| `how-to/fix-a-failing-gate.md` | Fix a failing gate |
| `how-to/run-verify-in-ci.md` | Run verify in CI |
| `how-to/change-the-contract.md` | Change the contract |
| `how-to/store-in-postgres.md` | Store objects in Postgres |
| `reference/index.md` | Reference: the list |
| `reference/manifest.md` | The manifest |
| `reference/definitions.md` | Definitions and types |
| `reference/rules.md` | Rules and the standard rules |
| `reference/rule-language.md` | The rule language |
| `reference/operations.md` | Operations and outputs |
| `reference/generated-code.md` | The generated code |
| `reference/gherkin-steps.md` | Gherkin steps |
| `reference/verification-gates.md` | Verification gates |
| `reference/diff.md` | Diff and versions |
| `reference/postgres-schema.md` | The Postgres schema |
| `reference/configuration.md` | The configuration file |
| `reference/cli.md` | The CLI |
| `reference/diagnostics.md` | Diagnostics |
| `reference/public-api.md` | The package API |
| `reference/glossary.md` | Glossary |
| `explanation/index.md` | Explanation: the list |
| `explanation/the-contract.md` | The contract |
| `explanation/core-and-shell.md` | The core and the shell |
| `explanation/general-constructs.md` | General constructs only |
| `explanation/json-schema-and-cel.md` | JSON Schema's words and CEL |
| `explanation/how-urn-forge-proves-it.md` | How urn-forge proves it |
| `explanation/compatibility.md` | Compatibility |

## 5. Check a page

1. Read the page against sections 2 and 3.
2. Run each command of the page, and compare the output with the page.
3. Run `npm run docs:build` from the root of the repository. A dead link or a snippet file that does not exist fails the build.

## Related pages

- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [How urn-forge is built](./architecture.md)
- [The glossary](../docs/reference/manifest.md)
