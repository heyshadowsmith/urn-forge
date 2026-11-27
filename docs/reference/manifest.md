# The manifest

This page is for you. The agent reads the same facts, in a shorter form, in `node_modules/urn-forge/AGENTS.md`.

The manifest is one YAML file, `domain.manifest.yaml` by default. It has four top-level sections. Only `manifest` is required. If a key is not on this page, `compile` stops with `manifest-shape`. The [booking example](#example) at the end of this page uses all constructs.

| Section | Holds |
| --- | --- |
| `manifest` | The header: `namespace`, `domain`, `version` (major.minor.patch, read by `diff` and gate 5), and the optional `compatibility: { callers: ignore-unknown }` (refer to [diff](./cli#diff)). |
| `definitions` | The values: numbers, strings, objects, lists |
| `rules` | The text of each of your own rules |
| `operations` | Each operation: an input, the outputs, and their rules |

A name is lowercase snake_case: `^[a-z][a-z0-9_]{0,62}$`. The `namespace` is a URN namespace: 2 to 32 lowercase letters, digits and hyphens, starting with a letter, such as `acme` or `my-shop`. Each part then has a URN, `urn:<namespace>:<domain>:<definition|rule|operation>:<name>`, which `diff`, gate 5 and the JSON output use. Each definition, rule and operation has a `description`. The generated code uses the `description` as a comment. `deprecated: true` marks a part `@deprecated`, and each live use of the part gets the warning `deprecated-use`.

## Definitions

| Key | For | Value |
| --- | --- | --- |
| `type` | All definitions, required | One of the eight types, or the name of another definition |
| `properties` | `object`, required | The names of the definitions that are its properties |
| `items` | `array`, required | The name of the definition of each item |
| `values` | `map`, required | The name of the definition of each value |
| `keys` | `map` | The name of a `string` definition, whose rules each key keeps. With no `keys`, a key is any text |
| `variants` | `union`, required | A list of definitions of different JSON types; or, with `tag`, each value of the tag to its object variant |
| `tag` | `union` | The name of a required property that each object variant has. Its value names the variant |
| `identifier` | `object` | A required property that is not an object or a list. It makes each object different from all other objects. |
| `rules` | All definitions | The rules that the value keeps |

The structure (`type`, `properties`, `items`, `values`, `keys`, `variants`, `tag`, `identifier`) tells what a value is. Each condition that must be true of the value is a rule, also `required` and `enum`.

| `type` | A value | TypeScript |
| --- | --- | --- |
| `string` | Text | `string`, or the union of its `enum` choices |
| `integer` | A safe integer | `number` |
| `number` | A finite number | `number` |
| `boolean` | `true` or `false` | `boolean` |
| `object` | Named properties, and no others | `interface` |
| `array` | A list of items | `readonly T[]` |
| `map` | Named values: each key is a text, and each value keeps the rules of `values` | `Readonly<Record<string, T>>` |
| `union` | A value of one of its variants | `A \| B` |

There is no date type and no decimal type. A date is a `string` with `format: date`. A time is a `string` with `format: date-time` (`2026-11-24T19:00:00Z`). Money is an `integer` of its smallest unit, such as cents.

- **An object** lists its properties by the names of their definitions, and the properties keep the rules of these definitions. You cannot give a property a different name, or make it narrower, in the object. A property that `required` does not list is optional (`?` in TypeScript). An object definition in `properties` embeds that object.
- **A list** has items of its `items` definition, with their rules. The rules of the list, such as `maxItems`, apply to the full list.
- **A union** is a value of one of its variants. With a `tag`, each variant is an object, and the value of its tag names it: `variants: { circle: circle, square: square }` with `tag: kind`. A value with another tag breaks the rule `variant`. With no `tag`, each variant is of a different JSON type (a string, a number, a bool, a list or an object), and the type of the value names it.
- **A map** has a value of its `values` definition for each key. Use it where the keys are names that the contract does not know before, such as a count for each tag. A key keeps the rules of its `keys` definition. Where the keys are known, use an object.
- **A definition as a type**: `type: booking` makes a definition with the structure and rules of `booking`, and with its own rules. Use this to give one kind of value two functions (`from_account` and `to_account`). You can also use it to refer to an object by its identifier (`holder` of `type: customer_id`).

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
| `output` | Yes | One or more entries, `- <object>: [rule names]`. Each entry is an object that the operation can give as an answer, and the rules that are true for that answer. `- quote` is an output with no rule |
| `rules` | No | Rules that are true for each answer |

There is no key for errors, states, callers or events. A refusal is an output. A stored record, the caller and the time are properties of the input. An event is a property of an output. Because the core returns exactly one output for each call, make sure that the rules of the outputs exclude each other.

## Rules

Each rule has a name, and its text is in one location: the top-level `rules` section, or the standard set. Definitions, outputs and operations apply rules by their names.

```yaml
rules:
  at_least:
    description: The value is the bound or more
    parameters: [limit]
    rule: self >= limit
    failure_message: Must be at least {limit}
```

| Key | Required | Value |
| --- | --- | --- |
| `description` | Yes | What the rule checks, and why, for a reader of the manifest |
| `rule` | Yes | An expression that gives `true` if the value keeps the rule |
| `failure_message` | Yes | What a failure says when the rule breaks: the `failure_message` of each failure in a result. `{name}` puts the argument of a parameter in the text. A list gets `, ` between its items |
| `parameters` | No | Names of definitions. Each is a parameter, with the type of its definition |

Apply a rule with no parameter by its name only (`- uniqueItems`). Apply a rule with one parameter as `- minimum: 1`, and a rule with more parameters as a map: `- between: { low: 1, high: 9 }`. The argument must be a valid value of the definition of the parameter. If not, `compile` stops with `rule-argument`. Your own rule cannot have the name of a standard rule.

| Applied to | The rule reads |
| --- | --- |
| A definition | `self`: the value |
| An output: `- quote: [fits_express]` | `input`, and `output`: that object |
| The `rules` of an operation | `input`, and `output` if the operation has one output |

### The standard rules

The standard rules are the common checks that urn-forge includes. They have declarations like all other rules. If you apply a standard rule to a different type, `compile` stops with `rule-type`. The text of your own rules follows [the rule syntax](./syntax).

| Rule | For | Argument |
| --- | --- | --- |
| `enum`, `const` | `string` | A list of strings; a string |
| `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` | `integer`, `number` | A number |
| `multipleOf` | `integer` | An integer of 1 or more |
| `minLength`, `maxLength` | `string` | An integer of 0 or more |
| `pattern` | `string` | A regular expression. It matches part of the text, so anchor it with `^…$` |
| `format` | `string` | `date` or `date-time` (with fractions of a second, and `Z` or an offset such as `+02:00`) |
| `minItems`, `maxItems` | `array` | An integer of 0 or more |
| `uniqueItems` | `array` | none |
| `required` | `object` | A list of property names |

Each standard rule has a failure message, such as `Must be at least {bound}`. For a set of permitted numbers, use `minimum` and `maximum`, or your own rule.

## Retire a part

1. Add `deprecated: true` to the definition, rule or operation.
2. In its `description`, tell what to use in its place.
3. Run `npx urn-forge compile`. The generated code marks the part `@deprecated`. Each live part that uses it gets a `deprecated-use` warning.
4. When no caller uses the part, remove it, and increase the major version.

## Example

<<< @/../packages/urn-forge/tests/fixtures/booking/domain.manifest.yaml
