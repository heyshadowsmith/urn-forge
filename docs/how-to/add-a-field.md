# Add a field

Add a field: one value with a primitive type and its constraints.

## Before you start

- You have a project that compiles. Refer to [Set up a project](set-up-a-project).
- Choose the short key: `<context>.field.<identifier>`, for example `parcel.field.weight_grams`. The identifier becomes the property name in each entity that uses the field.

## Steps

1. Choose the primitive:

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

2. Add the entry to `domain.manifest.yaml`. Set `primitive`, the constraints that you need and a `description`:

   ```yaml
   order.field.price:
     primitive: decimal
     min: "0.01"
     max: "9999.99"
     scale: 2
   ```

   Put each `decimal` bound in quotes. A YAML number is not exact, so `compile` stops.

3. Add a reference to the field in the `fields` of an entity. A field has no effect until an entity lists it. Refer to [Add an entity](add-an-entity).
4. Run `npx urn-forge compile`. If a constraint does not belong to the primitive, `compile` stops:

   ```
   bad-field.yaml:8:3  error  constraint-not-allowed  order.field.note.min: "min" is not a constraint of primitive "string" (allowed: minLength, maxLength, regex, format)
   ```

   Correct the entry at the line and column that the problem gives. For each code, refer to [Diagnostics](../reference/diagnostics).

5. Run `npx urn-forge verify`. If the field is a required input field, gate 3 fails for each input table without its column:

   ```
   features/quote_shipping.feature:6:7  error  missing-column  the table of "I run the operation with:" has no column for required input field(s) "label" of urn:demo:shipping:quote:operation:quote_shipping; to test a missing value, keep the column and leave the cell empty
   ```

   Add the column to each table. Then add a scenario for each boundary value that gate 3 names. Refer to [Write scenarios](write-scenarios).

For the rules of each constraint, such as `regex`, `format` and `mustBe`, refer to [Primitives and constraints](../reference/primitives).

## Result

`npx urn-forge verify` passes, and no warning names the new field.

## Related pages

- [Primitives and constraints](../reference/primitives)
- [Add an entity](add-an-entity)
- [Write scenarios](write-scenarios)
