# How urn-forge proves it

urn-forge makes sure that one name connects the declaration of an operation, the code that implements it and the scenarios that test it. This page tells how that chain works, what each gate shows and cannot show, and why the same manifest always gives the same bytes.

## One name through the chain

The operation `quote_shipping` of the [tutorials](../tutorials/first-domain) occurs in each link of the chain:

1. **The manifest.** You declare the operation:

   ```yaml
   operations:
     quote_shipping:
       description: Calculate the price to send a parcel
       input: parcel
       output:
         - quote: [fits_express]
         - too_heavy_for_express: [over_express_limit, names_the_weight]
   ```

2. **The generated code.** `compile` writes the type of the core, with the name of the operation as a key:

   ```ts
   export interface DomainCore {
     /** Calculate the price to send a parcel */
     readonly quote_shipping: (input: Parcel) => QuoteShippingAnswer;
   }
   ```

3. **The core.** Your function has the same name. The `satisfies DomainCore` clause connects it to the generated type.
4. **The features.** The steps name the operation, its outputs, and the rules that a scenario breaks:

   ```gherkin
   When I run "quote_shipping" with:
   Then the output is "too_heavy_for_express":
   Then the input is rejected by "maximum" of "weight_grams"
   ```

5. **The gates.** `urn-forge verify` examines the links without a run of the code.

A Cucumber run then sends each scenario through `runOperation`. Thus the scenario tests the function that the manifest declares, through the harness that checks the contract, and no other code.

Many tools make TypeScript types from a schema. None of them can tell you that a declared operation has a function and a scenario for each of its outputs, or that each rule has a scenario that breaks it. These questions need names that all the parts share, and a check that reads all the parts.

## Conformance, not correctness

The gates show *conformance*: the parts agree with the manifest. They do not show that the logic of the core is *correct*. Only a person can say what the correct result is, and the scenarios are where they say it. The gates make sure that those scenarios exist and stay connected to the code. The harness makes sure that each answer, correct or not, stays inside the contract.

`verify` runs gates 1 to 4. For urn-forge's own domain, `packages/urn-forge/self`, it shows:

```
gate 1  completeness  PASS  tsc: 0 error(s) over core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  2 feature(s), 24 scenario(s), 2/2 operation(s) run, 9 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against generated
verify passed (gates 1, 2, 3, 4)
```

| Check | It shows | It cannot show |
| --- | --- | --- |
| 1. Completeness | Every operation has a function of the generated type, through `satisfies DomainCore` | That a function computes the correct value. A function that returns a price of `0` for every parcel passes |
| 2. Boundary | No shell file calls the core without the harness, and no file turns off the type check | A call from a file that gate 2 does not examine |
| 3. Gherkin | Every step names a real operation, output, definition and rule; every operation, output and rule of a definition has a scenario | That a scenario passes, or that its expected values are correct |
| 4. Drift | Each generated file is equal, byte for byte, to a new compile | That the manifest is correct |
| The harness, at run time | Each input and each answer keeps the rules of the manifest | That the core selected the correct output among the allowed ones |
| `urn-forge diff` | No change can break a caller without a new major version | A change of meaning that keeps the values, for example cents that become euros |

`verify` reads the code and the features. It does not run them. The Cucumber run is a separate step, and CI runs both. The two find different problems:

- **Only a static check can find what is absent.** An output with no scenario does not make a Cucumber run fail, because the run has nothing to run. Gate 3 compares every feature with the manifest, so it finds the gap.
- **Only a run can find wrong behaviour.** Gate 3 cannot tell if `1600` is the correct price for a parcel. The run calls the core through the harness and compares.

## Why the rules of outputs need no breaking scenario

Gate 3 asks for a scenario that breaks each rule of a definition, because a rule that no scenario breaks may be wrong without a sign: it may accept each value. A scenario that breaks it shows that it refuses.

The rules of an output are different. They hold for each answer of the core, and the harness checks them on each scenario that runs the operation. A scenario cannot break them without a wrong core. The edges of these rules are where a wrong core passes, so add scenarios at the edges. [Tutorial 3](../tutorials/strict-coverage) shows a core that is wrong by one, which only an edge scenario finds.

## Warn, then make it an error

If a gap failed the build from the first day, a team with a large manifest could not adopt urn-forge. Thus a gap is a warning by default, and `verify` passes. When the scenarios cover the manifest, set `coverage: 'error'` in the config. Then each new operation, output or rule needs a scenario before `verify` passes.

## Same input, same bytes

The same manifest, config and urn-forge version always give the same bytes, on any machine. Gate 4 depends on this. It compiles the manifest again and compares the result with the committed files. If the compiler gave different bytes on a different machine, gate 4 would fail on a clean repository, and a team would learn to ignore it.

The compiler reads no clock, no random value and no environment. It writes the pieces in the order of the manifest.

Each generated file starts with a header and a fingerprint:

```
// Generated by urn-forge from domain.manifest.yaml. Do not edit: change the manifest, then run urn-forge compile.
// fingerprint sha256:…
```

The fingerprint is the SHA-256 of the body of the file. Gate 4 does not trust it. A hand edit below the header does not change the header. Thus gate 4 compares each file byte for byte, and also fails on a generated file that compile no longer makes.

The verdict of a commit also stays the same over time. A rule about the time compares a time of the input, never the clock. Thus a new run of an old commit gives the same result.

## Related pages

- [Tutorial: make the domain strict](../tutorials/strict-coverage)
- [Fix a failing gate](../how-to/fix-a-failing-gate)
- [Verification gates](../reference/verification-gates)
