# urn-forge plan: bring `self/` up to date

Nov 27, 2026 · @Shadow Smith

`self/` is urn-forge's own domain. It declares pure functions of the toolchain, and its core calls the real functions, so its scenarios test urn-forge itself. It still declares only the two functions of 0.2: `to_type_name` and `judge_version_change`. Since then, urn-forge has gained URNs, the URN namespace and gate 5, and none of them is in `self/`. Some of what is there is stale.

The limit of `self/` stays as it is: only pure functions whose result a user sees, never the reader, the model or the code generator.

## What changes

```yaml
operations:
  name_part:                 # new: the URN of a part, as the generated file, diff and gate 5 give it
    input: part
    output:
      - part_urn: [joins_the_parts]
  check_namespace:           # new: a URN namespace, as the manifest takes it
    input: namespace_candidate
    output:
      - namespace_accepted: [is_a_urn_namespace]
      - namespace_refused: [is_not_a_urn_namespace]
  judge_weaker_contract:     # new: whether the versions allow a weaker contract, as gate 5 judges it
    input: version_change
    output:
      - weaker_allowed: [the_version_changed, allows_a_breaking_change]
      - weaker_refused: [keeps_the_version_or_a_stable_major]
  judge_bound_change:        # new: whether a new argument of a bound accepts more or less, as diff judges it
    input: bound_change
    output:
      - bound_judged: [direction_by_the_form]
  to_type_name: …            # as now
  judge_version_change: …    # as now
```

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | URNs | **`name_part`: `{ namespace, domain, kind, name }` → `part_urn`, with the rule `output.urn == 'urn:' + input.namespace + ':' + input.domain + ':' + input.kind + ':' + input.name`. `kind` is `definition`, `rule` or `operation`. The core calls `partUrn`** | URNs are in each result, in `diff` and in gate 5. The rule states the format completely |
| 2 | The namespace | **`check_namespace`: a candidate → `namespace_accepted` or `namespace_refused`, with the pattern of a URN namespace as the rule of each. The core calls the `NAMESPACE` test of the manifest reader** | It is what makes a URN valid, and it changed in 0.3 |
| 3 | Gate 5's verdict | **Move the verdict of gate 5 into one exported function, `allowsWeaker(from, to)`, in `src/verify/contract.ts`, and use it in the gate. `judge_weaker_contract` calls it. Its rules: a weaker contract is allowed only when the version changed and `diff` would allow a breaking change** | Today the verdict is one line inside the gate. A function can be declared, and the gate and `self/` then use the same one |
| 4 | Argument direction | **`judge_bound_change`: a standard rule with one bound (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`, `minItems`, `maxItems`), the old bound and the new one → `narrower`, `wider` or `same`. The rule states the direction from the form: a larger bound of a `minimum` is narrower. The core gives the real `argumentDirection` the rule of the standard set** | This decides whether a change is breaking for `diff`, and whether gate 5 sees a weaker rule. `enum` and `required` are lists, and the contract cannot state set inclusion in one rule well: they stay out |
| 5 | The version | **`version` takes the pattern of `SEMVER`, the check that the manifest reader uses** | Today `self/` accepts versions, such as `1.0.0-01`, that the reader refuses. A contract that accepts more than the real function gives false confidence |
| 6 | `to_type_name` | **No change to its rule. Record that the rule language cannot state the full rule: it has no function for upper or lower case, and cannot count the underscores of a name** | The current rule is weak, but the language cannot say more. This is a finding, not a fix |
| 7 | The stale texts | **The header comment of the manifest, and `contributing/dogfooding.md`: the namespace is `urn-forge`, gaps are always errors, and the list of the operations** | They describe 0.2 |
| 8 | Out of scope | **The failure message of a rule (`fillMessage`), the fix of a code (`fixOf`), the names of Postgres, and the direction of `enum` and `required`** | Each can be a later step, one operation at a time |

## The target, written first

Step 0 adds the four operations to the manifest and their scenarios, with a core that answers wrongly for each, so that `verify` passes and `cucumber-js` fails for the reason expected. Then step 1 makes the core call the real functions.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target: the manifest, the scenarios, and a core that answers wrongly | `verify` passes; the new scenarios fail for the reason expected |
| 1 | `allowsWeaker` in `src/verify/contract.ts`, used by gate 5; the core calls `partUrn`, `NAMESPACE`, `allowsWeaker` and `argumentDirection` | Each scenario of `self/` passes; the tests of gate 5 pass |
| 2 | The version pattern, the header comment, and `contributing/dogfooding.md` | `verify:self` and the scenarios pass; the finding of decision 6 is in the guide |

## Sabotages at the end

Each must turn CI red:

1. Make `partUrn` join with `/` → the rule `joins_the_parts`, in a scenario of `self/`.
2. Make `allowsWeaker` allow a weaker contract with the same version → the rule `the_version_changed`.
3. Swap the direction of `minimum` in `argumentDirection` → the rule `direction_by_the_form`.

## Risks

- **A core that builds a rule of the standard set.** `argumentDirection` takes a rule as the compiler gives it, not a name. The core loads the standard set to find the rule. This is not a circle: the compiler does not use the output of `self/`.
- **Rules that repeat the code.** The rule of `name_part` says what `partUrn` does, in other words. That is the point of a contract. If the two disagree, a scenario fails.
