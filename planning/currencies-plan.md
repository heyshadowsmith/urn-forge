# urn-forge currencies plan

Nov 23, 2026 · @Shadow Smith

After [uniqueness](./uniqueness-plan.md), the corpus is at 85 of 143 promises (59.4%). B4, "money", has 5 promises:

| Promise | What it needs | Can it be stated today? |
| --- | --- | --- |
| subscriptions.P03 | Minor units from 0 to 99999999, with an ISO 4217 code | All but the ISO 4217 code |
| payments.P01 | Minor units from 1 to 99999999, paired with an ISO 4217 code | All but the code; the pair is two fields of the payment |
| claims.P02 | Decimals with at most 2 fraction digits, an ISO 4217 code, lines above 0.00 and at most 10000.00 | All but the code |
| ticketing.P02 | Non-negative minor units with an ISO 4217 code, and one currency for all the amounts of an order | All but the code; the one currency is a rule with `all` |
| bookings.P09 | A deposit in the restaurant's one currency, positive with 2 decimals, equal to the amount per guest times the party size | The product (`*`) and the decimals; the one currency is to check |

Each promise names an ISO 4217 code. Today a currency field is `regex: '[A-Z]{3}'`, so `XYZ` passes. That is the one thing that no contract can state.

## What changes for a user

```yaml
money.field.currency:
  primitive: string
  format: currency
  description: An ISO 4217 code
```

```text
Invalid currency: Expected an ISO 4217 code, such as EUR
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | How a field states it | **A new `format: currency` on a `string`: one of the active codes of ISO 4217** | The same form as `uuid`, `email` and `uri`. A format is a shape of a text, and it fits the MECE model |
| 2 | Where the list comes from | **urn-forge ships one pinned copy of ISO 4217 list one (the active codes), with the date of its version. It never asks `Intl` or the database** | `Intl.supportedValuesOf('currency')` differs between Node versions and has codes that are no longer active. One copy gives one verdict on every machine |
| 3 | How the list reaches the checks | **The generated Valibot check and the Postgres `CHECK` hold the codes themselves** | A new version of the list then changes the generated files, and gate 4 shows the change. There is no data file to keep in step |
| 4 | A new version of the list | **A release of urn-forge. The docs say which version it holds** | ISO 4217 changes a few times a year, and rarely removes a code that is in use |
| 5 | `diff` | **A new `format: currency` on a field that callers send: breaking (a code that worked is refused). A new version of the list: as any change of a format** | The same as each format |
| 6 | Minor units for each currency (0 for JPY, 3 for KWD) | **Out of scope** | No promise asks for them: each states its own scale, or minor units |

## Scope

- **In scope:**
  - `format: currency`, its check in Valibot and Postgres, and gate 3's boundary case.
  - The pinned list, and a test that compares the generated check with it.
  - The corpus promises below, and the docs.
- **Out of scope:**
  - The minor units of each currency.
  - Exchange rates.
  - A money primitive. An embedded entity of an amount and a currency is the pair today.

## The promises that this plan can move

| Promise | After |
| --- | --- |
| subscriptions.P03 | declared, with `format: currency` |
| claims.P02 | declared, with `format: currency`; the lines use the currency of their claim |
| payments.P01 | to check: is "paired with" two fields of one entity, or must it be an embedded money entity? |
| ticketing.P02 | to check: `format: currency`, and an invariant with `all` that every amount of an order has the order's currency |
| bookings.P09 | to check: the deposit with `*`, and how the contract states the restaurant's one currency |

If they pass the strict test, 2 to 5 promises take the score from 85 to 87–90 of 143 (60.8–62.9%). The contract builders apply the same strict test as before.

## The target, written first

Step 0 adds a field with `format: currency` to the primitives fixture, and tests that:

- `EUR` and `JPY` pass;
- `XYZ`, `eur` and a code that is no longer active, such as `DEM`, are refused, in Valibot and in Postgres.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | The pinned list | The list, its version, and its source |
| 2 | `format: currency` | Valibot, Postgres, gate 3 boundary cases, `diff` |
| 3 | The corpus | The contracts; the minimum is the new score |
| 4 | Docs | The primitives page: the format and the version of the list |

## Sabotages at the end

Each must turn CI red:

1. Give `XYZ` as a currency in a subscriptions scenario that expects a success → the input is rejected.
2. Remove a code from the pinned list → the generated files change, and gate 4 fails on the committed contracts.
3. Insert `XYZ` in a Postgres currency column → the `CHECK` refuses it.

## Done

- The promises that pass the strict test are declared, and the corpus minimum is the new score.
- Each sabotage fails.
- The docs say which version of ISO 4217 urn-forge holds.

## Risks

- **The list falls behind.** A new code is refused until urn-forge ships a version with it. The docs name the version, and a contract that needs a code before then can still use a regex.
- **The size of the generated check.** About 180 codes of 3 letters: some kilobytes in the schemas file and the SQL, only for a domain that uses the format.
