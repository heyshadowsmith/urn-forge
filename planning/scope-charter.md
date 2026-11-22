# urn-forge scope charter

Nov 22, 2026 · @Shadow Smith

urn-forge grew one plan at a time: primitives, structure, invariants, Postgres, lifecycle, events, gate 2, date arithmetic, `reportOn`, formula cells, the store file. Four blind trials then built four domains with it, and each found where urn-forge stops. Each time, the answer was decided for one case. This charter decides the line once: what urn-forge is responsible for, what belongs to the code around it, and the test that a new idea must pass.

The page [Scope](../docs/explanation/the-contract.md) today compares urn-forge with specification v1.1, and lists what urn-forge does not have "at this time". That reads as a list of work to do. Some of it is work that urn-forge should never do.

## The purpose, in one sentence

**urn-forge makes the contract of a domain explicit, generates the code that enforces it at each boundary, and proves that the code and the scenarios agree with it.**

It is a contract tool, not a runtime and not a framework. It writes files and gives a verdict. It never connects to a database, a network or a clock.

## The model

| Layer | Who owns it | What urn-forge does for it |
| --- | --- | --- |
| **The contract**: the values, the structure, the rules of one entity, what each operation takes, returns, refuses and emits, and how the contract changes | **urn-forge** (the manifest) | Declares it, compiles it, and classifies each change (`diff`) |
| **The enforcement at the boundaries**: parse and brand the input, check the output, check the stored rows | **urn-forge** (generated files) | Generates it: the schemas, the runtime, the SQL and the store statements |
| **The behaviour**: what an operation computes and decides | **The core** (TypeScript) | Checks it: a typed handler for each operation (gate 1), no forged values (gate 2), a scenario for each case (gate 3). It never generates it |
| **The effects**: transport, storage, transactions, reads, messages, time, identity | **The shell** and its tools | Gives it what to run (statements, parsed events), and checks its brands (gate 2). It never runs it |
| **The operations of a system**: deploy, migrate, monitor, scale | **The platform** | Nothing. `diff` says when a change needs a migration |

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The purpose | **The sentence above**, at the top of the home page, the README and the new Scope page | One sentence that each later decision can be compared with |
| 2 | The test for a new idea | **An idea belongs in urn-forge only if it passes all four:** (a) it describes the contract, not the behaviour; (b) each part that enforces the contract can use it: the schema, the SQL (or an explicit `unenforced-in-sql`), gate 3 coverage and `diff`; (c) it is deterministic: no clock, no environment, no I/O; (d) a scenario can show it | (a) keeps the manifest from becoming a programming language. (b) keeps one rule from being enforced in one place only. (c) is the base of the fingerprint and gate 4. (d) keeps the traceability chain whole |
| 3 | What is out, for good | **Business computation** (prices, totals, refunds), **workflow and state that needs stored data** (already decided, seats left), **I/O** (HTTP, running SQL, transactions, reads and queries, messages, an outbox), **migrations**, **authentication, authorization and tenancy**, **the clock and time zones**, **the translation of messages**, **deploy and monitoring** | Each fails test (a) or (c). Each has better tools: the core for computation, the shell and its libraries for effects, the platform for operations. urn-forge helps with each only by checking or by documenting a pattern |
| 4 | What is out for 1.0, and can be a plugin later | **Other databases than Postgres, other languages than TypeScript, API description formats (OpenAPI, JSON Schema), links across manifests** | These pass the test, but each is a new target for the same contract. The plugin contract exists for them. None is needed to prove the model |
| 5 | The open ideas, put through the test | **Rules over list items**: in, when a domain needs them (passes; the SQL reports `unenforced-in-sql`). **A timestamp as a date in a rule**: out (needs a time zone: fails (c) unless the zone is in the manifest). **Computed fields**, such as `total = sum(lines)`: out (fails (a)). **State transitions** as allowed moves of an enum: out for 1.0 (needs stored state; the core with a declared error does it). **Reads**, a function from rows to an entity: out (fails (c); a read is a query, which the shell owns). **Gate 1 over the shell**: out (decided Nov 21, 2026; `tsc` over the project does it) | Each idea gets a verdict and the reason, so it is not asked again without new facts |
| 6 | What urn-forge does at the edge of its scope | **It checks or it documents; it does not do.** It checks the shell's brands (gate 2), warns when a stored change needs a migration (`diff`), gives exact arithmetic to the core (`urn-forge/exact`), and documents patterns (data that the input does not carry, a refusal for stored state, a rename with a new operation) | This is how urn-forge already helps at each edge. It keeps the help without owning the work |
| 7 | The Scope page | **Rewrite it** as "What urn-forge does and does not do": the purpose, the model above, the out-of-scope list with the owner of each, and the test. Move the comparison with specification v1.1 to [Departures from the specification](departures-from-the-spec.md), which already gives the reasons. Correct the rows that are out of date (code that writes rows, date arithmetic, `reportOn`, formula cells, `urn-forge/exact`) | A reader asks "is this urn-forge's job?", not "is this in v1.1?". The spec comparison stays, in the place that explains it |
| 8 | Where the scope shows in the product | **The home page** (the purpose and the model), **the README**, and **each how-to at an edge** links to the Scope page in one line, for example Store entities in Postgres ("urn-forge writes the statements; your shell runs them") | A user meets the edge in a how-to, not on the Scope page |
| 9 | Changing the scope | **A change to this charter is a plan of its own**, with the test of decision 2 applied | The line moves only on purpose |
| 10 | One PR? | **Yes**: this charter first; then one PR for decisions 7 and 8 | The decisions are separate from the rewrite of the pages |

## Scope of this plan

**In:** the purpose, the model, the test, the out-of-scope list, the verdicts on the open ideas, and the rewrite of the Scope page, the home page and the README.

**Out:** any change to the code. Each verdict of decision 5 that says "in" is a plan of its own, when a domain needs it.

## Build order

- [ ] **1. Agree this charter.** *Check:* each decision confirmed or changed.
- [ ] **2. The pages.** The new Scope page, the comparison with v1.1 in Departures, the home page, the README, and the links from the how-tos at the edges. *Check:* the docs build; each "out" item of the Scope page names its owner and a page or pattern; no row of the Scope page says "at this time" for an item that decision 3 puts out for good.

## Risks

- **A line drawn too tight.** A team may need one of the out items. Decision 9 lets the line move, with a reason. Decision 6 keeps urn-forge helpful at each edge.
- **A line drawn too loose.** "In, when a domain needs them" can turn into "in". Each such item still needs its own plan and the test of decision 2.
