# Diagnostics

Every message urn-forge can print while compiling a manifest, grouped by the pass that produces it. Messages start with the manifest key or URN they are about. Placeholders are shown as `<…>`.

## Meta-schema (pass 1)

| Message | Cause | Fix |
| --- | --- | --- |
| `YAML: <parser message>` | The file isn't valid YAML, or a key appears twice | Fix the YAML. Duplicate keys are always an error |
| `manifest must be a YAML mapping` | The top level isn't a set of keys | Start the file with `manifest:` and atom keys |
| `manifest: missing header (namespace, domain, version)` | There's no `manifest:` key | Add the [header](../guide/manifest#header) |
| `manifest.namespace: must be lowercase snake_case, …` | A header segment breaks the naming rule | Use `a-z`, `0-9` and `_`, starting with a letter |
| `manifest.version: must be a semver version such as 0.1.0` | `version` isn't semver | Quote it if YAML reads it as a number |
| `invalid key "<key>": expected <context>.<kind>.<identifier>, …` | A top-level key isn't a valid short key | Rename it, for example `geometry.field.radius` |
| `invalid key "<key>": kind "<kind>" is not supported yet (MVP kinds: field, entity, operation)` | `invariant`, `event` or `error`, which the spec has but the MVP doesn't | Remove it for now. See [MVP scope](./scope) |
| `invalid key "<key>": unknown kind "<kind>" …` | The middle segment isn't a known kind | Use `field`, `entity` or `operation` |
| `<key>.primitive: unknown primitive "<name>" (MVP primitives: float, integer, string)` | A primitive the MVP doesn't support | Use `float`, `integer` or `string` |
| `<key>.<constraint>: "<constraint>" is not a constraint of primitive "<primitive>" (allowed: …)` | For example, `minLength` on a `float` | Use a constraint from the allowed list |
| `<key>.<constraint>: <Valibot message>` | A constraint value of the wrong type, such as `min: "abc"` (`Invalid type: …`) or `max: 1.5` on an `integer` (`Invalid safe integer: …`) | Use a number (an integer for `integer` fields) |
| `<key>.<property>: unknown property "<property>"` | A key the entry doesn't accept | Remove it, or check its spelling |
| `<key>.fields: must list at least one field` | An entity with an empty `fields` list | Add a field reference |
| `<key>.description: …` | An entity or operation without a description, or an empty one | Add a description |

## Uniqueness (pass 3)

| Message | Cause | Fix |
| --- | --- | --- |
| `<urn>: brandIdentifier "<Brand>" is already used by <urn>; rename one of them` | Two atoms produce the same PascalCase name, even across kinds | Rename one context or identifier |
| `<urn>: fields[<i>].ref <urn> and <urn> both become property "<name>"` | Two fields with the same identifier in one entity | Rename one field's identifier |
| `<urn>: fields[<i>].ref lists <urn> more than once` | The same field is listed twice in one entity | Remove the duplicate |

## References (pass 4)

| Message | Cause | Fix |
| --- | --- | --- |
| `<urn>: <where> "<short key>" does not resolve (no atom <urn> in this manifest)` | A `ref`, `input` or `output` names an atom that isn't declared | Declare it, or fix the short key |
| `<urn>: <where> "<short key>" must name a field, but <urn> is an entity` | A `ref` points at something that isn't a field | Point it at a field |
| `<urn>: input "<short key>" must name an entity, but <urn> is a field` | An operation's `input` or `output` isn't an entity | Wrap the field in an entity |

## Plugins

| Message | Cause | Fix |
| --- | --- | --- |
| `<urn>: generated export "<Name>" collides with an export of <urn>; rename one of them` | For example, `geometry.field.radius_input` exports `GeometryRadiusInput`, which is also the input type of `geometry.field.radius` | Rename one atom |
| `plugin <name> config: <message>` | Invalid plugin configuration | Not reachable from the CLI in the MVP, which has no config file |

## Gates

The messages from `verify` are listed with each gate in [Verification gates](../guide/verify).
