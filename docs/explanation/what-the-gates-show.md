# What the gates show

`urn-forge verify` runs gates, and a build that passes is a strong signal. But each gate shows one specific thing, and nothing more. This page tells what each gate shows, what it cannot show, and why the gates and the Cucumber run are separate.

## Conformance, not correctness

Specification v1.0 used words such as "mathematically guaranteed" and "proof". [Specification v1.1](../project/spec-v1-1) changed them to "gate" and "check", with stated limits. The reason is in its first section:

> The gates show *conformance*: every operation has a handler with the generated signature, every boundary crossing is parsed, every bounded field has boundary scenarios, and no generated file was edited by hand. They do not show that handler logic is *correct*. That remains the job of the tests the gates require to exist.

Conformance means that the parts agree with the manifest. Correctness means that the domain does the right thing. Only a person can say what the right thing is, and the scenarios are where they say it.

## What each gate shows

`verify` runs gates 1, 3 and 4. urn-forge does not have gate 2 at this time. Gate 5 compares two manifests, so it is the separate command `urn-forge diff`. `verify` says so:

```
gate 1  completeness  PASS  tsc: 0 error(s) over self/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  3 feature(s), 18 scenario(s), 3/3 operations tagged, 3/3 errors expected, strict: 3/3 features (boundaryCoverage: error)
gate 4  drift         PASS  2 generated file(s) compared byte for byte against self/generated
verify passed (gates 1, 3, 4; gate 2 is not built; gate 5 is urn-forge diff)
```

| Gate | It shows | It cannot show |
| --- | --- | --- |
| 1. Completeness | Every operation has a handler of the generated type. The core uses `satisfies DomainCoreImplementation`, and the name resolves to the generated file, not to a copy | That a handler computes the correct value. A type assertion can also hide a wrong type from `tsc` |
| 3. Gherkin | Every `@urn:` tag resolves. Every operation has a tagged feature. Table headers are fields. The input table has each required column. Each expected error is declared, and each declared error has a scenario. Each invariant of an operation input has a scenario that breaks it. The boundary values are present | That a scenario passes. That its expected values are correct. That a boundary scenario expects the correct outcome |
| 4. Drift | Each committed generated file is equal, byte for byte, to a fresh compile. No committed generated file is left without a source | That the manifest is correct |
| 2. Boundary discipline (not built) | The core does not make a false brand | — |
| 5. Compatibility (not built) | No change breaks a URN that consumers use | — |

Some limits need more words:

- **Gate 1 sees the types, not the values.** A handler that returns `ok({ price_cents: 0 })` for every parcel passes gate 1. Without gate 2, a handler can also use `as` to make `tsc` accept a value of the wrong type.
- **Gate 3 counts values, it does not judge them.** A scenario that sends `-1` to a field with `min: 0` covers the boundary, even if the scenario expects success. The Cucumber run then fails, and that is the correct result. But gate 3 alone does not see the problem. [Boundary coverage and the ratchet](./boundary-coverage) tells more.
- **Gate 3 does not run the rules.** It sees that a scenario names an invariant in `the input is rejected by`. Only the Cucumber run shows that the rule refuses that input.
- **Gate 4 trusts the manifest.** If the manifest says that a divisor can be zero, the generated schema accepts zero, and gate 4 agrees.

## Static checks and the Cucumber run

`verify` reads the code and the features. It does not run them. The Cucumber run is a separate step that sends each scenario through `executeOperation`. CI runs both, as separate steps, so a failure in one does not hide a failure in the other.

The two checks find different problems:

- **Only a static check can find what is absent.** An operation with no scenario does not make a Cucumber run fail, because the run has nothing to run. The same is true for a declared error that no scenario expects, for an invariant that no scenario breaks, and for a boundary value that no scenario sends. Gate 3 reads every feature and compares it with the IR, so it finds these cases.
- **Only a run can find wrong behavior.** Gate 3 cannot tell if `1600` is the correct price for an express parcel of 2500 grams. The run calls the handler and compares.

The static checks also give a position. Most problems have a file, a line and a column, and a URN where one applies.

## The limits of a build that passes

A build that passes says that the chain is complete:

- Each operation in the manifest has a handler of the correct type.
- Each operation has scenarios that use real field names and that include the boundary values.
- Each scenario passes.
- Nobody edited a generated file.

It does not say that the domain is correct, that the scenarios test the important cases, or that the manifest describes the business well. These questions need people. The gates make sure that the place where people answer them, the scenarios, exists and stays connected to the code.

## Related pages

- [Verification gates](../reference/verification-gates)
- [Fix a gate that fails](../how-to/fix-a-failing-gate)
- [Run verify in CI](../how-to/run-verify-in-ci)
- [The traceability chain](./traceability)
- [Boundary coverage and the ratchet](./boundary-coverage)
