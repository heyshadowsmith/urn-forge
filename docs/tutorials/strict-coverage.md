# Make the domain strict

In this tutorial, you close the boundary gaps of the shipping domain. First, you tag the feature as strict, so that the gaps become errors. Then you add the scenarios that send the edge values. At the end, you set `boundaryCoverage: 'error'`, and `verify passed` shows with no warnings.

Before you start, do [tutorial 2](./declared-errors). You continue in the same folder, `my-shipping/`. All the commands run from `packages/urn-forge`.

## 1. Tag the feature as strict

Open `my-shipping/features/quote_shipping.feature`. Add the tag `@urn-forge:strict` on a new first line:

```gherkin
@urn-forge:strict
@urn:demo:shipping:quote:operation:quote_shipping
Feature: Shipping quotes
```

## 2. Run verify

Run this command:

```bash
npx urn-forge verify --config my-shipping/urn-forge.config.ts
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over my-shipping/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       FAIL  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features
    my-shipping/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    my-shipping/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside oneOf
gate 4  drift         PASS  2 generated file(s) compared byte for byte against my-shipping/generated
verify failed: gate 3
```

The two boundary gaps of tutorial 1 are now errors, and gate 3 fails. Each message gives the values that no scenario sends:

- For `weight_grams`, the values `1` (`min`), `30000` (`max`) and `30001` (`max + 1`). Your scenarios already send `0` (`min − 1`).
- For `zone`, a value that is not in the `oneOf` list. Your scenarios already send `domestic` and `international`.

## 3. Add the weight scenarios

Add these two scenarios at the end of the feature:

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
```

The Scenario Outline sends `1` and `30000`, and the operation accepts them. The second scenario sends `30001`, and the schema refuses it at the boundary.

Run `verify` again:

```bash
npx urn-forge verify --config my-shipping/urn-forge.config.ts
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over my-shipping/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       FAIL  1 feature(s), 5 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features
    my-shipping/features  error  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside oneOf
gate 4  drift         PASS  2 generated file(s) compared byte for byte against my-shipping/generated
verify failed: gate 3
```

The gap of `weight_grams` is closed. Only the gap of `zone` stays.

## 4. Add the zone scenario

Add this scenario at the end of the feature:

```gherkin
  Scenario: An unknown zone is rejected at the boundary
    When I run the operation with:
      | weight_grams | zone |
      | 800          | moon |
    Then the input is rejected on "zone"
```

Make sure that your feature is the same as this file. The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/3-strict-coverage/features/quote_shipping.feature{1,34-57 gherkin}

## 5. Run Cucumber

Gate 3 examines only that the scenarios send the values. Cucumber examines that the scenarios pass. Run this command:

```bash
npx cucumber-js --profile my-shipping
```

The command shows this output:

```
..............................

10 scenarios (10 passed)
30 steps (30 passed)
0m 0.018s (0m 0.003s executing your code)
```

## 6. Run verify

Run this command:

```bash
npx urn-forge verify --config my-shipping/urn-forge.config.ts
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over my-shipping/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features
    my-shipping/features  note  ratchet-ready  every feature is @urn-forge:strict; set boundaryCoverage: 'error' in the config so new features are strict too
gate 4  drift         PASS  2 generated file(s) compared byte for byte against my-shipping/generated
verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
```

All the gaps are closed, and gate 3 passes. Thus gate 3 now shows the note `ratchet-ready`. It tells you that all the features are strict.

## 7. Set boundaryCoverage to error

The tag makes only this feature strict. A new feature without the tag can have gaps again, and `verify` gives only warnings. To make each gap an error, change the configuration.

Open `my-shipping/urn-forge.config.ts`. Add the line `boundaryCoverage: 'error',` after the `tsconfig` line:

```ts
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  manifest: './domain.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../tsconfig.json',
  boundaryCoverage: 'error',
});
```

## 8. Run verify

Run this command:

```bash
npx urn-forge verify --config my-shipping/urn-forge.config.ts
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over my-shipping/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
gate 4  drift         PASS  2 generated file(s) compared byte for byte against my-shipping/generated
verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
```

The note `ratchet-ready` is gone, and the summary of gate 3 shows `(boundaryCoverage: error)`. Your domain now has no warnings. Each new gap makes `verify` fail.

Your files are now the same as the files in `tutorial/3-strict-coverage/`. The only difference is the `tsconfig` path in the configuration file, because your folder is at a different level.

## 9. Remove your work

If you do not want to keep your domain, do these steps:

1. Delete the folder `my-shipping/`.
2. Remove the `my-shipping` profile from `cucumber.json`.

## What you learned

- Gate 3 finds the edge values of each constraint that no scenario sends.
- The tag `@urn-forge:strict` makes the gaps of the operations of a feature into errors.
- You close a gap with a scenario that sends the edge value: an accepted value, or a value that the schema refuses.
- `boundaryCoverage: 'error'` makes each gap an error, also in new features.

## Next

You completed the tutorials. To do a specific task with urn-forge, go to the [how-to guides](../how-to/).

## Related pages

- [Boundary coverage and the ratchet](../explanation/boundary-coverage)
- [Adopt strict coverage](../how-to/adopt-strict-coverage)
- [Waive a boundary](../how-to/waive-a-boundary)
- [Verification gates](../reference/verification-gates)
- [The configuration file](../reference/configuration)
