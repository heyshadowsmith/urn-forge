# Add an invariant

An invariant is a named rule over the fields of one entity, for example "the expiry date is after the effective date". The schema of the entity enforces the rule, and a scenario shows that the rule refuses a bad input. This guide declares an invariant, compiles it, adds the scenario that breaks it and verifies the result.

The examples come from `packages/urn-forge/insurance/`, which CI tests. The invariant `term_is_positive` refuses a policy that does not end after it starts. The invariant `limit_is_positive` refuses a coverage that pays nothing, inside each policy that embeds it.

## Before you start

- You have an entity with the fields that the rule compares. Refer to [Add an entity](add-an-entity).
- The entity is the input of an operation that has a tagged feature. Refer to [Add an operation](add-an-operation).
- Use an invariant only for a rule over the fields of one entity. If the rule needs other data, such as a stored state, put it in the core as a declared error. Refer to [Declare an error](declare-an-error).

## 1. Write the invariant

Add an entry with the short key `<context>.invariant.<identifier>`. The insurance manifest has four invariants (highlighted):

<<< @/../packages/urn-forge/insurance/domain.manifest.yaml{114-133 yaml}

| Key | Value |
| --- | --- |
| `description` | Necessary. What the rule means |
| `on` | Necessary. The short key of the entity whose fields the rule compares |
| `rule` | Necessary. The rule, in the rule language |
| `message` | Necessary. The text of the issue when the rule does not hold |

- Do not list the invariant on the entity. The link is `on` only, so the two places cannot disagree.
- One entity can have more than one invariant. `policy.entity.policy` has two.
- The rule can name only properties of the `on` entity. To make a rule over the fields of an embedded entity, put `on` on the embedded entity. `limit_is_positive` is on `policy.entity.coverage`, not on the policy.

A rule compares fields and literals:

- `expiry_date > effective_date` compares two fields of one primitive.
- `cancellation_date >= effective_date and cancellation_date <= expiry_date` joins two comparisons with `and`.
- A text literal is in single quotes, for example `'2026-01-01'` for a `date`. The other side of the comparison gives its type.

For each operator and the types that it accepts, refer to [The rule language](../reference/rule-language).

### Compare a link or an embedded entity

A link holds the value of the key of its target. Thus, a rule compares a link as a value of the primitive of the key. For example, `holder` of the policy is a `string`, because `customer.field.customer_id` is a `string`. A rule can compare it with a text literal, for example `holder != '00000000-0000-0000-0000-000000000000'`. A comparison with a different primitive gives `rule-type`. Here the rule is `holder > premium`:

```
insurance/domain.manifest.yaml:122:9  error  rule-type  urn:acme:insurance:policy:invariant:term_is_positive: rule: ">" has a string on the left and a decimal on the right; both sides must have one primitive (at column 1 of the rule)
```

An embedded entity, or a list, has no value to compare. A rule can use it only in `is present` and `is absent`. Here the rule is `coverages > premium`:

```
insurance/domain.manifest.yaml:122:9  error  rule-type  urn:acme:insurance:policy:invariant:term_is_positive: rule: "coverages" is a list; a rule can use it only in "coverages is present" or "coverages is absent" (at column 1 of the rule)
```

For a single embedded entity, the message says `is an embedded entity` in place of `is a list`. A guard is useful only if the property is optional. If `coverages` is required, `coverages is present` gives `rule-type` too, because it is always true.

## 2. Guard an optional field

If a field has `required: false`, the rule must guard it on the left side:

- `deductible is absent or deductible < premium` holds when there is no deductible.
- `deductible is present and deductible < premium` does not hold when there is no deductible.

Select the guard that gives the correct answer for an absent value. `deductible_below_premium` uses `is absent or`, because a policy without a deductible is correct.

If you write `deductible < premium` without a guard, `compile` stops:

```
insurance/domain.manifest.yaml:127:9  error  unguarded-field  urn:acme:insurance:policy:invariant:deductible_below_premium: rule: "deductible" is optional, so the rule must guard it: write "deductible is present and …" or "deductible is absent or …" (at column 1 of the rule)
```

## 3. Compile

Run this command:

```bash
npx urn-forge compile --config insurance/urn-forge.config.ts
```

