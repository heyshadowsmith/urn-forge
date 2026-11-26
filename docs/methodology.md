# The methodology

urn-forge splits the work on a domain in two. You own the contract: the rules of the domain. A coding agent writes the code and the tests. urn-forge proves that the code keeps the contract. This page tells you how each part works, what each part gives you, and what it cannot prove.

## The split

| Who | Does what |
| --- | --- |
| You | Review the contract. Decide each new version. Say in the scenarios which answer is correct |
| The coding agent | Writes the contract from your request, then the code and the scenarios. Runs the checks until they pass |
| urn-forge | Generates the types and the harness from the contract. Fails CI when the code, the scenarios or a change do not agree with it |

The agent reads its instructions from `AGENTS.md`, which `urn-forge init` writes. Claude Code also gets a skill that runs the loop below. Each problem that urn-forge finds has a stable code and one sentence that says what to do, as text or as JSON. The agent acts on the code, and does not have to guess.

## The loop

1. **The contract first.** The agent puts your request into `domain.manifest.yaml`: a value and its limits, a rule, a new answer, a new operation.
2. **Compile.** `urn-forge compile` writes the types. The agent writes the code until the types check.
3. **Scenarios.** The agent writes a scenario for each operation, each answer and each rule, and a scenario at each edge of each rule.
4. **Verify.** The agent runs `urn-forge verify` and the scenarios until both pass.
5. **Stop and ask.** The agent asks you before it removes or weakens a rule, an answer or a scenario, before it changes the version, and when the contract cannot state a rule that you asked for.

## The contract

The contract is one YAML file. It says what the domain promises to all code outside it: the values that it accepts, its operations, the answers of each operation, and when each answer is permitted. The code selects which permitted answer to give to one request.

**What it gives you:** you review one short file, not the code. A change to what the domain promises is a change to that file, in a diff that you can read in minutes.

The contract has only general constructs: values, objects, lists, operations and rules. It has no keyword for errors, states, callers, events or clocks. Each of these is built from the general constructs:

| An idea | Built as |
| --- | --- |
| An error | An answer of the operation |
| A state and its changes | The stored record in the input, and rules of each answer |
| Who can call | A caller object in the input, and rules |
| The time | A time string in the input |
| An event | A property of an answer |

**What it gives you:** each promise is a rule with a name and a message. The harness checks it on each call, a scenario can break it, and gate 5 and `diff` see when it changes. The agent has a small set of constructs to learn, and it cannot hide a promise in a construct that the checks do not see.

Each part has a URN, such as `urn:acme:bookings:definition:party_size`. Failures, `diff` and the output of the gates use it, so a part is never confused with a part of another domain. A repository can hold several domains, and one config lists them.

## The harness

urn-forge generates one file, and it does not run your application. The **core** is one plain function for each operation, with no database, no network and no clock. The **shell** does all other work. It loads the stored record, the caller and the time into the input, calls the harness, and stores or sends the result.

The harness, `runOperation`, checks each input before the code runs, and each answer after it. It gives one of three results:

| Result | Means |
| --- | --- |
| The answer | The input and the answer keep the contract. A refusal is an answer too |
| `InputRejected` | The caller sent an input that breaks a rule. The code did not run |
| `ContractViolation` | The code gave an answer that the contract does not permit. This is a bug in the code |

**What it gives you:** an agent's bug becomes a `ContractViolation` that names the rule, not a wrong value in your database. A scenario only gives an input and reads the answer, so the agent's scenarios are short and easy to review.

## The gates

`urn-forge verify` runs five gates in CI. They do not depend on the agent being careful.

| An agent's shortcut | What stops it |
| --- | --- |
| Return a wrong answer | The harness, at run time and in each scenario |
| Leave an operation without code | Gate 1, completeness |
| Call the code without the harness from a shell file, or turn off a type check | Gate 2, boundary, for the files that the config lists as the shell |
| Skip a scenario for a new operation, answer or rule | Gate 3, scenarios. A gap is always an error |
| Edit a generated file | Gate 4, drift |
| Delete a rule, an answer or a scenario, or make a rule accept more | Gate 5, contract, with `--base` in CI, unless the version changes |

`urn-forge diff` also fails a change that can break a caller, unless the major version increases.

## What it cannot prove

The gates prove that the parts agree with the contract. They do not prove that the contract or the logic is correct.

| Check | It proves | It cannot prove |
| --- | --- | --- |
| Gate 1 | Each operation has code of the generated type | That the code calculates the correct value |
| Gate 2 | The shell calls the code only through the harness | A call from a file that the config does not list |
| Gate 3 | Each operation, answer and rule has a scenario | That the scenario expects the correct value |
| Gate 4 | The generated files are current | That the contract is correct |
| Gate 5 | No rule, answer or scenario is gone or weaker without a new version | That the new version was the right decision |
| The harness | Each input and each answer keeps the rules | That the code chose the correct permitted answer |
| `diff` | No change breaks a caller without a new major version | A change in what a value means, for example from cents to euros |

The gates have two more limits:

- **They do not see a change to their own settings**: `urn-forge.config.ts`, `tsconfig.json`, `cucumber.json`, `features/support/` and the CI workflow.
- **The agent can change the version.** Then gate 5 passes, and shows each weaker change as a warning. It makes the change visible. It does not stop it.

So make a change to `domain.manifest.yaml` and to these settings need your approval, for example with `CODEOWNERS` and branch protection. List the shell in the config, so that gate 2 checks it. Run `verify --base` with the target branch in CI, so that gate 5 runs.

## Your review

urn-forge has checked that the code keeps the contract. Your review is about the contract and the expected values. Read in this order:

1. **The change to the manifest.** Is each new rule, answer and operation what you asked for? Does each rule say the right thing? `weight_grams >= 5000` where you meant `weight_grams > 5000` is a real bug, and no gate can find it.
2. **Each change to the settings of the checks.** Ask why the agent made it.
3. **The warnings of gate 5 and the output of `diff`.** Each one is a decision for you. A new version is the agent's claim that a weaker contract is on purpose.
4. **The expected values of the new scenarios.** Only you know that a parcel of 800 grams costs 600 cents. Check that each rule has scenarios at its edges.

You do not need to read the generated files, the types of the code, or each rule in the code. The gates and the harness check them. Read the code of an operation only where you are not certain of an expected value, or where the code chooses between answers that are all permitted.

## What the contract cannot state yet

The contract cannot state some rules yet: time zones and calendar months, a filter, the minimum or the maximum of a list, a count of the items that match a condition, either-or shapes, maps with free keys, and check digits. Put these rules in the code, with a refusal as an answer, and ask the agent for scenarios at their edges.

## The reference

- [The manifest](/reference/manifest): each key, and the standard rules.
- [The rule syntax](/reference/syntax): the language of the rules.
- [The CLI and the config](/reference/cli): each command, option, gate and code.

Your agent reads the same facts on one page, in `node_modules/urn-forge/AGENTS.md`.
