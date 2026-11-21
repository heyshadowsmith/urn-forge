# urn-forge invariants plan

Nov 21, 2026 · @Shadow Smith

An invariant is a named rule over the fields of one entity, such as "the expiry date is after the effective date" (spec §4.3, §5, pass 6, §7.1). It is the third layer of the MECE model ([primitives plan](./primitives-plan)): a field says which values one field allows, a field reference says whether the value is there and how many there are, and an invariant says which combinations of fields are allowed. Today the third layer has no spelling, so a cross-field rule lives only in the core, where the manifest, the schemas and the scenarios cannot see it.

This plan adds the `invariant` kind from the manifest through to a scenario that breaks it, and makes the insurance domain of the MVP plan the target, written first.

## What changes for a user

**Before**: a rule over two fields is code in a handler, and the input it refuses is a declared error or a bug.

**After**: the rule is in the manifest, the schema of the entity enforces it, and a scenario proves it.

```yaml
policy.invariant.term_is_positive:
  description: A policy ends after it starts
  on: policy.entity.policy
  rule: expiry_date > effective_date
  message: The expiry date must be after the effective date
```

```ts
// domain.schemas.generated.ts (generated)
export const PolicyPolicySchema = v.pipe(
  v.object({ /* … */ }),
  v.forward(
    v.check((p) => p.expiry_date > p.effective_date, 'The expiry date must be after the effective date'),
    ['expiry_date'],
  ),
);
```

```gherkin
Scenario: A policy that ends before it starts is rejected
  When I run the operation with:
    | effective_date | expiry_date |
    | 2026-06-01     | 2026-05-31  |
  Then the input is rejected by "urn:acme:insurance:policy:invariant:term_is_positive"
```

An invariant holds for every value of its entity. On an operation's input, a broken invariant is `InputRejected`. On its output, it is `ContractViolation`: the core returned a value that the domain does not allow.

## The rule language

Small on purpose (spec §4.3): no function calls, no other entity.

| Element | Form | Notes |
| --- | --- | --- |
| Field | `expiry_date` | A property name of the `on` entity |
| Number literal | `0`, `-3`, `1.5` | Typed by the other side: an `integer`, `float` or `decimal` |
| Text literal | `'2026-01-01'`, `'gold'` | Single quotes. Typed by the other side: a `string`, an `enum` value, a `decimal`, a `date` or a `timestamp`, and checked as that type |
| `true`, `false` | | `boolean` only |
| Comparison | `<` `<=` `=` `!=` `>=` `>` | Order (`<` and the others) on `integer`, `float`, `decimal`, `date` and `timestamp`; `=` and `!=` on every primitive |
| Arithmetic | `+` `-` | On `integer` and `decimal` only (spec §4.3); both sides of one primitive |
| Logic | `and`, `or`, `not`, parentheses | `not` binds tighter than `and`, and `and` tighter than `or` |
| Presence | `field is present`, `field is absent` | For an optional field |

