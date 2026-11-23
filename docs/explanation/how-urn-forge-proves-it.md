# How urn-forge proves it

urn-forge makes sure that one URN connects the declaration of an atom, the code that implements it and the scenario that tests it. This page tells how that chain works, what each gate shows and cannot show, why gate 3 asks for boundary values, and why the same input always gives the same bytes.

## One URN through the chain

The operation `urn:demo:shipping:quote:operation:quote_shipping` of the [first tutorial](../tutorials/first-domain) occurs in each link of the chain:

1. **The manifest.** You write the atom with a short key:

   ```yaml
   quote.operation.quote_shipping:
     description: Calculate the price to send a parcel
     input: parcel.entity.parcel
     output: quote.entity.quote
   ```

2. **The generated code.** `compile` writes a handler type for the operation, and a registry that has the URN as a key:

   ```ts
   export interface DomainCoreImplementation {
     readonly 'urn:demo:shipping:quote:operation:quote_shipping': QuoteQuoteShippingHandler;
   }
   ```

3. **The core.** Your handler has the same URN as its key. The `satisfies` clause connects it to the registry.
4. **The features.** The feature file has the URN as a tag. The generic steps read the tag to find the operation that they call:

   ```gherkin
   @urn:demo:shipping:quote:operation:quote_shipping
   Feature: Shipping quotes
   ```

5. **The gates.** `urn-forge verify` examines the links without a run of the code.

A Cucumber run then sends each scenario through `executeOperation`, with the URN from the tag. Thus the scenario tests the handler that the manifest declares, and no other code.

Many tools make TypeScript types from a schema. None of them can tell you that a declared operation has a handler and a scenario, or that the scenario uses the names of real fields. These questions need one name that all the parts share, and a check that reads all the parts. The URN is that name. The generated code is only the means to connect the parts. Thus urn-forge makes little code, and writes custom checks only where other tools cannot see.

## Conformance, not correctness

The gates show *conformance*: the parts agree with the manifest. They do not show that the handler logic is *correct*. Only a person can say what the correct result is, and the scenarios are where they say it. The gates make sure that those scenarios exist and stay connected to the code.

`verify` runs gates 1 to 4:

```
gate 1  completeness  PASS  tsc: 0 error(s) over self/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  3 feature(s), 17 scenario(s), 3/3 operations tagged, 2/2 errors expected, strict: 3/3 features (boundaryCoverage: error)
gate 4  drift         PASS  2 generated file(s) compared byte for byte against self/generated
verify passed (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

| Gate | It shows | It cannot show |
| --- | --- | --- |
| 1. Completeness | Every operation has a handler of the generated type, through `satisfies DomainCoreImplementation` | That a handler computes the correct value. A handler that returns `ok({ price_cents: 0 })` for every parcel passes |
| 2. Boundary discipline | No core file and no shell file forges a brand, and the core does not import a parser as a value | A forged value from a file that gate 2 does not examine, such as a library. A wrong value that a parse accepts |
| 3. Gherkin | Every tag resolves, every operation has a feature, table headers are fields, and each declared error, input invariant and boundary value has a scenario | That a scenario passes, or that its expected values are correct |
| 4. Drift | Each generated file is equal, byte for byte, to a fresh compile | That the manifest is correct |
| 5. `urn-forge diff` | No change to a live URN can break a caller or a stored row | A change of meaning that keeps the schema, for example cents that become euros |

`verify` reads the code and the features. It does not run them. The Cucumber run is a separate step, and CI runs both. The two find different problems:

- **Only a static check can find what is absent.** An operation with no scenario does not make a Cucumber run fail, because the run has nothing to run. Gate 3 compares every feature with the manifest, so it finds the gap.
- **Only a run can find wrong behavior.** Gate 3 cannot tell if `1600` is the correct price for a parcel. The run calls the handler and compares.

For the full rules of each gate, refer to [Verification gates](../reference/verification-gates).

## Boundary coverage

Many bugs are at an edge. A handler uses `>` where it must use `>=`, or a constraint says `max: 100` where the domain means 99. A scenario that sends only a value in the middle of the range passes in both cases.

Thus gate 3 asks, for each constrained input field, for the value at each edge and one value past it. For an `integer` with `min: 1`, it asks for `0` and `1`. One side shows that the schema refuses a bad value. The other side shows that it accepts the first good value. A `regex` needs a value that matches and a value that does not. An `enum` needs each of its values and one value outside the list.

Gate 3 counts values for each operation separately. Two operations can treat the same field in different ways, so a case that one operation tests says nothing about the other. Gate 3 gives one diagnostic for each field and operation, because a field is the unit that a person fixes:

```
    tutorial/1-first-domain/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
```

Gate 3 shows that a case is present, not that it passes. A scenario that sends `-1` to a field with `min: 0` covers the edge, even if it expects success. Then the Cucumber run fails. The two checks together find the problem.

### Warn, then ratchet

If boundary coverage failed the build from the first day, a team with a large suite could not adopt urn-forge. Thus the check has three levels:

1. **Warn.** By default, each gap is a warning, and `verify` passes.
2. **Strict features.** The tag `@urn-forge:strict` on a feature makes the gaps of its operations errors. A team makes one feature strict at a time.
3. **Error.** When every feature is strict, `verify` shows the note `ratchet-ready`. The team then sets `boundaryCoverage: 'error'`, and every new feature is strict from the start.

Sometimes a boundary cannot have a useful scenario. A waiver is a comment in the feature file, with a reason. An applied waiver shows as a note in the output of `verify`, so it stays visible. A waiver for a field with no gap is a warning, so it cannot hide a future gap. [Close boundary gaps](../how-to/close-boundary-gaps) gives the steps.

## Same input, same bytes

The same manifest, configuration and urn-forge version always give the same bytes, on any machine, in any locale and time zone, on any date. Gate 4 depends on this. It compiles the manifest again and compares the result with the committed files. If the compiler gave different bytes on a different machine, gate 4 would fail on a clean repository, and a team would learn to ignore it.

The compiler keeps these rules:

- It reads no clock, no random value and no environment.
- It sorts the output in a fixed order. Sorts compare code units, not the locale, because the order of letters is different in Turkish, for example.
- It writes `\n` line endings and one newline at the end of each file.

A test in CI compiles again under a Turkish locale and the time zone `Pacific/Chatham`, and fails on any change.

Each generated file starts with a header and a fingerprint:

```ts
// @generated by urn-forge 0.1.0 — do not edit
// fingerprint: sha256:28f251b06ee13bc71fcd6ef07854183ef6af206f87b6bcf789d8ee6063871368
```

The fingerprint is a hash of the inputs of the compile: the manifest in a canonical form, the configuration of each plugin, and the versions of urn-forge and its plugins. Two equal fingerprints mean two equal inputs.

Gate 4 does not trust the fingerprint. A hand edit below the header does not change the header. Thus gate 4 compares each file byte for byte, and also fails on a generated file that the compile no longer makes. A byte comparison finds every difference, whatever its cause.

The verdict of a commit also stays the same over time. A sunset date is compared with a reference date that CI gives, never with the clock. Thus a new run of an old commit gives the same result.

## Related pages

- [Tutorial: make the domain strict](../tutorials/strict-coverage)
- [Fix a gate that fails](../how-to/fix-a-failing-gate)
- [Verification gates](../reference/verification-gates)
