# Compiler passes

The `compile` and `verify` commands send the manifest through a sequence of passes. The passes make the IR. Then the plugins make the generated files from the IR. The pass numbers come from specification v1.1. urn-forge 0.1.0 does not have passes 5 and 8 at this time.

## Sequence

| Step | Name | Examines | Codes | If there is an error |
| --- | --- | --- | --- | --- |
| Read | Read the file | The manifest file can be read | `manifest-unreadable` | Stop |
| YAML | Parse the YAML | The file is valid YAML with no key two times in one mapping | `yaml-syntax`, `duplicate-key` | Stop after this step |
| 1 | [Meta-schema](#pass-1-meta-schema) | The structure of the header and of each entry | `not-a-mapping`, `missing-header`, `invalid-key`, `unsupported-kind`, `unknown-kind`, `unknown-primitive`, `constraint-not-allowed`, `unknown-property`, `missing-property`, `invalid-value` | Stop after this step |
| 2 | [Expansion](#pass-2-expansion) | None. It makes the URNs and the brand identifiers | None | — |
| 3 | [Uniqueness](#pass-3-uniqueness) | Brand identifiers and property names are unique | `duplicate-brand`, `duplicate-property`, `duplicate-ref`, `reserved-property` | Stop after pass 7 |
| 4 | [References](#pass-4-references) | Each reference names an atom of the correct kind | `unresolved-ref`, `wrong-ref-kind` | Stop after pass 7 |
| 5 | Cycle check | Not built | — | — |
| 6 | [Message templates](#pass-6-message-templates) | Each placeholder in an error message names a mandatory field of the error | `unknown-placeholder` | Stop after pass 7 |
| 7 | [Constraint coherence](#pass-7-constraint-coherence) | The constraints of each field accept one or more values | `incoherent-constraints` | Stop after pass 7 |
| 8 | Lifecycle | Not built | — | — |
| Plugins | [Plugin checks](#plugin-checks) | The plugins and their configurations agree with the IR | `plugin-config`, `missing-plugin`, `unsupported-construct`, `export-collision`, `output-conflict` | No files |

- Each step reports all the problems that it finds, not only the first problem.
- Passes 2 to 7 run together, and urn-forge reports their diagnostics together.
- Each diagnostic has a position in the manifest, except `manifest-unreadable`, `not-a-mapping`, `missing-header`, `plugin-config`, `missing-plugin` and `output-conflict`.
- For the message, the cause and the correction of each code, refer to [Diagnostics](./diagnostics).

## Pass 1: meta-schema

Pass 1 examines the parsed YAML with Valibot schemas. It examines these items, in this sequence:

1. The top level is a mapping (`not-a-mapping`).
2. The `manifest` header is there (`missing-header`) and agrees with its schema.
3. Each other top-level key, in the sequence of the file:
   1. The key is a short key (`invalid-key`) of a known kind (`unknown-kind`). The kinds `invariant` and `event` cause `unsupported-kind`.
   2. The entry agrees with the schema of its kind. For a field, the schema comes from its primitive.

| Problem in an entry | Code | Position |
| --- | --- | --- |
| A `primitive` that is not `boolean`, `float`, `integer` or `string`, or no `primitive` | `unknown-primitive` | The value, or the entry key if there is no `primitive` |
| A key on a field that is a constraint of a different primitive | `constraint-not-allowed` | The key |
| A key on the header, an atom or a field reference that it does not accept, and on a field a key that is a constraint of no primitive | `unknown-property` | The key |
| A value of the wrong type or form | `invalid-value` | The value |
| A necessary property that is not there | `missing-property` | The entry key |

The schema of each kind is on [The manifest](./manifest). The rules for constraint values are on [Primitives and constraints](./primitives).

## Pass 2: expansion

Pass 2 changes each short key to a URN with the `namespace` and `domain` of the header. It also makes the brand identifier of each atom. It reports no diagnostics. Refer to [URNs and names](./naming).

## Pass 3: uniqueness

Each URN is unique without a check. A URN comes from its short key with one rule, and a YAML mapping cannot have the same key two times (`duplicate-key`).

| Check | Code | Where |
| --- | --- | --- |
| Two atoms have the same brand identifier | `duplicate-brand` | All atoms, also of different kinds |
| One `fields` list has two fields with the same identifier | `duplicate-property` | Entities and errors |
| One `fields` list refers to the same field two times | `duplicate-ref` | Entities and errors |
| One `errors` list refers to the same error two times | `duplicate-ref` | Operations |
| A field of an error has the identifier `kind` | `reserved-property` | Errors |

Pass 3 examines URNs and brand identifiers over all atoms first. The other checks run for each atom, after pass 4 for that atom. A reference that does not resolve is not part of the `duplicate-property` and `duplicate-ref` checks.

## Pass 4: references

| Kind | Reference | Must name |
| --- | --- | --- |
| `entity` | `fields[<i>].ref` | A field |
| `error` | `fields[<i>].ref` | A field |
| `operation` | `input` | An entity |
| `operation` | `output` | An entity |
| `operation` | `errors[<i>]` | An error |

| Problem | Code |
| --- | --- |
| The manifest does not declare the atom | `unresolved-ref` |
| The atom is of a kind that the reference does not accept | `wrong-ref-kind` |

The message names the reference with its path, for example `fields[1].ref` or `errors[2]`.

## Pass 6: message templates

Pass 6 parses the `message` of each error into text and placeholders. Each placeholder must name a field of the error with `required: true`. If not, pass 6 reports `unknown-placeholder` at the `message`, one time for each placeholder. For the form of a placeholder, refer to [The manifest](./manifest).

The specification also puts invariant rules and `recordAs` events in pass 6. urn-forge 0.1.0 does not have invariants and events at this time.

## Pass 7: constraint coherence

Pass 7 examines the constraints of each field together. It reports `incoherent-constraints` at the constraint to correct. For the rules, refer to [Primitives and constraints](./primitives).

Pass 1, not pass 7, examines that a `oneOf` list is not empty and has no value two times.

## Sequence of the diagnostics

urn-forge reports the diagnostics of passes 3 to 7 in this sequence:

1. `duplicate-brand`, for all atoms in URN order.
2. For each atom in URN order:
   1. Pass 4, for each reference in the sequence of the entry.
   2. The checks of the kind of the atom:

| Kind | Checks, in sequence |
| --- | --- |
| `field` | Pass 7 |
| `entity` | `duplicate-property` and `duplicate-ref`, for each item of `fields` |
| `operation` | `duplicate-ref`, for each item of `errors` |
| `error` | `duplicate-property` and `duplicate-ref`, then `reserved-property`, then pass 6 |

URN order compares the UTF-16 code units. It does not use the locale.

This fixture has problems from passes 3, 4, 6 and 7:

<<< @/../packages/urn-forge/tests/fixtures/broken-references/domain.manifest.yaml

`urn-forge compile --manifest tests/fixtures/broken-references/domain.manifest.yaml` writes these diagnostics:

```
tests/fixtures/broken-references/domain.manifest.yaml:7:1  error  duplicate-brand  urn:demo:broken:geo_metry:field:radius: brandIdentifier "GeoMetryRadius" is already used by urn:demo:broken:geo:field:metry_radius; rename one of them
tests/fixtures/broken-references/domain.manifest.yaml:17:12  error  unresolved-ref  urn:demo:broken:order:entity:line: fields[1].ref "order.field.missing" does not resolve (no atom urn:demo:broken:order:field:missing in this manifest)
tests/fixtures/broken-references/domain.manifest.yaml:18:12  error  wrong-ref-kind  urn:demo:broken:order:entity:line: fields[2].ref "order.entity.line" must name a field, but urn:demo:broken:order:entity:line is an entity
tests/fixtures/broken-references/domain.manifest.yaml:32:12  error  unknown-placeholder  urn:demo:broken:order:error:limit: message placeholder {code} names an optional field; placeholders must name required fields (required fields: none)
tests/fixtures/broken-references/domain.manifest.yaml:23:12  error  unknown-placeholder  urn:demo:broken:order:error:limit_exceeded: message placeholder {quantiy} names no field of the error (required fields: quantity)
tests/fixtures/broken-references/domain.manifest.yaml:23:12  error  unknown-placeholder  urn:demo:broken:order:error:limit_exceeded: message placeholder {limit} names no field of the error (required fields: quantity)
tests/fixtures/broken-references/domain.manifest.yaml:52:19  error  reserved-property  urn:demo:broken:order:error:wrong_kind: fields[0].ref urn:demo:broken:order:field:kind becomes property "kind", which an error reserves for its URN; rename the field
tests/fixtures/broken-references/domain.manifest.yaml:10:67  error  incoherent-constraints  urn:demo:broken:order:field:code: oneOf value "abc" is longer than maxLength (2), so it is never valid
tests/fixtures/broken-references/domain.manifest.yaml:9:61  error  incoherent-constraints  urn:demo:broken:order:field:quantity: min (10) is greater than max (1), so no value is valid
tests/fixtures/broken-references/domain.manifest.yaml:11:69  error  incoherent-constraints  urn:demo:broken:order:field:size: oneOf value "XL" does not match regex [SML], so it is never valid
tests/fixtures/broken-references/domain.manifest.yaml:39:10  error  wrong-ref-kind  urn:demo:broken:order:operation:place: input "order.field.quantity" must name an entity, but urn:demo:broken:order:field:quantity is a field
tests/fixtures/broken-references/domain.manifest.yaml:45:40  error  wrong-ref-kind  urn:demo:broken:order:operation:reprice: errors[1] "order.entity.line" must name an error, but urn:demo:broken:order:entity:line is an entity
tests/fixtures/broken-references/domain.manifest.yaml:45:59  error  duplicate-ref  urn:demo:broken:order:operation:reprice: errors[2] lists urn:demo:broken:order:error:limit_exceeded more than once
```

## The IR

If passes 1 to 7 find no error, urn-forge makes the IR. The IR has these parts:

| Part | Contents |
| --- | --- |
| `meta` | `namespace`, `domain`, `manifestVersion` (the `version` of the header), `stability` (default `stable`), `manifestHash` (SHA-256 of the canonical JSON of the manifest) and `irSchemaVersion` (`1`) |
| `fields`, `entities`, `operations`, `errors` | One node for each atom, with the URN as the key, in URN order |

The plugins read only the IR. The IR types are exports of the [package API](./public-api).

## Plugin checks

After the passes, the engine examines the plugins in this sequence:

1. The configuration of each plugin agrees with its schema (`plugin-config`).
2. Each plugin in the `requires` list of a plugin is also in the plugin list (`missing-plugin`).
3. Each plugin can use each kind, primitive and constraint in the IR (`unsupported-construct`). A plugin declares these in its `supports` property.
4. Each plugin makes its files. The Valibot plugin reports `export-collision`. Two plugins that make a file with the same path cause `output-conflict`.

If step 1 or step 2 finds an error, steps 3 and 4 do not run. If step 3 finds an error, step 4 does not run. The `valibot` and `fcis` plugins can use all the kinds, primitives and constraints of urn-forge 0.1.0. Thus the CLI cannot cause `unsupported-construct` and `output-conflict` at this time.

| `unsupported-construct` message after `<URN>: the <plugin> plugin ` | Cause |
| --- | --- |
| `does not handle kind "<kind>"` | The plugin does not list the kind of the atom |
| `does not handle primitive "<primitive>"` | The plugin does not list the primitive of the field |
| `cannot translate constraint "<constraint>"` | The plugin does not list the constraint for the primitive of the field |

## Related pages

- [Diagnostics](./diagnostics)
- [The manifest](./manifest)
- [The configuration file](./configuration)
- [How urn-forge is built](../explanation/architecture)
- [Departures from the specification](../explanation/departures-from-the-spec)