```
insurance/domain.manifest.yaml:79:12  warning  deprecated-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, which is deprecated (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30)
wrote      insurance/generated/domain.runtime.generated.ts
wrote      insurance/generated/domain.schemas.generated.ts
wrote      insurance/generated/schema.generated.sql
fingerprint sha256:957beb20d7d7f9f6d395ce04f1fcb67c71fa406c51f82bf94bdc7a06871ba427
```

The `deprecated-ref` warning is about the field `note`, which the insurance domain retires. It does not stop `compile`. Refer to [Retire a URN](retire-a-urn).

The schema of the entity now checks each of its invariants. If a rule does not hold, the issue points at the first field that the rule names. For `term_is_positive`, that field is `expiry_date`. The issue also carries the URN of the invariant in `invariantUrn`. For an invariant of an embedded entity, the path of the issue goes into the object, for example `coverages.0.limit`. Refer to [The generated schemas](../reference/generated-schemas).

The insurance domain also enables the `postgres` plugin. It writes each invariant as a `CHECK` constraint with the identifier of the invariant as its name, for example `term_is_positive`. Refer to [Store entities in Postgres](store-in-postgres).

## 4. Fix the rule problems

Pass 6 examines each rule against the fields of its entity. If a rule is not correct, `compile` writes no files. Each problem gives the line and column of the rule in the manifest, and the column in the rule.

### `rule-syntax`

The rule is not complete, or it has a word that the language does not know. Here the rule is `expiry_date >`:

```
insurance/domain.manifest.yaml:122:9  error  rule-syntax  urn:acme:insurance:policy:invariant:term_is_positive: rule: expected a field, a literal or "(", found the end of the rule (at column 14 of the rule)
```

To fix it, complete the rule at the column that the message gives.

### `unknown-rule-field`

The rule names a field that the entity does not have. Here the rule is `expiry > effective_date`:

```
insurance/domain.manifest.yaml:122:9  error  unknown-rule-field  urn:acme:insurance:policy:invariant:term_is_positive: rule: "expiry" is not a field of the entity (fields: policy_id, holder, coverages, effective_date, expiry_date, premium, deductible) (at column 1 of the rule)
```

To fix it, use a name from the `fields` list. If the field is not on the entity, add it to the entity, or set `on` to a different entity.

### `rule-type`

The two sides of a comparison have different primitives. Here the rule is `premium > effective_date`:

```
insurance/domain.manifest.yaml:122:9  error  rule-type  urn:acme:insurance:policy:invariant:term_is_positive: rule: ">" has a decimal on the left and a date on the right; both sides must have one primitive (at column 1 of the rule)
```

A text literal that is not a value of the other side also gives `rule-type`. Here the rule is `expiry_date > '2026-1-1'`:

```
insurance/domain.manifest.yaml:122:9  error  rule-type  urn:acme:insurance:policy:invariant:term_is_positive: rule: '2026-1-1' is not a date in quotes, such as '2026-01-31', so it cannot meet a date in ">" (at column 1 of the rule)
```

To fix it, compare values of one primitive, and write each literal in the form of that primitive.

### `unguarded-field`

The rule uses an optional field without a guard. Step 2 shows this problem and its fix.

### `wrong-ref-kind`

`on` names an atom that is not an entity. Here `on` is `policy.operation.issue_policy`:

```
insurance/domain.manifest.yaml:121:7  error  wrong-ref-kind  urn:acme:insurance:policy:invariant:term_is_positive: on "policy.operation.issue_policy" must name an entity, but urn:acme:insurance:policy:operation:issue_policy is an operation
```

To fix it, set `on` to the entity that the operation uses as its input.

## 5. Add the scenario that breaks the invariant

Add a scenario that sends an input that breaks the rule. End it with `Then the input is rejected by "<invariant URN>"`. The last three scenarios of the feature break the invariant of the coverage and the two invariants of the policy (highlighted):

<<< @/../packages/urn-forge/insurance/features/issue_policy.feature{69-95 gherkin}

- Send every other field with a correct value. Then only the invariant refuses the input.
- Send the edge of the rule too. `2026-06-01` makes the expiry date equal to the effective date, which `>` refuses.
- The step must name an invariant of the input entity of the operation, or of an entity that the input embeds. If not, gate 3 fails with `undeclared-invariant`.
- To break an invariant of an embedded entity, send one object that breaks it. Lines 69 to 73 send `[{ peril: fire, limit: 0 }]` for `limit_is_positive`.
- `Then the input is rejected on "expiry_date"` also passes, but it does not name the rule. Gate 3 counts only the `rejected by` step.

