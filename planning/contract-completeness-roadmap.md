# urn-forge contract completeness roadmap

Nov 22, 2026 · @Shadow Smith

**The goal: a manifest can declare any contract.** A contract is the closed, named set of promises that a domain makes at its boundaries: what it accepts, what it can answer, and what it keeps (refer to [What a contract cannot say yet](../docs/explanation/the-contract.md)). Today a manifest states the promises about one value, one entity, one operation and its answers, and how the contract changes. It cannot state the promises that connect two things, and it leaves four promises out on purpose.

This roadmap replaces two decisions: the feature freeze of the [feature audit](./feature-audit.md) (decision 2), and the list of promises that the [scope charter](./scope-charter.md) leaves out on purpose (decision 3). It keeps the test of the charter: a new construct must describe the contract and not the behaviour, each part that enforces the contract must be able to use it, it must be deterministic, and a scenario must be able to show it. "Any contract" means any promise that passes that test. Business logic stays in the core.

## How completeness is measured: the contract corpus

A goal of "any contract" needs a measure, or it has no end.

- **The corpus** is a directory, `contracts/`, of real contracts, each written as plain promises first: payments, bookings, claims, ticketing, insurance, subscriptions, inventory, and the public contract of a known API style (a payments API, a messaging API).
- **Each promise** of each contract is a line with an ID: `payments.P07: a card payment has a card number and no account`.
- **Each promise has one status:** *declared* (the manifest states it, and a test shows that each enforcing part applies it), *workaround* (the manifest states it only with a pattern of [known holes](../docs/explanation/the-contract.md)), or *not declarable*.
- **The score** is the share of promises that are declared. CI prints it. Each plan of this roadmap names the promises that it moves to *declared*, and the score must go up.
- **A blind trial after each phase** gives a new contract to an agent, which writes its promises, then its manifest, and reports each promise that it could not declare. New promises go into the corpus.

## The phases

Each item is a plan of its own, with the format of the earlier plans: a target written first, one commit for each step, sabotages at the end. The order puts first what the most contracts need, and what fits the machinery that exists.

### Phase A: relations inside one request and its answer

| # | Hole | The construct | Enforced by |
| --- | --- | --- | --- |
| A1 | Rules between an entity and its list items and embedded entities | Paths and quantifiers in the rule language: `each lines: receipt_date >= claim_date - 90`, `count(names) = quantity`, `sum(lines.amount) = total` | Valibot (exact); SQL where a row sees it, else `unenforced-in-sql`; gate 3 coverage of the invariant; `diff` as a rule change |
| A2 | Rules between the request and the answer | Postconditions on an operation: `ensures: output.refund <= input.premium` | `executeOperation`: a broken postcondition is `ContractViolation`; gate 3 needs a scenario at the edge; `diff`: a new postcondition narrows Out (compatible) |
| A3 | More than one declared error for one call | `fail` with a list of declared errors | The runtime, gate 1 types, the `fails with` step for each |

### Phase B: shapes

| # | Hole | The construct | Enforced by |
| --- | --- | --- | --- |
| B1 | Either-or shapes | A variant entity: a discriminator field and one entity for each case | Valibot `v.variant`; a union type in TypeScript; SQL columns of each case with a `CHECK` for the case; gate 3 boundary coverage for each case; `diff` for a new or removed case by direction of use |
| B2 | Present and empty, not absent | `nullable` on a field reference | Valibot `v.nullable`; SQL `NULL` with the meaning written in a comment; gate 3 needs a `null` case |
| B3 | Maps | `map` on a field reference, with a key field and a value | Valibot `v.record`; SQL child table keyed by the map key |
| B4 | Units and currencies | `unit` on a field; a rule may compare and add only fields of one unit | Pass 6 types the units; the schema of a money value with its currency field |

### Phase C: promises about what is kept and about repeated calls

| # | Hole | The construct | Enforced by |
| --- | --- | --- | --- |
| C1 | Uniqueness among stored records | `unique: [<property>, …]` on an entity | SQL `UNIQUE` with the URN comment; a declared error that the shell gives from `23505`; a scenario step that stores two |
| C2 | The same request two times | `idempotencyKey: <property>` on an operation | The store file: a table of keys and answers, and the statements to read and write it; a scenario step that sends one request two times |
| C3 | States and transitions of an entity | A `states` field with the moves that are allowed: `submitted → approved, rejected` | The store file: an `UPDATE … WHERE state = <from>`; a declared error for a move that is not allowed; gate 3 coverage of each move |
| C4 | Operations that take a long time | An operation that answers `accepted` with a reference, and an event for each later state (uses C3) | The runtime types; event coverage; scenarios for each state |

### Phase D: promises across a system

| # | Hole | The construct | Enforced by |
| --- | --- | --- | --- |
| D1 | One domain that refers to another | Imports between manifests: `uses: acme:accounts@^1` and references to its atoms | The compiler reads the other manifest; `diff` across the pair; generated types from the other domain |
| D2 | Who can call | `callers` on an operation: named roles, and rules on the input that the caller must meet (`caller.customer_id = input.holder`) | A generated guard that the shell calls before `executeOperation`; a declared error `forbidden`; scenario steps with a caller |
| D3 | Time zones | A `zone` on a `timestamp` field or on the manifest; `date_of(at)` in a rule | Valibot and SQL with the zone from the manifest, never from the environment (keeps determinism) |
| D4 | The delivery of events | Declared guarantees on an event: an ordering key, at least one delivery, a deduplication key | Generated metadata for the publisher; a scenario step for the key; the guarantee itself is the platform's, so the manifest states it and the docs give the owner |

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The goal | **A manifest can declare any promise that passes the test of the scope charter** | "Any contract" without the test becomes "any program". The test keeps business logic in the core |
| 2 | The feature freeze of the audit | **Lift it**, and put the corpus score in its place: a new construct is in only if it moves promises of the corpus to *declared* | Evidence still decides; the corpus gives it without a human team first |
| 3 | The promises that the charter left out | **Back in, as phase D**, each with a construct that states the promise and names who enforces it when urn-forge cannot | Each is a real promise. A manifest can state a promise that the platform keeps, as long as it says so |
| 4 | The cuts of the audit | **Keep audit records (`recordAs`)**: "a refusal is recorded" is a promise about an answer. **Still cut `core-parser-import`** | The first is contract by the definition; the second is not a promise |
| 5 | The docs split | **Do it first, before phase A** | Each phase adds surface. A core path and pages for each extra keep a new user from meeting all of it |
| 6 | The corpus | **Build it before A1**, with at least six contracts and their promises, and the first score | Each plan then states the promises that it moves, and CI shows the score |
| 7 | The order | **A, B, C, D**, one plan at a time | A and B extend what exists; C needs the store file; D needs decisions about other systems |
| 8 | The rule language | **It grows in A1, A2 and B4 only**: paths, quantifiers, `count`, `sum`, units, `input.` and `output.`. No user functions, no loops, no calls | These are what relations need. More would make it a programming language, which fails the test |

## The first steps

1. The docs split (decision 5).
2. The corpus, with its score in CI (decision 6).
3. The plan for A1, rules over list items, with the corpus promises that it moves.

## Risks

- **The manifest becomes a language to learn.** Each construct adds a page and codes. The docs split, and a core path that does not mention phases B to D, keep the first hour small.
- **A promise that no part can enforce.** D4 can only be stated and documented. Each such construct must say who keeps the promise, or it is a comment, not a contract.
- **The corpus as our own opinion.** Its contracts are written by us. The blind trial after each phase adds promises from outside.
