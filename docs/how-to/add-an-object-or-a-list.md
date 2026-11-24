# Add an object or a list

Group values into an object, or make a list of values. Both are definitions, in the same section as the other values.

## Before you start

- Each property of the object, and the item of the list, is a definition. Refer to [Add a definition](add-a-definition).

## Add an object

1. In `definitions`, add a key with the name of the object.
2. Add `description` and `type: object`.
3. Add `properties`, a list of the names of definitions. A property has the name of its definition. You cannot rename a property, or change its rules, in the object.
4. Add `rules`, and the rule `required` with the properties that the object must have. A property that `required` does not list is optional.
5. Run `npx urn-forge compile`.

This object comes from `packages/urn-forge/tests/fixtures/booking/domain.manifest.yaml`:

```yaml
  contact:
    description: How to reach the guest
    type: object
    properties: [email, phone]
    rules:
      - required: [email]
```

`email` and `phone` are definitions of the same manifest. A contact must have an email, and it can have a phone. A value with a property that is not in `properties` breaks the check of the object, with the rule name `properties`.

## Embed an object

To put an object in an object, name the object in `properties`:

```yaml
  booking:
    description: A booking
    type: object
    identifier: reference
    properties: [reference, party_size, state, deposit, starts_at, ends_at, note, tables, contact, dishes, total]
    rules:
      - required: [reference, party_size, state, starts_at, ends_at, contact]
```

The booking has a `contact`. Its value is an object with the properties and the rules of `contact`.

## Give an object an identifier

If two objects of one kind must be told apart, add `identifier` with the name of the property that does it. In the example, `reference` identifies a booking.

- The identifier must be a property of the object.
- The `required` rule must list it.
- It must be one value, not an object or a list.

Otherwise, `compile` stops with `invalid-identifier`. The Postgres schema uses the identifier as the primary key. Refer to [Store objects in Postgres](store-in-postgres).

## Add a list

1. In `definitions`, add a key with the name of the list.
2. Add `description` and `type: array`.
3. Add `items` with the name of one definition. Each item is a value of that definition.
4. If the list has limits, add `rules`: `minItems`, `maxItems` or `uniqueItems`.
5. Run `npx urn-forge compile`.

This list comes from `packages/urn-forge/templates/starter/domain.manifest.yaml`:

```yaml
  person:
    description: The name of a person who shares the bill
    type: string
    rules:
      - minLength: 1

  people:
    description: The people who share the bill, each one once
    type: array
    items: person
    rules:
      - minItems: 1
      - maxItems: 10
      - uniqueItems
```

Each item of `people` is a `person`, so each item has the rule `minLength: 1`. The rules of the list apply to the whole list.

## Make a list of objects

Name an object in `items`:

```yaml
  dish:
    description: A dish that is ordered ahead
    type: object
    properties: [course, amount]
    rules:
      - required: [course, amount]

  dishes:
    description: The dishes that are ordered ahead
    type: array
    items: dish
```

A failure in an item names its place, for example `dishes[0].amount`.

## Use one kind of object two times

An object has each property one time. To hold two values of one kind, make two definitions whose `type` names that kind:

```yaml
  from_account:
    description: The account that pays
    type: account

  to_account:
    description: The account that receives
    type: account
```

Then list `from_account` and `to_account` in `properties`.

## Result

`npx urn-forge compile` writes an `interface` for each object, with `?` on each optional property, and a `readonly` array type for each list. The check of an object checks each property, then the rules of the object.

## Related pages

- [Definitions and types](../reference/definitions)
- [Add a rule](add-a-rule)
- [Model a stored record, the caller and the time](model-the-input)
