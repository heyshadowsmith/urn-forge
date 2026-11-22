# urn-forge lifecycle plan

Nov 21, 2026 · @Shadow Smith

A URN never changes its meaning ([URNs as permanent names](../docs/explanation/the-contract.md)). Today nothing enforces that. A manifest can tighten a constraint, remove a property or change a primitive, and `compile` and `verify` pass. Since the [Postgres plan](./postgres-plan.md), the same change can also break a database: a tighter `maxLength` makes old rows invalid.

The spec has two parts for this. Pass 8 (spec §3, §6) gives each atom a lifecycle (`active`, `deprecated`, `sunset`), so an old URN can retire without a change of meaning. `urn-forge diff` (spec §3, gate 5) compares two manifests, and classifies each change to an existing URN as compatible, breaking or lifecycle. This plan adds both.

## What changes for a user

```yaml
policy.field.note:
  primitive: string
  description: Free text about a coverage
  status: deprecated
  supersededBy: policy.field.remark
  sunsetDate: 2027-06-30
```

While the coverage still refers to the note, `compile` warns (the message text is a sketch; step 2 fixes it):

```text
$ urn-forge compile --reference-date 2026-11-21
warning  deprecated-ref  urn:acme:insurance:policy:entity:coverage: fields[2] refers to urn:acme:insurance:policy:field:note, which is deprecated (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30)
```

The coverage keeps `note` while callers move, and adds `remark` beside it. `diff` against the old manifest reports each change, and a breaking one if there is one:

```text
$ urn-forge diff old.manifest.yaml domain.manifest.yaml --config urn-forge.config.ts
breaking    urn:acme:insurance:customer:field:name  minLength 1 → 2 tightens a field that the Postgres table customer.customer stores
compatible  urn:acme:insurance:policy:entity:coverage  adds the optional property "remark"
lifecycle   urn:acme:insurance:policy:field:note  active → deprecated
1 breaking change to a live URN
```

## The model

A change to a URN is breaking if a consumer that worked before can fail after it. Who can fail depends on how the URN is used, so `diff` classifies each change by the **direction of use**:

