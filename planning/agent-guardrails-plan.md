# urn-forge plan: the same guardrails for each agent

Nov 25, 2026 · @Shadow Smith

The review of the docs found three gaps in the product. This plan closes them, and the same PR builds it.

## Decisions

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| 1 | The starter's `AGENTS.md` | **Add the two parts that only the skill had: write a scenario at each edge of each rule, and stop and ask a person before a weaker rule, a new `version`, or a rule that the contract cannot state** | Codex, Cursor and Copilot read `AGENTS.md`, not the skill. They get the same guardrails as Claude Code |
| 2 | The fix of each code of gate 5 | **"Put it back. If the change is on purpose, ask a person: only a person decides a new `manifest.version`." No "bump", no "behaviour"** | The old fixes told the agent to change the version. That is the decision that the skill and `AGENTS.md` keep for a person. A fix must not tell the agent to do what the instructions forbid |
| 3 | `type-cycle` and `rule-syntax` | **Say "a base type" and "the rule language of urn-forge", not "JSON Schema" and "the CEL subset"** | These texts are real output, which the docs quote |
| 4 | The package's `AGENTS.md` | **Keep the names that help an agent act: the rule language is a subset of CEL, `<Name>Schema` is a Valibot schema, and the version is semver. Change only the line that says "version bump"** | An agent already knows CEL and Valibot, and writes better rules and calls with that knowledge. The docs site, for people, names none of them |

## Build

One commit:

- the fixes in `src/codes.ts`, the codes table of the package's `AGENTS.md`, and the starter's `AGENTS.md`;
- the outputs that the docs quote;
- the line of the set-up guide that said that other agents do not get these parts.

The tests already keep the fixes and the reference the same. A new test checks that the starter's `AGENTS.md` asks for the edges and says when to stop. Another test checks that no fix tells the agent to change the version.
