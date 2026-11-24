# Add a definition

Add a named value to the manifest: a number, a text, a true-or-false value, a date or a time. For an object or a list, refer to [Add an object or a list](add-an-object-or-a-list).

## Before you start

- You have a project that compiles. Refer to [Set up a project](set-up-a-project).

## Steps

1. Open `domain.manifest.yaml`, and find the section `definitions`.
2. Add a key with the name of the value. A name is lowercase snake_case, for example `party_size`.
3. Add `description`: one sentence that tells a reader what the value is. The generated code and the Postgres schema use it as a comment.
4. Add `type`. Select one of the types in the table below.
5. If the value has limits, add `rules`, and list each rule with its argument. Refer to [Rules and the standard rules](../reference/rules).
6. Run `npx urn-forge compile`.

| The value | `type` | Rules to add |
| --- | --- | --- |
| A whole number, such as a count | `integer` | `minimum`, `maximum`, `multipleOf` |
| An exact amount, such as money | `integer`, in the smallest unit (cents) | `minimum: 0` |
| A number that can have a fraction | `number` | `minimum`, `exclusiveMinimum` |
| A text | `string` | `minLength`, `maxLength`, `pattern` |
| A choice from a list | `string` | `enum: [a, b, c]` |
| A date, such as `2026-11-24` | `string` | `format: date` |
| A date and time, such as `2026-11-24T19:00:00Z` | `string` | `format: date-time` |
| True or false | `boolean` | none |

urn-forge has no decimal type. Use an integer of the smallest unit. For example, `1500` cents is 15.00.

## Example

These definitions come from `packages/urn-forge/tests/fixtures/booking/domain.manifest.yaml`:

```yaml
definitions:
  reference:
    description: The reference of a booking
    type: string
    rules:
      - pattern: '^[A-Z]{8}$'

  party_size:
    description: The number of guests
    type: integer
    rules:
      - minimum: 1
      - maximum: 12

  state:
    description: The state of a booking
    type: string
    rules:
      - enum: [confirmed, seated, completed, cancelled]

  starts_at:
    description: When the booking starts
    type: string
    rules:
      - format: date-time
```

Put a regular expression in single quotes, so that YAML does not read its characters.

## Use a definition as the type of another

`type` can name another definition. The new definition has the type and all the rules of that definition, and it can add rules of its own. Use it when two values have one kind but two roles:

```yaml
  holder:
    description: The customer who holds the policy
    type: customer_id
```

`holder` comes from `packages/urn-forge/insurance/domain.manifest.yaml`. It is a `customer_id`, with the `pattern` of `customer_id`. An object can then have the properties `holder` and `customer_id` with one kind of value.

A chain of names must end at one of the six types. `compile` stops with `type-cycle` if a chain comes back to its start.

## Mark a definition as deprecated

To tell readers that a definition will go, add `deprecated: true`:

```yaml
  note:
    description: A note from the guest
    type: string
    deprecated: true
    rules:
      - maxLength: 20
```

The generated type gets `@deprecated` in its comment. Each part of the manifest that uses the definition gets the warning `deprecated-use`. Say in the `description` what to use in its place. To remove the definition, delete it; `urn-forge diff` reports the removal.

## Result

`npx urn-forge compile` writes a type and a check for the definition. For `party_size`, the type is `PartySize`, and `check('party_size', 13)` gives a failure of the rule `maximum`.

## Related pages

- [Definitions and types](../reference/definitions)
- [Rules and the standard rules](../reference/rules)
- [Add a rule](add-a-rule)
