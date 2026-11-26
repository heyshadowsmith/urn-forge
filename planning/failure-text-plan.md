# urn-forge plan: `message` becomes `failure`

Nov 27, 2026 · @Shadow Smith

A rule has two texts: `description` and `message`. The name `message` does not say when the text is shown. This plan renames it `failure`, and gives each text one job.

```yaml
was_confirmed:
  description: Only a confirmed booking can be seated   # what the rule checks, and why
  rule: input.stored_booking.state == 'confirmed'
  failure: The booking was not confirmed                 # what a failure says when the rule breaks
```

```json
{ "definition": "seat_booking", "rule": "was_confirmed", "path": "", "failure": "The booking was not confirmed" }
```

A `success` text, and a list of the rules that allowed an answer, are not in this plan. They can come later, if something needs to show them.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The key | **`message` becomes `failure`. A rule with `message` fails with `manifest-shape`, and the message says to rename it `failure`** | The name says when the text is shown |
| 2 | `description` | **Required, as now. The docs say that it describes what the rule checks and why, for a reader. It is not a second wording of the failure** | Each text has one job: `description` for the reader of the manifest, `failure` for the reader of a result |
| 3 | A failure in a result | **`{ definition, rule, path, failure }`: the field is `failure`, not `message`** | The field has the name of the text that fills it |
| 4 | The code `invalid-message` | **No change: it stays `invalid-message`** | A code is stable, so a tool or an agent that acts on it does not break. It names the kind of problem, a text with a wrong `{parameter}`, not the key |
| 5 | `diff` and gate 5 | **No change: a change to `failure` or `description` is not a change to what the rule accepts** | As for `message` now |
| 6 | The repository | **Each rule of the standard set, the domains, the contracts, the fixtures, the tutorial snapshots and the starter: `message` becomes `failure`. A `description` that only repeats the failure gets a text that says what the rule checks and why** | The rename is mechanical. Only 2 of the 461 rules have the same text in the two keys |

## Scope

- **In scope:** decisions 1 to 6; the generated code, the runtime and the steps that read a failure; the schema of the manifest; both `AGENTS.md` files, the skill and the reference pages of the docs.
- **Out of scope:** a `success` text; a list of the rules that allowed an answer.

## The target, written first

Step 0 adds tests that fail for the reason expected:

- a failure of `runOperation` and of `check` has `failure`, not `message`;
- a rule with `failure` compiles, with `{param}` filled;
- a rule with `message` fails with `manifest-shape`, and the message names `failure`;
- `{x}` in a `failure` with no parameter `x` fails with `invalid-message`.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `failure` in the manifest, the model, the generated code, the runtime and the steps; each manifest of the repository | Each domain, contract, fixture and snapshot compiles, verifies and passes its scenarios; each generated file is current |
| 2 | The schema of the manifest, both `AGENTS.md` files, the skill and the reference pages | The docs build; the reference test passes |

## Sabotages at the end

Each must turn CI red:

1. Write `message` in a rule → `manifest-shape`.
2. Give a failure in the generated code the field `message` → the target test.

## Risks

- **A breaking change to each manifest and to the shape of a failure.** urn-forge is 0.x. The error for `message` says what to write.