| Use | Who depends on it | A change that breaks them |
| --- | --- | --- |
| **In**: a value that a caller sends (an operation's input, and what it embeds or links) | Callers | A change that refuses a value that was valid: a tighter constraint, a new required property, a new invariant |
| **Out**: a value that a caller receives (an operation's output, a declared error's payload) | Callers | A change that allows a value that was not valid: a wider constraint, a property that becomes optional, a new declared error |
| **Stored**: a value in a table of the Postgres plugin | Rows already in the database | The same as **In**: old rows must still be valid |
| Unused | No one | None |

A URN with two uses has the rules of both, so for it any change of meaning is breaking. This is the spec's table ("tightening a constraint is breaking"), applied to both sides: the spec's rule is correct for inputs, but for outputs the opposite change is the breaking one.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Which atoms have a lifecycle? | **Every kind**: `status` (`active`, the default, `deprecated` or `sunset`), `supersededBy` (an atom of the same kind) and `sunsetDate` (`YYYY-MM-DD`) | Spec §3. Every atom has a URN that someone can depend on |
| 2 | Where is it in the IR? | **`lifecycle?` on a node only when it is not plain `active`** | Existing IRs and fingerprints do not change. The same choice kept `{ field }` in its old shape in the structure plan |
| 3 | What are the rules on the keys? | `supersededBy` and `sunsetDate` only on a `deprecated` or `sunset` atom; `supersededBy` resolves in pass 4, to an atom of the same kind that is not the atom itself. Otherwise `invalid-lifecycle` | A replacement or a sunset date on an active atom has no meaning. A wrong kind would point a reader at the wrong thing |
| 4 | What does pass 8 check? | **A reference from an active atom** to a deprecated atom is `deprecated-ref` (a warning). A reference from an active or deprecated atom to a sunset atom, or to an atom whose `sunsetDate` is on or before the reference date, is `sunset-ref` (an error) | Spec §6. A deprecated atom that uses another deprecated atom is normal while both retire, so it gets no warning |
| 5 | Where does the reference date come from? | **`--reference-date` on `compile` and `verify`, then `referenceDate` in the config.** Without either, a date check is a warning, and `verify` says that sunset dates are not enforced | Spec §6: never the clock, so one commit always gives one verdict. CI sets the date |
| 6 | What does a sunset atom generate? | **Nothing.** It stays in the manifest, so its URN is never used again, but no plugin writes code, a type or a table for it, and no gate asks for its handler or scenarios. The output depends on `status` only, never on a date | A sunset atom is gone for its users, but its name is not free. The reference date changes diagnostics only, so the generated bytes do not depend on the day |
| 7 | And a deprecated atom? | **It generates everything, as before, with a mark:** `@deprecated` with its replacement in the TypeScript (editors cross the name out; `tsc` does not fail), and the status in the SQL comment | The deprecation is visible where the code uses it, without breaking anything |
| 8 | How does `diff` find the uses? | **From the IR**: In and Out from the operations (nested entities, links and errors included); Stored from the Postgres plugin's `tables`, through `--config` | The same IR walk as gate 3 and the plugin. Storage is in the config, so `diff` reads the config when it has one |
| 9 | How is a constraint change classified? | **By aspect, as a set of values:** the new set is equal, smaller (tighter), larger (wider), or neither. A bound that moves, a `notIn` or an enum `values` that changes, a `multipleOf` that is a multiple or a divisor of the old one, a `scale`, a length. A changed `regex` or `format` is "neither" | The MECE model gives each constraint one aspect, so each aspect has one comparison. A pattern cannot be compared in general, so the safe answer is "neither" |
| 10 | Property changes | On In: a new required property and optional → required are tightening, a removed property and required → optional are compatible (schemas drop unknown keys). On Out: the opposite. On both: all breaking. A changed `many` rule is like a constraint. A change of target (`ref`, `link`, `key`) or of single ↔ list is breaking. A new name by `as` is a removal and an addition | The direction-of-use rule, applied to presence and count, the second layer of the model |
| 11 | Invariant changes | A new invariant tightens its entity; a removed one widens it; a changed rule is "neither" | A rule cannot be compared with another rule in general, so the safe answer is "neither" |
| 12 | Operation and error changes | A new input or output entity URN is breaking. A new declared error widens Out (breaking); a removed one is compatible. A changed `category` or `retryable` is breaking. A new `message` text is compatible | Spec §3 calls a new declared error compatible, but a caller that handles every error kind breaks on a new one. This is the only place where the plan departs from the spec's table |
| 13 | Lifecycle changes | **Forward only**: `active → deprecated → sunset` is the lifecycle class. Backward is breaking. A change to an atom that was already sunset is not reported. A removed atom is breaking, even a sunset one | Spec §3. A sunset atom stays as a tombstone, so its URN cannot get a second meaning later |
| 14 | `stability: experimental` | **Breaking changes are warnings** while the old manifest is experimental. Removing the flag is compatible; adding it back is breaking | Spec §3 |
| 15 | Gate 5 | **The `urn-forge diff` command, run by CI against the manifest at the merge base.** Not part of `verify` | `verify` has one manifest and no git history. The how-to shows `git show origin/main:<path> > old.yaml` for CI |
| 16 | Diagnostics | Pass 1: `invalid-lifecycle`. Pass 8: `deprecated-ref`, `sunset-ref`. `diff`: `breaking-change` (an error, or a warning while experimental). Compatible and lifecycle changes are report lines, not diagnostics | One code for one kind of problem. A compatible change needs no action, so it is not a problem |
| 17 | Target | **Extend `insurance/`**: `policy.field.note` becomes deprecated, superseded by a new `policy.field.remark`, with a sunset date. And a `tests/diff/` set of old and new manifests, one pair for each row of the classification tables, each with its expected report | Insurance has In, Out and Stored uses at once. The pairs keep every rule tested on its own |
| 18 | One PR? | **Yes**, one commit per step, as before | |

## Scope

**In:** the lifecycle keys on every kind; `invalid-lifecycle`; pass 8 with the reference date (CLI and config); sunset atoms out of the plugins and gates; `@deprecated` in TypeScript and the status in SQL; the `diff` command with its classifier, text and JSON output and exit code; `stability: experimental`; a CI job that runs `diff` for each domain of this repository; the docs.

**Out:** a check of the manifest's `version` against the kind of change (it is reported, not enforced); comparing two regular expressions or two rules; migrations for a breaking database change; events (the `event` kind is not built).

## The target, written first

Step 0 deprecates `policy.field.note` in `insurance/`, superseded by a new `policy.field.remark`, with `sunsetDate: 2027-06-30`. The coverage keeps `note` and adds an optional `remark`: removing `note` now would break every caller that receives a coverage, so it waits for the sunset. It writes `tests/diff/`, one directory for each case, each with `old.yaml`, `new.yaml` and `expected.txt`. Until step 1, `compile` refuses insurance at pass 1 (`unknown-property` for `status`, `supersededBy` and `sunsetDate`), and `diff` is an unknown command; that is the check of step 0.

## Build order

One PR (decision 18), one commit per step. Each step leaves the repository green and ends with a check.

- [x] **0. The target.** As above. *Check:* `compile` refuses exactly the three lifecycle keys.
  - *Done*, in two commits. The cases went in first. The insurance change went in with step 1, because CI compiles insurance and a red commit would hide other failures. `compile` reported only the first lifecycle key, `status`: a field's schema is a strict object, and it reports one unknown key.
- [x] **1. Lifecycle in the manifest and the IR.** The keys on every kind, `lifecycle?` in the IR and the fingerprint, `supersededBy` in pass 4, `invalid-lifecycle`. *Check:* insurance compiles to an IR with one `lifecycle`; the other IRs and fixtures do not change.
  - *Done.* Pass 1 checks the lifecycle keys apart from each kind's own keys, so no kind changed. Pass 8 came in this step too, because a deprecated note in insurance needs it to compile with a warning. `remark` has `maxLength: 40`, not 500, so the two new boundary rows in insurance's features stay readable.
- [x] **2. Pass 8 and the generated code.** The reference date from the CLI and the config; `deprecated-ref` and `sunset-ref`; sunset atoms out of the plugins and the gates; `@deprecated` and the SQL comment. *Check:* insurance compiles with one warning, `deprecated-ref` for the coverage's note; a fixture for each code; a sunset field generates no schema, no column and no domain.
  - *Done*, with one change to decision 5. Without a reference date, a sunset date is not checked at all, not checked as a warning: with no date there is nothing to compare. `verify` then prints `note: sunset dates are not checked: set --reference-date or referenceDate in the config`, and its JSON result has `sunsetDatesChecked: false`. The codes are tested in `tests/lifecycle.test.ts` and `tests/every-code.test.ts`, not in fixtures.
- [x] **3. The classifier.** Uses from the IR and the config; each table of this plan as code, typed so that a new primitive or constraint without a comparison fails `tsc`. *Check:* every pair in `tests/diff/` gives its expected report.
  - *Done.* All 34 cases passed at the first run, so I read each message by hand before the commit. The constraint table is typed by primitive (`src/diff/relation.ts`). A unit test covers the edges: exclusive bounds, scale, a `notIn` of decimals by value, a `multipleOf` that is neither a multiple nor a divisor, and timestamps as instants.
- [x] **4. The `diff` command.** Two manifests and an optional config; text and `--format json`; exit code 1 for a breaking change to a live URN; warnings while experimental. *Check:* `diff` of insurance against its version on `main` reports one lifecycle change and the new optional `remark`, and no breaking change.
  - *Done.* The check was met: 0 breaking, 2 compatible (the new field and the new optional property), 1 lifecycle. `verify`'s summary now says `gate 5 is urn-forge diff`. The package exports `classify`, `diffManifests`, `usesOf`, `liveIr` and `statusOf`.
- [x] **5. Ship.** A CI job that runs `diff` for each domain against the merge base; the docs (manifest, passes, CLI, diagnostics, a how-to to retire a URN, a how-to to run `diff` in CI, the explanation of direction of use). *Check:* CI green; every sabotage below fails.
  - *Done.* `scripts/diff-base.mjs` runs `diff` for each domain against a git ref, and the CI job `compatibility` runs it on each pull request against `HEAD^1`. New pages: [Retire a URN](../docs/how-to/change-the-contract.md), [Check compatibility in CI](../docs/how-to/change-the-contract.md) and [Compatibility and the direction of use](../docs/explanation/compatibility.md). Two things changed while the docs were written: removing a property whose target was deprecated is a lifecycle change, so a retirement passes gate 5 on its sunset date; and a deprecated-ref stays a warning when a sunset-ref fails the same build. After review, the test domains were decoupled from time and from gate 5: insurance fixes `referenceDate: '2026-11-21'` in its config, so its sunset date can never fail urn-forge's CI on a future day (a unit test checks the failure at 2027-06-30), and the `compatibility` job runs `diff:base --report`, because test domains change on purpose; `tests/diff.test.ts` proves that `diff` fails on a breaking change.

## Done

| Sabotage | What catches it | Result |
| --- | --- | --- |
| `supersededBy` on an active atom | Pass 1, `invalid-lifecycle` | Caught |
| `supersededBy` that names an entity for a field | Pass 4, `wrong-ref-kind` | Caught |
| An active entity that refers to a sunset field | Pass 8, `sunset-ref` | Caught |
| A reference date after `sunsetDate`, with the reference still there | Pass 8, `sunset-ref` | Caught on insurance: `verify --reference-date 2027-06-30` fails on the coverage's note |
| `maxLength` lowered on a field that an operation's input uses | `diff`, `breaking-change` | Caught on insurance: `remark` 40 → 30 fails `diff:base`, for callers that send it and rows already stored |
| `maxLength` raised on a field that only an output uses | `diff`, `breaking-change` | Caught (case `output-widened`, with `max`) |
| The same raise on a field that only an input uses | `diff`: compatible | Met (case `input-widened`) |
| A new declared error on an operation | `diff`, `breaking-change` | Caught (case `error-added`) |
| `sunset → active` | `diff`, `breaking-change` | Caught (case `sunset-revived`) |
| A breaking change in a manifest with `stability: experimental` | `diff`: a warning, exit code 0 | Met (case `experimental`, and the CLI test) |

**Met.**

## Risks

- **Strictness.** The direction-of-use rule finds more breaking changes than the spec's table, for example a new declared error. That is correct for a caller that handles every error, but it can feel strict. The message of each `breaking-change` says which use makes it breaking, and the how-to shows the path: a new URN, and a deprecation of the old one.
- **"Neither" is safe, not exact.** A changed `regex` or rule is breaking wherever the URN is used, even when the new pattern only widens. A precise comparison of patterns or rules is a large problem, and this plan does not solve it.
- **Two manifests, two IRs.** `diff` compiles both manifests. An old manifest that a newer urn-forge refuses cannot be compared; `diff` then reports the old manifest's diagnostics and stops.
- **Reference date in CI.** If CI does not set `--reference-date`, sunset dates are warnings only. The CI how-to must set it, for example to the commit date.
