# Why urn-forge works this way

urn-forge splits the work on a domain in two. You own the contract: the rules of the domain. A coding agent writes the code and the tests. urn-forge proves that the code keeps the contract. Each decision on this page serves that split. Each decision also has a cost, which this page gives.

## One short file for the contract

The contract says what the domain promises to all code outside it: the values that it accepts, its operations, the answers of each operation, and when each answer is permitted. The code selects which permitted answer to give to one request.

**What it gives you:** you review one file, not the code. A change to a rule is a change to that file, in a diff that you can read in minutes. The agent cannot change what the domain promises without a change that you see.

**The cost:** some rules are long to write as a rule. The contract also cannot say everything yet (see the end of this page).

## A harness, not a framework

urn-forge generates one file, and it does not run your application. The core is one plain function for each operation, with no database, no network and no clock. The shell does all other work: it loads the stored record, the caller and the time into the input, calls the harness, and stores or sends the result.

**What it gives you:** the harness checks each input before the code runs, and each answer after it. An agent's bug in the code becomes a `ContractViolation` that names the rule, not a wrong value in your database. A scenario only gives an input and reads the answer, so the agent's tests are short and easy to review.

**The cost:** the shell does more work. An operation that must get data in its middle becomes two operations.

## General constructs only

The manifest has no keyword for errors, states, callers, events or clocks. Each of these is made with values, objects and rules:

| An idea | Built as |
| --- | --- |
| An error | An answer of the operation |
| A state and its changes | The stored record in the input, and rules of each answer |
| Who can call | A caller object in the input, and rules |
| The time | A time string in the input |
| An event | A property of an answer |

**What it gives you:** each promise is a rule with a name and a message. The harness checks it on each call, a scenario can break it, and gate 5 and `diff` see when it changes. The agent learns a small set of constructs, and cannot hide a promise in a construct that the checks do not see.

**The cost:** a manifest becomes longer.

## Each rule has a name

The common checks, such as `minimum` and `maxLength`, are rules like your own rules, with a name, a text and a message. Your own rules use a small expression language with no loops and no side effects.

**What it gives you:** a failure tells which rule broke. A gap in the scenarios names the rule that has no test. Gate 5 can tell that a rule is gone or accepts more. The same rule becomes a check in the code and, where possible, a constraint in the database.

## Gates that an agent cannot avoid

The checks of urn-forge do not depend on the agent being careful. Each one fails in CI, with a code and one sentence that says what to do. They have two limits: they do not see a change to their own settings, and the agent can change the version. [Set up a project for an agent](../how-to/work-with-a-coding-agent#_4-protect-the-contract-and-the-settings) tells you how to protect both.

| An agent's shortcut | What stops it |
| --- | --- |
| Return a wrong answer | The harness, at run time and in each scenario |
| Leave an operation without code | Gate 1 |
| Call the code without the harness from a shell file, or turn off a type check | Gate 2, for the files that `shell` names |
| Skip a test for a new rule or answer | Gate 3, with `coverage: 'error'` |
| Edit a generated file | Gate 4 |
| Delete a rule, an answer or a test, or make a rule accept more | Gate 5, unless the version changes; then you see a warning |

**What it gives you:** you do not need to check that the agent ran the checks. CI runs them. When a change must make the contract weaker, the agent must change the version, and you see that in the review.

## Conformance, not correctness

The gates show that the parts agree with the contract. They do not show that the contract or the logic is correct.

| Check | It shows | It cannot show |
| --- | --- | --- |
| Gate 1 | Each operation has code of the generated type | That the code calculates the correct value |
| Gate 2 | The shell calls the code only through the harness | A call from a file that gate 2 does not examine |
| Gate 3 | Each operation, answer and rule of a definition has a scenario | That the scenario expects the correct value |
| Gate 4 | The generated files are the same as the files of a new compile | That the contract is correct |
| Gate 5 | No rule, answer or scenario is gone or weaker without a new version | That a new version was the right decision |
| The harness | Each input and each answer keeps the rules | That the code selected the correct permitted answer |
| `diff` | No change breaks a caller without a new major version | A change in what a value means, for example from cents to euros |

Only a person can say which answer is correct. You say it in the contract and in the expected values of the scenarios. That is why [Review an agent's change](../how-to/review-an-agents-change) starts there.

The compiler reads no clock, no random value and no environment, so the same contract gives the same files on each machine. If `diff` cannot tell whether a change accepts more or less, it calls the change breaking. A false "breaking" costs a version number. A false "compatible" costs a broken caller.

## What the contract cannot say yet

The shell does these tasks: authentication, the load of records, the delivery of events, the removal of duplicate requests, and the map to HTTP. When the data is in the input, the contract can state rules about each of them.

The contract cannot state some rules yet: time zones and calendar months, a filter, the minimum or the maximum of a list, either-or shapes, maps with free keys, and check digits. Put these rules in the code, with a refusal as an answer, and ask the agent for scenarios at their edges.
