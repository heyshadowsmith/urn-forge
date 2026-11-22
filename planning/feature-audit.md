# urn-forge feature audit

Nov 22, 2026 · @Shadow Smith

urn-forge has about 9,300 lines of source, 5,900 lines of tests, 77 diagnostic codes and about 144,000 words of user documentation on 60 pages. Four blind trials built four domains with it. This audit asks, for each feature: what evidence says that a user needs it, what it costs, and where it belongs. It applies the [scope charter](./scope-charter.md) and the product thesis: **urn-forge is a single source of truth for a domain's contract, with proof that everything that claims to implement it agrees with it.**

## How to read the evidence

- **Organic** means that a trial used the feature, or that the feature caught a mistake, without the prompt asking for it.
- **Prompted** means that the prompt of the trial asked for it. Each trial asked for events, an audit record, Postgres, a shell, and a v2 with `diff`. A prompted use shows that the feature works, not that a user needs it.
- **Caught** means a real mistake, not a planted one.

The trials were four AI agents, not human teams. The evidence is a floor, not a verdict.

## The classes

| Class | Meaning | What changes |
| --- | --- | --- |
| **Core** | Part of the thesis. A new user meets it on the first path | It stays on the front door of the docs |
| **Extra** | Works and stays. A project chooses it | Its own pages. The core path does not mention it, and a core page links to it at most once |
| **Cut** | Costs more than its evidence earns | Removed, with a deprecation note in the release notes |

## The audit

| # | Feature | Evidence | Cost | Class |
| --- | --- | --- | --- | --- |
| 1 | **Manifest, compiler, URNs** (kinds `field`, `entity`, `operation`, `error`; passes 1–7; diagnostics with URNs) | Organic in all 4 trials. "Never had to guess" (trial 1), "the first manifest compiled with no diagnostics" (trials 2, 3) | The base of everything | **Core** |
| 2 | **Primitives and constraints** (8 primitives, about 15 constraints) | Organic in all 4. Each trial used `decimal` with `scale`, `date`, `enum`, lengths and ranges | 772 lines; the manifest reference | **Core** |
| 3 | **Structure** (`ref` to an entity, `link`, `many`, `key`, `as`) | Organic: lines of a claim, attendees, coverages, dietary needs | Part of `kinds` and the reference | **Core** |
| 4 | **Generated schemas and runtime** (`executeOperation`, `ok`, `fail`, `satisfies`) | Organic in all 4. "`satisfies` typed everything; the core passed on the first run" (trials 1, 2, 4). Caught: an error with a value that its field forbids (trial 1) | 895 lines of plugins | **Core** |
| 5 | **Gate 1** (`tsc` and `satisfies` over the core) | Organic in all 4 | Small | **Core** |
| 6 | **Gate 3 traceability and coverage** (tags, headers, errors, invariants, boundaries) | Organic in all 4, and the most praised feature: "boundary coverage told me exactly which values to add" (all 4). Caught: missing edge values in each trial | 658 lines; the largest reference pages | **Core** |
| 7 | **Strict mode by tag, and the ratchet** (`@urn-forge:strict`, `ratchet-ready`) | Not used: each trial began from `init`, which sets `boundaryCoverage: 'error'` from the start | A tag, a note, tutorial 3 and a how-to | **Extra**: a migration aid for a project that has gaps |
| 8 | **Waivers** (`# urn-forge:waive …`) | Not used in any trial | 4 codes, a how-to | **Extra** |
| 9 | **Gate 4** (drift) | Never fired except on purpose. It guards the derivation half of the thesis | Small; 3 codes | **Core**: cheap insurance for the thesis |
| 10 | **Generic Cucumber steps** | Organic in all 4: "no step code to write" (trial 1) | 764 lines with the cell reader | **Core** |
| 11 | **Invariants and the rule language** (comparisons, `and`/`or`, guards) | Organic in all 4: a term, a deposit for a party, a reason for a rejection | 717 lines; a reference page of 4,153 words | **Core**, limited by the charter |
| 12 | **Date arithmetic in rules** | Organic in 2 trials (sale window, booking window) | Small, in the rule language | **Core** |
| 13 | **`reportOn`** | Asked for in 1 trial; ordering the rule worked too | Small; 1 code | **Extra**: one section on the invariant page |
| 14 | **Formula cells** (`=repeat(…)`) | Organic in trial 4: "made the length edges easy" | 254 lines with the cell reader; a mini-language | **Core**, because strict coverage needs it. Documented with boundary coverage, not as a feature of its own |
| 15 | **`urn-forge/exact`** | Not found in trial 4, which came before the pointers. No organic use yet | 91 lines | **Core**, as a helper of the core. One mention where the core does arithmetic |
| 16 | **`init` and the tarball** | Organic in all 4: "`init` worked first time" | Small | **Core** |
| 17 | **Postgres SQL and the store file** | Prompted in all 4. Caught: the store file closes the fault of trial 4, a hand-written `INSERT` that dropped a column | 980 lines; a reference of 5,226 words and a how-to of 3,034 | **Extra**. It is the strongest example of the thesis, so the home page names it |
| 18 | **Events** (`event`, `emits`, the emit steps, event coverage) | Prompted in all 4 | `event` kind, 2 codes, a how-to of 2,137 words | **Extra** |
| 19 | **Audit records** (`recordAs`, `Then the refusal is recorded as`, record coverage) | Prompted in trials 2–4. "Made the audit trail trivial" (trials 3, 4). The shell can record a refusal itself | A cross-kind rule (pass 6), 3 codes, a step, a field of `DomainError` | **Cut candidate**: see decision 4 |
| 20 | **Lifecycle** (`status`, `supersededBy`, `sunsetDate`, pass 8, the reference date) | Prompted in trials 2 and 4. It caused the one CI scare: a fixed sunset date in a test domain | 72 lines and pass 8; 3 codes; the reference date in the config, the CLI and CI; a how-to of 1,864 words | **Extra**, as a pair with `diff` |
| 21 | **`urn-forge diff`** (In/Out/Stored, `breaking-change`, the migration note) | Prompted in trials 2–4. Each agent agreed with each verdict: "easy to agree or disagree with". It found 2 real faults of its own rules during the trials | 486 lines; a how-to of 2,217 words; an explanation of 2,122 | **Extra**, for a contract with callers outside the repository |
| 22 | **Gate 2: `brand-assertion`, `brand-from-any`, `suppressed-check`** | Never caught a mistake that was not planted | 168 lines; 3 codes; the `shell` setting and `shell-not-found` | **Extra**: see decision 5 |
| 23 | **Gate 2: `core-parser-import`** | Never caught a mistake. Its reason (a core that parses to do arithmetic) went away with `urn-forge/exact` | 1 code, a section of a how-to | **Cut** |
| 24 | **`--format json`** | Not used in the trials; the CI page of the docs uses it for annotations | Small; a reference page | **Extra** |

