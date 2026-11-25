# Work with a coding agent

urn-forge is made for a coding agent, such as Claude Code, Codex or Cursor, to use. The agent changes the manifest, writes the core and the scenarios, and runs `verify` until it passes. You review the contract. This page tells you how to set up a project for an agent, and how urn-forge stops an agent that makes a check pass in the wrong way.

## Give the agent its instructions

`urn-forge init` writes `AGENTS.md`. It tells the agent the loop of the project, the files that it must not edit, and where the reference is. Claude Code, Codex, Cursor, Copilot and other agents read this file.

If the file is already there, `init` keeps it. Then add a line to your file that points at `node_modules/urn-forge/AGENTS.md`.

The reference is `node_modules/urn-forge/AGENTS.md`. It is one page with each key of the manifest, each standard rule, each function of the rule language, each step, and each code with its fix. It is the reference of the installed version, and the agent can read it offline.

## Give Claude Code the skill

`urn-forge init` also writes a Claude Code skill, `.claude/skills/urn-forge/SKILL.md`. Claude Code loads a skill from this folder with no install step. Commit the folder, and your team gets the skill too.

`AGENTS.md` is in the context of each session, so it is short. The skill loads only when the work is on the domain: when a request changes a definition, a rule, an output or an operation, or when `compile`, `verify` or `cucumber-js` fails. You can also start it with `/urn-forge`. The skill tells Claude Code to:

1. Change the contract first, in the manifest.
2. Compile, then write the core until the types check.
3. Write a scenario for each operation, output and rule, and a scenario at each edge of a rule.
4. Run `verify --format json` and `cucumber-js` until both pass, and correct each problem at the place that its code names.
5. Stop and ask you before it removes or weakens a rule, an output or a scenario, before it changes the `version`, and when a rule cannot be written in the rule language.

The skill lets Claude Code run `npx urn-forge` and `npx cucumber-js` with no permission prompt, for the turn in which the skill loads. These commands write only the generated files.

The skill holds the procedure only. For each fact, it points at `node_modules/urn-forge/AGENTS.md`, which changes with the version that you install. If your project does not have the skill, copy the folder `node_modules/urn-forge/skills/urn-forge` to `.claude/skills/urn-forge`. If you already have a skill there, `init` keeps it.

## Let the agent read the problems as JSON

Add `--format json` to `compile`, `verify` or `diff`. The command writes one JSON object to stdout, and nothing else. The exit code does not change. This is the output of `verify` when a rule has no scenario (formatted here):

```json
{
  "ok": false,
  "gates": [
    { "gate": 1, "name": "completeness", "pass": true, "summary": "tsc: 0 error(s) over src/core.ts; core satisfies DomainCore" },
    { "gate": 2, "name": "boundary", "pass": true, "summary": "1 core file(s), 0 shell file(s): 0 problem(s)" },
    { "gate": 3, "name": "gherkin", "pass": false, "summary": "1 feature(s), 14 scenario(s), 1/1 operation(s) run, 6 rule(s) broken" },
    { "gate": 4, "name": "drift", "pass": true, "summary": "1 generated file(s) compared byte for byte against src/generated" }
  ],
  "warnings": 0,
  "problems": [
    {
      "code": "uncovered-rule",
      "severity": "error",
      "file": "features",
      "line": null,
      "path": null,
      "message": "no scenario breaks required of too_heavy_for_express; add one that ends with Then the input is rejected by \"required\" of \"too_heavy_for_express\", or Then the value is rejected by …",
      "fix": "Add a scenario that breaks the rule and ends with Then the input is rejected by \"<rule>\" of \"<definition>\", or Then the value is rejected by \"<rule>\" of \"<definition>\"."
    }
  ]
}
```

Each problem has a `code` that does not change between versions, and a `fix` that tells what to do. The text output shows the same fix on the line below the problem.

## Let an editor check the manifest

The starter manifest starts with this line:

```yaml
# yaml-language-server: $schema=./node_modules/urn-forge/manifest.schema.json
```

An editor with the YAML language server then checks each key of the manifest and completes it. An agent can also check a manifest with `manifest.schema.json` before it runs `compile`. `compile` checks more than the schema: the names between the parts, the rules and their arguments.

## Stop a contract that gets weaker

An agent that cannot make a check pass can remove the check. In urn-forge, the checks are the rules, the outputs and the scenarios. Gate 5 compares them with a git ref, such as the target branch of a pull request:

```bash
npx urn-forge verify --base origin/main
```

This is the output when a change removes the rule `maximum` and the row of the scenario that breaks it:

```
gate 5  contract      FAIL  2 change(s) make the contract weaker than HEAD, and the version 0.1.0 → 0.1.0 does not allow it
    domain.manifest.yaml:10  error  removed-rule  the rule maximum is removed from definitions.weight_grams
      fix: Put the rule back; if the contract must accept more, bump manifest.version to a new major version (in 0.x, to a new version) and say why in the change.
    features/quote_shipping.feature  error  removed-scenario  1 of the 4 scenarios "A parcel that breaks a rule is rejected at the boundary" are removed
      fix: Put the scenario back, or bump manifest.version to a new major version (in 0.x, to a new version) when the behaviour it tests is removed on purpose.
verify failed: gate 5
```

Gate 5 fails when one of these is true, and the `version` of the manifest does not allow it:

| Code | The change |
| --- | --- |
| `removed-rule` | A rule of a definition, an output or an operation is not there |
| `wider-rule` | A rule accepts more, or other values: a lower `minimum`, a new `enum` choice, fewer `required` properties, or a new text of a rule |
| `removed-output` | An output, or an operation and its outputs, is not there |
| `removed-scenario` | A scenario is not there. Gate 5 knows a scenario by its name, so a renamed scenario counts as removed. Each row of an outline counts |

If the contract must become weaker, change the `version`: to a new major version, to a pre-release, or (in `0.x`) to a different version. Then gate 5 passes, and shows each change as a warning. A person sees the new version in the review and decides.

Without `--base`, gate 5 does not run. In CI, give the target branch. Refer to [Run verify in CI](./run-verify-in-ci).
