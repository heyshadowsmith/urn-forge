# Waive a boundary

A waiver removes the boundary gaps of one input field from gate 3, and records why. Use it when a scenario cannot test a boundary. The output on this page comes from the domains of [tutorial 2](../tutorials/declared-errors) and [tutorial 3](../tutorials/strict-coverage).

## Before you start

- Gate 3 reports an `uncovered-boundary` problem for the field. Refer to [Adopt strict coverage](adopt-strict-coverage).
- You know the full URN of the field, for example `urn:demo:shipping:parcel:field:weight_grams`.
- You have a reason that a reviewer can accept.

## Prefer a scenario

A waiver hides a gap. A scenario closes it. Write a scenario if one of these is true:

- The schema can refuse the value. A value outside `min`, `max`, `minLength`, `maxLength`, `oneOf`, `regex` or `mustBe` fails at the boundary, so `Then the input is rejected on "<field>"` can test it.
- The value is the empty string. Write `""` in the cell.
- The value is valid but rare. A row in an `Examples` table costs one line.

Use a waiver only if no scenario can send the value, or if a different test examines the value and the reason says where.

## Add the waiver

1. Open the feature file that tags the operation.
2. Add a comment line anywhere in the file, in this form:

   ```gherkin
   # urn-forge:waive <field URN> <reason>
   ```

   - The field URN is the full URN of the field, not the short key.
   - The reason is free text. It can contain spaces.

   For example, the feature of tutorial 3 has no scenario for `30001` grams. This waiver removes that gap:

   ```gherkin
   @urn-forge:strict
   @urn:demo:shipping:quote:operation:quote_shipping
   Feature: Shipping quotes

     # urn-forge:waive urn:demo:shipping:parcel:field:weight_grams The carrier API refuses parcels over 30000 grams before the call
   ```

3. Run `verify`:

   ```bash
   npx urn-forge verify --config tutorial/3-strict-coverage/urn-forge.config.ts
   ```

The waiver applies to the field in each operation that the feature file tags. It applies in strict features and with `boundaryCoverage: 'error'` too.

::: warning
A waiver removes every gap of the field, not only the gap that you have in mind. If you add a constraint to the field later, the waiver also hides the new gaps. Examine each waiver when you change the field.
:::

## Result

The gap is gone. Gate 3 counts the waiver in its summary and shows it as a `waived-boundary` note, with its reason:

```
gate 3  gherkin       PASS  1 feature(s), 5 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error), 1 waiver(s)
    tutorial/3-strict-coverage/features/quote_shipping.feature:5:1  note  waived-boundary  boundary coverage of urn:demo:shipping:parcel:field:weight_grams is waived: The carrier API refuses parcels over 30000 grams before the call
```

A note does not fail a gate and is not counted as a warning. Each run shows it, so the waiver stays visible in review.

## Fix a waiver that gate 3 refuses

### `invalid-waiver`

The comment has no reason, or no full URN:

```
gate 3  gherkin       FAIL  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
    tutorial/2-declared-errors/features/quote_shipping.feature:4:1  error  invalid-waiver  a waiver must read "# urn-forge:waive <field URN> <reason>": # urn-forge:waive urn:demo:shipping:parcel:field:zone
```

To fix it, add the reason after the URN. The URN must start with `urn:`.

### `unknown-waiver`

The field is not a constrained input field of the operations that the file tags. In this example, `express` has no constraint, so it has no boundary:

```
gate 3  gherkin       FAIL  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features, 1 waiver(s)
    tutorial/2-declared-errors/features/quote_shipping.feature:4:1  error  unknown-waiver  waiver for urn:demo:shipping:parcel:field:express, which is not a constrained input field of urn:demo:shipping:quote:operation:quote_shipping
```

Do one of these:

- If the URN is incorrect, correct it.
- If the field is in a different operation, move the waiver to a feature file that tags that operation.
- If the field has no constraint or is not in the input, remove the waiver.

### `unused-waiver`

The field has no boundary gap, so the waiver waives nothing. This is a warning:

```
gate 3  gherkin       PASS  1 feature(s), 6 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 1/1 features (boundaryCoverage: error), 1 waiver(s)
    tutorial/3-strict-coverage/features/quote_shipping.feature:5:1  warning  unused-waiver  waiver for urn:demo:shipping:parcel:field:zone waives nothing: the field has no boundary gap; remove the waiver
```

To fix it, remove the waiver. The scenarios already cover the field. If you keep the waiver, it can hide a gap in the future.

## Related pages

- [Adopt strict coverage](adopt-strict-coverage)
- [Write scenarios](write-scenarios)
- [Diagnostics](../reference/diagnostics)
- [Boundary coverage and the ratchet](../explanation/boundary-coverage)
