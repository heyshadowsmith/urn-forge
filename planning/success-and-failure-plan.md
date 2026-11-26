# urn-forge plan: the success and the failure of a rule

Nov 27, 2026 · @Shadow Smith

A rule has two texts today: `description` and `message`. The name `message` does not say when it is shown. In 459 of the 461 rules of the repository, the two texts say the same thing in different words: once as a statement, once as a failure.

This plan gives each text one job, and makes the result of a passing call say why its answer was allowed.

```yaml
was_confirmed:
  rule: input.stored_booking.state == 'confirmed'
  success: The booking was confirmed       # what is true when the rule holds
  failure: The booking was not confirmed   # what is wrong when it breaks
  description: Only a confirmed booking can be seated, so that a cancelled table is not given away   # optional: why the rule exists
```

```json
{
  "ok": true,
  "domain": "urn:demo:booking",
  "operation": "seat_booking",
  "output": "booking",
  "value": { "…": "…" },
  "kept": [
    { "definition": "seat_booking", "rule": "was_confirmed", "path": "", "success": "The booking was confirmed" },
    { "definition": "seat_booking", "rule": "is_seated", "path": "", "success": "The booking is now seated" },
    { "definition": "seat_booking", "rule": "keeps_the_party", "path": "", "success": "Seating changed only the state" }
  ]
}
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The texts of a rule | **`success` and `failure` are required. `{param}` works in both. `description` becomes optional, for why the rule exists. `message` is gone: a manifest with it fails with `manifest-shape`, and the message says to rename it `failure`** | Each text has one job. `success` and `failure` say what the rule states, so a `description` that repeats them is not needed. Write one only when the reason is not obvious |
| 2 | Which rules `kept` lists | **The rules of the answer: the rules of the output that came back, then the rules of the operation, in the order of the manifest. Not the rules of the definitions in the input or the answer** | These rules say why this answer was allowed. The rules of the definitions say that the values are well formed: `minimum` of `party_size` holds for each valid input, so listing it says nothing. A booking with dishes would list each rule of each dish |
| 3 | Always, or on request | **Always. `kept` is on each `ok: true` result of `runOperation`** | No option to learn. An operation has few rules of its answer, so the cost is small |
| 4 | `check` | **No change. A passing `check` gives the value, with no `kept`** | `check` tests a value, not an answer. Its rules are the rules of a definition (decision 2) |
| 5 | The shape of a failure | **`{ definition, rule, path, failure }`, the same as `kept` with `failure` in place of `success`. `message` is gone from the result** | The field has the name of the text that fills it. The two lists read alike |
| 6 | The standard rules | **Each standard rule gets a `success`, such as `Is at least {bound}`, and its `message` becomes its `failure`** | They are rules like all other rules |
| 7 | The scenarios | **No new step. A scenario still ends with the answer or with the rule that broke** | A step for `kept` is a later choice, if scenarios need to state which rules allowed an answer |
| 8 | `diff` and gate 5 | **No change: a change to `success`, `failure` or `description` is not a change to what the rule accepts** | As for `message` now |
| 9 | The texts of the repository | **Each rule of the domains, the contracts, the fixtures, the tutorial snapshots and the starter gets a `success`. Its `message` becomes its `failure`. A `description` that only repeats `success` is removed** | About 460 rules. Most `description`s already state the rule, so most become the `success`, and a few become a real `description` |

## Scope

- **In scope:** decisions 1 to 9; the generated code, the runtime and the Gherkin steps that read a failure; the schema of the manifest; both `AGENTS.md` files, the skill, the starter, and the reference pages of the docs.
- **Out of scope:**
  - a step for `kept`;
  - `kept` on `check`;
  - a setting to turn `kept` off.

## The target, written first

Step 0 adds tests that fail for the reason expected:

- a passing `runOperation` of the booking fixture gives `kept`, with each rule of the answer and its `success`, and no rule of a definition;
- a failure has `failure`, not `message`;
- a rule with `message` fails with `manifest-shape`, and the message names `failure`;
- a rule without `success` or without `failure` fails with `manifest-shape`;
- a rule without `description` compiles;
- `{param}` is filled in `success` too, and `{x}` with no parameter `x` fails with `invalid-message`.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `success` and `failure` in the manifest and the model; the standard rules | Each manifest of the repository compiles, after step 2 |
| 2 | The texts of each rule of the repository | Each domain, contract, fixture and snapshot compiles |
| 3 | `failure` in each failure, and `kept` in each passing result; the steps read `failure` | The target tests pass; each scenario passes; each generated file is current |
| 4 | The schema of the manifest, both `AGENTS.md` files, the skill, and the reference pages | The docs build; the reference test passes |

## Sabotages at the end

Each must turn CI red:

1. Leave out the `success` of a rule → `manifest-shape`.
2. Make `kept` skip the rules of the operation → the target test.
3. Edit the `success` of a standard rule by hand in a generated file → gate 4.

## Risks

- **Many texts to write.** About 460 `success` texts. Most come from the `description` of today. The others are written by hand and read in review.
- **A result that is a little larger.** `kept` adds a few lines to each passing call. An operation with many rules of its answer gives a longer list.
- **A breaking change to each manifest and to the shape of a failure.** urn-forge is 0.x. The error for `message` says what to write, and the docs say that `message` is now `failure`.
