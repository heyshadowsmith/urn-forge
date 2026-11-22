# urn-forge contract corpus plan

Nov 22, 2026 · @Shadow Smith

The [roadmap](./contract-completeness-roadmap.md) has a goal: a manifest can declare any contract. A goal of "any" needs a measure. This plan builds the measure: a corpus of real contracts, each written as plain promises, and a score that says how many of those promises a manifest declares. Each later plan then names the promises that it moves to *declared*, and CI shows the score go up.

## What changes

Nothing changes for a user of urn-forge. The corpus is a folder of this repository, `contracts/`. The npm package does not include it.

```text
contracts/
  corpus.yaml                 the minimum score, and the holes of the roadmap
  payments/
    promises.yaml             the promises, each with a status
    domain.manifest.yaml      the contract, as well as urn-forge can declare it today
    urn-forge.config.ts       strict: boundaryCoverage: error
    features/*.feature        the scenarios that show each declared promise
    src/core.ts               a small core, enough for the scenarios
    src/generated/
  bookings/ …
```

A promise:

```yaml
# contracts/payments/promises.yaml
contract: payments
description: Take a payment from a buyer by card or by bank transfer, and refund it
promises:
  P01:
    promise: An amount is more than 0 and has at most 2 digits after the point
    status: declared
    by: [payments.field.amount]
  P07:
    promise: A card payment has a card number and no account
    status: workaround
    by: [payments.invariant.card_has_number]
    hole: B1
  P12:
    promise: A refund is never more than the payment that it refunds
    status: not-declarable
    hole: A2
```

The score, as CI will print it (these numbers are an example, not a result):

```text
contract corpus: 61 of 118 promises declared (51.7%), minimum 51.7%
  workaround      14
  not declarable  43
  by hole: A1 11, A2 9, B1 6, C1 5, C2 4, C3 8, D2 3, …
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where the corpus is | **`contracts/` at the root of the repository**, outside the package | It measures urn-forge. It is not a part of urn-forge |
| 2 | What *declared* means | **The manifest states the promise, and the contract passes `verify` with strict coverage and its scenarios pass** | Strict gate 3 needs a scenario for each invariant, error, event and boundary. So a declared promise is enforced and shown, not only written |
| 3 | Who writes the promises | **An agent with no knowledge of urn-forge writes the promises of each contract, before any manifest** | If the promises come from what urn-forge can do, the score measures nothing |
| 4 | Which contracts | **Six: payments, restaurant bookings, expense claims, event ticketing, subscriptions, inventory** | They cover money, time, lists, states, stored records and repeated calls. Insurance stays a test domain: urn-forge shaped it |
| 5 | The three statuses | **declared, workaround, not-declarable.** *workaround* and *not-declarable* name the hole of the roadmap that would declare the promise (A1 to D4) | The count by hole tells which plan moves the most promises. A promise that fits no hole is a new hole, and the roadmap gets it |
| 6 | Business logic | **Not in the corpus.** A promise that needs the state or a calculation of the core fails the test of the charter, and the review removes it | The corpus measures contracts. Logic in it would make the score a measure of the wrong thing |
| 7 | The score | **declared ÷ all promises.** A workaround counts 0 | A workaround loses a part of the promise, for example the union type of an either-or shape |
| 8 | The ratchet | **`corpus.yaml` holds a minimum score. CI fails below it.** Each plan that moves promises raises the minimum | The score can only go up, as the roadmap asks |
| 9 | The score command | **A script of this repository, not a `urn-forge` command** | Users do not need it |
| 10 | The cores | **As small as the scenarios allow** | The corpus tests the contract, not the logic |

## Scope

- **In scope:** the six contracts, the format of `promises.yaml`, a checker, the score, CI, and a short section in `CONTRIBUTING.md`.
- **Out of scope:**
  - The blind trial after each phase (the roadmap gives it its own place).
  - Contracts of a known API style. A payments API and a messaging API come in a later round.
  - Any change to urn-forge.

## The target, written first

Step 0 writes the promises of the six contracts and nothing else. Each `promises.yaml` has only `contract`, `description` and the promises with their text. Six agents write them, one for each contract. Each gets the name of the domain and this brief: "write the promises that this domain makes to the parties outside it: what it accepts, what it can answer, what it keeps, and how it can change. Not how it calculates." They get no urn-forge docs. A review then removes promises that are business logic (decision 6) and joins duplicates.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The promises of the six contracts, without a status | Each contract has 15 to 25 promises. The review notes are in the commit message |
| 1 | The checker: `scripts/corpus.ts` and `tests/corpus.test.ts` | It reads each `promises.yaml` and fails if any of these is true: a promise has no status; a *declared* or *workaround* promise has no `by`; a short key in `by` is not an atom of that manifest; a *workaround* or *not-declarable* promise has no `hole`, or a hole that `corpus.yaml` does not list; a promise ID is used two times. It prints the score. Each failure has a test |
| 2 | The manifest, the features and the core of each contract, and the status of each promise | One commit for each contract. Each passes `verify` with strict coverage, and its scenarios pass |
| 3 | CI | A job verifies each contract, runs its scenarios, prints the score in the job summary, and fails below the minimum of `corpus.yaml` |
| 4 | Ship | `CONTRIBUTING.md` explains the corpus. The roadmap gets the first score and the count by hole. The A1 plan starts from that count |

## Sabotages at the end

Each must turn CI red:

1. Put a short key in `by` that is not in the manifest.
2. Remove the scenario of an invariant that a *declared* promise names.
3. Change a *declared* promise to *workaround*, so the score falls below the minimum.
4. Give a *not-declarable* promise the hole `Z9`.

## Done

- Six contracts, each with 15 to 25 promises.
- Each contract passes `verify` with strict coverage, and its scenarios pass.
- CI prints the score and fails below the minimum.
- The roadmap shows the first score and the count by hole.

## Risks

- **A wrong status.** A writer can call a promise *declared* when the manifest only comes near it. The review of step 2 reads each *declared* promise next to the atoms in `by`. The blind trials then give a second opinion.
- **Promises that fit urn-forge.** If the step 0 agents know urn-forge, their promises fit what it does today. They get no urn-forge docs.
- **Work in six domains.** Each contract needs a core and features. The cores stay small (decision 10), and the contracts use the patterns of the tutorials.