A comparison has two sides of one primitive, so `expiry_date > effective_date` is correct and `deductible > effective_date` is a type error. Values compare as their primitive defines: `decimal` exactly, `date` as text, `timestamp` as instants.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where is the link between an invariant and its entity? | **Only `on` in the invariant.** The IR derives the entity's `invariants` list | Spec §4.2 writes the link twice, as `on` and as `invariants:` on the entity. Two places can disagree; one cannot. This is the MECE rule applied to the manifest itself |
| 2 | Does an invariant have a `description`? | **Yes, necessary**, as on every other atom | The spec's example has none, but every other kind has one, and the reference pages list it |
| 3 | What does a rule do with an optional field? | **It must be guarded.** The field can appear only where `x is present and …` or `x is absent or …` makes it present. Pass 6 refuses it elsewhere | Without the guard, `deductible > 0` on an absent deductible has no clear answer. A guard makes the answer part of the rule, where a reader sees it |
| 4 | Can a rule name a list? | **Only in `is present` and `is absent`** | The language has no functions, so it cannot count or loop. A list rule is a later decision |
| 5 | Which field does a broken invariant point at? | **The first field the rule names**, through `v.forward`. The issue also carries the invariant URN | Spec §7.1 asks for a field path and the URN. The first field is predictable and needs no new key |
| 6 | How does a scenario expect it? | **A new step: `Then the input is rejected by "<invariant URN>"`**. `rejected on "<field>"` still works too | Naming the rule proves which rule refused the input, as `fails with` names the error |
| 7 | Does gate 3 require a scenario for each invariant? | **Yes, as for declared errors**: each invariant on an operation's input entity needs a scenario that breaks it, `uncovered-invariant`, in the coverage mode | A rule that no scenario breaks is a rule nobody has seen work. Spec §8 is silent; this follows its error coverage |
| 8 | What is the target? | **The insurance domain** of the MVP plan: `insurance/` next to `self/` and the tutorial, with a manifest, a core, features and a CI profile, written first | The MVP plan named it for Milestone 3. Dates, decimals, an optional deductible and a cancellation give every part of the language a real use |
| 9 | Diagnostics | **Four new codes:** `rule-syntax` (with the column in the rule), `unknown-rule-field`, `rule-type` and `unguarded-field`; `wrong-ref-kind` for an `on` that is not an entity | One code for one kind of problem, so a fix is clear from the code |
| 10 | What does the IR keep? | **The parsed rule (an AST) and its canonical text**, both in the fingerprint | Spec §5 keeps the AST. The canonical text gives messages and docs one spelling of each rule |
| 11 | One PR or one per step? | **One PR**, one commit per step, as for the primitives | The steps share the kind, the plugins and the docs |

## Scope

**In:** the `invariant` kind; the rule parser, printer and type checker (pass 6); `on` in pass 4; Valibot translation; the runtime's issue with the invariant URN and `ContractViolation` for an output; the new step; gate 3 coverage; the insurance domain in CI; the docs.

**Out:** invariants across entities (spec: single-entity only); rules over list items; SQL `CHECK` (no Postgres plugin yet); lifecycle fields on invariants (pass 8 is not built).

## The target, written first

Step 0 writes `insurance/`: a policy entity with `policy_id` (`string`, `format: uuid`), `effective_date` and `expiry_date` (`date`), `premium` (`decimal`, `scale: 2`, `exclusiveMin: "0"`) and an optional `deductible` (`decimal`, `scale: 2`). Two invariants:

- `term_is_positive`: `expiry_date > effective_date`;
- `deductible_below_premium`: `deductible is absent or deductible < premium`.

Two operations: `issue_policy` (input a policy, output the policy) and `cancel_policy`, with a declared error `policy_not_started` when the cancellation date is before the effective date (a state rule, so it stays in the core). The features break each invariant, cover every boundary, and expect the error. Until the kind exists, `compile` refuses the manifest with `unsupported-kind`; that is the check of step 0.

## Build order

One PR (decision 11), one commit per step. Each step leaves the repository green and ends with a check.

- [x] **0. The target.** `insurance/` as above, not yet in CI. *Check:* `compile` reports `unsupported-kind` for each invariant and nothing else.
  - *Done*, with one change to the target. The core is stateless, so a cancellation carries the policy terms it needs, and "the cancellation date is inside the term" is a data rule: a third invariant, `cancellation_within_term`. The declared error became a computed rule instead: `refund_below_minimum`, when the refund for the unused days is below 1.00. The check was met: three `unsupported-kind`, nothing else.
- [x] **1. The rule language.** A parser to an AST, a printer to canonical text, and a type checker over a map of property names to primitive, required and list. *Check:* unit tests for each element; `print(parse(text))` is stable; each type and guard error has its message and column.
  - *Done* in `src/rules/`. Number literals keep their text, so a decimal literal stays exact. `x is present` on a required field is a `rule-type` error ("is always true"), so a guard cannot hide a mistake.
