# urn-forge plan: docs about coding agents

Nov 25, 2026 · @Shadow Smith

urn-forge is built for coding agents. The docs still describe a person who writes each part by hand, and the agent gets one guide at the end of the list. This plan rewrites the docs around the way that urn-forge is used: **a person owns the contract, a coding agent writes the code, and the gates prove that the code keeps the contract.**

The docs do not change what urn-forge does. Each command, output and example stays real.

## Two readers, two places

| Reader | Where they read | What they need |
| --- | --- | --- |
| The person who directs the agent: a developer or a lead | The docs site | Why to trust the agent's work, how to set up a project, what to review, what the gates cannot prove |
| The coding agent | `AGENTS.md` of the project, the skill, `node_modules/urn-forge/AGENTS.md` | The loop, the facts, each code with its fix |

The docs site is for the person. It does not repeat the agent's files. It links to them and says what is in them.

## The story of the docs

1. **The problem.** An agent writes code that looks right and passes the tests that it wrote itself. A type cannot say a business rule. When a check fails, the easy way out for an agent is to change the check.
2. **The split.** You write the contract, one file that you can review in minutes. The agent writes the core and the scenarios. urn-forge generates the rest.
3. **The proof.** The harness checks each input and answer at run time. The gates check the code, the scenarios and the generated files in CI. Gate 5 fails a change that makes the contract weaker. None of these depend on the agent being honest.
4. **Your part.** Review the manifest diff and the scenarios. Decide each version bump. Only you can say which answer is correct.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The reader of the site | **The person who directs coding agents. Each page says what the agent does and what you do** | The agent has its own files. A page for two readers serves neither |
| 2 | The home page | **Hero: "Coding agents write the code. You own the contract." The page shows the problem, the split (you, the agent, urn-forge), and the booking example as a bug that an agent makes and the harness catches** | It states the purpose in the first line. The booking example stays: it is real and it shows the catch |
| 3 | The tutorial | **"Build a domain with a coding agent". The same shipping domain and the same real outputs. Each part says what you ask the agent, what the agent runs, and what you check. A note says that you can also do each step by hand with the same commands** | A transcript of an agent session is not repeatable, so the docs cannot quote it. The CLI outputs are repeatable. The framing changes, the evidence does not |
| 4 | A new guide | **"Review an agent's change": read the manifest diff first, then the output of `diff` and the gate 5 warnings, then the new scenarios and their expected values. Do not read the generated files. Read the core only where a scenario's value is in question** | This is the task that the person does most often, and no page covers it now |
| 5 | The guides | **Order by what you do: Set up a project for an agent (today's "Work with a coding agent"), Review an agent's change, Run the gates in CI, Change the contract, then the guides of detail: rules and refusals, scenarios, calling an operation, Postgres. Each guide of detail starts with one line on when you need it, because the agent writes these parts** | The first four guides are the person's work. The others explain what the agent writes, so that you can review it |
| 6 | The explanation | **"Why urn-forge works this way" opens with the split, then gives each decision as what it gives the person who directs an agent: one reviewable file, stable codes and fixes, gates that the agent cannot argue with, gate 5, conformance and not correctness** | The decisions are the same. The reason is now the one that matters most |
| 7 | The reference | **No change in content. Each reference page links to `node_modules/urn-forge/AGENTS.md`, the agent's reference** | Facts do not depend on who writes the code |
| 8 | Writing | **Simplified Technical English, as now. Real outputs only. Trim as we rewrite: no page gets longer than it is now, except the new guide** | The earlier trim stays |
| 9 | Names of other technologies | **The docs say what each feature does and what it gives you, not what it is built on or borrows from. They do not name JSON Schema, TypeSpec, Smithy, CEL, Standard Schema, Valibot, Kubernetes, protovalidate, semver or RFC 3339. A name stays only where you type it or see it: a command such as `npx cucumber-js`, a file such as `.feature`, or a line of real output** | The reader wants to know what urn-forge does for them. The agent's files keep the names that help an agent, such as the rule language being CEL, because an agent already knows CEL |
| 10 | `CLAUDE.md` | **Remove it. `init` writes `AGENTS.md` only, and Claude Code reads `AGENTS.md`. Remove `CLAUDE.md` from the starter, the tests, `AGENTS.md` of the package and the docs** | One file of instructions for each agent |

## Scope

- **In scope:** the home page, the tutorial, the guides, the explanation, the navigation, the site description. The README of the repository and of the package, if they describe urn-forge.
- **Out of scope:**
  - a change to the CLI, the skill or `AGENTS.md`, except the removal of `CLAUDE.md` (decision 10);
  - claims about a specific agent beyond what is tested. The docs name Claude Code for the skill, and `AGENTS.md` for the others.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | Remove `CLAUDE.md` from `init`, the starter, the tests and `AGENTS.md` of the package | The tests and the tarball test pass |
| 1 | The home page, the site description and the navigation | The docs build; each link resolves |
| 2 | The tutorial | Each output is quoted from a real run; the tarball test still runs the tutorial's end state |
| 3 | The guides, with the new guide "Review an agent's change" | Each output is real; the docs build |
| 4 | The explanation and the READMEs | The docs build |
| 5 | A review pass by an agent that reads the site as a new user who directs agents | Its findings are fixed, or listed in the PR. A search of the site finds none of the names of decision 9 outside commands, file names and real output |

## Risks

- **Overclaiming.** The gates prove conformance, not correctness. Each page that says what urn-forge proves also says what it cannot prove. The explanation keeps the table of what each check cannot show.
- **Losing the person who writes by hand.** Every command is the same for a person, and the tutorial says so.

## What was built

- **Step 0.** `CLAUDE.md` is gone from `init`, the starter, the tests, the package's `AGENTS.md` and the docs.
- **Steps 1 to 4.** The home page, the navigation ("Your work" and "The parts of a domain"), the new guide "Review an agent's change", the tutorial, the guides, the explanation, the reference pages and both READMEs. Four guides grew by about two lines, for the line that says why you read them.
- **Step 5.** A fresh agent read the site against the code and reported 28 findings. It re-ran each output, and each matched. The fixes:
  - **The tutorial was wrong for a new reader.** The starter is strict, so part 3 showed warnings where a reader gets a failure. Part 1 again makes gaps warnings, and part 4 makes them errors. The tutorial now starts a git repository.
  - **Gate 2 checks only the files that `shell` names.** Four pages said that it checks the whole application. The set-up guide now has a step, "Name the shell", and each claim names the condition.
  - **The agent can change the version.** Gate 5 then passes, with warnings. The pages no longer say that gate 5 blocks the change. They say that it makes the change visible.
  - **The gates do not see a change to their own settings**: the config, `tsconfig.json`, `cucumber.json`, `features/support/` and the CI workflow. The review guide has a new step for these files. The set-up guide tells you to protect them, and the contract, with code owners.
  - **`diff` passes all changes in 0.x.** The review guide said that it needs a new version.
  - **New sections:** a project that already exists, day-to-day work with an agent, and what agents other than Claude Code do not get from `AGENTS.md`. The CI guide now says how to install the tarball in CI.
  - **Smaller fixes:** the comment of the booking example no longer names CEL. The `usage` example is inline. The `unique` example is marked as made up. The help block is labelled as its first lines. The page titles are consistent. Some words are now in STE.
- **Not done here (out of scope: a change to the product):**
  - The fix texts of `type-cycle` and `rule-syntax`, and the package's `AGENTS.md`, still name other technologies.
  - The gate 5 fix texts use "bump" and "behaviour".
  - The starter's `AGENTS.md` does not ask for edge scenarios, or to stop before a weaker rule or a new version.
