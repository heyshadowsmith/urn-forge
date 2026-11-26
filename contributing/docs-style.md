# Documentation style guide

This guide is for the pages of the documentation site, in `docs/`. The pages in `contributing/` and `CONTRIBUTING.md` follow its English rules (section 2) too.

## 1. The pages

The site has two pages. Keep it so: a new page needs a reason that neither page can hold.

| Page | Serves | Holds |
| --- | --- | --- |
| `index.md` | A person who wants to know what urn-forge does, and to try it | The split, how it works in four steps, the five gates, and how to start |
| `methodology.md` | A person who wants to understand it | The split, the loop, the contract, the harness, the gates, what they cannot prove, the review, and the limits |

The facts (each key, rule, step, option and code) are in `packages/urn-forge/AGENTS.md`, the reference for agents. A test keeps it complete. The site links to it, and does not copy it.

## 2. ASD-STE100 Simplified Technical English

Both pages use STE. These are the rules that this site applies.

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
- **Links** in `docs/` go to the other page with a path and no extension, for example `[The methodology](/methodology)`. VitePress uses clean URLs. A user page does not link to `planning/` or `contributing/`. Links in `contributing/` keep the `.md` extension, so that they work on GitHub.
- **Headings** use sentence case.
- **Terms** follow [the reference](../packages/urn-forge/AGENTS.md):
  - *definition*, *rule*, *operation*, *input* and *output* are the parts of the manifest. Do not write *field*, *entity*, *kind*, *primitive*, *constraint* or *atom*: they are words of 0.1.
  - A *refusal* is an output. Do not write *error* for it.
  - *The core* is the functions of the operations. *The shell* is the code that calls `runOperation`. *The harness* is `runOperation`.
  - *Standard rules* are the common checks that urn-forge ships, such as `minimum`. The site does not name the technologies under urn-forge.
- **Versions:** urn-forge 0.2.0. Do not promise future work. To say that a part is not built, write "urn-forge does not have … at this time". [The methodology](../docs/methodology.md) tells why some promises stay outside the manifest.
- **The navigation** is in `docs/.vitepress/config.mts`. The old addresses of the site redirect to the methodology, in `docs/vercel.json`.

## 4. Check a page

1. Read the page against sections 2 and 3.
2. Run each command of the page, and compare the output with the page.
3. Run `npm run docs:build` from the root of the repository. A dead link or a snippet file that does not exist fails the build.

## Related pages

- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [How urn-forge is built](./architecture.md)
- [The reference for agents](../packages/urn-forge/AGENTS.md)