- [x] **2. The kind.** `invariant` joins the kind registry: the meta-schema, `on` in pass 4, pass 6 with the type checker, the IR (`invariants`, and each entity's derived list), the fingerprint, the four codes. *Check:* the insurance manifest compiles to an IR; fixtures for each new diagnostic.
  - *Done*, with decision 1 applied to the IR too: an entity does not list its invariants, and `invariantsOf(ir, entity)` finds them by `on`. A kind can now declare that it builds `after` other kinds and read their nodes, so pass 6 sees the entity's fields. The dogfood domain caught the new kind twice: `self/`'s kind `enum` had to list `invariant` (gate 1), and `to_urn` then needed an example of it (gate 3). Fixture: `invalid-rules`.
- [x] **3. Valibot.** Each entity with invariants becomes `v.pipe(v.object(…), v.forward(v.check(…), [field]), …)`. Comparisons use the primitive's rules, with the decimal helpers. A plugin that does not support the kind gets `unsupported-construct`. *Check:* the generated schema refuses each broken rule at its first field; tests through the `primitives`-style fixture.
  - *Done* (steps 3 and 4 are one commit). Each rule is an exported `<Brand>Rule` function. Gate 1 found that TypeScript does not compare two branded strings, such as two dates, so the generated rule widens each field to its plain type. Fixture `rules` has one invariant per operator on each primitive; the tests run each rule at its edges. One test caught a wrong hand calculation of mine, not a bug: `1.1 + 2.2` is exactly `3.30`.
- [x] **4. The runtime.** An issue from an invariant carries `invariantUrn`. A broken invariant on the output is `ContractViolation`. *Check:* a core that returns an output that breaks an invariant gets `ContractViolation` with the URN.
  - *Done.* The runtime knows the invariant of an issue by its `requirement`: Valibot keeps the function of a failed check on the issue, and the contract lists each rule function with its URN.
- [x] **5. Steps and gate 3.** `Then the input is rejected by "<invariant URN>"`; gate 3 resolves invariant tags and URNs in that step, refuses an invariant that is not on the operation's input entity, and reports `uncovered-invariant` in the coverage mode. *Check:* a scenario removed from the insurance features gives exactly one `uncovered-invariant`.
  - *Done*, with two more codes than decision 9 lists: `undeclared-invariant` (a step names an invariant that is not on the input entity) and `uncovered-invariant`. The summary adds `N/M invariants broken`. The insurance features passed 20 of 20 at the first run.
- [x] **6. Ship the target.** `insurance/` joins CI (verify and Cucumber), strict from the start. The docs gain the kind, the language, the step and the codes, and an explanation of the third layer. *Check:* CI green; every sabotage below fails.
  - *Done.* Both CI jobs run insurance. Each sabotage below was run on a copy of insurance, with the result in the table.

## Done

Invariants are done when CI is green with `insurance/` strict, and each of these fails `compile` or `verify`:

| Sabotage | What catches it | Result |
| --- | --- | --- |
| `rule: expiry_date > ` (incomplete) | Pass 6, `rule-syntax` at the column | Caught: `expected a field, a literal or "(", found the end of the rule` |
| A rule that names `expiry` (no such field) | Pass 6, `unknown-rule-field` | Caught |
| `premium > effective_date` | Pass 6, `rule-type` | Caught: `">" has a decimal on the left and a date on the right` |
| `deductible < premium` with an optional deductible | Pass 6, `unguarded-field` | Caught |
| `on:` an operation | Pass 4, `wrong-ref-kind` | Caught |
| The core issues a policy that ends on its first day | Cucumber: `ContractViolation` with the invariant URN | Caught: 3 scenarios fail with `ContractViolation (expiry_date: The expiry date must be after the effective date)` |
| The scenario that breaks `term_is_positive` removed | Gate 3, `uncovered-invariant` | Caught |

**Met.**

## Risks

- **Two evaluators.** Gate 3 does not run rules, so only the generated code evaluates them. If the type checker and the translation disagree, a rule can compile and still mean something else at run time. Step 3 tests each operator on each primitive through generated schemas.
- **Language growth.** Each new operator is a decision about types for every primitive. The table above is the whole language until a plan changes it.
- **Optional-field guards.** The guard rule (decision 3) is a small flow analysis. It handles `and` and `or` with a guard on the left; anything cleverer is refused with `unguarded-field`, which can feel strict. The message says how to write the guard.
- **Rules and boundary coverage.** Gate 3 asks for a scenario that breaks each invariant, not for the edges of a rule (for example `expiry_date` one day after `effective_date`). Edge cases of rules can come later.
