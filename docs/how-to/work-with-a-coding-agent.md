# Set up a project for an agent

A coding agent, such as Claude Code, Codex or Cursor, changes the contract. It writes the code and the scenarios, and it runs the checks until they pass. You review the contract and the expected values. This page tells you how to set up a project so that the agent works well. It also tells you how to stop the agent when it makes a check pass in the wrong way.

## 1. Run init

`urn-forge init` writes two files for the agent:

- **`AGENTS.md`** gives the agent the loop of the project, the files that it must not edit, and where the reference is. Claude Code, Codex, Cursor, Copilot and other agents read this file.
- **`.claude/skills/urn-forge/SKILL.md`** is a skill for Claude Code. It loads when a request changes the domain, or when a check fails. You can also start it with `/urn-forge`. Commit the folder, and your team gets the skill too.

The skill tells Claude Code to:

1. Change the contract first.
2. Compile, then write the code until the types check.
3. Write a scenario for each operation, answer and rule.
4. Write a scenario at each edge of a rule.
5. Run the checks until they pass. Correct each problem at the place that its code names.
6. Stop and ask you before it removes or weakens a rule, an answer or a scenario.
7. Stop and ask you before it changes the `version`.
8. Stop and ask you when it cannot write a rule that you asked for.

The skill lets Claude Code run `npx urn-forge` and `npx cucumber-js` with no permission prompt. These commands write only the starter files (`init`) and the generated files.

Other agents get `AGENTS.md`, but not the skill. `AGENTS.md` gives them the same rules: the edges (item 4), and when to stop and ask (items 6 to 8). The skill adds the order of the work and a table of the codes.

## 2. Name the shell

The shell is the code that calls an operation: an HTTP handler, a queue consumer or a CLI. Gate 2 checks only the files that the config names. Add them to `urn-forge.config.ts`:

```ts
export default defineConfig({
  coverage: 'error',
  shell: ['src/shell'],
});
```

Then gate 2 fails when a shell file calls the code without the harness. Without `shell`, gate 2 checks only the core.

## 3. Turn on gate 5 in CI

An agent that cannot make a check pass can remove the check. Gate 5 finds this. It compares the rules, the answers and the scenarios with the target branch. It fails when one of them is removed, or when a rule accepts more, and the `version` does not allow it:

```
gate 5  contract      FAIL  2 change(s) make the contract weaker than HEAD, and the version 0.1.0 → 0.1.0 does not allow it
    domain.manifest.yaml:10  error  removed-rule  the rule maximum is removed from definitions.weight_grams
      fix: Put the rule back. If the change is on purpose, stop and ask a person: only a person decides a new manifest.version.
    features/quote_shipping.feature  error  removed-scenario  1 of the 4 scenarios "A parcel that breaks a rule is rejected at the boundary" are removed
      fix: Put the scenario back. If the change is on purpose, stop and ask a person: only a person decides a new manifest.version.
verify failed: gate 5
```

| Code | The change |
| --- | --- |
| `removed-rule` | A rule of a definition, an answer or an operation is not there |
| `wider-rule` | A rule accepts more: a lower `minimum`, a new `enum` choice, fewer `required` properties, or a new text of a rule |
| `removed-output` | An answer, or an operation and its answers, is not there |
| `removed-scenario` | A scenario is not there. Gate 5 knows a scenario by its name, so a renamed scenario counts as removed |

The version allows a weaker contract when it changes to a new major version, to a pre-release, or to any other `0.x` version. Then gate 5 passes, and shows each change as a warning. **The agent can change the version too.** Gate 5 does not stop the change. It makes the change visible. [Review an agent's change](./review-an-agents-change) tells you what to read.

Gate 5 runs only with `--base`. [Run the gates in CI](./run-verify-in-ci) shows the workflow.

## 4. Protect the contract and the settings

The gates cannot see a change to their own settings. Make a change to these files need your approval: `domain.manifest.yaml`, `urn-forge.config.ts`, `tsconfig.json`, `cucumber.json`, `features/support/` and the CI workflow. On GitHub, list them in `CODEOWNERS`, and turn on branch protection.

## A project that already exists

`init` writes nothing when one of its files is already there, and most projects have a `tsconfig.json`. Run `init` in an empty folder, and copy these parts into your project:

| From the starter | In your project |
| --- | --- |
| `domain.manifest.yaml`, `urn-forge.config.ts`, `cucumber.json`, `register-tsx.mjs`, `features/support/steps.ts`, `src/core.ts` | Copy them |
| `.claude/skills/urn-forge/` | Copy the folder |
| `AGENTS.md` | Copy it, or add its text to your `AGENTS.md` |
| `package.json` | Add `"type": "module"`, and the scripts `compile`, `verify` and `test:features` |
| `tsconfig.json` | Add `features` to `include` |

## Day to day

- **Ask for a result, not for code.** "Refuse an express parcel over 5000 grams, and say its weight" is better than "add an if statement".
- **When the agent stops and asks**, it has found a decision that is yours: a weaker rule, a new version, or a rule that the contract cannot state. Answer with the decision and the reason. Do not answer only "do it".
- **For more than one domain**, give each domain its own manifest and config, and run each command with `--config <file>`.

## What the agent sees

Each problem has a stable code and one sentence that tells what to do:

```
domain.manifest.yaml:75  error  rule-guard  over_express_limit: input.express can be absent: read it after has(input.express) &&, or after !has(input.express) ||
  fix: Read an optional property only after has(): has(self.x) && self.x > 0, or !has(self.x) || self.x > 0.
```

With `--format json`, `compile`, `verify` and `diff` give the same problems as one JSON object. Each problem has its `code` and its `fix`, so the agent does not have to read prose. [The CLI reference](../reference/cli#json-output) gives each key.

The agent's reference is `node_modules/urn-forge/AGENTS.md`. It has each key of the manifest, each standard rule, each function of the rule language, each step, and each code with its fix. It changes with the version that you install. The agent can read it offline.

The starter manifest starts with a line that gives editors the schema of the manifest:

```yaml
# yaml-language-server: $schema=./node_modules/urn-forge/manifest.schema.json
```

An editor then checks and completes each key. An agent can check a manifest with it before it compiles.
