# The manifest

The manifest is one YAML file that declares one domain. The default name is `domain.manifest.yaml`. Pass 1 of the compiler examines the structure that this page gives. For the passes, refer to [Compiler passes](./compiler-passes).

This manifest uses each kind, an optional field reference and a declared error:

<<< @/../packages/urn-forge/tests/fixtures/shop/domain.manifest.yaml

The primitives test fixture, `tests/fixtures/primitives/domain.manifest.yaml`, uses each primitive, each constraint and each form of `many`.

## The file

| Rule | Diagnostic if the rule is not obeyed |
| --- | --- |
| The file is valid YAML | `yaml-syntax` |
| A key occurs only one time in each mapping | `duplicate-key` |
| The top level is a mapping. An empty file is not a mapping | `not-a-mapping` |
| The top level has the key `manifest`, which is the header | `missing-header` |
| Each other top-level key is a short key that declares one atom | `invalid-key`, `unknown-kind`, `unsupported-kind` |

- The sequence of the top-level keys is not important. The generated code uses URN order.
- A manifest with a header and no atoms is correct.
- A manifest cannot refer to a different manifest.

## The header

```yaml
manifest:
  namespace: demo
  domain: shop
  version: 0.1.0
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `namespace` | string | Yes | — | A URN segment: `^[a-z][a-z0-9_]{0,62}$` |
| `domain` | string | Yes | — | A URN segment: `^[a-z][a-z0-9_]{0,62}$` |
| `version` | string | Yes | — | A semver version, for example `0.1.0`, `1.0.0-rc.1` or `1.0.0+build.5` |
| `stability` | `stable` or `experimental` | No | `stable` | Written to the IR only. urn-forge 0.1.0 does not use it for a check |

The header cannot have other properties (`unknown-property`).

YAML reads `version: 1` and `version: 1.0` as numbers, not strings. These values cause `invalid-value`. A version with three parts, for example `1.0.0`, is a string.

## Short keys and kinds

Each atom has a short key of the form `<context>.<kind>.<identifier>`, for example `order.field.quantity`. For the grammar and the URN that urn-forge makes from it, refer to [URNs and names](./naming).

| Kind | Declares | Section |
| --- | --- | --- |
| `field` | One value, with a primitive and constraints | [Field](#field) |
| `entity` | A named group of field references | [Entity](#entity) |
| `operation` | A handler contract: an input entity, an output entity and the declared errors | [Operation](#operation) |
| `error` | A declared error: a named refusal of an operation | [Error](#error) |

## Field

```yaml
order.field.quantity: { primitive: integer, min: 1, max: 99, notIn: [13] }
order.field.delivery: { primitive: enum, values: [standard, express, "click & collect"] }
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `primitive` | `boolean`, `date`, `decimal`, `enum`, `float`, `integer`, `string` or `timestamp` | Yes | — | Other values cause `unknown-primitive` |
| `description` | string | No | None | Not empty. The generated schema has it in its comment |
| A constraint | Refer to [Primitives and constraints](./primitives) | No, except `values` of an `enum` | None | A constraint of the primitive of the field |

- A field accepts only the constraints of its primitive. A constraint of a different primitive causes `constraint-not-allowed`, and the message gives the constraints of the primitive. A key that is a constraint of no primitive causes `unknown-property`.
- An `enum` field must have `values`. If it does not, the result is `missing-property`.
- A field can have only one constraint for each side of an aspect: `min` or `exclusiveMin`, `max` or `exclusiveMax`, and `regex` or `format`. Two cause `conflicting-constraints`.
- The constraints of a field must accept one or more values (pass 7, `incoherent-constraints`).
- Write each bound of a `decimal` in quotes, for example `min: "0.01"`. A YAML number causes `invalid-value`, because YAML reads it as a binary float.
- Write a bound of a `timestamp` in quotes, for example `min: "2026-01-01T00:00:00Z"`. A bound of a `date` can have quotes or not, for example `min: 2026-01-01`.
- A field does not set if it is optional. The field reference in an entity or an error sets it.

## Field reference

A field reference is an item of the `fields` list of an entity or an error.

