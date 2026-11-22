# Add an invariant

Add an invariant: a named rule over the fields of one entity, which the schema of the entity enforces.

## Before you start

- You have an entity with the fields that the rule compares. Refer to [Add an entity](add-an-entity).
- The entity is the input of an operation with a tagged feature.
- Use an invariant only for a rule over the fields of one entity. If the rule needs other data, such as a stored state, return a declared error from the core. Refer to [Declare an error](declare-an-error).

## Steps

1. Add an entry with the short key `<context>.invariant.<identifier>`. Give `description`, `on`, `rule` and `message`. `on` is the short key of the entity.
2. If the rule uses an optional field, guard it on the left: `x is absent or …`, or `x is present and …`. Without a guard, `compile` stops with `unguarded-field`.
3. Run `npx urn-forge compile`. If the rule is not correct, `compile` writes no files. The problem gives the line in the manifest and the column in the rule.
4. Add a scenario that sends an input that breaks the rule. Give every other field a correct value. End the scenario with `Then the input is rejected by "<invariant URN>"`.
5. Run `npx urn-forge verify`.

For the operators and the types that they accept, refer to [The rule language](../reference/rule-language).

## Example

The insurance domain refuses a policy that does not end after it starts. It also refuses a deductible that is not less than the premium:

```yaml
policy.invariant.term_is_positive:
  description: A policy ends after it starts
  on: policy.entity.policy
  rule: expiry_date > effective_date
  message: The expiry date must be after the effective date
policy.invariant.deductible_below_premium:
  description: A deductible, when there is one, is less than the premium
  on: policy.entity.policy
  rule: deductible is absent or deductible < premium
  message: The deductible must be less than the premium
```

The scenario sends the edge of the rule too. `2026-06-01` makes the expiry date equal to the effective date, which `>` refuses:

```gherkin
  Scenario Outline: A policy that does not end after it starts is rejected
    When I run the operation with:
      | policy_id                            | holder                               | effective_date | expiry_date   | premium | coverages                         |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-06-01     | <expiry_date> | 120.00  | [{ peril: fire, limit: 1000.00 }] |
    Then the input is rejected by "urn:acme:insurance:policy:invariant:term_is_positive"

    Examples:
      | expiry_date |
      | 2026-06-01  |
      | 2026-05-31  |
```

If the rule names a field that the entity does not have, `compile` stops:

```
insurance/domain.manifest.yaml:122:9  error  unknown-rule-field  urn:acme:insurance:policy:invariant:term_is_positive: rule: "expiry" is not a field of the entity (fields: policy_id, holder, coverages, effective_date, expiry_date, premium, deductible) (at column 1 of the rule)
```

If no scenario breaks an invariant, gate 3 reports `uncovered-invariant`. An invariant also holds for the output. If the core returns an output that breaks it, the result is `ContractViolation`. Correct the handler, not the invariant.

The issue of a broken invariant is on the first field that the rule names. To put it on a different field, set `reportOn` to a property name that the rule names.

## Result

The gate 3 summary of `npx urn-forge verify` shows that a scenario breaks each invariant:

```
gate 3  gherkin       PASS  2 feature(s), 15 scenario(s), 2/2 operations tagged, 1/1 errors expected, 2/2 events expected, 1/1 records expected, 5/5 invariants broken, strict: 2/2 features (boundaryCoverage: error)
```

## Related pages

- [The rule language](../reference/rule-language)
- [Gherkin steps](../reference/gherkin-steps)
- [Fix a gate that fails](fix-a-failing-gate)
