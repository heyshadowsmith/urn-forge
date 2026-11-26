# urn-forge plan: `message` becomes `explanation`

Nov 27, 2026 · @Shadow Smith

A rule has two texts: `description` and `message`. The name `message` does not say when the text is shown. This plan renames it `explanation`, and gives each text one job. `failure` was the first choice, but a result already has `failures`, a list of `Failure` objects, so a failure would hold a `failure`. `explanation` is used nowhere else in urn-forge.

```yaml
was_confirmed:
  description: Only a confirmed booking can be seated   # what the rule checks, and why
  rule: input.stored_booking.state == 'confirmed'
  explanation: The booking was not confirmed             # what a failure says when the rule breaks
```

```json
{ "definition": "seat_booking", "rule": "was_confirmed", "path": "", "explanation": "The booking was not confirmed" }
```

A `success` text, and a list of the rules that allowed an answer, are not in this plan. They can come later, if something needs to show them.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The key | **`message` becomes `explanation`. A rule with `message` fails with `manifest-shape`, and the message says to rename it `explanation`** | The name says what the text is: why the rule broke. `description` explains the rule to a reader of the manifest, and `explanation` explains a failure to a reader of a result |
| 2 | `description` | **Required, as now. The docs say that it describes what the rule checks and why, for a reader. It is not a second wording of the failure** | Each text has one job: `description` for the reader of the manifest, `explanation` for the reader of a result |
| 3 | A failure in a result | **`{ definition, rule, path, explanation }`: the field is `explanation`, not `message`** | The field has the name of the key that fills it |
| 4 | The code `invalid-message` | **No change: it stays `invalid-message`** | A code is stable, so a tool or an agent that acts on it does not break. It names the kind of problem, a text with a wrong `{parameter}`, not the key |
| 5 | `diff` and gate 5 | **No change: a change to `explanation` or `description` is not a change to what the rule accepts** | As for `message` now |
| 6 | The repository | **Each rule of the standard set, the domains, the contracts, the fixtures, the tutorial snapshots and the starter: `message` becomes `explanation`. A `description` that only repeats the explanation gets a text that says what the rule checks and why** | The rename is mechanical. Only 2 of the 461 rules have the same text in the two keys |

## Scope

- **In scope:** decisions 1 to 6; the generated code, the runtime and the steps that read a failure; the schema of the manifest; both `AGENTS.md` files, the skill and the reference pages of the docs.
- **Out of scope:** a `success` text; a list of the rules that allowed an answer.

## The target, written first

Step 0 adds tests that fail for the reason expected:

- a failure of `runOperation` and of `check` has `explanation`, not `message`;
- a rule with `explanation` compiles, with `{param}` filled;
- a rule with `message` fails with `manifest-shape`, and the message names `explanation`;
- `{x}` in an `explanation` with no parameter `x` fails with `invalid-message`.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `explanation` in the manifest, the model, the generated code, the runtime and the steps; each manifest of the repository | Each domain, contract, fixture and snapshot compiles, verifies and passes its scenarios; each generated file is current |
| 2 | The schema of the manifest, both `AGENTS.md` files, the skill and the reference pages | The docs build; the reference test passes |

## Sabotages at the end

Each must turn CI red:

1. Write `message` in a rule → `manifest-shape`.
2. Give a failure in the generated code the field `message` → the target test.

## Risks

- **A breaking change to each manifest and to the shape of a failure.** urn-forge is 0.x. The error for `message` says what to write.
