# The manifest

The manifest is one YAML file that declares one domain. The default name is `domain.manifest.yaml`. This manifest uses each kind except `invariant`:

<<< @/../packages/urn-forge/tests/fixtures/shop/domain.manifest.yaml

## The file

| Rule | Diagnostic |
| --- | --- |
| The file is valid YAML | `yaml-syntax` |
| A key occurs only one time in each mapping | `duplicate-key` |
| The top level is a mapping | `not-a-mapping` |
| The top level has the key `manifest`, the header | `missing-header` |
| Each other top-level key is the short key of one atom | `invalid-key`, `unknown-kind` |

- The sequence of the keys is not important. The generated code uses URN order.
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
| `namespace` | string | Yes | — | `^[a-z][a-z0-9_]{0,62}$` |
| `domain` | string | Yes | — | `^[a-z][a-z0-9_]{0,62}$` |
| `version` | string | Yes | — | A semver version, for example `0.1.0` or `1.0.0-rc.1` |
| `stability` | `stable` or `experimental` | No | `stable` | While the old manifest is `experimental`, `urn-forge diff` gives a breaking change as a warning |
| `caller` | string | No | — | The short key of an entity: who calls, as the shell authenticated them. Each operation then must have `callers`. Refer to [`callers`](#callers) |

- Other properties cause `unknown-property`.
- YAML reads `version: 1` and `version: 1.0` as numbers. They cause `invalid-value`.

## Short keys and kinds

Each atom has a short key `<context>.<kind>.<identifier>`, for example `order.field.quantity`. The context and the identifier match `^[a-z][a-z0-9_]{0,62}$`. urn-forge makes the URN `urn:<namespace>:<domain>:<context>:<kind>:<identifier>` from it. For the generated names, refer to [Generated code](./generated-code).

| Kind | Declares |
| --- | --- |
| `field` | One value, with a primitive and constraints |
| `entity` | A named group of properties |
| `invariant` | A rule over the properties of one entity |
| `operation` | A handler contract: input, output, declared errors and events |
| `event` | A fact that an operation returns when it succeeds |
| `error` | A declared refusal of an operation |

Each kind also accepts the [lifecycle keys](#lifecycle-keys).

## Field

```yaml
order.field.quantity: { primitive: integer, min: 1, max: 99, notIn: [13] }
order.field.delivery: { primitive: enum, values: [standard, express, "click & collect"] }
```

| Property | Type | Necessary | Rule |
| --- | --- | --- | --- |
| `primitive` | `boolean`, `date`, `decimal`, `enum`, `float`, `integer`, `string` or `timestamp` | Yes | Other values cause `unknown-primitive` |
| `description` | string | No | Not empty |
| `moves` | A map from each value to a list of values | No | `enum` only. The moves of a state field; a state with no moves out is final. Each state is one of `values`, each move one time, or `invalid-moves` |
| A constraint | Refer to [Primitives and constraints](./primitives) | Only `values` of an `enum` | A constraint of the primitive of the field |

- Write a `decimal` bound in quotes, for example `min: "0.01"`. Write a `timestamp` bound in quotes.
- A field does not say if it is optional. The field reference sets that.

## Field reference

A field reference is an item of the `fields` list of an entity, an event or an error. It makes one property.

| Form | The property holds | Parsed type |
| --- | --- | --- |
| `ref: <field>` | A value of the field | The branded type of the field |
| `ref: <entity>` | An embedded object of the entity, with its invariants | The parsed type of the entity |
| `link: <entity>` | The value of the `key` of the entity | The branded type of the key field |

```yaml
fields:
  - ref: policy.field.policy_id
  - link: customer.entity.customer
    as: holder
  - ref: policy.entity.coverage
    as: coverages
    many: { minItems: 1, maxItems: 3, unique: true }
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `ref` | string | `ref` or `link` | — | The short key of a field or an entity |
| `link` | string | `ref` or `link` | — | The short key of an entity with a `key`. Else `missing-key` |
| `as` | string | No | The identifier of the target | The property name. `^[a-z][a-z0-9_]{0,62}$` |
| `required` | boolean | No | `true` | `false` lets the key be absent |
| `many` | `true`, or `{ minItems, maxItems, unique }` | No | None | The property holds a list |

| Property of `many` | Type | Rule |
| --- | --- | --- |
| `minItems` | integer, 0 or more | The list has this number of items or more |
| `maxItems` | integer, 0 or more | The list has this number of items or fewer. Not less than `minItems` (`incoherent-constraints`) |
| `unique` | `true`, or a list of property names | `true`: no value occurs two times; for an embedded entity, no key occurs two times, so the entity needs a `key`. A list, for an embedded entity only: no two items with each named property present and equal, and an item with one of them absent is not compared. A name that is not a single-valued property of the item causes `invalid-unique` |

| Problem | Code |
| --- | --- |
| Both or neither of `ref` and `link` | `invalid-value`: `must have either ref or link` |
| A target of the wrong kind | `wrong-ref-kind` |
| A target that is not in the manifest | `unresolved-ref` |
| The same target two times with the same name | `duplicate-ref` |
| Two properties with the same name | `duplicate-property` |
| An entity that embeds itself, at any depth | `embedding-cycle` |

- `many: true` is a list of any length. An empty list is present. `required: false` lets the list be absent.
- Links can make a cycle. urn-forge does not make sure that the linked object exists.
- The generated code keeps the properties in the sequence of the list.

## Entity

```yaml
customer.entity.customer:
  description: A person who holds policies
  key: customer.field.customer_id
  fields:
    - ref: customer.field.customer_id
    - ref: customer.field.name
```

| Property | Type | Necessary | Rule |
| --- | --- | --- | --- |
| `description` | string | Yes | Not empty |
| `key` | string | No | The short key of a field that the entity refers to with `ref`, `required: true` and no `many`. Else `invalid-entity-key` |
| `fields` | A list of [field references](#field-reference) | Yes | One or more items |

An entity needs a `key` if a `link` names it, if a list with `unique: true` embeds it, or if it is a table of the `postgres` plugin. An `invariants` key causes `unknown-property`: each invariant names its entity with `on`.

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
| `on` | string | Yes | — | The short key of an entity. An event causes `wrong-ref-kind` |
| `rule` | string | Yes | — | A condition in the [rule language](./rule-language) over the property names of the `on` entity |
| `message` | string | Yes | — | Not empty. No placeholders |
| `reportOn` | string | No | The first property that the rule names | A property that the rule names. The issue goes on it. Else `invalid-report-on` |

- The invariant applies to each value of the entity: an input, an output or an embedded object.
- Gate 3 needs a scenario that breaks each invariant of the input entity of an operation.

## Operation

```yaml
policy.operation.cancel_policy:
  description: Stop a policy and calculate the refund for the days it does not cover
  input: policy.entity.cancellation
  output: policy.entity.refund_quote
  errors:
    - policy.error.refund_below_minimum
  emits: [policy.event.policy_cancelled]
```

| Property | Type | Necessary | Default | Rule |
| --- | --- | --- | --- | --- |
| `description` | string | Yes | — | Not empty |
| `input` | string | Yes | — | The short key of an entity |
| `output` | string | Yes | — | The short key of an entity. It can be the `input` entity |
| `errors` | A list of strings | No | `[]` | Short keys of errors, each one time |
| `emits` | A list of strings or maps | No | `[]` | Each event one time: its short key, or `{ event, when }`. Refer to [`emits`](#emits) |
| `changes` | A map | No | — | The stored record that the operation changes. Refer to [`changes`](#changes) |
| `reads` | A map | No | — | The stored record that the operation reads. Refer to [`reads`](#reads) |
| `due` | string | No | — | When the shell's clock must call the operation, for a record: a rule over `current.`, `now` and `today`. It needs `changes`. Any other problem causes `invalid-due`. Refer to [Run changes on a clock](../how-to/run-changes-on-a-clock) |
| `callers` | A map | With a `caller` in the header | — | Who may call. Refer to [`callers`](#callers) |
| `requires` | A list of maps | No | `[]` | Each `{ rule, otherwise }`. Refer to [`requires` and `ensures`](#requires-and-ensures) |
| `ensures` | A list of strings | No | `[]` | Rules that the answer must keep. Refer to [`requires` and `ensures`](#requires-and-ensures) |

- An operation with no `errors` can only succeed. Its error type is `never`.
- A successful operation returns zero or more events of each kind in `emits`, in any sequence, except as an item `{ event, when }` states.

### `emits`

| Item | Meaning |
| --- | --- |
| `policy.event.policy_issued` | Zero or more of the event on each success |
| `{ event: payment.event.captured }` | Exactly one of the event on each success |
| `{ event: payment.event.pending, when: <rule> }` | Exactly one of the event on each success where the rule holds, and none where it does not |

A `when` rule reads `input.`, `current.` and `output.`, as an `ensures` rule does. A success with another count is a `ContractViolation`:

```text
urn:demo:delivery:payment:operation:create_payment emitted 0 urn:demo:delivery:payment:event:authorized, but it emits exactly one when output.status = 'authorized'
```

### `changes`

| Property | Type | Necessary | Rule |
| --- | --- | --- | --- |
| `entity` | string | Yes | Short key of an entity with exactly one field that has `moves`. That property must be required and not a list |
| `from` | A list of strings | Yes | At least one state; each one is a value of the state field, one time |
| `to` | A string or a list of strings | No | A state, or the states that the record can end in. Each `from` state reaches a state of `to` by a move, or is that state. Leave it out when the state stays |
| `otherwise` | string | Yes | Short key of an error in `errors`. Each required field of the error is a property of `entity` or of `input` |
| `missing` | string | No | Short key of an error in `errors`, for no record. Each required field of the error is a property of `input` |

Any other problem causes `invalid-changes`. The handler gets the record as its second parameter, `current`. `executeOperation` answers `otherwise` for a state outside `from`, and `missing` for `current: null`, without a call of the handler. When `output` has the state field, the state of the answer must be in `to` and reached by a move or the same, or stay without `to`. When `output` has the key field, the key must not change. Refer to [Declare states and moves](../how-to/declare-states).

### `reads`

| Property | Type | Necessary | Rule |
| --- | --- | --- | --- |
| `entity` | string | Yes | The short key of an entity |
| `missing` | string | No | Short key of an error in `errors`, for no record. Each required field of the error is a property of `input` |

The handler gets the record as its second parameter, `current`, and the rules can read `current.`. An operation cannot have both `reads` and `changes`. Any other problem causes `invalid-reads`.

### `callers`

| Property | Type | Necessary | Rule |
| --- | --- | --- | --- |
| `allow` | `any`, or a list of strings | Yes | `any`: every caller. Else rules over `caller.`, `input.` and, with `changes` or `reads`, `current.`; the call is allowed when one rule holds |
| `otherwise` | string | With rules; not with `any` | Short key of an error in `errors`. Each required field of the error is a property of the caller, of `input`, or of the record |

`callers` without a `caller` in the header, or an operation with no `callers` in a domain with a `caller`, causes `invalid-callers`. `executeOperation` checks the callers after the record parses, and before the state of `changes` and the `requires` rules. Refer to [Declare who may call](../how-to/declare-callers).

### `requires` and `ensures`

| Property | Type | Necessary | Rule |
| --- | --- | --- | --- |
| `requires[].rule` | string | Yes | A rule over `input.<property>` and, with `changes`, `current.<property>` |
| `requires[].otherwise` | string | Yes | Short key of an error in `errors`. Each required field of the error is in `fill`, or a property of `input` or of the `changes` entity |
| `requires[].fill` | A map | No | From a property of the error to a name with a prefix (`input.amount`, `current.amount`), of the same primitive. Properties not in `fill` are filled by name, the record's value over the input's |
| `ensures[]` | string | — | A rule over `input.`, `current.`, `output.` and `event.` |

`event.<property>` is the one event of the success. It is allowed only when each item of `emits` has the form `{ event }` or `{ event, when }`, and it names a property that each of those events has. On a success with no event, which the `when` rules allow, the rule is not checked. A success with more than one event is a `ContractViolation`.

A rule uses the [rule language](./rule-language). A name with no prefix, `current.` without `changes`, `output.` in `requires`, or `event.` outside `ensures` causes `invalid-condition`; a rule that does not parse or type causes the codes of an invariant rule. `executeOperation` checks `requires` after the state of `changes`, in order, and answers the `otherwise` of the first rule that does not hold, without a call of the handler. It checks `ensures` on a success; a rule that does not hold is a `ContractViolation`. Refer to [Declare preconditions and postconditions](../how-to/declare-conditions).

## Event

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
| `delivery` | A map | No | — | How the event gets to a consumer. Refer to [`delivery`](#delivery) |

- No property can have the name `kind` (`reserved-property`). The payload has `kind`, with the URN of the event.
- Each value must pass the schema of its field. Else the result is `ContractViolation`.
- A `key` causes `unknown-property`.

### `delivery`

```yaml
payment.event.captured:
  description: A payment was captured
  fields:
    - ref: event.field.event_id
    - ref: event.field.sequence
    - ref: payment.field.payment_id
    - ref: payment.field.status
  delivery:
    id: event_id
    orderBy: payment_id
    sequence: sequence
```

| Property | Type | Necessary | Rule |
| --- | --- | --- | --- |
| `id` | string | Yes | A required `string` property of the event. The shell gives its value with `newEventId`; the core does not set it |
| `orderBy` | A string or a list of strings | Yes | Required properties of the event that hold one value. The events with the same values get to a consumer in the order of their changes |
| `sequence` | string | No | A required `integer` property of the event. The outbox sets it: 1 for the first event of an `orderBy` value, then 1 more for each event |

Any other problem causes `invalid-delivery`. With the Postgres extra, the outbox keeps the delivery. Refer to [Emit an event](../how-to/emit-an-event#_6-deliver-the-events-in-order).

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
| `category` | `validation`, `conflict`, `not_found`, `forbidden` or `precondition` | Yes | — | For the shell. The core does not read it |
| `retryable` | boolean | Yes | — | For the shell. `true` if the same request can be correct at a later time |
| `message` | string | Yes | — | A [message template](#message-template) |
| `fields` | A list of [field references](#field-reference) | No | `[]` | Can be empty |
| `recordAs` | string | No | None | The short key of an event that the fields of the error can make |

- No property can have the name `kind` (`reserved-property`). The payload has `kind`, with the URN of the error.
- Each value must pass the schema of its field, with all its constraints. Else the result is `ContractViolation`, not the error. To carry a value outside the limits of a field, declare a different field.

### `recordAs`

`executeOperation` makes the `recordAs` event from the fields of the error, and gives it as `record` on the `DomainError`. The core does not return it, and it is not in `emits`.

```yaml
policy.event.refund_refused:
  description: A cancellation was refused because its refund was below the minimum, for an audit trail
  fields:
    - ref: policy.field.refund
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

| Rule, by property name | Else `invalid-record-as` |
| --- | --- |
| The event has each property of the error | `has no property "<name>", which the error has` |
| Each such property has the same target, `required` and `many` | `has a property "<name>" that differs from the error's; it must have the same target, presence and count` |
| Each other property of the event has `required: false` | `has the required property "<name>", which the error does not have; make it optional, so the error's fields can build the event` |

### Message template

A placeholder is `{name}`, with no space, `{` or `}` inside. `{ sku }` and `{}` stay as text. Each placeholder must name a property of the error with `required: true` and no `many`: a field or a link, not an embedded entity. Else `unknown-placeholder`. The runtime puts the value in place of the placeholder.

## Lifecycle keys

Each atom accepts these keys:

```yaml
policy.field.note:
  primitive: string
  description: Free text about a coverage
  status: deprecated
  supersededBy: policy.field.remark
  sunsetDate: 2027-06-30
```

| Property | Type | Default | Rule |
| --- | --- | --- | --- |
| `status` | `active`, `deprecated` or `sunset` | `active` | Moves forward only. `urn-forge diff` reports a step back as breaking |
| `supersededBy` | string | None | The short key of a different atom of the same kind. Not a URN |
| `sunsetDate` | `YYYY-MM-DD` | None | A calendar day, with quotes or not |

`supersededBy` or `sunsetDate` with `status: active` causes `invalid-lifecycle`.

| Status | A reference to the atom | Generated code | Gates |
| --- | --- | --- | --- |
| `active` | No diagnostic | All | All checks |
| `deprecated` | From an active atom: `deprecated-ref`, a warning | All, marked `@deprecated` | All checks |
| `sunset` | From an active or a deprecated atom: `sunset-ref`, an error | None | No check |

- If a `sunsetDate` is on or before the reference date, a reference from an active or a deprecated atom is `sunset-ref`. Without a reference date, urn-forge does not compare sunset dates. Refer to [The configuration file](./configuration).
- The generated code depends on `status` only.
- Keep a sunset atom in the manifest. `urn-forge diff` reports a removed atom as a breaking change.

## Related pages

- [Primitives and constraints](./primitives)
- [Add a field](../how-to/add-a-field)
- [The contract](../explanation/the-contract)
