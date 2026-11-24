# Make the domain strict

In this tutorial, you make a gap in the scenarios an error, so that `verify` fails when a new output or a new rule has no scenario. Then you add scenarios at the edges of the rules, where a core is most often wrong.

Before you start, do [tutorial 2](./declared-errors). Run all the commands from the `my-shipping` folder.

## 1. Make a gap an error

Replace the content of `urn-forge.config.ts` with this content:

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/urn-forge.config.ts{6-7}

Run verify:

```bash
npx urn-forge verify
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 12 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

Your scenarios have no gap, so nothing changes.

## 2. See a gap fail verify

1. Open `features/quote_shipping.feature`, and remove the last scenario, `A refusal needs the weight`.
2. Run verify:

   ```bash
   npx urn-forge verify
   ```

   The command shows this output:

   ```
   gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
   gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
   gate 3  gherkin       FAIL  1 feature(s), 11 scenario(s), 1/1 operation(s) run, 6 rule(s) broken
       features  error  uncovered-rule  no scenario breaks required of too_heavy_for_express; add one that ends with Then the input is rejected by "required" of "too_heavy_for_express", or Then the value is rejected by …
   gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
   verify failed: gate 3
   ```

   In tutorial 2, the same gap was a warning. Now it is an error, and `verify` stops with exit code `1`.

3. Put the scenario back.

## 3. Find the edges of the rules

Gate 3 asks for one scenario that breaks each rule of a definition. It does not ask for the values at the edges of a rule. A core that is wrong by one at an edge can still pass each scenario.

For example, change the comparison in `src/core.ts` from `>` to `>=`:

```ts
    if (express && weight_grams >= EXPRESS_LIMIT_GRAMS) return answer('too_heavy_for_express', { weight_grams });
```

Run Cucumber:

```bash
npx cucumber-js
```

The command shows this output:

```
....................................

12 scenarios (12 passed)
36 steps (36 passed)
0m 0.019s (0m 0.004s executing your code)
```

Each scenario passes, but the core now refuses an express parcel of exactly 5000 grams.

## 4. Add the edge scenarios

Replace the content of `features/quote_shipping.feature` with this content. The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/features/quote_shipping.feature{26-45 gherkin}

The new scenarios send the lightest and the heaviest parcel that `weight_grams` accepts, and an express parcel of exactly 5000 grams.

Run Cucumber:

```bash
npx cucumber-js
```

The scenario at the edge fails. The output has these lines, among others:

```
  1) An express parcel of exactly 5000 grams is quoted # features/quote_shipping.feature:39
           Error: quote_shipping did not answer: ContractViolation: over_express_limit of quote_shipping: The parcel fits express delivery
15 scenarios (14 passed, 1 failed)
45 steps (44 passed, 1 failed)
```

The core refused the parcel, but the rule `over_express_limit` allows the refusal only above 5000 grams. The harness found the error.

## 5. Correct the core

Change the comparison in `src/core.ts` back from `>=` to `>`. Your core is now the same as this file:

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/src/core.ts

## 6. Run Cucumber and verify

1. Run Cucumber:

   ```bash
   npx cucumber-js
   ```

   The command shows this output:

   ```
   .............................................

   15 scenarios (15 passed)
   45 steps (45 passed)
   0m 0.015s (0m 0.003s executing your code)
   ```

2. Run verify:

   ```bash
   npx urn-forge verify
   ```

   The command shows this output:

   ```
   gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
   gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
   gate 3  gherkin       PASS  1 feature(s), 15 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
   gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
   verify passed (gates 1, 2, 3, 4)
   ```

Your project is now the same as `packages/urn-forge/tutorial/3-strict-coverage/` in the repository.

## What you built

- A manifest that states the contract: the values that `quote_shipping` accepts, its two outputs, and the rules that say when each output comes back.
- A core that is a plain function. It does not check its input, and it does no I/O.
- A harness that checks each input before the core runs, and each answer after it.
- Scenarios that run each output, break each rule of each definition, and test the edges of the rules.
- A `verify` that fails when one of these parts no longer agrees with the manifest.

## Next

- To call the operation from your application, refer to [Call an operation](../how-to/call-an-operation).
- To check a change to the manifest, refer to [Change the contract](../how-to/change-the-contract).
- To run the checks on each pull request, refer to [Run verify in CI](../how-to/run-verify-in-ci).

## Related pages

- [Write scenarios](../how-to/write-scenarios)
- [Verification gates](../reference/verification-gates)
- [How urn-forge proves it](../explanation/how-urn-forge-proves-it)
