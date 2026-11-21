# Add a field

A field is one value with a primitive type and its constraints. This guide adds a field to the manifest, makes it part of an entity, and updates the generated code and the scenarios.

## Before you start

- You have a project that compiles. Refer to [Set up a project](set-up-a-project).
- Choose the short key of the field: `<context>.field.<identifier>`, for example `parcel.field.weight_grams`. The identifier becomes the property name in each entity that uses the field. Refer to [URNs and names](../reference/naming).

## 1. Choose the primitive

urn-forge has four primitives:

| Primitive | Value | Constraints |
| --- | --- | --- |
| `integer` | A safe-integer JavaScript number | `min`, `max`, `notEqual` |
| `float` | A finite JavaScript number | `min`, `max`, `notEqual` |
| `string` | A JavaScript string | `minLength`, `maxLength`, `regex`, `oneOf` |
| `boolean` | `true` or `false` | `mustBe` |

For the full rules of each constraint, refer to [Primitives and constraints](../reference/primitives).

## 2. Write the field entry

Add the entry to `domain.manifest.yaml`. Set `primitive`, then the constraints that you need. Each constraint is optional.

### `integer`

```yaml
order.field.quantity:
  primitive: integer
  min: 1
  max: 99
  notEqual: 13
```

`min` and `max` are inclusive. `notEqual` excludes one value.

### `float`

```yaml
order.field.unit_cost:
  primitive: float
  min: 0
  max: 10000
```

### `string` with a length

```yaml
order.field.note:
  primitive: string
  minLength: 1
  maxLength: 140
```

### `string` with `regex`

```yaml
order.field.sku:
  primitive: string
  regex: '[A-Z]{3}-[0-9]{4}'
```

The pattern must match the full value. urn-forge adds `^(?:` and `)$`, and uses the `u` flag. Put the pattern in single quotes, so that YAML does not change the backslashes.

### `string` with `oneOf`

```yaml
order.field.delivery:
  primitive: string
  oneOf: [standard, express, "click & collect"]
```

The value must be one of the listed strings. To use a `oneOf` value as an object key in the core, refer to [Use branded values in the core](use-branded-values).

### `boolean`

```yaml
order.field.gift_wrap:
  primitive: boolean
```

### `boolean` with `mustBe`

```yaml
order.field.terms_accepted:
  primitive: boolean
  mustBe: true
  description: The buyer accepted the terms
```

Only the value of `mustBe` is valid.

## 3. Add a description

Add `description` to each field. It is optional, but the generated code shows it in the comment above the schema:

```ts
/** urn:demo:shop:order:field:terms_accepted — The buyer accepted the terms */
export const OrderTermsAcceptedSchema = v.pipe(
  v.boolean(),
  v.value(true),
  v.brand("urn:demo:shop:order:field:terms_accepted"),
);
```

## 4. Use the field in an entity

A field has no effect until an entity lists it. Add a reference to the `fields` of an entity:

```yaml
parcel.entity.parcel:
  description: A parcel to send
  fields:
    - ref: parcel.field.weight_grams
    - ref: parcel.field.zone
    - ref: parcel.field.express
      required: false
```

Refer to [Add an entity](add-an-entity).

## 5. Compile

Run this command:

```bash
npx urn-forge compile
```

If a constraint does not belong to the primitive, `compile` stops:

```
bad-field.yaml:12:3  error  constraint-not-allowed  order.field.note.min: "min" is not a constraint of primitive "string" (allowed: minLength, maxLength, regex, oneOf)
```

If the constraints exclude all values, `compile` also stops:

```
bad-field.yaml:9:8  error  incoherent-constraints  urn:demo:shop:order:field:quantity: min (100) is greater than max (99), so no value is valid
```

For each code, refer to [Diagnostics](../reference/diagnostics).

## 6. Update the scenarios

Run `npx urn-forge verify`.

- **If the field is a required input field,** gate 3 fails for each table of `When I run the operation with:` that has no column for it:

  ```
  features/quote_shipping.feature:6:7  error  missing-column  the table of "I run the operation with:" has no column for required input field(s) "label" of urn:demo:shipping:quote:operation:quote_shipping; to test a missing value, keep the column and leave the cell empty
  ```

  Add the column to each table.

- **If the field has constraints and is in an input,** gate 3 shows the boundary values that no scenario sends:

  ```
  features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:label in the input of urn:demo:shipping:quote:operation:quote_shipping has no value of length 1 (minLength), no value of length 0 (below minLength), no value of length 40 (maxLength), no value of length 41 (above maxLength)
  ```

  Add a scenario for each boundary value. A value in the range gives an output. A value out of the range gives `Then the input is rejected on "<field>"`. Refer to [Write scenarios](write-scenarios).

## Result

`npx urn-forge verify` passes, and no warning names the new field.

## Related pages

- [Primitives and constraints](../reference/primitives)
- [The manifest](../reference/manifest)
- [Add an entity](add-an-entity)
- [Write scenarios](write-scenarios)
- [Boundary coverage and the ratchet](../explanation/boundary-coverage)
