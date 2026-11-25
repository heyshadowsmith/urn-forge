# urn-forge plan: a Claude Code skill

Nov 25, 2026 · @Shadow Smith

The [plan for coding agents](./coding-agents-plan.md) gave every agent plain files: an `AGENTS.md` in the project, a reference in the package, JSON output, and gate 5. This plan adds one file for Claude Code: a skill, `urn-forge`. It adds no command, no option and no manifest feature.

## Why a skill, when `AGENTS.md` exists

`AGENTS.md` is always in the context, so it must be short. It says what the project is and what not to do. A skill loads only when Claude Code works on the contract, so it can hold the procedure: the order of the steps, how to act on each code, and when to stop and ask a person.

| File | Read by | Holds |
| --- | --- | --- |
| `AGENTS.md` (project) | Each agent, always | The loop, the files never to edit, a pointer to the reference |
| `node_modules/urn-forge/AGENTS.md` | Each agent, when it needs a fact | The reference: keys, rules, functions, steps, codes and fixes |
| `.claude/skills/urn-forge/SKILL.md` (new) | Claude Code, when it changes the contract or a check fails | The procedure |

## What changes for a user

```console
$ npx urn-forge init
  wrote      .claude/skills/urn-forge/SKILL.md
  wrote      AGENTS.md
  wrote      CLAUDE.md
  …
```

In Claude Code, the skill loads when a request is about the contract ("add a refusal for an overdue invoice"), or the user types `/urn-forge`.

## The skill

```markdown
---
name: urn-forge
description: Change or fix an urn-forge domain: the manifest (domain.manifest.yaml), the core, the
  scenarios and the generated files. Use when a request adds or changes a rule, an output or an
  operation, or when urn-forge compile, verify or cucumber-js fails.
allowed-tools: Bash(npx urn-forge *) Bash(npx cucumber-js *)
---
```

The body is a procedure in five parts:

1. **Change the contract first.** Write the rule, the output or the operation in the manifest. Do not start in the core.
2. **Compile, then let the types lead.** Run `npx urn-forge compile --format json`, then write the core until gate 1 passes.
3. **Write the scenarios.** Write one for each new operation, each output and each rule. Add one at each edge of a rule, because gate 3 does not ask for these.
4. **Verify until green.** Run `npx urn-forge verify --format json`, then `npx cucumber-js`. Act on the first problem's `code` and `fix`. A table groups the codes by what to change: the manifest, the core, a scenario, or `compile`.
5. **Stop and ask a person when:**
   - the only way to green removes or weakens a rule, an output or a scenario;
   - a change needs a new `version`;
   - a rule that the user asked for cannot be said in the CEL subset.

For a fact, the skill points at `node_modules/urn-forge/AGENTS.md`. It does not copy the reference.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | How a project gets the skill | **`init` writes it to `.claude/skills/urn-forge/SKILL.md`, a project skill. Claude Code loads it with no install, and the team gets it from git. The package ships it at `skills/urn-forge/`. An existing project copies that folder. No plugin and no marketplace in this plan** | One way to get it. It works offline, and it is versioned with the project. A plugin is a second channel to keep in step. If users ask, the same folder can become a plugin later |
| 2 | Who invokes it | **Both: Claude loads it from the description, and the user can type `/urn-forge`** | The skill has no side effect that a person must start: it runs the loop that the user asked for |
| 3 | Pre-approved tools | **`allowed-tools: Bash(npx urn-forge *) Bash(npx cucumber-js *)`** | The loop runs these commands many times. A permission prompt for each run stops the agent. They write only the generated files. The grant lasts for the turn only |
| 4 | When the skill goes stale | **The skill holds the procedure only. Each fact is in the package's reference, which updates with the package. `init` keeps a `SKILL.md` that exists, as it does `AGENTS.md`** | The procedure changes rarely. The facts change with each version |
| 5 | Tests | **A test parses the frontmatter. It checks that `name` is the folder name and that the description fits in 1,536 characters. It checks that each command and option in the skill is in the usage of the CLI, each code is in `CODES`, and each path is a file of the package or the starter. Another test checks that `init` writes the skill** | The skill cannot name a command, an option or a code that does not exist |
| 6 | Docs | **A section in "Work with a coding agent": what the skill does, how to get it in an existing project, and how it differs from `AGENTS.md`** | |

## Scope

- **In scope:** decisions 1 to 6.
- **Out of scope:**
  - a plugin, a marketplace, an MCP server, or hooks;
  - skills for other agents;
  - a benchmark of the skill with evals (a later plan, if the skill changes often).

## The target, written first

Step 0 adds tests that fail for the reason expected:

- `init` writes `.claude/skills/urn-forge/SKILL.md`;
- the skill's frontmatter has `name: urn-forge` and a description of at most 1,536 characters;
- each `urn-forge` command and option, each code, and each path in the skill exists;
- the package's `files` include `skills`.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | The skill in the package, `skills/urn-forge/SKILL.md` | The frontmatter and consistency tests pass |
| 2 | `init` writes it, and keeps one that exists | The init test and the starter test pass; the tarball test installs it |
| 3 | The docs | The how-to has the section; the docs build |

## Sabotages at the end

Each must turn CI red:

1. Name an option in the skill that the CLI does not have → the consistency test.
2. Name a code that `CODES` does not have → the consistency test.
3. Remove `skills` from the package's `files` → the tarball test.

## Risks

- **A description that does not trigger.** Claude loads the skill from its description. The description names the files and the failures that start the work. If it does not trigger, the user types `/urn-forge`. A later plan can measure this with evals.
- **Two sources of the loop.** `AGENTS.md` and the skill both describe the loop. `AGENTS.md` keeps five lines; the skill adds the order, the code table and when to stop. The consistency test keeps the skill's names right.

## What was built

Each step is one commit, and each commit is green.

- **Step 1.** `skills/urn-forge/SKILL.md`, with the five parts of the plan. Its table assigns each of the 41 codes to the place to change. The consistency test checks two directions: each code that the skill names is in `CODES`, and each code in `CODES` is in the skill. A new code therefore needs a row in the skill. The second direction was not in the plan. Each path is checked in a project that `init` makes and `compile` builds, so `src/generated/` and `node_modules/urn-forge/AGENTS.md` are real paths.
- **Step 2.** `init` copies the skill from the package, so there is one copy of the text. It keeps a skill that exists, and says to compare it with the package's skill. The tarball test checks that a project has the skill.
- **Step 3.** A section "Give Claude Code the skill" in "Work with a coding agent". The tutorial's `init` output, the CLI reference and the package's reference name the skill.

All three sabotages turned CI red: an option that the CLI does not have (`--fast`) and a code that `CODES` does not have failed the consistency test, and removing `skills` from `files` failed the tarball test at `init`.
