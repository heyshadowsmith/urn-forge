# The MECE model of primitives

The primitives and constraints of urn-forge are MECE: mutually exclusive and collectively exhaustive. Each kind of single value has exactly one primitive. Each constraint restricts exactly one aspect of a value. This page tells why the model has this form, and where its limits are. For the facts, refer to [Primitives and constraints](../docs/reference/primitives.md).

## The problem with two spellings

A manifest is the contract of a domain. If one rule has two spellings, two people write the same rule in two ways. Then a reader cannot compare two fields, and a tool must know both spellings.

Before this model, urn-forge had such overlaps. A `string` with `oneOf` was a closed set of names, but it could also have `minLength`, `maxLength` and `regex`. Pass 7 then had to examine each listed name against the length and the pattern, only because the two rules overlapped. The specification planned more overlaps: `format: iso-date` on a `string` and a `timestamp` primitive for dates, and `list` as a primitive next to `integer`.

There were also gaps. `min` and `max` were inclusive only, so "a price above 0" had no spelling for a `float`. `notEqual` took one value, so "not 0 and not 13" had no spelling. Money had no exact type.

## Three layers

The model gives each question to one layer:

| Layer | Question |
| --- | --- |
| The field, with its primitive and constraints | What is one value, and which values are allowed? |
| The field reference in an entity, an event or an error | What does the property hold, is it present, and how many values are there? |
| The invariant, with its rule over the fields of one entity | Which combinations of fields are allowed? |

Thus a field never says how many values there are. A list is `many` on the field reference, not a `list` primitive. A list of integers is a list on one axis and an integer on the other axis, so a single primitive cannot be both. The same field can be one value in one entity and a list in another entity.

## Structure on the field reference

A real domain also needs a property that holds a different entity, and a property that points at a different entity. An order holds its lines, and it names its customer. This is structure, so it goes on the same axis as `many`: the field reference. A primitive still says what one value is. The field reference says what a property holds:

| Field reference | The property holds |
| --- | --- |
| `ref: <field>` | A value of the field |
| `ref: <entity>` | An embedded object of the entity |
| `link: <entity>` | The value of the `key` of the entity |

`required`, `many` and `as` apply to each form in the same way. Thus a list of coverages is `many` on `ref: policy.entity.coverage`, and no new rule is necessary for it.

The specification had `list`, `record` and `ref` as primitives. A `ref` primitive would put a second axis into the primitive layer. A field would then say what one value is and also what it points at. Two spellings would follow: a `ref` field in an entity, and a field reference to an entity. The model keeps one spelling.

A link is a value. It has the type and the brand of the key field, so a rule compares it as that primitive, and coverage counts it as that field. An embedded object is not a value. A rule can only ask whether it is there. The invariants of the embedded entity say what it allows, and they run inside each object.

A link can make a cycle, because a cycle of values is data. An embedding cannot make a cycle, because the type of the object would never end. Pass 5 refuses it (`embedding-cycle`).

## The third layer: invariants

A rule such as "the expiry date is after the effective date" is about two fields. No constraint of one field can say it, and a field reference cannot either. Before the `invariant` kind, such a rule was code in a handler. The manifest, the schemas and the scenarios could not see it.

An invariant gives the rule one place in the manifest. The schema of its entity then refuses each value that breaks the rule. Gate 3 asks for a scenario that breaks each invariant of an operation input. The layers stay separate. A constraint of one field does not go into a rule, and a rule does not say if a field is present. A guard such as `deductible is absent or …` reads the presence that the field reference sets.

The [rule language](../docs/reference/rule-language.md) is small on purpose. It has comparisons, `+` and `-`, `and`, `or`, `not` and presence. Each operator is a decision about the types of every primitive. Thus `<` follows the order that each primitive defines: `decimal` exactly, `date` as text and `timestamp` as instants. `+` and `-` on a `date` count days, because a day is the unit that a `date` has: `expiry_date - effective_date` is an `integer`. The language has no months or years, because they have no fixed length. Function calls, rules across entities and rules over the items of a list would each need new decisions. urn-forge does not have them at this time. Refer to [Scope](../docs/explanation/the-contract.md).

The rule language uses the same comparisons as the constraints. `min: "0.01"` on a `decimal` and `premium > 0` in a rule compare in the same way. A value means the same thing in both layers.

## The three layers in SQL

The Postgres plugin puts each layer in its own place in the database:

| Layer | In SQL |
| --- | --- |
| The field: a primitive and its constraints | A domain, with one `CHECK` for all the constraints. Each column and each list of the field uses it |
| The field reference: presence, count, structure | The column: `NOT NULL`, the foreign key of a link, the child table of a list or an embedded entity, its `UNIQUE`, and the count trigger |
| The invariant | A named `CHECK` on each table of its entity |

The specification put the constraints of a field on each table, as checks with the name `ck_<brand>`. Then one field in three entities would have its rules three times. A domain gives the rules of a field one place, as the manifest does. It also covers the items of a list, which are rows of a child table, not columns of the entity.

The layers also show where SQL stops. A `CHECK` sees one row. A count of items is about many rows, so it is a trigger on the field reference layer, not a check. A rule over a list or an embedded entity is an invariant over rows of a different table. The plugin reports it as `unenforced-in-sql` and does not write an approximate check. The Valibot schema at the boundary still enforces it.

One value must mean the same thing in both checks. Thus the length of a `string` counts Unicode code points, as Postgres `char_length` does. A `regex` goes into SQL only in a subset that the two dialects read in the same way. For the details, refer to [The Postgres schema](../docs/reference/postgres-schema.md).

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
- **One step for each kind.** An `integer` has `multipleOf`. A `decimal` has `scale`, the number of digits after the point. A `float` has no step. The specification had `precision: [p, s]` for decimals. That constraint mixes size with step, so the model keeps only `scale`. The Postgres plugin needs no precision: a `NUMERIC` with no precision keeps the digits that it gets, and a check holds the scale.
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

A map from keys to values (`record` in the specification) is structure too. urn-forge does not have it at this time. A list of entities with a `key` covers the cases that the domains of this repository have. Refer to [Scope](../docs/explanation/the-contract.md).

## The cost

Two changes broke manifests that worked before. `oneOf` on a `string` became an `enum`, and `notEqual` became `notIn`. Before version 1.0, no project outside this repository used urn-forge, so the change was cheapest at that time. Each old spelling gets a message that names the new spelling.

## Related pages

- [Primitives and constraints](../docs/reference/primitives.md)
- [The rule language](../docs/reference/rule-language.md)
- [Add a field](../docs/how-to/add-a-field.md)
- [Departures from the specification](../planning/departures-from-the-spec.md)
- The primitives plan
