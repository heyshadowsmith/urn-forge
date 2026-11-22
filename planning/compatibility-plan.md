# urn-forge compatibility plan

Nov 22, 2026 · @Shadow Smith

After [idempotency](./idempotency-plan.md), the corpus is at 71 of 143 promises (49.7%). E4, "how the contract changes", has 6 promises, one in each contract:

| Promise | What may be added | Callers ignore unknown fields | Notice before removal |
| --- | --- | --- | --- |
| bookings.P24 | optional request fields, answer fields, event fields | yes | a new major version, announced 6 months before the old one is withdrawn |
| claims.P24 | optional fields, event types, categories, refusal codes | yes | — (nothing is removed) |
| inventory.P23 | fields, operations, error codes, event types | yes | a removed element stays 6 months after it is deprecated |
| payments.P24 | optional fields, event types | — | a major version stays 12 months after its successor is released |
| subscriptions.P24 | fields, enum values | yes | a removed version works 12 months after its deprecation is announced |
| ticketing.P24 | fields, refusal codes | yes | a new major version is announced 180 days before the old one is retired |

Each promise has three parts:

1. **Within a major version, nothing is removed or renamed.** `urn-forge diff` already does this: on a stable manifest, a breaking change fails.
2. **Some additions are allowed, because callers ignore what they do not know.** `diff` does not do this today. A new declared error, a new event and a new enum value in an answer widen what callers receive, so `diff` reports each as breaking. Four of the promises allow them.
3. **A removal needs notice.** Today a lifecycle has `deprecated`, `sunsetDate` and `sunset`. Nothing states when the deprecation was announced, so nothing can check a minimum notice. Nothing states the notice for a major version.

## What changes for a user

```yaml
urn-forge:
  version: 1.0.0
  compatibility:
    callers: ignore-unknown
    notice: 6 months
```

```yaml
stock.field.bin_code:
  lifecycle:
    status: deprecated
    deprecatedOn: 2026-11-22
    sunsetDate: 2027-05-22
```

```text
$ urn-forge diff old.yaml new.yaml
compatible  urn:…:claim:operation:submit_claim  the new declared error …: callers ignore what they do not know (compatibility.callers)
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where it is stated | **A header `compatibility`, with `callers` and `notice`, both optional.** No `compatibility` gives the same `diff` as today | The rules apply to the whole contract, not to one atom |
| 2 | "Callers ignore unknown fields" | **`callers: ignore-unknown`.** Then `diff` reports a new declared error, a new event and a new enum value of a value that callers receive as compatible, with the reason. A removed or renamed value stays breaking | This is what the promise allows: a caller that ignores what it does not know is not broken by a new kind of answer. Without the statement, a new error breaks a caller that handles each kind, as today |
| 3 | Our side of unknown fields | **No change: the generated schemas already drop unknown properties of a request (`v.object`).** The docs say so | A caller that sends a field from a newer version is not refused |
| 4 | When a deprecation was announced | **`deprecatedOn: YYYY-MM-DD` in a lifecycle.** It is required with `sunsetDate` when the header has `notice` | The notice counts from the announcement. Without its date, nothing can check it |
| 5 | The notice | **`notice: <n> days` or `notice: <n> months`, counted on calendar dates.** `compile` stops with `short-notice` when `sunsetDate` is earlier than `deprecatedOn` + `notice` | "Stays supported for at least 6 months after it is announced" |
| 6 | Removal in `diff` | **With `notice`, `diff` refuses (as breaking) a move to `sunset` of an atom that the old manifest did not deprecate with a `sunsetDate`, and pass 8 with a reference date refuses a `sunset` atom whose `sunsetDate` is after that date (`early-sunset`)** | The notice must be given before the removal, and the removal waits for the date. A sunset atom stays as a tombstone, as today |
| 7 | A major version | **`diff` still fails on a breaking change when the major version goes up.** A new major version is a new manifest beside the old one, and its old version keeps running | Today's rule. Two majors at once is the operator's job: urn-forge generates one version |
| 8 | Notice for a major version (bookings, payments, subscriptions, ticketing) | **Out of this plan.** Those promises keep their status | They are about how long the operator runs an old deployment. A date in the manifest states it but checks nothing that urn-forge builds. That fails the strict test |

## Scope

- **In scope:** the `compatibility` header; `deprecatedOn`; `short-notice` and `early-sunset`; the `diff` rules of decisions 2 and 6; the corpus promises below; and the docs.
- **Out of scope:**
  - Running two major versions at once.
  - A notice for a major version (decision 8).
  - A generated client that ignores unknown fields.

## The promises that this plan can move

| Promise | Now | After |
| --- | --- | --- |
| claims.P24 | not-declarable | declared: `callers: ignore-unknown`, and `diff` refuses every removal or rename |
| inventory.P23 | not-declarable | declared: `callers: ignore-unknown` and `notice: 6 months` |
| bookings.P24, payments.P24, subscriptions.P24, ticketing.P24 | not-declarable | workaround: the part within a major version is declared; the notice for a major version is not (decision 8) |

If both pass the strict test, the score goes from 71 to 73 of 143 (51.0%). The four workarounds do not change the score. The contract builders apply the same strict test as before.

## The target, written first

Step 0 adds `tests/fixtures/compatibility`: a domain with `compatibility: { callers: ignore-unknown, notice: 6 months }` and a field that is deprecated with `deprecatedOn` and `sunsetDate`. It also adds `tests/compatibility.test.ts`, with:

- a pair of manifests for each `diff` rule of decisions 2 and 6;
- a `short-notice` and an `early-sunset` case.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `compatibility` and `deprecatedOn` in the manifest and the IR | `invalid-compatibility` for an unknown `callers` value or a `notice` that is not a time; `short-notice` |
| 2 | Pass 8 | `early-sunset` with a reference date |
| 3 | `diff` | The rules of decisions 2 and 6, each with a `tests/diff` case; a domain without `compatibility` gives the same `diff` as today |
| 4 | The corpus | The contracts; the minimum is the new score |
| 5 | Docs | The guide "Change the contract" gets a section on `compatibility`; the manifest, diff and diagnostics pages |

## Sabotages at the end

Each must turn CI red:

1. Remove `callers: ignore-unknown` from the target and add a declared error in a new manifest → `diff` reports a breaking change.
2. Change `sunsetDate` to 5 months after `deprecatedOn` in inventory → `compile` stops with `short-notice`.
3. Move an active field to `sunset` in a new manifest with `notice` → `diff` reports a breaking change.
4. Set the reference date before the `sunsetDate` of a sunset atom → `early-sunset`.
5. Remove a field from claims in a new manifest → `diff` reports a breaking change, with `callers: ignore-unknown`.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say what `callers: ignore-unknown` allows, and that the callers must keep to it.

## Risks

- **A caller that does not ignore unknown values.** urn-forge cannot know. With `callers: ignore-unknown`, the contract states the duty, and a new error code breaks only a caller that breaks it.
- **Dates that are not true.** `deprecatedOn` is what the author writes. The CI diff job shows each new `deprecatedOn`, so a reviewer sees it in the pull request that announces it.
