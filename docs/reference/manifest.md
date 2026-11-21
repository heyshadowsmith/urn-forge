# The manifest

The manifest is one YAML file that declares one domain. The default name is `domain.manifest.yaml`. Pass 1 of the compiler examines the structure that this page gives. For the passes, refer to [Compiler passes](./compiler-passes).

This manifest uses each kind except `invariant`, an optional field reference and a declared error:

<<< @/../packages/urn-forge/tests/fixtures/shop/domain.manifest.yaml

The insurance domain uses invariants, dates, exact decimals, an optional field, a link, an embedded entity, entity keys, a deprecated field, events and `recordAs`:

<<< @/../packages/urn-forge/insurance/domain.manifest.yaml{yaml}

The primitives test fixture, `tests/fixtures/primitives/domain.manifest.yaml`, uses each primitive, each constraint and each form of `many`.

## The file

| Rule | Diagnostic if the rule is not obeyed |
| --- | --- |
| The file is valid YAML | `yaml-syntax` |
| A key occurs only one time in each mapping | `duplicate-key` |
| The top level is a mapping. An empty file is not a mapping | `not-a-mapping` |
| The top level has the key `manifest`, which is the header | `missing-header` |
| Each other top-level key is a short key that declares one atom | `invalid-key`, `unknown-kind` |

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
| `stability` | `stable` or `experimental` | No | `stable` | Written to the IR. `urn-forge diff` reads it from the old manifest: while it is `experimental`, a breaking change is a warning. Refer to [Verification gates](./verification-gates) |

The header cannot have other properties (`unknown-property`).

YAML reads `version: 1` and `version: 1.0` as numbers, not strings. These values cause `invalid-value`. A version with three parts, for example `1.0.0`, is a string.

## Short keys and kinds

Each atom has a short key of the form `<context>.<kind>.<identifier>`, for example `order.field.quantity`. For the grammar and the URN that urn-forge makes from it, refer to [URNs and names](./naming).

