# Add a refusal

In this tutorial, you add a business rule to the shipping domain: an express parcel weighs 5000 grams at most. A parcel that breaks this rule gets a refusal, not a quote. A refusal is an output of the operation, an object like any other. Rules say when each output can come back, and the harness checks them on each answer of the core.

Before you start, do [tutorial 1](./first-domain). Run all the commands from the `my-shipping` folder.

## 1. Add the refusal to the manifest

Replace the content of `domain.manifest.yaml` with this content. The highlighted lines are new or changed:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/domain.manifest.yaml{46-67,74-75}

Examine the new parts:

- `too_heavy_for_express` is an object with one property, `weight_grams`. It is the refusal. urn-forge has no special kind for an error: the operation gives the object its role.
- The `rules` section declares three rules of your own. Each rule has a `description`, the `rule` itself and a `message`. The `rule` is an expression in a subset of CEL, the Common Expression Language.
- In the rule of an operation, `input` is the input, and `output` is the object that came back.
- The `output` of `quote_shipping` lists two objects. Each object lists the rules that must hold when it comes back. A `quote` comes back only for a parcel that `fits_express`. A `too_heavy_for_express` comes back only `over_express_limit`, and it `names_the_weight` of the parcel.

`express` is optional. Thus a rule reads `input.express` only after `has(input.express)`. If you remove `has(input.express)`, `compile` stops with the diagnostic `rule-guard`.

## 2. Compile the manifest

Run this command:

```bash
npx urn-forge compile
```

The command shows this output:

```
wrote      src/generated/domain.generated.ts
```

The answer type of the operation now has two outputs:

```ts
export type QuoteShippingAnswer = Answer<"quote", Quote> | Answer<"too_heavy_for_express", TooHeavyForExpress>;
```

## 3. Run verify

Run this command:

```bash
npx urn-forge verify
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 10 scenario(s), 1/1 operation(s) run, 6 rule(s) broken
    features  warning  uncovered-output  no scenario of quote_shipping answers too_heavy_for_express; add one that ends with Then the output is "too_heavy_for_express"
    features  warning  uncovered-rule  no scenario breaks required of too_heavy_for_express; add one that ends with Then the input is rejected by "required" of "too_heavy_for_express", or Then the value is rejected by …
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed with 2 warning(s) (gates 1, 2, 3, 4)
```

Gate 1 passes. The core returns only a `quote`, and a core can return fewer outputs than the manifest allows. Gate 3 gives two warnings: no scenario gives the new output, and no scenario breaks the `required` rule of the new object.

## 4. Write a scenario for the refusal

Open `features/quote_shipping.feature`. Add this scenario after the first `Scenario Outline` and its `Examples`:

```gherkin
  Scenario: An express parcel over 5000 grams is refused
    When I run "quote_shipping" with:
      | weight_grams | zone     | express |
      | 5001         | domestic | true    |
    Then the output is "too_heavy_for_express":
      | weight_grams |
      | 5001         |
```

## 5. See the harness catch the core

Run this command:

```bash
npx cucumber-js
```

The new scenario fails. The output has these lines, among others:

```
  1) An express parcel over 5000 grams is refused # features/quote_shipping.feature:18
           Error: quote_shipping did not answer: ContractViolation: fits_express of quote_shipping: An express parcel can weigh 5000 grams at most
11 scenarios (10 passed, 1 failed)
33 steps (32 passed, 1 failed)
```

The core still gives a quote for each parcel. The harness checked the answer, found that it breaks `fits_express`, and gave a `ContractViolation` in place of the answer. The message is the `message` of the rule.

## 6. Change the core

Replace the content of `src/core.ts` with this content. The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/src/core.ts{7,11}

Run Cucumber again:

```bash
npx cucumber-js
```

The command shows this output:

```
.................................

11 scenarios (11 passed)
33 steps (33 passed)
0m 0.017s (0m 0.004s executing your code)
```

## 7. Write a scenario for the rule of the refusal

The `required` rule of `too_heavy_for_express` applies only to an answer of the core, so no input can break it. Check a value of the definition in place of a run. Add this scenario at the end of the feature:

```gherkin
  Scenario: A refusal needs the weight
    When I check a "too_heavy_for_express" with:
      | weight_grams |
      |              |
    Then the value is rejected by "required" of "too_heavy_for_express"
```

Your feature is now the same as this file:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/features/quote_shipping.feature{gherkin}

## 8. Run Cucumber and verify

1. Run Cucumber:

   ```bash
   npx cucumber-js
   ```

   The command shows this output:

   ```
   ....................................

   12 scenarios (12 passed)
   36 steps (36 passed)
   0m 0.018s (0m 0.004s executing your code)
   ```

2. Run verify:

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

The warnings are gone. The rules of the outputs, such as `fits_express`, do not need a scenario that breaks them: the harness checks them on each answer of each scenario that runs the operation.

## Next

Continue to [tutorial 3: Make the domain strict](./strict-coverage).

## Related pages

- [Declare a refusal](../how-to/declare-a-refusal)
- [Operations and outputs](../reference/operations)
- [The rule language](../reference/rule-language)
