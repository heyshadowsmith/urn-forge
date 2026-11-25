# Set up a project for an agent

A coding agent, such as Claude Code, Codex or Cursor, changes the contract, writes the code and the scenarios, and runs the checks until they pass. You review the contract and the expected values. This page tells you how to set up a project so that the agent works well, and so that it cannot make a check pass in the wrong way.

## 1. Run init

`urn-forge init` writes two files for the agent:

- **`AGENTS.md`** gives the agent the loop of the project, the files that it must not edit, and where the reference is. Claude Code, Codex, Cursor, Copilot and other agents read this file. If the project already has an `AGENTS.md`, `init` keeps it. Then add a line to it that points at `node_modules/urn-forge/AGENTS.md`.
- **`.claude/skills/urn-forge/SKILL.md`** is a skill for Claude Code. It loads when a request changes the domain, or when a check fails. You can also start it with `/urn-forge`. Commit the folder, and your team gets the skill too.

The skill tells Claude Code to:

1. Change the contract first.
2. Compile, then write the code until the types check.
3. Write a scenario for each operation, answer and rule, and a scenario at each edge of a rule.
4. Run the checks until they pass, and correct each problem at the place that its code names.
5. Stop and ask you before it removes or weakens a rule, an answer or a scenario, before it changes the `version`, and when it cannot write a rule that you asked for.

The skill lets Claude Code run `npx urn-forge` and `npx cucumber-js` with no permission prompt. These commands write only the generated files.

**For a project that already exists**, copy `node_modules/urn-forge/skills/urn-forge` to `.claude/skills/urn-forge`, and add the pointer to your `AGENTS.md`.

## 2. Turn on gate 5 in CI

An agent that cannot make a check pass can remove the check. Gate 5 stops this. It compares the rules, the answers and the scenarios with the target branch, and fails when one of them is removed or a rule accepts more, and the `version` did not change:

```
gate 5  contract      FAIL  2 change(s) make the contract weaker than HEAD, and the version 0.1.0 → 0.1.0 does not allow it
    domain.manifest.yaml:10  error  removed-rule  the rule maximum is removed from definitions.weight_grams
      fix: Put the rule back; if the contract must accept more, bump manifest.version to a new major version (in 0.x, to a new version) and say why in the change.
    features/quote_shipping.feature  error  removed-scenario  1 of the 4 scenarios "A parcel that breaks a rule is rejected at the boundary" are removed
      fix: Put the scenario back, or bump manifest.version to a new major version (in 0.x, to a new version) when the behaviour it tests is removed on purpose.
verify failed: gate 5
```

Gate 5 runs only with `--base`. [Run the gates in CI](./run-verify-in-ci) shows the workflow. When a change must make the contract weaker, the agent changes the `version`. Then gate 5 passes, and shows each change as a warning for you to decide. Refer to [Review an agent's change](./review-an-agents-change).

| Code | The change |
| --- | --- |
| `removed-rule` | A rule of a definition, an answer or an operation is not there |
| `wider-rule` | A rule accepts more: a lower `minimum`, a new `enum` choice, fewer `required` properties, or a new text of a rule |
| `removed-output` | An answer, or an operation and its answers, is not there |
| `removed-scenario` | A scenario is not there. Gate 5 knows a scenario by its name, so a renamed scenario counts as removed |

## 3. Make gaps errors

Set `coverage: 'error'` in `urn-forge.config.ts`. Then each new operation, answer or rule that the agent adds must have a scenario, or `verify` fails. The starter has this setting.

## What the agent sees

Each problem has a stable code and one sentence that tells what to do:

```
domain.manifest.yaml:75  error  rule-guard  over_express_limit: input.express can be absent: read it after has(input.express) &&, or after !has(input.express) ||
  fix: Read an optional property only after has(): has(self.x) && self.x > 0, or !has(self.x) || self.x > 0.
```

With `--format json`, `compile`, `verify` and `diff` give the same problems as one JSON object, with the `code` and the `fix` of each. The agent acts on the code, and does not have to read prose. [The CLI reference](../reference/cli#json-output) gives each key.

The reference for the agent is `node_modules/urn-forge/AGENTS.md`: each key of the manifest, each standard rule, each function of the rule language, each step, and each code with its fix, on one page. It changes with the version that you install, and the agent can read it offline.

The starter manifest starts with a line that gives editors the schema of the manifest:

```yaml
# yaml-language-server: $schema=./node_modules/urn-forge/manifest.schema.json
```

An editor then checks and completes each key, and an agent can check a manifest before it compiles.