## What the audit finds

- **The core path is 13 features, and they are most of the code.** The thesis does not ask to remove code: it asks to stop putting the extras in front of a new user.
- **The extras are 9 features, with 18 of the 77 codes, and about 19,000 words on their own pages, plus sections of the core references.** The two cuts have 4 more codes. A new user meets each of them today in the tutorials, the gate summaries and the references.
- **Features made features.** Strict coverage led to formula cells; decimals as strings led to `urn-forge/exact`; invariants led to `reportOn`; `recordAs` led to the record step; `shell` led to `shell-not-found`. Each was right on its own. The rule for later: a fix of friction in an extra stays in the extra.
- **The real gap is not a feature.** No human team has used urn-forge.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The classes | **Core, Extra and Cut, as in the table** | The table gives the evidence for each |
| 2 | A feature freeze | **No new feature until a human team uses urn-forge on a real domain.** Fixes of what users find are allowed | Every feature since the MVP came from reasoning and four AI agents. The next evidence must come from a person |
| 3 | The docs | **The next PR splits the docs into a core path and the extras** (the second part of this work). The tutorials, the home page and the core references mention no extra; each extra has its own pages | This is where the cost of the extras falls on a new user |
| 4 | Audit records (19) | **Cut them**: `recordAs`, the record step, `undeclared-record`, `uncovered-record`, `invalid-record-as` and `record` on a `DomainError`. The docs show the shell that records a refusal from the `DomainError` | A cross-kind rule and three codes for something the shell does in a few lines. The trials liked it only when asked for it. If you prefer to keep it, it is an **Extra** |
| 5 | Gate 2 (22) | **Keep its three rules as an Extra** that runs on the core always, and on the shell when `shell` is set. Name it as insurance in the docs, not as a pillar | Cheap to run and to keep. Its evidence is nil, so it does not earn a place on the front door |
| 6 | `core-parser-import` (23) | **Cut it** | Its reason went away with `urn-forge/exact` |
| 7 | Each cut | **A deprecation in one release, then the removal**: the manifest key or step gives a warning that names the replacement | urn-forge applies the same rule to a contract. It should apply it to itself |
| 8 | The next evidence | **One drift trial**: an agent keeps one domain through several versions while a second agent makes changes that should break agreement. Count what urn-forge catches and what slips | It tests the thesis directly, before more is built on it |

## Not in this audit

The code of the cuts, and the docs split. Each follows from the decisions, in its own PR.
