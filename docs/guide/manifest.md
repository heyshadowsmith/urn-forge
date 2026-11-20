# Writing a manifest

A manifest is one YAML file that declares one domain. urn-forge validates it in four passes: a meta-schema check of the structure, then expansion to URNs, uniqueness checks and reference checks. Every problem is reported, not only the first.

## Header

```yaml
manifest:
  namespace: demo        # organization or system root
  domain: math           # bounded context or business vertical
  version: 0.1.0         # semver, set by you
  stability: stable      # optional: stable (default) or experimental
```

`namespace` and `domain` must be lowercase snake_case: they start with a letter, use only `a-z`, `0-9` and `_`, and are at most 63 characters. `version` must be a semver version.

## Short keys and URNs

Every other top-level key declares one atom, written as a **short key**:

```
<context>.<kind>.<identifier>
arithmetic.field.divisor
```

`context` and `identifier` follow the same snake_case rule as the header. `kind` is one of `field`, `entity` or `operation`. The spec's other kinds (`invariant`, `event`, `error`) are rejected with "not supported yet".

`compile` expands each short key into a full URN using the header:

```
arithmetic.field.divisor  →  urn:demo:math:arithmetic:field:divisor
```

URNs are what features, generated code and diagnostics use. References inside the manifest (`ref`, `input`, `output`) use short keys and must point into the same manifest.

### Brand identifiers

Each atom also gets a **brand identifier**: the PascalCase of its context and identifier.

| Short key | Brand identifier |
| --- | --- |
| `arithmetic.field.divisor` | `ArithmeticDivisor` |
| `geometry.entity.circle_area` | `GeometryCircleArea` |
| `arithmetic.operation.safe_divide` | `ArithmeticSafeDivide` |

Generated code is named after brand identifiers, so two atoms with the same brand identifier are a compile error, even across kinds. For example, `geo_metry.field.radius` and `geo.field.metry_radius` both become `GeoMetryRadius`.

## Fields

A field declares one value: a primitive plus optional constraints and a description.

```yaml
arithmetic.field.divisor:
  primitive: float
  notEqual: 0
  description: What to divide by
```

| Primitive | TypeScript type | Constraints |
| --- | --- | --- |
| `float` | finite `number` | `min`, `max`, `notEqual` (numbers) |
| `integer` | safe-integer `number` | `min`, `max`, `notEqual` (integers) |
| `string` | `string` | `minLength`, `maxLength` (non-negative integers) |

A constraint that doesn't belong to the primitive is an error. So is a constraint value of the wrong type:

```
geometry.field.radius.minLength: "minLength" is not a constraint of primitive "float" (allowed: min, max, notEqual)
```

## Entities

An entity is a named group of fields. Each entry in `fields` references a field by short key:

```yaml
arithmetic.entity.division:
  description: A division to perform
  fields:
    - ref: arithmetic.field.dividend
    - ref: arithmetic.field.divisor
      required: false     # the key may be absent; defaults to true
```

- `description` is required, and so is at least one field.
- Optionality lives on the reference, not the field, so one field can be required in one entity and optional in another.
- On the entity, each field appears under its **identifier**: `arithmetic.field.divisor` becomes the property `divisor`. Two fields with the same identifier (say `geometry.field.size` and `arithmetic.field.size`) can't both be in one entity.
- Fields keep their declaration order in the generated code.

## Operations

An operation names its input and output entities:

```yaml
arithmetic.operation.safe_divide:
  description: Divide; the divisor is never zero
  input: arithmetic.entity.division
  output: arithmetic.entity.division_result
```

`input` and `output` must name entities. The spec also allows a field here; the MVP doesn't.

## Validation passes

| Pass | Checks | Example message |
| --- | --- | --- |
| 1. Meta-schema | Header, short keys, kinds, primitives, constraint keys and types, required properties, duplicate YAML keys | `invalid key "Geometry.field.radius": expected <context>.<kind>.<identifier>, …` |
| 2. Expansion | Short keys become URNs, and brand identifiers are derived | none |
| 3. Uniqueness | No two atoms share a URN or a brand identifier; no entity has two properties with one name | `… brandIdentifier "GeoMetryRadius" is already used by urn:demo:math:geo:field:metry_radius; rename one of them` |
| 4. References | Each `ref` names a field; each `input`/`output` names an entity | `urn:demo:math:geometry:entity:circle: fields[0].ref "geometry.field.diameter" does not resolve (…)` |

[Diagnostics](../reference/diagnostics) lists every message with its cause and fix.
