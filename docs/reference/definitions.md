# Definitions and types

A definition is a named value of the contract: a number, a text, an object, a list. All definitions are in the section `definitions`. An object is a definition with `type: object`, and a list is a definition with `type: array`.

## Keys

| Key | Required | For | Value |
| --- | --- | --- | --- |
| `description` | Yes | Each definition | What the value is, for a reader |
| `type` | Yes | Each definition | One of the six types, or the name of another definition |
| `properties` | For `type: object` | Objects | A list of the names of definitions |
| `items` | For `type: array` | Lists | The name of one definition |
| `identifier` | No | Objects | The name of the property that tells two objects of this kind apart |
| `rules` | No | Each definition | The rules that the value must keep. Refer to [Rules and the standard rules](./rules) |
| `deprecated` | No | Each definition | `true` or `false` |

Structure is what a value is: `description`, `type`, `properties`, `items` and `identifier`. Everything that must be true of the value is a rule in `rules`, including `required` and `enum`.

## The six types

The types are the types of JSON Schema.

| `type` | A value | TypeScript | In a rule (CEL) | Postgres column |
| --- | --- | --- | --- | --- |
| `string` | A text | `string`, or a union of the choices of `enum` | `string` | `TEXT` |
| `integer` | A safe integer | `number` | `int` | `BIGINT` |
| `number` | A finite number | `number` | `double` | `DOUBLE PRECISION` |
| `boolean` | `true` or `false` | `boolean` | `bool` | `BOOLEAN` |
| `object` | A map of properties | `interface` | the object | `JSONB` when it is a property |
| `array` | A list of items | `readonly T[]` | `list(T)` | `JSONB` |

There is no type for a date, a time or a decimal:

- A date is a `string` with the rule `format: date`, for example `2026-11-24`.
- A date and time is a `string` with the rule `format: date-time`, for example `2026-11-24T19:00:00Z`. A rule reads it with `timestamp(...)`.
- An exact amount, such as money, is an `integer` of its smallest unit, for example cents.

## A definition as a type

`type` can name another definition. The new definition has the structure and all the rules of that definition, and it adds the rules of its own `rules`.

```yaml
  stored_booking:
    description: The booking as it is stored, before the call
    type: booking
```

- A chain of names must end at one of the six types. A chain that comes back to its start stops `compile` with `type-cycle`.
- A definition whose type names another definition cannot have `properties`, `items` or `identifier`. They come from the end of the chain.
- In the generated code, the type is an alias: `export type StoredBooking = Booking;`.

Use it to give one kind of value two roles in one object, for example `from_account` and `to_account` of `type: account`. It is also how a value refers to another object: its type is the identifier definition of that object, for example `holder` of `type: customer_id`.

## Objects

```yaml
  contact:
    description: How to reach the guest
    type: object
    properties: [email, phone]
    rules:
      - required: [email]
```

- `properties` lists definitions by name. The property has the name of its definition. A property cannot be renamed, and it cannot change its rules in the object.
- Each name in `properties` must be a definition of the manifest, and it occurs one time.
- A property that the rule `required` does not list is optional. An optional property is `?` in TypeScript. A rule reads it only after `has(...)`.
- A value with a key that is not in `properties` breaks the check of the object. The failure has the rule name `properties`.
- An object definition in `properties` embeds that object.

### Identifier

`identifier: <property>` names the property that tells two objects of one kind apart. JSON Schema has no word for it, so the word is urn-forge's own.

- It must be a property of the object.
- The rule `required` of the object must list it.
- Its type cannot be `object` or `array`.

Otherwise, `compile` stops with `invalid-identifier`. The Postgres schema uses it as the primary key of a table, and `references` in the config refers to it.

## Lists

```yaml
  tables:
    description: The tables a booking asks for
    type: array
    items: table_number
    rules:
      - maxItems: 4
      - uniqueItems
```

- `items` names one definition. Each item is a value of that definition, with its rules.
- An object definition in `items` makes a list of objects.
- The rules of the list, such as `minItems`, apply to the list. The rules of the item apply to each item.

## The check of a value

The generated check of a definition does these steps, in this sequence:

1. It checks the structure: the type. For an object, it also checks that each key is a property, and checks each property. For a list, it checks each item.
2. If the structure is wrong, it stops, with a failure of the rule `type` or `properties`, or the failures of a property or an item.
3. For an object, it checks the rule `required`. If it fails, it stops.
4. It checks each other rule of the definition.

A definition whose type names another definition runs the check of that definition first.

Each failure has the name of the definition, the name of the rule, the place of the value and the message. The place is a path, such as `contact.email` or `dishes[0].amount`.

## Related pages

- [Rules and the standard rules](./rules)
- [Add a definition](../how-to/add-a-definition)
- [Add an object or a list](../how-to/add-an-object-or-a-list)
- [The generated code](./generated-code)
