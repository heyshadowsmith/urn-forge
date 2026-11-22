# Make the domain strict

In this tutorial, you close the boundary gaps of the shipping domain. You tag the feature as strict, add the scenarios that send the edge values, and set `boundaryCoverage: 'error'`. At the end, `verify` passes with no warnings.

Before you start, do [tutorial 2](./declared-errors). You continue in the same project, `my-shipping/`.

## 1. Tag the feature as strict

Open `features/quote_shipping.feature`. Add the tag `@urn-forge:strict` on a new first line:

```gherkin
@urn-forge:strict
@urn:demo:shipping:quote:operation:quote_shipping
Feature: Shipping quotes
```

## 2. Run verify

Run this command:

```bash
npx urn-forge verify
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       FAIL  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features
    features  error  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    features  error  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against src/generated
verify failed: gate 3
```

In a strict feature, the boundary gaps are errors. Each message gives the values that no scenario sends:

- For `weight_grams`: `1` (`min`), `30000` (`max`) and `30001` (`max + 1`).
- For `zone`: a value that is not in the `values` list.

## 3. Add the boundary scenarios

Add these three scenarios at the end of the feature:

```gherkin
  Scenario Outline: The lightest and heaviest parcels are accepted
    When I run the operation with:
      | weight_grams   | zone     |
      | <weight_grams> | domestic |
    Then the output is:
      | price_cents   |
      | <price_cents> |

    Examples:
      | weight_grams | price_cents |
      | 1            | 600         |
      | 30000        | 3500        |

  Scenario: A parcel over 30000 grams is rejected at the boundary
    When I run the operation with:
      | weight_grams | zone     |
      | 30001        | domestic |
    Then the input is rejected on "weight_grams"

  Scenario: An unknown zone is rejected at the boundary
    When I run the operation with:
      | weight_grams | zone |
      | 800          | moon |
    Then the input is rejected on "zone"
```

The operation accepts `1` and `30000`. The schema refuses `30001` and `moon` at the boundary.

Make sure that your feature is the same as this file. The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/features/quote_shipping.feature{1,34-57 gherkin}

## 4. Run Cucumber

Gate 3 examines only that the scenarios send the values. Cucumber examines that the scenarios pass. Run this command:

```bash
npx cucumber-js
```

The command shows this output:

```
..............................

10 scenarios (10 passed)
30 steps (30 passed)
0m 0.018s (0m 0.003s executing your code)
```

## 5. Run verify

Run this command:

```bash
npx urn-forge verify
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features
    features  note  ratchet-ready  every feature is @urn-forge:strict; set boundaryCoverage: 'error' in the config so new features are strict too
gate 4  drift         PASS  2 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

All the gaps are closed. The note `ratchet-ready` tells you that all the features are strict.

## 6. Set boundaryCoverage to error

The tag makes only this feature strict. A new feature without the tag can have gaps, and `verify` gives only warnings for them. To make each gap an error, change the configuration.

Replace the content of `urn-forge.config.ts` with this content:

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/urn-forge.config.ts

## 7. Run verify

Run this command:

```bash
npx urn-forge verify
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
gate 4  drift         PASS  2 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

The summary of gate 3 shows `(boundaryCoverage: error)`. Each new gap makes `verify` fail. Your files are the same as the files in `tutorial/3-strict-coverage/`.

## Next

You completed the tutorials. To do a specific task, go to the [how-to guides](../how-to/).

## Related pages

- [Close boundary gaps](../how-to/close-boundary-gaps)
- [How urn-forge proves it](../explanation/how-urn-forge-proves-it)
- [The configuration file](../reference/configuration)
