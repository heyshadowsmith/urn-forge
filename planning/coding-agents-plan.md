# urn-forge plan: coding agents as the primary user

Nov 25, 2026 · @Shadow Smith

urn-forge is built for coding agents first. An agent edits the manifest, runs `compile`, writes the core and the scenarios, and runs `verify` until it is green. Most of that loop already suits an agent:

- **One file is the source of truth.** The generated types tell the agent what to write.
- **The gates name the fix.** `no scenario breaks maxLength of note; add one that ends with Then the input is rejected by "maxLength" of "note"`.
- **A failure names its rule, its definition and its path.**
- **It is hard to cheat.** `@ts-ignore` fails gate 2, a hand-edited generated file fails gate 4, and `diff` shows a weaker rule.

This plan closes six gaps. It adds no manifest feature: each item is about how an agent reads urn-forge and how urn-forge reads the agent's work.

## The gaps

| # | Gap | What it costs an agent |
| --- | --- | --- |
| 1 | The output is text for a person | The agent parses prose, and a change of wording breaks it |
| 2 | A project has no instructions | Each new session finds the loop again, and can edit a generated file or skip a gate |
| 3 | The docs are on a website | The agent works from `node_modules`, often offline, and guesses the CEL subset or a step's words |
| 4 | Some messages do not name their fix | The agent tries changes until one works |
| 5 | The manifest format has no schema | The agent finds a wrong key only when `compile` runs, and an editor cannot complete a key |
| 6 | A contract can get weaker to go green | The largest risk: the agent deletes a rule, an output or a scenario so that `verify` passes |

## What changes for a user

```console
$ urn-forge verify --format json
{"ok":false,"problems":[{"code":"uncovered-rule","severity":"error","file":"features/booking.feature","line":null,
  "path":["note","maxLength"],"message":"no scenario breaks maxLength of note",
  "fix":"add a scenario that ends with: Then the input is rejected by \"maxLength\" of \"note\""}]}
```

```console
$ urn-forge init my-domain
  created my-domain/AGENTS.md
  created my-domain/CLAUDE.md          # one line: @AGENTS.md
  …
```

```console
$ urn-forge verify --base origin/main
gate 5: the contract is weaker than origin/main
  rule maxLength of note is removed
  scenario "A note that is too long is refused" is removed
  fix: bump manifest.version to a new major version, or put them back
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Which agents | **Any agent, through plain files and JSON: `AGENTS.md`, `--format json`, a JSON Schema. No skill, plugin or MCP server in this plan** | `AGENTS.md` is read by Claude Code (through `CLAUDE.md`), Codex, Cursor, Copilot and others. A Claude Code skill can come later and reuse the same files |
| 2 | The shape of a diagnostic | **One shape for each command: `{ code, severity, file, line, path, message, fix }`. `code` is a stable name, as now (`uncovered-rule`, `direct-call`, `drift`, …). `fix` is one sentence that says what to do** | The codes exist already. A stable code lets an agent act on a problem without reading its message |
| 3 | JSON output | **`--format json` on `compile`, `verify` and `diff`. It writes one JSON object to stdout and nothing else. The exit codes do not change** | One object is simpler to parse than a stream. The exit code stays the signal of pass or fail |
| 4 | Instructions in a project | **`init` writes `AGENTS.md` and a `CLAUDE.md` of one line, `@AGENTS.md`. `AGENTS.md` says: the loop (manifest, compile, core, scenarios, verify); the files never to edit; how a refusal and a contract violation differ; how to read a problem; and that a version bump is a person's decision** | The agent reads the rules of the project before it starts. It is a file of the project, so the team can change it |
| 5 | The reference in the package | **One file, `AGENTS.md`, at the root of the package, shipped in `files`. It holds the manifest keys, the standard rules, the CEL subset, the Gherkin steps and each diagnostic code with its fix. The project's `AGENTS.md` points at `node_modules/urn-forge/AGENTS.md`. A test fails when a key, a rule, a step or a code is missing from it** | It matches the installed version, works offline, and cannot fall behind the code |
| 6 | Each message names its fix | **Every diagnostic gets a `fix`. A test lists every code that the source can give and fails when one has no fix, or is not in the reference** | An agent acts on the fix. A person reads it too |
| 7 | A schema of the manifest | **`urn-forge/manifest.schema.json`, a JSON Schema of the manifest format, shipped in the package. `init` adds `# yaml-language-server: $schema=…` to the starter manifest. `compile` does not use it: its own checks stay the source of the messages** | Editors and agents can check a manifest before `compile`. The compiler's messages stay specific |
| 8 | A weaker contract | **Gate 5, with `verify --base <ref>`. It reads the manifest and the features at the git ref, and fails when, without a new major version (or in 0.x, without a version bump): a rule is removed from a definition, an output or an operation; an argument of a rule makes it accept more; an output is removed; or a scenario is removed. `diff` already classifies the changes of the manifest; gate 5 adds the scenarios** | This is the cheat that no gate stops today. A bump is a visible decision that a person reviews |
| 9 | Gate 5 with no `--base` | **Gate 5 does not run. CI passes `--base` with the target branch** | `verify` with no git history still works, as now |

