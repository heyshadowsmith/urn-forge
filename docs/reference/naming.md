# URNs and names

Each atom has one URN. urn-forge makes the URN, the brand identifier, the property name and the generated export names from the segments of the short key and from the header.

## URN grammar

```
urn:<namespace>:<domain>:<context>:<kind>:<identifier>
urn:demo:shop:order:field:unit_cost
```

| Segment | Source | Pattern | Example |
| --- | --- | --- | --- |
| `urn` | Fixed text | `urn` | `urn` |
| `namespace` | `manifest.namespace` in the header | `^[a-z][a-z0-9_]{0,62}$` | `demo` |
| `domain` | `manifest.domain` in the header | `^[a-z][a-z0-9_]{0,62}$` | `shop` |
| `context` | The first segment of the short key | `^[a-z][a-z0-9_]{0,62}$` | `order` |
| `kind` | The second segment of the short key | `field`, `entity`, `operation` or `error` | `field` |
| `identifier` | The third segment of the short key | `^[a-z][a-z0-9_]{0,62}$` | `unit_cost` |

- A segment other than `kind` is lowercase snake_case. It starts with a letter, contains only `a` to `z`, `0` to `9` and `_`, and has a maximum of 63 characters.
- The `_` character can occur at the end of a segment and two times in sequence, for example `x_` or `a__b`.
- A URN is case-sensitive.
- The specification also has the kinds `invariant` and `event`. urn-forge 0.1.0 does not accept them at this time (`unsupported-kind`). Refer to [Scope](./scope).

## Short keys

A short key is the URN without `urn`, the namespace and the domain:

```
<context>.<kind>.<identifier>
order.field.unit_cost
```

| Item | Value |
| --- | --- |
| Pattern | `^([a-z][a-z0-9_]{0,62})\.([a-z]+)\.([a-z][a-z0-9_]{0,62})$` |
| Expansion (pass 2) | `urn:<namespace>:<domain>:` and the three segments, with `:` in place of `.` |
| Example | `order.field.unit_cost` becomes `urn:demo:shop:order:field:unit_cost` |

A key that does not agree with the pattern causes `invalid-key`. A key that agrees with the pattern but has an unknown `kind` segment causes `unknown-kind`, or `unsupported-kind` for `invariant` and `event`.

### Where each form occurs

| Location | Form |
| --- | --- |
| A top-level key of the manifest | Short key |
| `ref` of a field reference, `input`, `output` and the items of `errors` | Short key |
| The tags of a feature file, for example `@urn:demo:shop:order:operation:price_line` | URN |
| The steps `Then the operation fails with "<error URN>"` | URN |
| The generated code: `v.brand(…)`, the keys of `DomainCoreImplementation`, `DispatchMap` and `ErrorPayloads`, the `kind` of an error payload | URN |
| The messages of diagnostics | The short key in pass 1, else the URN |

## Brand identifiers

The brand identifier is the PascalCase form of the context and the identifier. The namespace, the domain and the kind are not part of it.

urn-forge makes it with these steps (`toBrandIdentifier`):

1. Join the context and the identifier with `_`.
2. Divide the result at each `_`.
3. Remove the empty parts.
4. Change the first character of each part to uppercase.
5. Join the parts.

| Context | Identifier | Brand identifier |
| --- | --- | --- |
| `order` | `unit_cost` | `OrderUnitCost` |
| `policy` | `deductible_amount` | `PolicyDeductibleAmount` |
| `geo_metry` | `radius` | `GeoMetryRadius` |
| `geo` | `metry_radius` | `GeoMetryRadius` |
| `v2` | `x_1` | `V2X1` |
| `a` | `b__c` | `ABC` |

Each atom has a brand identifier, also an operation and an error. Two atoms cannot have the same brand identifier, also if their kinds are different (`duplicate-brand`). For example, `order.field.size` and `order.entity.size` both have the brand identifier `OrderSize`.

## Property names

In an entity or an error, the property name of a field is the identifier of the field, with no change. `order.field.unit_cost` is the property `unit_cost`. The property names are the table headers in the feature files.

## Generated export names

| Kind | File | Export | Form | Example for `order.field.quantity` or `order.operation.price_line` |
| --- | --- | --- | --- | --- |
| `field`, `entity`, `error` | `domain.schemas.generated.ts` | The Valibot schema | `<Brand>Schema` | `OrderQuantitySchema` |
| `field`, `entity`, `error` | `domain.schemas.generated.ts` | The output type, with the brand (`v.InferOutput`) | `<Brand>` | `OrderQuantity` |
| `field`, `entity`, `error` | `domain.schemas.generated.ts` | The input type, without the brand (`v.InferInput`) | `<Brand>Input` | `OrderQuantityInput` |
| `operation` | `domain.runtime.generated.ts` | The handler type | `<Brand>Handler` | `OrderPriceLineHandler` |

`<Brand>` is the brand identifier. The functions `schemaNames` and `handlerName` of the [package API](./public-api) give these names. An operation has no schema of its own. The runtime file imports the schemas file as the namespace `s`. Thus a handler name cannot be the same as a schema export. The runtime file also has fixed exports, for example `Result`, `DispatchMap` and `executeOperation`. Refer to [The generated runtime](./generated-runtime).

## The reserved property `kind`

The payload of each error has the property `kind`. Its value is the URN of the error, for example `kind: "urn:demo:shop:order:error:price_unavailable"`. As a result, no field of an error can have the identifier `kind` (`reserved-property`). A field with the identifier `kind` is correct in an entity.

## Collisions

urn-forge reports these name collisions. Each one is an error.

| Code | Pass | Collision | Example |
| --- | --- | --- | --- |
| `duplicate-key` | YAML | A top-level key occurs two times | `order.field.quantity` two times |
| `duplicate-urn` | 3 | Two entries expand to the same URN | A YAML file cannot cause this at this time, because a short key that occurs two times is a `duplicate-key` error first |
| `duplicate-brand` | 3 | Two atoms have the same brand identifier | `geo_metry.field.radius` and `geo.field.metry_radius` |
| `duplicate-property` | 3 | Two fields in one entity or error have the same identifier | `a.field.size` and `b.field.size` in one entity |
| `duplicate-ref` | 3 | One list refers to the same atom two times | The same field two times in `fields`, or the same error two times in `errors` |
| `reserved-property` | 3 | A field of an error has the identifier `kind` | `order.field.kind` in the `fields` of an error |
| `export-collision` | Valibot plugin | A generated export name of one atom is the same as an export name of a different atom | `geometry.field.radius_input` exports `GeometryRadiusInput`, which is also the input type of `geometry.field.radius` |

For `duplicate-brand`, urn-forge reports the atom that is second in URN order. For the messages, refer to [Diagnostics](./diagnostics).

## Related pages

- [The manifest](./manifest)
- [Compiler passes](./compiler-passes)
- [The generated schemas](./generated-schemas)
- [URNs as permanent names](../explanation/urns)
- [The functional core and brands](../explanation/functional-core)
