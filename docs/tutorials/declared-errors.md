# Add a declared error

In this tutorial, you add a business rule to the shipping domain: an express parcel can weigh 5000 grams at most. The operation refuses a heavier express parcel with a declared error. At the end, a scenario expects the error.

Before you start, do [tutorial 1](./first-domain). You continue in the same project, `my-shipping/`.

## 1. Declare the error

Open `domain.manifest.yaml`. Make these two changes:

1. Add the error `quote.error.too_heavy_for_express` before the operation.
2. Add an `errors` list to the operation.

Make sure that your manifest is the same as this file. The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/domain.manifest.yaml{35-41,47-48}

The error has these parts:

- `category` gives the kind of error. The shell can use it, for example to select an HTTP status.
- `retryable: false` tells the caller that the same request fails again.
- `message` is the text for a person. `{weight_grams}` is a placeholder for the value of the field.
- `fields` is the data that the error carries. Each value must pass the constraints of its field.

An operation can return only the errors in its `errors` list.

## 2. Compile the manifest

Run this command:

```bash
npx urn-forge compile
```

The command shows this output:

```
wrote      src/generated/domain.runtime.generated.ts
wrote      src/generated/domain.schemas.generated.ts
fingerprint sha256:492eef5cf4429536322062da365f080ff6cc4091bb6ae5563c713a73570b3b10
```

Open `src/generated/domain.runtime.generated.ts`. Find the handler type:

```ts
/** urn:demo:shipping:quote:operation:quote_shipping — Calculate the price to send a parcel */
export type QuoteQuoteShippingHandler = (
  input: s.ParcelParcel,
) => Result<s.QuoteQuoteInput, s.QuoteTooHeavyForExpressInput>;
```

The error type of the `Result` is the payload of the new error. Thus, the handler can return the error.

## 3. Return the error from the core

Open `src/core.ts`. Make these changes:

1. Import `fail` from the generated runtime.
2. Add the constant `EXPRESS_LIMIT_GRAMS`.
3. At the start of the handler, return the error if an express parcel is too heavy.

Make sure that your core is the same as this file. The highlighted lines are new or changed:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/src/core.ts{1,5,9-11}

`fail(…)` gets the URN of the error and the fields of the error.

## 4. See gate 1 refuse an undeclared error

1. In `src/core.ts`, change `too_heavy_for_express` to `too_heavy` in the `fail(…)` call.

2. Run `verify`:

   ```bash
   npx urn-forge verify
   ```

   The command shows this output:

   ```
   gate 1  completeness  FAIL  tsc: 1 error(s) over src/core.ts; `core` satisfies DomainCoreImplementation
       src/core.ts:10:19  error  type-error  TS2345: Argument of type '"urn:demo:shipping:quote:error:too_heavy"' is not assignable to parameter of type '"urn:demo:shipping:quote:error:too_heavy_for_express"'.
   gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
   gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, 0/1 errors expected, strict: 0/1 features
       features  warning  uncovered-error  error urn:demo:shipping:quote:error:too_heavy_for_express of urn:demo:shipping:quote:operation:quote_shipping has no scenario that expects it; add one with Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express"
       features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
       features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
   gate 4  drift         PASS  2 generated file(s) compared byte for byte against src/generated
   verify failed: gate 1
   ```

   The manifest does not declare `…:error:too_heavy`. Thus, `tsc` refuses it, and gate 1 fails. Gate 3 also gives the warning `uncovered-error`: no scenario expects the declared error.

3. Change `too_heavy` back to `too_heavy_for_express`.

## 5. Add the scenario

Open `features/quote_shipping.feature`. Add a scenario at the end of the file. Make sure that your feature is the same as this file. The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/features/quote_shipping.feature{25-31 gherkin}

The step `Then the operation fails with "<error URN>":` makes sure that the operation returns this error. The table headers are the fields of the error, and the values must agree.

## 6. Run Cucumber

Run this command:

```bash
npx cucumber-js
```

The command shows this output:

```
..................

6 scenarios (6 passed)
18 steps (18 passed)
0m 0.015s (0m 0.003s executing your code)
```

## 7. Run verify

Run this command:

```bash
npx urn-forge verify
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
    features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against src/generated
verify passed with 2 warning(s) (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

Gate 3 shows `1/1 errors expected`. The two boundary warnings stay. You close them in the next tutorial.

## Next

Continue to [tutorial 3: Make the domain strict](./strict-coverage).

## Related pages

- [Declare an error](../how-to/declare-an-error)
- [The core and the shell](../explanation/core-and-shell)
- [Gherkin steps](../reference/gherkin-steps)