## Scope

- **In scope:** decisions 1 to 9; the starter; the docs of the CLI (`--format`, `--base`, gate 5) and a how-to page, "Work with a coding agent".
- **Out of scope:** a Claude Code skill or plugin; an MCP server; a change to the manifest.

## The target, written first

Step 0 adds tests that fail for the reason expected:

- `verify --format json` on a fixture with a missing scenario gives one object, with the code `uncovered-rule` and a `fix`;
- `init` writes `AGENTS.md` and `CLAUDE.md`;
- the package's `AGENTS.md` names each standard rule, each CEL function, each step and each code;
- every code in the source has a `fix`;
- each manifest of the fixtures and the contracts is valid against `manifest.schema.json`, and a manifest with an unknown key is not;
- `verify --base` fails when a commit removes a rule and its scenario, and passes when the same commit bumps the major version.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | One diagnostic shape, with a `fix` for each code | Every code has a fix; the text output prints it |
| 2 | `--format json` on `compile`, `verify` and `diff` | The JSON tests pass; the exit codes do not change |
| 3 | The package's `AGENTS.md`, with its completeness test | Each key, rule, function, step and code is in it |
| 4 | `manifest.schema.json` | The fixtures and the contracts are valid; a bad manifest is not |
| 5 | `init` writes `AGENTS.md`, `CLAUDE.md` and the schema line | The starter test passes |
| 6 | Gate 5, `verify --base` | It fails on a removed rule, output or scenario, and passes with a bump |
| 7 | The docs and CI | The CLI reference and the how-to are written; this repository's CI runs `verify --base` |

## Sabotages at the end

Each must turn CI red:

1. Remove the `fix` of one code → the test of the codes.
2. Add a rule to the standard set and leave it out of `AGENTS.md` → the completeness test.
3. Print a line to stdout in `--format json` → the JSON test.
4. Delete a rule and its scenario from a contract on a branch → gate 5.

## Risks

- **`AGENTS.md` and the docs say the same thing twice.** The package's file is a reference, short and complete; the docs explain. The completeness test keeps the reference right; the docs link to it.
- **Gate 5 and a shallow clone.** CI must fetch the base ref. The error names the ref it could not read and says to fetch it.
- **Gate 5 blocks a fix that is meant to weaken a rule.** That is its purpose: the bump makes the decision visible, and a person approves it in review.

## What was built

Each step is one commit, and each commit is green.

- **Step 1.** `src/codes.ts` lists 41 codes, each with one fix. A diagnostic and a gate problem take a `Code`, so a code with no fix does not type-check. The text output shows the fix on the line after each problem. The type check found one code that the plan's list had missed, `type-cycle`.
- **Step 2.** `--format json` on `compile`, `verify` and `diff`. A wrong command line is the problem `usage`, with exit code `2`.
- **Step 3.** `packages/urn-forge/AGENTS.md`. The test checks each standard rule, each function and macro, each step, and each code with its exact fix.
- **Step 4.** `manifest.schema.json`, JSON Schema 2020-12. It accepts each manifest of the repository (with the placeholders of the starter filled in) and refuses an unknown key, an object with no `properties`, `items` on a string, and a map of two rules in one entry. The standard set is not checked: its rule names are camelCase.
- **Step 5.** The starter has `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md`) and the schema line. `init` keeps an `AGENTS.md` or a `CLAUDE.md` that exists, and says so: a project with its own instructions is common.
- **Step 6.** Gate 5 with the codes `removed-rule`, `wider-rule`, `removed-output`, `removed-scenario` and `base-unreadable`. The rules of a removed output are not reported again: `removed-output` names them. When the version allows the change, each change is a warning, so that a reviewer still sees it.
- **A fix after step 6.** Gate 5 found no feature at the base for a project in a folder of its repository, because `git ls-tree` reads a path from the working folder. A test with a project in a folder now covers it.
- **Step 7.** The how-to "Work with a coding agent", the CLI reference (JSON, gate 5, the new codes), CI (`--base` in the how-to, and gate 5 on each contract of the corpus on a pull request).

All four sabotages turned CI red: a code with no fix (the type check and the test of the codes), a standard rule missing from `AGENTS.md` (the reference test), a line on stdout in JSON mode (the JSON tests), and a removed rule and scenario (gate 5).
