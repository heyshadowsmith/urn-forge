---
name: urn-forge
description: Change or fix an urn-forge domain, whose contract is domain.manifest.yaml, with its core, its Gherkin scenarios and its generated files. Use when a request adds or changes a definition, a rule, an output or an operation of the domain, or when urn-forge compile, urn-forge verify or cucumber-js fails.
allowed-tools: Bash(npx urn-forge *) Bash(npx cucumber-js *)
---

# Change an urn-forge domain

The contract of this project is `domain.manifest.yaml`, or one manifest for each domain that `domains` of `urn-forge.config.ts` lists. urn-forge generates types, schemas and a harness from it, and its gates check the core and the scenarios against it. Work in this order: the contract, the core, the scenarios, then the checks. For a fact (a key of the manifest, a standard rule, a function of the rule language, a step), read `node_modules/urn-forge/AGENTS.md`.

## 1. Change the contract first

Put the request into the manifest before you write code:

- A value and its limits: a definition, with rules such as `- minimum: 1`.
- A condition that must be true of a value, an answer or an operation: a rule. Write its text once under `rules:`, and apply it by name.
- A new answer, also a refusal: an output of the operation, with the rules that are true when the core gives it. Make sure that the rules of the outputs exclude each other.
- A stored record, the caller or the time: a property of the input. An event: a property of an output.

The manifest says what must be true. It does not hold business logic: the core decides.

## 2. Compile, and let the types lead

Run `npx urn-forge compile --format json`. If `ok` is `false`, correct each problem in the manifest (see the table below) and compile again. Then change `src/core.ts` until the types check: one function for each operation, which returns `answer('<output>', value)`. Keep `satisfies DomainCore`. Do not edit `src/generated/`.

## 3. Write the scenarios

In `features/`, make sure that:

- a scenario runs each operation: `When I run "<operation>" with:`;
- a scenario ends with each output: `Then the output is "<output>":`;
- a scenario breaks each rule of a definition: `Then the input is rejected by "<rule>" of "<definition>"`. For a rule that no input reaches, such as a rule of an output, use `When I check a "<definition>" with:` and `Then the value is rejected by "<rule>" of "<definition>"`.

Then add a scenario at each edge of each rule: the last value that the rule accepts, and the first value that it rejects. Gate 3 does not ask for these, but the core is most often wrong there.

## 4. Verify until both pass

Run `npx urn-forge verify --format json`, then `npx cucumber-js`. Correct the first problem first, because a correction often clears the next problems. Each problem has a `code` and a `fix`. Do what the fix says, at the place that this table names:

| Change | Codes |
| --- | --- |
| The manifest | `yaml-syntax`, `manifest-shape`, `unknown-definition`, `type-cycle`, `duplicate-property`, `unknown-property`, `not-an-object`, `duplicate-output`, `invalid-identifier`, `deprecated-use`, `standard-name`, `unknown-rule`, `rule-argument`, `rule-syntax`, `rule-type`, `rule-guard`, `rule-scope`, `invalid-message` |
| The config, `urn-forge.config.ts`, or the command | `usage`, `config-unreadable`, `config-invalid`, `manifest-unreadable`, `tsconfig-unreadable`, `missing-input` |
| The path or the permissions that the message names | `io-error` |
| The core | `core-not-found`, `core-not-satisfying`, `type-error` |
| The shell: call the core through `runOperation(core, operation, input)` | `direct-call`, `suppressed-check` |
| The scenarios | `feature-syntax`, `unknown-name`, `uncovered-operation`, `uncovered-output`, `uncovered-variant`, `uncovered-rule` |
| Nothing by hand: run `npx urn-forge compile` | `drift` |
| Nothing: stop and ask (step 5) | `removed-rule`, `wider-rule`, `removed-output`, `removed-scenario` |
| Nothing: stop, and tell the person that urn-forge has a bug (exit 3) | `internal-error`, `internal-contract` |
| Fetch the base branch, then run again | `base-unreadable` |

A `type-error` in `src/generated/` comes from a file that is not current: run `npx urn-forge compile` first.

When a scenario fails in `cucumber-js`:

- `ContractViolation: <rule> of <definition>`: the core gave an answer that breaks a rule of the contract. Correct the core.
- `InputRejected` where the scenario expects an answer: the input of the scenario breaks a rule. Correct the table of the scenario, if the request does not change the rule.
- A wrong value, such as `quote.price_cents is 601, not 600`: decide from the request which one is right. Change the expected value only when the request changes what the code must do.

## 5. Stop and ask a person

Do not continue on your own when:

- the only way to make a check pass is to remove or weaken a rule, an output or a scenario. Gate 5 (`npx urn-forge verify --base <ref>`) fails such a change, and a person decides it;
- the change needs a new `version` in the manifest, because `npx urn-forge diff` or gate 5 says so. A new version tells callers that the contract changed;
- a rule of the request cannot be written in the rule language of urn-forge. Say which part, and propose a rule that can be written, or a check in the core.

Say what you found, what you propose, and what a person must decide.

## Done

The work is done when `npx urn-forge verify` passes with no warning that the change added, `npx cucumber-js` passes, and each new rule, output and operation has a scenario.
