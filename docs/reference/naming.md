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
| `kind` | The second segment of the short key | `field`, `entity`, `invariant`, `operation` or `error` | `field` |
| `identifier` | The third segment of the short key | `^[a-z][a-z0-9_]{0,62}$` | `unit_cost` |

- A segment other than `kind` is lowercase snake_case. It starts with a letter, contains only `a` to `z`, `0` to `9` and `_`, and has a maximum of 63 characters.
- The `_` character can occur at the end of a segment and two times in sequence, for example `x_` or `a__b`.
- A URN is case-sensitive.
- The specification also has the kind `event`. urn-forge 0.1.0 does not accept it at this time (`unsupported-kind`). Refer to [Scope](./scope).

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

A key that does not agree with the pattern causes `invalid-key`. A key that agrees with the pattern but has an unknown `kind` segment causes `unknown-kind`, or `unsupported-kind` for `event`.

### Where each form occurs

| Location | Form |
| --- | --- |
| A top-level key of the manifest | Short key |
| `ref` of a field reference, `input`, `output`, the items of `errors` and `on` of an invariant | Short key |
| The tags of a feature file, for example `@urn:demo:shop:order:operation:price_line` | URN |
| The steps `Then the operation fails with "<error URN>"` and `Then the input is rejected by "<invariant URN>"` | URN |
| The generated code: `v.brand(…)`, the keys of `DomainCoreImplementation`, `DispatchMap` and `ErrorPayloads`, the `kind` of an error payload, the `urn` of an `InvariantInfo` | URN |
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

Each atom has a brand identifier, also an invariant, an operation and an error. Two atoms cannot have the same brand identifier, also if their kinds are different (`duplicate-brand`). For example, `order.field.size` and `order.entity.size` both have the brand identifier `OrderSize`.

## Property names

In an entity or an error, each field reference makes one property. The property name is the value of `as` on the field reference. If there is no `as`, the property name is the identifier of the target, with no change:

| Field reference | Property name |
| --- | --- |
| `ref: order.field.unit_cost` | `unit_cost` |
| `ref: policy.entity.coverage` | `coverage` |
| `ref: policy.entity.coverage`, `as: coverages` | `coverages` |
| `link: customer.entity.customer`, `as: holder` | `holder` |

- `as` has the form of an identifier: `^[a-z][a-z0-9_]{0,62}$`. If not, the result is `invalid-value`.
- Use `as` if two references would make the same name, for example two links to one entity. Use it also if a different name is clearer, for example `coverages` for a list.
- The property names are the table headers in the feature files and the field names in an invariant rule. They are also the names in an object cell.

## Generated export names

| Kind | File | Export | Form | Example for `order.field.quantity` or `order.operation.price_line` |
| --- | --- | --- | --- | --- |
| `field`, `entity`, `error` | `domain.schemas.generated.ts` | The Valibot schema | `<Brand>Schema` | `OrderQuantitySchema` |
| `field`, `entity`, `error` | `domain.schemas.generated.ts` | The output type, with the brand (`v.InferOutput`) | `<Brand>` | `OrderQuantity` |
| `field`, `entity`, `error` | `domain.schemas.generated.ts` | The input type, without the brand (`v.InferInput`) | `<Brand>Input` | `OrderQuantityInput` |
| `operation` | `domain.runtime.generated.ts` | The handler type | `<Brand>Handler` | `OrderPriceLineHandler` |
| `invariant` | `domain.schemas.generated.ts` | The rule function | `<Brand>Rule` | `PolicyTermIsPositiveRule` for `policy.invariant.term_is_positive` |
| `entity` with invariants | `domain.schemas.generated.ts` | The object without the checks. Not exported | `<Brand>Fields` | `PolicyPolicyFields` for `policy.entity.policy` |

`<Brand>` is the brand identifier. The functions `schemaNames`, `handlerName` and `ruleName` of the [package API](./public-api) give these names. An operation has no schema of its own. The runtime file imports the schemas file as the namespace `s`. Thus a handler name cannot be the same as a schema export. The runtime file also has fixed exports, for example `Result`, `DispatchMap` and `executeOperation`. Refer to [The generated runtime](./generated-runtime).

## The reserved property `kind`

The payload of each error has the property `kind`. Its value is the URN of the error, for example `kind: "urn:demo:shop:order:error:price_unavailable"`. As a result, no property of an error can have the name `kind` (`reserved-property`), from the identifier of its target or from `as`. A field with the identifier `kind` is correct in an entity, and in an error if `as` gives it another name.

## Collisions

urn-forge reports these name collisions. Each one is an error.

| Code | Pass | Collision | Example |
| --- | --- | --- | --- |
| `duplicate-key` | YAML | A top-level key occurs two times | `order.field.quantity` two times |
| `duplicate-brand` | 3 | Two atoms have the same brand identifier | `geo_metry.field.radius` and `geo.field.metry_radius` |
| `duplicate-property` | 3 | Two properties of one entity or error from two different targets have the same name | `a.field.size` and `b.field.size` in one entity, with no `as` |
| `duplicate-ref` | 3 | One list refers to the same atom two times with the same name | The same field two times in `fields`, two links to one entity with no `as`, or the same error two times in `errors` |
| `reserved-property` | 3 | A property of an error has the name `kind` | `order.field.kind` in the `fields` of an error without `as`, or `as: kind` |
| `export-collision` | Valibot plugin | A generated export name of one atom is the same as an export name of a different atom. The `<Brand>Rule` of an invariant is part of this check | `geometry.field.radius_input` exports `GeometryRadiusInput`, which is also the input type of `geometry.field.radius`. `p.invariant.term` exports `PTermRule`, which is also the output type of `p.field.term_rule` |

For `duplicate-brand`, urn-forge reports the atom that is second in URN order. For the messages, refer to [Diagnostics](./diagnostics).

## Related pages

- [The manifest](./manifest)
- [Compiler passes](./compiler-passes)
- [The generated schemas](./generated-schemas)
- [URNs as permanent names](../explanation/urns)
- [The functional core and brands](../explanation/functional-core)
