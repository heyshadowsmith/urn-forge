# The manifest

The manifest is one YAML file, `domain.manifest.yaml` by default, with four top-level sections. Only `manifest` is required. A key that this page does not list stops `compile` with `manifest-shape`.

| Section | Holds |
| --- | --- |
| `manifest` | The header |
| `definitions` | The values: numbers, strings, objects, lists |
| `rules` | The text of every rule of your own. Refer to [Rules and the rule language](./rule-language) |
| `operations` | The operations: an input, the outputs, and their rules |

The [booking example](#example) at the end of this page uses every construct.

## The header

```yaml
manifest:
  namespace: demo
  domain: booking
  version: 0.1.0
  compatibility:
    callers: ignore-unknown
```

| Key | Required | Value |
| --- | --- | --- |
| `namespace` | Yes | The owner of the domain, for example your organisation |
| `domain` | Yes | The domain. The Postgres schema has this name |
| `version` | Yes | A semver version, such as `0.1.0` or `2.0.0-alpha.1`. `diff` reads it |
| `compatibility` | No | `callers: ignore-unknown`: callers ignore what they do not recognise in an output, so `diff` treats a new output, choice or property of an output as compatible |

## Names and common keys

A name of a namespace, domain, definition, rule or operation is lowercase snake_case: `^[a-z][a-z0-9_]{0,62}$`. A rule of your own cannot take the name of a standard rule.

Every definition, rule and operation has:

| Key | Required | Value |
| --- | --- | --- |
| `description` | Yes | What the piece is, for a reader. The generated code and the Postgres schema use it as a comment |
| `deprecated` | No | `true` marks the piece `@deprecated` in the generated code, and each live use of it gets the warning `deprecated-use`. It still works |

## Definitions

| Key | For | Value |
| --- | --- | --- |
| `type` | Every definition, required | One of the six types, or the name of another definition |
| `properties` | `type: object`, required | The names of the definitions that are its properties |
| `items` | `type: array`, required | The name of the definition of each item |
| `identifier` | `type: object` | The property that tells two objects of this kind apart |
| `rules` | Every definition | The rules the value keeps |

Structure (`type`, `properties`, `items`, `identifier`) is what a value is. Everything that must be true of it, including `required` and `enum`, is a rule.

### Types

| `type` | A value | TypeScript | Valibot |
| --- | --- | --- | --- |
| `string` | Text | `string`, or the union of its `enum` choices | `v.string()` |
| `integer` | A safe integer | `number` | `v.number()`, `v.integer()` |
| `number` | A finite number | `number` | `v.number()`, `v.finite()` |
| `boolean` | `true` or `false` | `boolean` | `v.boolean()` |
| `object` | Named properties | `interface` | `v.strictObject()` |
| `array` | A list of items | `readonly T[]` | `v.array()` |

There is no date or decimal type. A date is a `string` with `format: date` (`2026-11-24`), a time a `string` with `format: date-time` (`2026-11-24T19:00:00Z`). Money is an `integer` of its smallest unit, such as cents.

### A definition as a type

`type` can name another definition. The new one has that definition's structure and rules, and adds its own:

```yaml
  stored_booking:
    description: The booking as it is stored, before the call
    type: booking
```

This gives one kind of value two roles (`from_account` and `to_account` of `type: account`), and lets a value refer to another object by its identifier (`holder` of `type: customer_id`). It cannot add `properties`, `items` or `identifier`.

### Objects

```yaml
  contact:
    description: How to reach the guest
    type: object
    properties: [email, phone]
    rules:
      - required: [email]
```

- A property has the name of its definition, and keeps its rules. It cannot be renamed or narrowed in place.
- A property that `required` does not list is optional: `?` in TypeScript, and read in a rule only after `has()`.
- A key that is not a property fails the check with the rule `properties`.
- An object definition in `properties` embeds that object.

`identifier: <property>` names a required property, of a type other than `object` or `array`, that tells two objects apart. The Postgres schema uses it as the primary key.

### Lists

```yaml
  tables:
    description: The tables a booking asks for
    type: array
    items: table_number
    rules:
      - maxItems: 4
      - uniqueItems
```

Each item is a value of the `items` definition, with its rules. The rules of the list, such as `maxItems`, apply to the whole list.

## Operations

```yaml
operations:
  seat_booking:
    description: Seat the party of a booking
    input: seat_request
    output:
      - booking: [was_confirmed, is_seated, keeps_the_party]
      - invalid_state: [was_not_confirmed, names_the_request]
```

| Key | Required | Value |
| --- | --- | --- |
| `input` | Yes | One object definition |
| `output` | Yes | One or more entries, `- <object>: [rule names]`: an object the operation can answer, and the rules that hold when it does. `- quote` and `- quote: []` mean an output with no rule |
| `rules` | No | Rules that hold for every answer |

There is no key for errors, states, callers or events. A refusal is an output; a stored record, the caller and the time are properties of the input; an event is a property of an output. The core returns exactly one output per call.

In a rule of an output, `input` is the input and `output` is that object. The operation's own `rules` can read `input`, and `output` only when there is one output. Make the rules of the outputs exclude each other, so that each input allows one output.

## Example

<<< @/../packages/urn-forge/tests/fixtures/booking/domain.manifest.yaml
