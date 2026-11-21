# The MECE model of primitives

The primitives and constraints of urn-forge are MECE: mutually exclusive and collectively exhaustive. Each kind of single value has exactly one primitive. Each constraint restricts exactly one aspect of a value. This page tells why the model has this form, and where its limits are. For the facts, refer to [Primitives and constraints](../reference/primitives).

## The problem with two spellings

A manifest is the contract of a domain. If one rule has two spellings, two people write the same rule in two ways. Then a reader cannot compare two fields, and a tool must know both spellings.

Before this model, urn-forge had such overlaps. A `string` with `oneOf` was a closed set of names, but it could also have `minLength`, `maxLength` and `regex`. Pass 7 then had to examine each listed name against the length and the pattern, only because the two rules overlapped. The specification planned more overlaps: `format: iso-date` on a `string` and a `timestamp` primitive for dates, and `list` as a primitive next to `integer`.

There were also gaps. `min` and `max` were inclusive only, so "a price above 0" had no spelling for a `float`. `notEqual` took one value, so "not 0 and not 13" had no spelling. Money had no exact type.

## Three layers

The model gives each question to one layer:

| Layer | Question |
| --- | --- |
| The field, with its primitive and constraints | What is one value, and which values are allowed? |
| The field reference in an entity or an error | Is the value present, and how many values are there? |
| Invariants, a later kind | Which combinations of fields are allowed? |

Thus a field never says how many values there are. A list is `many` on the field reference, not a `list` primitive. A list of integers is a list on one axis and an integer on the other axis, so a single primitive cannot be both. The same field can be one value in one entity and a list in another entity.

## Six aspects

A single value can be restricted in these ways only:

- **Range:** a lower bound, an upper bound, or both.
- **Step:** the distance between two allowed values.
- **Size:** the length of a value.
- **Shape:** the form of a value.
- **Membership:** a set that contains the value.
- **Exclusion:** a set that does not contain the value.

Each constraint belongs to one aspect, and a constraint name has the same aspect on each primitive. `min` is an inclusive lower bound on a number, a decimal, a date and a timestamp. The specification used `after` and `before` for dates. The model uses `min` and `max`, because the aspect is the same.

## One primitive for each kind of value

A kind of value gets its own primitive only if it needs a different set of values or a different comparison:

- `integer`, `decimal` and `float` are all numbers, but they compare differently. An integer is exact and discrete. A decimal is exact and has a fraction, so money is never a binary float. A float is approximate.
- `date` and `timestamp` are different kinds. A calendar day has no time and no time zone. A timestamp is an instant.
- `enum` is a closed set of names. Free text is a `string`. Thus no length or shape constraint can meet a membership constraint on one field.

A duration is not a primitive. Its values and its comparison are those of an `integer`, so a field such as `timeout_ms` is enough.

## Rules that keep the model MECE

- **At most one constraint for one side.** `min` and `exclusiveMin` together, or `regex` and `format` together, cause `conflicting-constraints`. Each pair restricts the same side of the same aspect.
- **Exclusive bounds only on continuous kinds.** On an `integer` or a `date`, `exclusiveMin: 0` is the same rule as `min: 1`. A second spelling would break the model, so these kinds have no exclusive bounds.
- **One step for each kind.** An `integer` has `multipleOf`. A `decimal` has `scale`, the number of digits after the point. A `float` has no step. The specification had `precision: [p, s]` for decimals. That constraint mixes size with step, so the model keeps only `scale`. A SQL plugin can get the precision from the range and the scale.
- **A closed list of named formats.** `format` has `uuid`, `email` and `uri`. A name joins the list only if a `regex` cannot express it clearly. Otherwise `format` would become a second `regex`.

## How urn-forge enforces the model

The model is in the registry, not only in this page:

- Each constraint in a primitive descriptor declares its aspect. A test makes sure that one name has one aspect on each primitive.
- A descriptor declares the groups of constraints that exclude each other. A test makes sure that each group has one aspect.
- A test compares the constraint table of the reference page with the registry, row for row.

Thus a new constraint that breaks the model fails the tests before it ships.

## What the model does not cover

Collectively exhaustive means exhaustive for single values that a domain sends as JSON. urn-forge does not cover these values at this time:

| Value | Write it as |
| --- | --- |
| A duration | An `integer`, with the unit in the field name |
| A time of day, a local date and time, a time zone | Not covered |
| An integer larger than 2⁵³ | A `string` with a `regex` |
| Binary data | Not covered |

Nested entities, `ref` to another entity and `record` are structure, like lists. They need their own decisions. Refer to [Scope](../reference/scope).

## The cost

Two changes broke manifests that worked before. `oneOf` on a `string` became an `enum`, and `notEqual` became `notIn`. Before version 1.0, no project outside this repository used urn-forge, so the change was cheapest at that time. Each old spelling gets a message that names the new spelling.

## Related pages

- [Primitives and constraints](../reference/primitives)
- [The manifest](../reference/manifest)
- [Add a field](../how-to/add-a-field)
- [Departures from the specification](./departures-from-the-spec)
- [The primitives plan](../project/primitives-plan)
