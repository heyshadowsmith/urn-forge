# Diagnostics

This page gives each message that urn-forge can show when it compiles a manifest. The messages are in groups, one group for each pass. Each message starts with its manifest key or its URN. The `<…>` text shows a value that changes.

## Meta-schema (pass 1)

| Message | Cause | Correction |
| --- | --- | --- |
| `YAML: <parser message>` | The file is not valid YAML, or a key occurs two times | Correct the YAML. A key that occurs two times is always an error |
| `manifest must be a YAML mapping` | The top level is not a set of keys | Start the file with `manifest:` and the atom keys |
| `manifest: missing header (namespace, domain, version)` | The file has no `manifest:` key | Add the [header](../guide/manifest#header) |
| `manifest.namespace: must be lowercase snake_case, …` | A segment of the header does not obey the name rule | Use only `a-z`, `0-9` and `_`. Start with a letter |
| `manifest.version: must be a semver version such as 0.1.0` | The `version` value is not a semver version | Put the value in quotes if YAML reads it as a number |
| `invalid key "<key>": expected <context>.<kind>.<identifier>, …` | A top-level key is not a valid short key | Change the name of the key, for example to `geometry.field.radius` |
| `invalid key "<key>": kind "<kind>" is not supported yet (MVP kinds: field, entity, operation)` | The kind is `invariant`, `event` or `error`. The specification has these kinds, but the MVP does not | Remove the entry. Refer to [MVP scope](./scope) |
| `invalid key "<key>": unknown kind "<kind>" …` | The middle segment is not a known kind | Use `field`, `entity` or `operation` |
| `<key>.primitive: unknown primitive "<name>" (MVP primitives: float, integer, string)` | The MVP does not accept this primitive | Use `float`, `integer` or `string` |
| `<key>.<constraint>: "<constraint>" is not a constraint of primitive "<primitive>" (allowed: …)` | The constraint is not applicable to the primitive, for example `minLength` on a `float` | Use a constraint from the list in the message |
| `<key>.<constraint>: <Valibot message>` | The constraint value has the wrong type. Examples: `min: "abc"` gives `Invalid type: …`, and `max: 1.5` on an `integer` gives `Invalid safe integer: …` | Use a number. For an `integer` field, use an integer |
| `<key>.<property>: unknown property "<property>"` | The entry has a key that it does not accept | Remove the key, or correct its name |
| `<key>.fields: must list at least one field` | The `fields` list of an entity is empty | Add a field reference |
| `<key>.description: …` | An entity or an operation has no description, or an empty description | Add a description |

## Uniqueness (pass 3)

| Message | Cause | Correction |
| --- | --- | --- |
| `<urn>: brandIdentifier "<Brand>" is already used by <urn>; rename one of them` | Two atoms make the same PascalCase name. This is an error also if the atoms are of different kinds | Change one context or one identifier |
| `<urn>: fields[<i>].ref <urn> and <urn> both become property "<name>"` | One entity contains two fields with the same identifier | Change the identifier of one field |
| `<urn>: fields[<i>].ref lists <urn> more than once` | One entity refers to the same field two times | Remove the second reference |

## References (pass 4)

| Message | Cause | Correction |
| --- | --- | --- |
| `<urn>: <where> "<short key>" does not resolve (no atom <urn> in this manifest)` | A `ref`, `input` or `output` refers to an atom that the manifest does not declare | Declare the atom, or correct the short key |
| `<urn>: <where> "<short key>" must name a field, but <urn> is an entity` | A `ref` refers to an atom that is not a field | Refer to a field |
| `<urn>: input "<short key>" must name an entity, but <urn> is a field` | The `input` or `output` of an operation is not an entity | Put the field in an entity |

## Plugins

| Message | Cause | Correction |
| --- | --- | --- |
| `<urn>: generated export "<Name>" collides with an export of <urn>; rename one of them` | Two atoms make the same export name. For example, `geometry.field.radius_input` exports `GeometryRadiusInput`. This is also the input type of `geometry.field.radius` | Change the name of one atom |
| `plugin <name> config: <message>` | A plugin configuration is not valid | The CLI cannot cause this error in the MVP, because the MVP has no configuration file |

## Gates

For the messages of the `verify` command, refer to [Verification gates](../guide/verify).
