# Add a declared error

In this tutorial, you add a business rule to the shipping domain: an express parcel can weigh 5000 grams at most. The operation refuses a heavier express parcel with a declared error. At the end, a scenario expects the error, and `verify` passes.

Before you start, do [tutorial 1](./first-domain). You continue in the same folder, `my-shipping/`. All the commands run from `packages/urn-forge`.

## 1. Declare the error in the manifest

Open `my-shipping/domain.manifest.yaml`. Make these two changes:

1. Add the error `quote.error.too_heavy_for_express` before the operation.
2. Add an `errors` list to the operation.

Make sure that your manifest is the same as this file. The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/domain.manifest.yaml{35-41,47-48}

Examine the parts of the error:

- `category` gives the kind of error. The shell can use it, for example to select an HTTP status.
- `retryable: false` tells the caller that the same request fails again.
- `message` is the text for a person. `{weight_grams}` is a placeholder for the value of the field.
- `fields` is the data that the error carries. Here, the error carries the weight of the parcel.

An operation can return only the errors in its `errors` list. For each key of an error, refer to [The manifest](../reference/manifest).

## 2. Compile the manifest

Run this command:

```bash
npx urn-forge compile --config my-shipping/urn-forge.config.ts
```

The command shows this output:

```
wrote      my-shipping/generated/domain.runtime.generated.ts
wrote      my-shipping/generated/domain.schemas.generated.ts
fingerprint sha256:b48297b4537c103460a0d8c21ae9ae155f0bd5b185c94813eb2a78c92b66c4bf
```

The manifest changed. Thus, the fingerprint changed too.

## 3. Examine the new handler type

Open `my-shipping/generated/domain.runtime.generated.ts`. Find the type of the handler:

```ts
/** urn:demo:shipping:quote:operation:quote_shipping — Calculate the price to send a parcel */
export type QuoteQuoteShippingHandler = (
  input: s.ParcelParcel,
) => Result<s.QuoteQuoteInput, s.QuoteTooHeavyForExpressInput>;
```

The second type of the `Result` is not `never` now. It is the payload of the new error. Thus, the handler can return the error.

## 4. Run verify

Run this command:

```bash
npx urn-forge verify --config my-shipping/urn-forge.config.ts
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over my-shipping/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, 0/1 errors expected, strict: 0/1 features
    my-shipping/features  warning  uncovered-error  error urn:demo:shipping:quote:error:too_heavy_for_express of urn:demo:shipping:quote:operation:quote_shipping has no scenario that expects it; add one with Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express"
    my-shipping/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    my-shipping/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against my-shipping/generated
verify passed with 3 warning(s) (gates 1, 3, 4; gate 2 is not built; gate 5 is urn-forge diff)
```

Gate 1 passes, because a handler that never fails is still correct. Gate 3 has a new warning, `uncovered-error`: no scenario expects the error. You add the rule to the core in step 5, and the scenario in step 7.

## 5. Return the error from the core

Open `my-shipping/core.ts`. Make these changes:

1. Import `fail` from the generated runtime.
2. Add the constant `EXPRESS_LIMIT_GRAMS`.
3. At the start of the handler, return the error if an express parcel is too heavy.

Make sure that your core is the same as this file. The highlighted lines are new or changed:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/core.ts{1,5,9-11}

`fail(…)` gets the URN of the error and the fields of the error. The handler returns a plain value. The shell parses and brands it.

## 6. See gate 1 find an incorrect error

Gate 1 makes sure that the core returns only the declared errors. Do a test of this:

1. In `my-shipping/core.ts`, change `too_heavy_for_express` to `too_heavy` in the `fail(…)` call.

2. Run `verify`:

   ```bash
   npx urn-forge verify --config my-shipping/urn-forge.config.ts
   ```

   The command shows this output:

   ```
   gate 1  completeness  FAIL  tsc: 1 error(s) over my-shipping/core.ts; `core` satisfies DomainCoreImplementation
       my-shipping/core.ts:10:19  error  type-error  TS2345: Argument of type '"urn:demo:shipping:quote:error:too_heavy"' is not assignable to parameter of type '"urn:demo:shipping:quote:error:too_heavy_for_express"'.
   gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, 0/1 errors expected, strict: 0/1 features
       my-shipping/features  warning  uncovered-error  error urn:demo:shipping:quote:error:too_heavy_for_express of urn:demo:shipping:quote:operation:quote_shipping has no scenario that expects it; add one with Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express"
       my-shipping/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
       my-shipping/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
   gate 4  drift         PASS  2 generated file(s) compared byte for byte against my-shipping/generated
   verify failed: gate 1
   ```

   The manifest does not declare the URN `…:error:too_heavy`. Thus, `tsc` refuses it, and gate 1 fails.

3. Change `too_heavy` back to `too_heavy_for_express`.

## 7. Add the scenario

Open `my-shipping/features/quote_shipping.feature`. Add a scenario at the end of the file. Make sure that your feature is the same as this file. The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/features/quote_shipping.feature{25-31 gherkin}

The step `Then the operation fails with "<error URN>":` has a table. The headers of the table are the fields of the error. The step makes sure that the operation returns this error, and that the error fields agree with the table.

## 8. Run Cucumber

Run this command:

```bash
npx cucumber-js --profile my-shipping
```

The command shows this output:

```
..................

6 scenarios (6 passed)
18 steps (18 passed)
0m 0.015s (0m 0.003s executing your code)
```

## 9. Run verify

Run this command:

```bash
npx urn-forge verify --config my-shipping/urn-forge.config.ts
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over my-shipping/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
    my-shipping/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    my-shipping/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against my-shipping/generated
verify passed with 2 warning(s) (gates 1, 3, 4; gate 2 is not built; gate 5 is urn-forge diff)
```

The summary of gate 3 shows `1/1 errors expected`, and the `uncovered-error` warning is gone. The two boundary warnings stay. You close them in the next tutorial.

## What you learned

- An error is an atom in the manifest. An operation lists the errors that it can return.
- After a manifest change, run `urn-forge compile`. The handler type then includes the new error.
- The core returns a declared error with `fail(…)`. Gate 1 refuses an error that the operation does not declare.
- The step `Then the operation fails with "<error URN>":` expects an error and examines its fields.
- Gate 3 gives the warning `uncovered-error` until a scenario expects each declared error.

## Next

Continue to [tutorial 3: Make the domain strict](./strict-coverage).

## Related pages

- [Results and declared errors](../explanation/results-and-errors)
- [Declare an error](../how-to/declare-an-error)
- [Gherkin steps](../reference/gherkin-steps)
- [Verification gates](../reference/verification-gates)
