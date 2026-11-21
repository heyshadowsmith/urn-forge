# What the gates show

`urn-forge verify` runs gates, and a build that passes is a strong signal. But each gate shows one specific thing, and nothing more. This page tells what each gate shows, what it cannot show, and why the gates and the Cucumber run are separate.

## Conformance, not correctness

Specification v1.0 used words such as "mathematically guaranteed" and "proof". [Specification v1.1](../project/spec-v1-1) changed them to "gate" and "check", with stated limits. The reason is in its first section:

> The gates show *conformance*: every operation has a handler with the generated signature, every boundary crossing is parsed, every bounded field has boundary scenarios, and no generated file was edited by hand. They do not show that handler logic is *correct*. That remains the job of the tests the gates require to exist.

Conformance means that the parts agree with the manifest. Correctness means that the domain does the right thing. Only a person can say what the right thing is, and the scenarios are where they say it.

## What each gate shows

`verify` runs gates 1, 2, 3 and 4. Gate 5 compares two manifests, so it is the separate command `urn-forge diff`. `verify` says so:

```
gate 1  completeness  PASS  tsc: 0 error(s) over self/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  3 feature(s), 17 scenario(s), 3/3 operations tagged, 2/2 errors expected, strict: 3/3 features (boundaryCoverage: error)
gate 4  drift         PASS  2 generated file(s) compared byte for byte against self/generated
verify passed (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

| Gate | It shows | It cannot show |
| --- | --- | --- |
| 1. Completeness | Every operation has a handler of the generated type. The core uses `satisfies DomainCoreImplementation`, and the name resolves to the generated file, not to a copy | That a handler computes the correct value. That the types are true: gate 2 examines that |
| 2. Boundary discipline | No core file and no shell file makes a branded value without a parse. There is no type assertion to a branded type, no `any` where a branded type belongs, and no `@ts-` comment that turns off a check. The core does not import a parser as a value | A forged value from a file that gate 2 does not examine. A wrong value that a parse accepts |
| 3. Gherkin | Every `@urn:` tag resolves. Every operation has a tagged feature. Table headers are fields. The input table has each required column. Each expected error is declared, and each declared error has a scenario. Each invariant of an operation input has a scenario that breaks it. The boundary values are present | That a scenario passes. That its expected values are correct. That a boundary scenario expects the correct outcome |
| 4. Drift | Each committed generated file is equal, byte for byte, to a fresh compile. No committed generated file is left without a source | That the manifest is correct |
| 5. Compatibility (`urn-forge diff`) | No change to a live URN can break a caller that sends it, a caller that receives it, or a row that a table stores | A change of meaning that keeps the schema. A consumer that the manifest and the configuration do not show. That a change that it calls breaking really breaks a consumer |

Some limits need more words:

- **Gate 1 sees the types, not the values.** A handler that returns `ok({ price_cents: 0 })` for every parcel passes gate 1.
- **Gate 2 sees only the files that it examines.** These are the core entry, the files that it imports in its directory, and the `shell` setting. A helper in a different directory, a library or a test can forge a value, and gate 2 does not see it. A project can add such a directory to `shell`. [The functional core and brands](./functional-core) tells why gate 2 exists.
- **Gate 2 sees brands, not all types.** An `any` or an assertion that does not touch a brand passes. Gate 2 looks into a type to a depth of four levels, so a brand deeper in a large object is not found. A value of type `unknown` cannot get a brand without an assertion, which gate 2 refuses.
- **Gate 3 counts values, it does not judge them.** A scenario that sends `-1` to a field with `min: 0` covers the boundary, even if the scenario expects success. The Cucumber run then fails, and that is the correct result. But gate 3 alone does not see the problem. [Boundary coverage and the ratchet](./boundary-coverage) tells more.
- **Gate 3 does not run the rules.** It sees that a scenario names an invariant in `the input is rejected by`. Only the Cucumber run shows that the rule refuses that input.
- **Gate 4 trusts the manifest.** If the manifest says that a divisor can be zero, the generated schema accepts zero, and gate 4 agrees.
- **Gate 5 sees the values, not the meaning.** If a field of cents becomes a field of euros with the same constraints, `diff` finds no change. A new `description` is compatible.
- **Gate 5 is safe, not exact.** It cannot compare two regular expressions or two rules, so it calls each such change breaking. Refer to [Compatibility and the direction of use](./compatibility).
- **Gate 5 knows only the uses that it can see.** It finds callers from the operations, and stored rows from the `tables` of the `postgres` plugin. Without `--config`, a stored field can look unused.

## Static checks and the Cucumber run

`verify` reads the code and the features. It does not run them. The Cucumber run is a separate step that sends each scenario through `executeOperation`. CI runs both, as separate steps, so a failure in one does not hide a failure in the other.

The two checks find different problems:

- **Only a static check can find what is absent.** An operation with no scenario does not make a Cucumber run fail, because the run has nothing to run. The same is true for a declared error that no scenario expects, for an invariant that no scenario breaks, and for a boundary value that no scenario sends. Gate 3 reads every feature and compares it with the IR, so it finds these cases.
- **Only a run can find wrong behavior.** Gate 3 cannot tell if `1600` is the correct price for an express parcel of 2500 grams. The run calls the handler and compares.

The static checks also give a position. Most problems have a file, a line and a column, and a URN where one applies.

## The limits of a build that passes

A build that passes says that the chain is complete:

- Each operation in the manifest has a handler of the correct type.
- No core file and no shell file forges a brand.
- Each operation has scenarios that use real field names and that include the boundary values.
- Each scenario passes.
- Nobody edited a generated file.
- If CI also runs `urn-forge diff`, gate 5 found no breaking change to a live URN.

It does not say that the domain is correct, that the scenarios test the important cases, or that the manifest describes the business well. These questions need people. The gates make sure that the place where people answer them, the scenarios, exists and stays connected to the code.

## Related pages

- [Verification gates](../reference/verification-gates)
- [Fix a gate that fails](../how-to/fix-a-failing-gate)
- [Run verify in CI](../how-to/run-verify-in-ci)
- [The traceability chain](./traceability)
- [Boundary coverage and the ratchet](./boundary-coverage)
