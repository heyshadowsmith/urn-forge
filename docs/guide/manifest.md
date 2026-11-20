# The manifest

A manifest is one YAML file for one domain. urn-forge does five checks on it:

1. A meta-schema check of the structure.
2. The expansion of short keys to URNs.
3. A check that names are unique.
4. A check that each reference is correct.
5. A check that the constraints of each field accept one or more values.

urn-forge shows all the problems that it finds, not only the first problem.

## Header

```yaml
manifest:
  namespace: demo        # the root of the organization or system
  domain: math           # the bounded context or business area
  version: 0.1.0         # a semver version that you set
  stability: stable      # optional: stable (default) or experimental
```

The `namespace` and `domain` values must be lowercase snake_case:

- They start with a letter.
- They contain only `a-z`, `0-9` and `_`.
- They have a maximum of 63 characters.

The `version` value must be a semver version.

## Short keys and URNs

Each other top-level key declares one atom. The key is a **short key**:

```
<context>.<kind>.<identifier>
arithmetic.field.divisor
```

The `context` and `identifier` segments obey the same snake_case rule as the header. The `kind` segment is `field`, `entity`, `operation` or `error`. The `error` kind is in progress. urn-forge examines error entries, but the plugins do not make code for them at this time. As a result, a manifest with errors does not compile (`unsupported-construct`). The specification also has the kinds `invariant` and `event`. urn-forge does not accept these kinds at this time, and it shows a `not supported yet` message.

The `compile` command uses the header to expand each short key to a full URN:

```
arithmetic.field.divisor  →  urn:demo:math:arithmetic:field:divisor
```

Features, generated code and diagnostics use URNs. References in the manifest (`ref`, `input` and `output`) use short keys. Each reference must point to an atom in the same manifest.

### Brand identifiers

Each atom also has a **brand identifier**. The brand identifier is the PascalCase form of its context and its identifier.

| Short key | Brand identifier |
| --- | --- |
| `arithmetic.field.divisor` | `ArithmeticDivisor` |
| `geometry.entity.circle_area` | `GeometryCircleArea` |
| `arithmetic.operation.safe_divide` | `ArithmeticSafeDivide` |

The names in the generated code come from brand identifiers. As a result, two atoms with the same brand identifier cause a compile error, also if they are of different kinds. For example, `geo_metry.field.radius` and `geo.field.metry_radius` both become `GeoMetryRadius`.

## Fields

A field declares one value. It has a primitive, and it can have constraints and a description.

```yaml
arithmetic.field.divisor:
  primitive: float
  notEqual: 0
  description: The number to divide by
```

| Primitive | TypeScript type | Constraints |
| --- | --- | --- |
| `boolean` | `boolean` | `mustBe` (`true` or `false`). The field accepts only this value, for example a box that the user must tick |
| `float` | A finite `number` | `min`, `max` and `notEqual` (numbers) |
| `integer` | A safe-integer `number` | `min`, `max` and `notEqual` (integers) |
| `string` | `string` | `minLength` and `maxLength` (integers that are not negative). `regex`: a pattern that the value must match. `oneOf`: a list of the values that the field accepts, for example `oneOf: [standard, express]`. The list must have one or more values, and no value two times |

A `regex` pattern must match the full value. For example, `[a-z]+` accepts `abc` but not `abc1`. You do not write `^` and `$`. The pattern is a JavaScript regular expression in Unicode mode, without other flags. Put the pattern in single quotes in YAML, because double quotes change backslashes:

```yaml
order.field.sku: { primitive: string, regex: '[A-Z]{3}-[0-9]{4}' }
```

A constraint that is not applicable to the primitive causes an error. A constraint value of the wrong type also causes an error. Constraints that do not accept a value cause an error too, for example `min: 5` with `max: 1`:

```
geometry.field.radius.minLength: "minLength" is not a constraint of primitive "float" (allowed: min, max, notEqual)
```

## Entities

An entity is a group of fields with a name. Each item in `fields` refers to a field by its short key:

```yaml
arithmetic.entity.division:
  description: A division to do
  fields:
    - ref: arithmetic.field.dividend
    - ref: arithmetic.field.divisor
      required: false     # the key can be absent; the default is true
```

- The `description` is mandatory. The entity must also have one or more fields.
- The reference sets if a field is optional, not the field. As a result, one field can be mandatory in one entity and optional in a different entity.
- In the entity, the name of each field is its **identifier**. For example, `arithmetic.field.divisor` becomes the property `divisor`. One entity cannot contain two fields with the same identifier, for example `geometry.field.size` and `arithmetic.field.size`.
- The generated code keeps the fields in the sequence of the manifest.

## Operations

An operation has an input entity and an output entity:

```yaml
arithmetic.operation.safe_divide:
  description: Divide; the divisor is never zero
  input: arithmetic.entity.division
  output: arithmetic.entity.division_result
```

The `input` and `output` values must be entities. The specification also accepts a field in these positions. The MVP does not accept a field.

## The passes

The pass numbers come from the specification. The MVP does not have passes 5, 6 and 8.

| Pass | Checks | Example message |
| --- | --- | --- |
| 1. Meta-schema | The header, short keys, kinds, primitives, constraint keys and types, mandatory properties, and YAML keys that occur two times | `invalid key "Geometry.field.radius": expected <context>.<kind>.<identifier>, …` |
| 2. Expansion | urn-forge changes short keys to URNs and makes the brand identifiers | No message |
| 3. Uniqueness | Two atoms cannot have the same URN or brand identifier. One entity cannot have two properties with the same name | `… brandIdentifier "GeoMetryRadius" is already used by urn:demo:math:geo:field:metry_radius; rename one of them` |
| 4. References | Each `ref` points to a field. Each `input` and `output` points to an entity | `urn:demo:math:geometry:entity:circle: fields[0].ref "geometry.field.diameter" does not resolve (…)` |
| 7. Constraint coherence | The constraints of each field accept one or more values: `min` is not larger than `max`, and `minLength` is not larger than `maxLength` | `urn:demo:math:geometry:field:radius: min (5) is greater than max (1), so no value is valid` |

For a list of all messages, with the cause and the correction for each, refer to [Diagnostics](../reference/diagnostics).