| Kind | Declares | Section |
| --- | --- | --- |
| `field` | One value, with a primitive and constraints | [Field](#field) |
| `entity` | A named group of properties. Each property refers to a field or to a different entity | [Entity](#entity) |
| `invariant` | A named rule over the fields of one entity | [Invariant](#invariant) |
| `operation` | A handler contract: an input entity, an output entity, the declared errors and the events | [Operation](#operation) |
| `event` | A named fact that an operation returns when it succeeds | [Event](#event) |
| `error` | A declared error: a named refusal of an operation | [Error](#error) |

Each kind also accepts the [lifecycle keys](#lifecycle-keys) `status`, `supersededBy` and `sunsetDate`.

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
- A field does not set if it is optional. The field reference in an entity, an event or an error sets it.

## Field reference

A field reference is an item of the `fields` list of an entity, an event or an error. Each field reference makes one property of the payload. It has one of three forms:

| Form | The property holds | The parsed type of the property |
| --- | --- | --- |
| `ref: <field>` | A value of the field | The branded type of the field |
| `ref: <entity>` | An embedded object of the entity, with its invariants | The parsed type of the entity |
| `link: <entity>` | The value of the `key` of the entity | The branded type of the key field |

```yaml
fields:
  - ref: order.field.note
    required: false
  - ref: order.field.sku
    many: { minItems: 1, maxItems: 50, unique: true }
```

From the insurance domain:

```yaml
fields:
  - ref: policy.field.policy_id
  # The customer who holds the policy: the policy holds the customer's key.
  - link: customer.entity.customer
    as: holder
  # Each peril at most once: a list of coverage objects, unique by their key.
  - ref: policy.entity.coverage
    as: coverages
    many: { minItems: 1, maxItems: 3, unique: true }
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `ref` | string | `ref` or `link` | — | A short key of a field or an entity in this manifest. The pattern is `^[a-z][a-z0-9_]{0,62}\.[a-z]+\.[a-z][a-z0-9_]{0,62}$`. A different kind causes `wrong-ref-kind` |
| `link` | string | `ref` or `link` | — | A short key of an entity in this manifest, with a `key`. A different kind causes `wrong-ref-kind`. An entity with no `key` causes `missing-key` |
| `as` | string | No | The identifier of the target | The property name. A URN segment: `^[a-z][a-z0-9_]{0,62}$`. Other values cause `invalid-value` |
| `required` | boolean | No | `true` | `false` lets the key be absent from the payload |
| `many` | `true`, or a mapping with `minItems`, `maxItems` and `unique` | No | None | The property holds a list of values. Other values cause `invalid-value`: `must be true or { minItems, maxItems, unique }` |

A field reference has exactly one of `ref` and `link`. If not, the result is `invalid-value`: `must have either ref or link`.

The mapping of `many` has these properties. Each one is optional:

| Property | Type | Rule |
| --- | --- | --- |
| `minItems` | integer, 0 or more | The list has this number of items or more. `minItems: 0` lets the list be empty, as does no `minItems` |
| `maxItems` | integer, 0 or more | The list has this number of items or fewer. If `minItems` is greater than `maxItems`, the result is `incoherent-constraints` |
| `unique` | boolean | `true`: no value occurs two times in the list. In a list of an embedded entity, no key occurs two times. The entity must then have a `key` (`missing-key`) |

- `many: true` is a list of any length.
- `required: false` lets the list be absent. An empty list is a different value: it is present, with no items.

- The property name is the value of `as`. If there is no `as`, the property name is the identifier of the target. `order.field.unit_cost` becomes the property `unit_cost`.
- One list cannot refer to the same target two times with the same name (`duplicate-ref`). Give one of them a different name with `as`.
- One list cannot have two properties with the same name, for example `a.field.size` and `b.field.size` (`duplicate-property`). Change one name with `as`.
- An embedded entity cannot embed, at any depth, the entity that embeds it (`embedding-cycle`). Links can make a cycle.
- A link holds only the key value. urn-forge does not make sure that the linked object exists. The shell does that, with its store.
- The generated code keeps the properties in the sequence of the list.

## Entity

```yaml
order.entity.line_total:
  description: The cost of one line
  fields: [{ ref: order.field.total }]
```

```yaml
customer.entity.customer:
  description: A person who holds policies
  key: customer.field.customer_id
  fields:
    - ref: customer.field.customer_id
    - ref: customer.field.name
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `description` | string | Yes | — | Not empty |
| `key` | string | No | None | A short key of a field. The entity must refer to this field with `ref`, with `required: true` and no `many` (pass 3, `invalid-entity-key`). A different kind causes `wrong-ref-kind` |
| `fields` | A list of [field references](#field-reference) | Yes | — | One or more items |

An entity needs a `key` in three cases: a `link` names it, a list with `unique: true` embeds it, or it is in `tables` of the `postgres` plugin. The key is the value that a link holds, and the value that `unique` compares. It is also the primary key of the table of the entity. Refer to [The Postgres schema](./postgres-schema).

An entity does not list its invariants. Each invariant names its entity with `on`. An `invariants` key on an entity causes `unknown-property`.

## Invariant

```yaml
policy.invariant.deductible_below_premium:
  description: A deductible, when there is one, is less than the premium
  on: policy.entity.policy
  rule: deductible is absent or deductible < premium
  message: The deductible must be less than the premium
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `description` | string | Yes | — | Not empty |
| `on` | string | Yes | — | A short key of an entity in this manifest (pass 4). A different kind causes `wrong-ref-kind` |
| `rule` | string | Yes | — | Not empty. A condition in the [rule language](./rule-language) over the property names of the `on` entity (pass 6) |
| `message` | string | Yes | — | Not empty. The message of the issue if the rule does not hold. It has no placeholders |

- An invariant holds for each value of its entity: the input of an operation, its output, or both.
- A rule can name only properties of the `on` entity. It cannot name a property of an embedded entity. The invariants of the embedded entity apply inside it.
- A rule can use an optional field only after a guard, for example `deductible is absent or …`. If not, the result is `unguarded-field`.
- A rule can use a list or an embedded entity only in `is present` and `is absent`.
- A rule compares a link as a value of the key field of the linked entity.
- An entity can have more than one invariant. An invariant has one entity.
- The generated schema of the entity examines each invariant. Refer to [The generated schemas](./generated-schemas).
- Gate 3 needs a scenario that breaks each invariant of the input entity of an operation. Refer to [Verification gates](./verification-gates).

For the grammar, the types and the messages of the rule, refer to [The rule language](./rule-language).

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
| `emits` | A list of strings | No | `[]` | Each item is a short key of an event in this manifest, and occurs only one time. The list can be empty |

From the insurance domain:

```yaml
policy.operation.issue_policy:
  description: Issue a policy as requested
  input: policy.entity.policy
  output: policy.entity.policy
  emits: [policy.event.policy_issued]
```

- `input` and `output` can be the same entity.
- An operation with no `errors` can only succeed. Its handler type has the error type `never`.
- An item of `emits` that names a different kind causes `wrong-ref-kind`. An item that occurs two times causes `duplicate-ref`.
- An operation returns its events only when it succeeds. It can return zero, one or more events of each kind in `emits`, in any sequence. The manifest does not set a count or a sequence.
- The handler type of an operation accepts only the events in its `emits`. Refer to [The generated runtime](./generated-runtime).

## Event

An event records a fact that happened, for example that a policy was issued. An operation lists its events in `emits`, and returns them only when it succeeds. An event never tells of a refusal: a declared error does that.

```yaml
policy.event.policy_issued:
  description: A policy was issued
  fields:
    - ref: policy.field.policy_id
    - link: customer.entity.customer
      as: holder
    - ref: policy.field.premium
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `description` | string | Yes | — | Not empty |
| `fields` | A list of [field references](#field-reference) | No | `[]` | Can be empty |

- The field references of an event have the same forms and rules as those of an entity: `ref` to a field or an entity, `link`, `as`, `required` and `many`.
- No property of an event can have the name `kind` (`reserved-property`), from the identifier of its target or from `as`. The payload of each event has the property `kind`, which contains the URN of the event.
- The value of each property must pass the schema of its field, as in an error. A value that the field refuses gives `ContractViolation`.
- An event has no `key`. A `key` on an event causes `unknown-property`.
- An invariant cannot be on an event. An `on` that names an event causes `wrong-ref-kind`. To give an event a rule, embed an entity that has the invariant.
- An event that no operation emits, and that no error names in `recordAs`, is correct.

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
| `recordAs` | string | No | None | A short key of an event in this manifest. A different kind causes `wrong-ref-kind`. The event must agree with the error (pass 6, `invalid-record-as`) |

- No property of an error can have the name `kind` (`reserved-property`), from the identifier of its target or from `as`. The payload of each error has the property `kind`, which contains the URN of the error.
- The value of each property must pass the schema of its field, with all the constraints of the field. The runtime parses the error with these schemas. A value that the field refuses gives `ContractViolation`, not the error. Thus, if an error must carry a value outside the limits of a field, declare a different field for it. Refer to [Declare an error](../how-to/declare-an-error#_1-write-the-error-entry).
- An error that no operation declares is correct.

### `recordAs`

`recordAs` names an event that the shell can record when the error occurs, for example in an audit trail. The core does not return this event. `executeOperation` makes it from the fields of the error, and gives it as `record` on the `DomainError`. The event is not one of the events in `emits`. Refer to [The generated runtime](./generated-runtime).

From the insurance domain:

```yaml
policy.event.refund_refused:
  description: A cancellation was refused because its refund was below the minimum, for an audit trail
  fields:
    - ref: policy.field.refund
    # Optional, so the error's fields can build the event (events plan, decision 6).
    - ref: policy.field.cancellation_date
      required: false

policy.error.refund_below_minimum:
  description: The refund is too small to pay out
  category: precondition
  retryable: false
  message: A refund of {refund} is below the minimum of 1.00
  fields:
    - ref: policy.field.refund
  recordAs: policy.event.refund_refused
```

The fields of the error must make the event. Thus pass 6 compares the properties of the two atoms by property name:

| Rule | If the rule is not obeyed |
| --- | --- |
| The event has each property of the error | `invalid-record-as`: `has no property "<name>", which the error has` |
| Each such property of the event has the same target, the same `required` and the same `many` as in the error | `invalid-record-as`: `has a property "<name>" that differs from the error's; it must have the same target, presence and count` |
| Each other property of the event has `required: false` | `invalid-record-as`: `has the required property "<name>", which the error does not have; make it optional, so the error's fields can build the event` |

### Message template

The `message` of an error is a template. A placeholder is `{` and `}` around one or more characters that are not a space, `{` or `}`.

| Text in `message` | Placeholder |
| --- | --- |
| `{sku}` | Yes, `sku` |
| `{Sku}` | Yes, `Sku`. Pass 6 reports it, because no field has this name |
| `{ sku }` | No. The text stays as it is |
| `{}` | No. The text stays as it is |

Each placeholder must name a property of the error with `required: true` and no `many` (pass 6, `unknown-placeholder`). The property can be a field or a link. It cannot be an embedded entity. The generated runtime puts the value of the field in place of the placeholder.

## Lifecycle keys

Each atom of each kind accepts these three keys, next to the properties of its kind:

```yaml
policy.field.note:
  primitive: string
  description: Free text about a coverage
  status: deprecated
  supersededBy: policy.field.remark
  sunsetDate: 2027-06-30
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `status` | `active`, `deprecated` or `sunset` | No | `active` | Other values cause `invalid-value`: `must be active, deprecated or sunset` |
| `supersededBy` | string | No | None | Only if `status` is `deprecated` or `sunset`. A short key of an atom of the same kind in this manifest, not the atom itself (pass 4). A URN causes `invalid-value`: `must be a short key such as policy.field.remark` |
| `sunsetDate` | A date `YYYY-MM-DD` | No | None | Only if `status` is `deprecated` or `sunset`. A day of the calendar, with quotes or not. Other values cause `invalid-value`: `must be a date YYYY-MM-DD` |

| Problem | Code |
| --- | --- |
| `supersededBy` or `sunsetDate` on an atom with `status: active`, or with no `status` | `invalid-lifecycle`, one time for each key |
| `supersededBy` names the atom itself | `invalid-lifecycle` |
| `supersededBy` names an atom of a different kind | `wrong-ref-kind` |
| `supersededBy` names no atom of the manifest | `unresolved-ref` |

What each status does:

| Status | References to the atom (pass 8) | Generated code | Gates |
| --- | --- | --- | --- |
| `active` | No diagnostic | All, as before | All checks |
| `deprecated` | From an active atom: `deprecated-ref`, a warning. From a deprecated or a sunset atom: no diagnostic | All, with a mark: `@deprecated` in the TypeScript comment, and `deprecated: …` in the SQL comment | All checks |
| `sunset` | From an active or a deprecated atom: `sunset-ref`, an error. From a sunset atom: no diagnostic | None. No schema, type, handler or table | No check. The atom needs no handler and no scenario |

- If an atom has a `sunsetDate` on or before the reference date, a reference to it from an active or a deprecated atom is `sunset-ref`. Without a reference date, pass 8 does not compare sunset dates. Refer to [Compiler passes](./compiler-passes).
- The generated code depends on `status` only, never on `sunsetDate`.
- A sunset atom stays in the manifest, so that its URN never gets a second meaning. `urn-forge diff` reports a removed atom as a breaking change, also a sunset atom.
- `status` moves forward only: `active`, then `deprecated`, then `sunset`. `urn-forge diff` reports a step back as a breaking change.
- The IR has `lifecycle` on a node only if `status` is not `active`. Refer to [Compiler passes](./compiler-passes).

For the reasons, refer to [Compatibility and the direction of use](../explanation/compatibility).

## Properties that urn-forge does not accept

Specification v1.1 has these properties. urn-forge 0.1.0 does not accept them at this time. Refer to [Scope](./scope).

| Item | Where in the specification | Diagnostic in urn-forge 0.1.0 |
| --- | --- | --- |
| The primitives `list`, `record` and `ref` | `primitive` of a field | `unknown-primitive`. For a list, use `many` on the field reference. For a different entity, use `ref` or `link` on the field reference. urn-forge does not have a `record` at this time |
| The constraint `oneOf` | A `string` field | `unknown-property`, with the hint `for a fixed set of values, use primitive: enum with values: [ … ]` |
| The constraint `notEqual` | A number field | `unknown-property`, with the hint `to exclude values, use notIn: [ … ]` |
| The format `iso-date` | `format` of a `string` field | `invalid-value`: `must be one of uuid, email, uri`. Use the `date` primitive |
| The constraint `precision` | A field | `unknown-property`. For a `decimal`, use `scale` and the range |
| The constraints `after` and `before` | A field | `unknown-property`. For a `date` or a `timestamp`, use `min` and `max` |
| `nullable` | A field reference | `unknown-property` |
| `invariants` | An entity | `unknown-property`. An invariant names its entity with `on`. urn-forge accepts `key`, with a different use. Refer to [Entity](#entity) |
| `key` | An event | `unknown-property`. An event is not stored, so it has no key |
| A `recordAs` event with a mandatory property that the error does not have | An error | `invalid-record-as`. The specification permits any event whose fields are a superset of the fields of the error |
| A URN in `supersededBy` | Each atom | `invalid-value`. Use the short key of the atom |
| A field as `input` or `output` | An operation | `wrong-ref-kind` |

## Related pages

- [URNs and names](./naming)
- [Primitives and constraints](./primitives)
- [Diagnostics](./diagnostics)
- [Add a field](../how-to/add-a-field)
- [URNs as permanent names](../explanation/urns)
