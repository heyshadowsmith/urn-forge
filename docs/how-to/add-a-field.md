# Add a field

A field is one value with a primitive type and its constraints. This guide adds a field to the manifest, makes it part of an entity, and updates the generated code and the scenarios.

## Before you start

- You have a project that compiles. Refer to [Set up a project](set-up-a-project).
- Choose the short key of the field: `<context>.field.<identifier>`, for example `parcel.field.weight_grams`. The identifier becomes the property name in each entity that uses the field. Refer to [URNs and names](../reference/naming).

## 1. Choose the primitive

urn-forge has eight primitives. Choose the one for the kind of value:

| Primitive | Value | Constraints |
| --- | --- | --- |
| `boolean` | `true` or `false` | `mustBe` |
| `date` | A calendar day, `YYYY-MM-DD`, as a string | `min`, `max` |
| `decimal` | An exact fraction, such as money, as a string | `min`, `max`, `exclusiveMin`, `exclusiveMax`, `scale`, `notIn` |
| `enum` | One of a fixed set of names | `values` (necessary) |
| `float` | A finite JavaScript number | `min`, `max`, `exclusiveMin`, `exclusiveMax`, `notIn` |
| `integer` | A safe-integer JavaScript number | `min`, `max`, `multipleOf`, `notIn` |
| `string` | Free text | `minLength`, `maxLength`, and `regex` or `format` |
| `timestamp` | An instant, ISO 8601 in UTC with `Z`, as a string | `min`, `max`, `exclusiveMin`, `exclusiveMax` |

A field holds one value. To make a list of values, use `many` on the field reference in the entity. Refer to [Add an entity](add-an-entity).

For the full rules of each constraint, refer to [Primitives and constraints](../reference/primitives). For why the set has this shape, read [The MECE model of primitives](../explanation/primitives-model).

## 2. Write the field entry

Add the entry to `domain.manifest.yaml`. Set `primitive`, then the constraints that you need. Each constraint is optional, except `values` on an `enum`.

### `integer`

```yaml
order.field.quantity:
  primitive: integer
  min: 1
  max: 99
  notIn: [13]
```

`min` and `max` are inclusive. `notIn` excludes each value in the list.

```yaml
order.field.pack_size:
  primitive: integer
  min: 6
  multipleOf: 6
```

`multipleOf` permits only the multiples of its value. An `integer` has no `exclusiveMin` or `exclusiveMax`: write `min: 1`, not `exclusiveMin: 0`.

### `float`

```yaml
order.field.unit_cost:
  primitive: float
  min: 0
  max: 10000
```

To exclude the bound itself, use `exclusiveMin` or `exclusiveMax`:

```yaml
order.field.weight_kg:
  primitive: float
  exclusiveMin: 0
  exclusiveMax: 1000
```

Set one bound on each side at most. `min` with `exclusiveMin`, or `max` with `exclusiveMax`, gives `conflicting-constraints`.

### `decimal`

```yaml
order.field.price:
  primitive: decimal
  min: "0.01"
  max: "9999.99"
  scale: 2
```

Use `decimal` for a value that must be exact, such as money. The value is a string, for example `"12.50"`, in the shell and in the core. `scale` is the largest number of digits after the point.

Put each bound in quotes. A YAML number is a binary float, so it is not exact, and `compile` stops.

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

### `string` with `format`

```yaml
order.field.email:
  primitive: string
  format: email
```

`format` is `uuid`, `email` or `uri`. A field has `regex` or `format`, not the two.

### `enum`

```yaml
order.field.delivery:
  primitive: enum
  values: [standard, express, "click & collect"]
```

The value must be one of the listed names. `values` is necessary. It must list at least one name, and each name only one time. To use an `enum` value as an object key in the core, refer to [Use branded values in the core](use-branded-values).

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

### `date`

```yaml
order.field.delivery_day:
  primitive: date
  min: 2026-01-01
  max: 2026-12-31
```

The value is a real calendar day, such as `2026-02-28`. `min` and `max` are inclusive. A `date` has no exclusive bounds.

### `timestamp`

```yaml
order.field.placed_at:
  primitive: timestamp
  min: "2026-01-01T00:00:00Z"
  exclusiveMax: "2027-01-01T00:00:00Z"
```

The value is an instant in UTC, such as `2026-03-01T09:30:00Z`, with up to three digits for fractions of a second. A value with an offset, such as `+02:00`, is not valid. The bounds compare instants, not text.

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
bad-field.yaml:8:3  error  constraint-not-allowed  order.field.note.min: "min" is not a constraint of primitive "string" (allowed: minLength, maxLength, regex, format)
```

If two constraints set the same side of one bound, or the shape two times, `compile` stops:

```
bad-field.yaml:9:17  error  conflicting-constraints  urn:demo:shop:order:field:weight_kg: min and exclusiveMin both set a lower bound; keep one
```

If the constraints exclude all values, `compile` also stops:

```
bad-field.yaml:9:8  error  incoherent-constraints  urn:demo:shop:order:field:quantity: min (100) is greater than max (99), so no value is valid
```

If a necessary constraint is not there, `compile` stops with `missing-property`:

```
bad-field.yaml:6:1  error  missing-property  order.field.delivery.values: missing property "values"
```

A `decimal` bound without quotes gives `invalid-value`:

```
bad-field.yaml:8:8  error  invalid-value  order.field.price.min: must be a decimal in quotes, such as "0.01": a YAML number is not exact
```

`oneOf` and `notEqual` are not constraints. If a field uses one of them, `compile` stops, and the message tells you what to write:

```
bad-field.yaml:8:3  error  unknown-property  order.field.delivery.oneOf: unknown property "oneOf"; for a fixed set of values, use primitive: enum with values: [ … ]
```

```
bad-field.yaml:8:3  error  unknown-property  order.field.quantity.notEqual: unknown property "notEqual"; to exclude values, use notIn: [ … ]
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
- [The MECE model of primitives](../explanation/primitives-model)