```yaml
fields:
  - ref: order.field.note
    required: false
  - ref: order.field.sku
    many: { minItems: 1, maxItems: 50, unique: true }
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `ref` | string | Yes | — | A short key of a field in this manifest. The pattern is `^[a-z][a-z0-9_]{0,62}\.[a-z]+\.[a-z][a-z0-9_]{0,62}$` |
| `required` | boolean | No | `true` | `false` lets the key be absent from the payload |
| `many` | `true`, or a mapping with `minItems`, `maxItems` and `unique` | No | None | The property holds a list of values of the field. Other values cause `invalid-value`: `must be true or { minItems, maxItems, unique }` |

The mapping of `many` has these properties. Each one is optional:

| Property | Type | Rule |
| --- | --- | --- |
| `minItems` | integer, 0 or more | The list has this number of items or more. `minItems: 0` lets the list be empty, as does no `minItems` |
| `maxItems` | integer, 0 or more | The list has this number of items or fewer. If `minItems` is greater than `maxItems`, the result is `incoherent-constraints` |
| `unique` | boolean | `true`: no value occurs two times in the list |

- `many: true` is a list of any length.
- `required: false` lets the list be absent. An empty list is a different value: it is present, with no items.

- The property name of the field in the payload is its identifier. `order.field.unit_cost` becomes the property `unit_cost`.
- One list cannot refer to the same field two times (`duplicate-ref`).
- One list cannot have two fields with the same identifier, for example `a.field.size` and `b.field.size` (`duplicate-property`).
- The generated code keeps the fields in the sequence of the list.

## Entity

```yaml
order.entity.line_total:
  description: The cost of one line
  fields: [{ ref: order.field.total }]
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `description` | string | Yes | — | Not empty |
| `fields` | A list of [field references](#field-reference) | Yes | — | One or more items |

## Operation

```yaml
order.operation.price_line:
  description: Price one order line
  input: order.entity.line
  output: order.entity.line_total
  errors: [order.error.price_unavailable, order.error.pricing_offline]
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `description` | string | Yes | — | Not empty |
| `input` | string | Yes | — | A short key of an entity in this manifest |
| `output` | string | Yes | — | A short key of an entity in this manifest |
| `errors` | A list of strings | No | `[]` | Each item is a short key of an error in this manifest, and occurs only one time. The list can be empty |

- `input` and `output` can be the same entity.
- An operation with no `errors` can only succeed. Its handler type has the error type `never`.

## Error

```yaml
order.error.price_unavailable:
  description: No price is known for the item
  category: not_found
  retryable: false
  message: No price for {sku}
  fields: [{ ref: order.field.sku }]
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `description` | string | Yes | — | Not empty |
| `category` | `validation`, `conflict`, `not_found`, `forbidden` or `precondition` | Yes | — | Metadata for the shell. The core does not read it |
| `retryable` | boolean | Yes | — | Metadata for the shell. `true` if the same request can be correct at a later time |
| `message` | string | Yes | — | Not empty. A [message template](#message-template) |
| `fields` | A list of [field references](#field-reference) | No | `[]` | Can be empty |

- No field of an error can have the identifier `kind` (`reserved-property`). The payload of each error has the property `kind`, which contains the URN of the error.
- An error that no operation declares is correct.

### Message template

The `message` of an error is a template. A placeholder is `{` and `}` around one or more characters that are not a space, `{` or `}`.

| Text in `message` | Placeholder |
| --- | --- |
| `{sku}` | Yes, `sku` |
| `{Sku}` | Yes, `Sku`. Pass 6 reports it, because no field has this name |
| `{ sku }` | No. The text stays as it is |
| `{}` | No. The text stays as it is |

Each placeholder must name a field of the error with `required: true` and no `many` (pass 6, `unknown-placeholder`). The generated runtime puts the value of the field in place of the placeholder.

## Properties and kinds that urn-forge does not accept

Specification v1.1 has these properties and kinds. urn-forge 0.1.0 does not accept them at this time. Refer to [Scope](./scope).

| Item | Where in the specification | Diagnostic in urn-forge 0.1.0 |
| --- | --- | --- |
| The kinds `invariant` and `event` | A short key | `unsupported-kind` |
| The primitives `list`, `record` and `ref` | `primitive` of a field | `unknown-primitive`. For a list, use `many` on the field reference |
| The constraint `oneOf` | A `string` field | `unknown-property`, with the hint `for a fixed set of values, use primitive: enum with values: [ … ]` |
| The constraint `notEqual` | A number field | `unknown-property`, with the hint `to exclude values, use notIn: [ … ]` |
| The format `iso-date` | `format` of a `string` field | `invalid-value`: `must be one of uuid, email, uri`. Use the `date` primitive |
| The constraint `precision` | A field | `unknown-property`. For a `decimal`, use `scale` and the range |
| The constraints `after` and `before` | A field | `unknown-property`. For a `date` or a `timestamp`, use `min` and `max` |
| `nullable` | A field reference | `unknown-property` |
| `key` and `invariants` | An entity | `unknown-property` |
| `emits` | An operation | `unknown-property` |
| `recordAs` | An error | `invalid-value`: `needs the event kind, which urn-forge does not support yet` |
| `status`, `supersededBy` and `sunsetDate` | Each atom | `unknown-property` |
| A field as `input` or `output` | An operation | `wrong-ref-kind` |

## Related pages

- [URNs and names](./naming)
- [Primitives and constraints](./primitives)
- [Diagnostics](./diagnostics)
- [Add a field](../how-to/add-a-field)
- [URNs as permanent names](../explanation/urns)