Run the scenarios:

```bash
npx cucumber-js --profile insurance --name "does not end after it starts"
```

```
......

2 scenarios (2 passed)
6 steps (6 passed)
0m 0.014s (0m 0.004s executing your code)
```

In your project, run `npx cucumber-js`. If a different rule refuses the input, the step fails. Here the step names `deductible_below_premium`:

```
Error: urn:acme:insurance:policy:operation:issue_policy rejected the input, but not by urn:acme:insurance:policy:invariant:deductible_below_premium: InputRejected (expiry_date: The expiry date must be after the effective date)
```

An issue of an embedded entity shows its nested path. Here the scenario of lines 69 to 73 names `term_is_positive`:

```
Error: urn:acme:insurance:policy:operation:issue_policy rejected the input, but not by urn:acme:insurance:policy:invariant:term_is_positive: InputRejected (coverages.0.limit: The limit of a coverage must be more than 0)
```

## 6. Verify

Run this command:

```bash
npx urn-forge verify --config insurance/urn-forge.config.ts
```

The gate 3 summary counts the invariants that a scenario breaks:

```
gate 3  gherkin       PASS  2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 4/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
```

Each invariant on the input entity of a tagged operation needs a scenario that breaks it. An invariant of an entity that the input embeds counts as an invariant of the input. If no scenario breaks one, gate 3 reports `uncovered-invariant`. The insurance features are strict, so it is an error. Here the scenario of lines 69 to 73 is not there:

```
gate 3  gherkin       FAIL  2 feature(s), 12 scenario(s), 2/2 operations tagged, 1/1 errors expected, 3/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features  error  uncovered-invariant  invariant urn:acme:insurance:policy:invariant:limit_is_positive on the input of urn:acme:insurance:policy:operation:issue_policy has no scenario that breaks it; add one with Then the input is rejected by "urn:acme:insurance:policy:invariant:limit_is_positive"
```

In a feature that is not strict, it is a warning. Refer to [Adopt strict coverage](adopt-strict-coverage). For `undeclared-invariant`, refer to [Fix a gate that fails](fix-a-failing-gate).

## 7. Find a broken invariant on the output

An invariant holds for every value of its entity, also for an output. `issue_policy` returns a policy, so its output must obey `term_is_positive` too.

If the core returns an output that breaks an invariant, the result is `ContractViolation`, not `InputRejected`. This shows a bug in the core. Gate 1 does not find it, because the types are correct. Only a scenario finds it.

For example, a handler of `issue_policy` that returns `expiry_date: policy.effective_date` fails each scenario that expects an output:

```
Error: urn:acme:insurance:policy:operation:issue_policy did not succeed: ContractViolation (expiry_date: The expiry date must be after the effective date)
```

`executeOperation` gives this result to the shell. The issue has the URN of the invariant:

```json
{
  "ok": false,
  "kind": "ContractViolation",
  "urn": "urn:acme:insurance:policy:operation:issue_policy",
  "issues": [
    {
      "path": "expiry_date",
      "fieldUrn": "urn:acme:insurance:policy:field:expiry_date",
      "invariantUrn": "urn:acme:insurance:policy:invariant:term_is_positive",
      "message": "The expiry date must be after the effective date"
    }
  ]
}
```

To fix it, correct the handler. Do not remove the invariant to make the scenario pass. Refer to [Call an operation from the shell](call-an-operation).

## Result

`npx urn-forge verify` passes, and the summary shows that a scenario breaks each invariant. The warning and the note come from the retired field `note`:

```
insurance/domain.manifest.yaml:79:12  warning  deprecated-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, which is deprecated (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30)
note: sunset dates are not checked: set --reference-date or referenceDate in the config
gate 1  completeness  PASS  tsc: 0 error(s) over insurance/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 4/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
gate 4  drift         PASS  3 generated file(s) compared byte for byte against insurance/generated
verify passed with 1 warning(s) (gates 1, 3, 4; gate 2 is not built; gate 5 is urn-forge diff)
```

## Related pages

- [The rule language](../reference/rule-language)
- [The manifest](../reference/manifest)
- [Gherkin steps](../reference/gherkin-steps)
- [Fix a gate that fails](fix-a-failing-gate)
- [The MECE model of primitives](../explanation/primitives-model)
