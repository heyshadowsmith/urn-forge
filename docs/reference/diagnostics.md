# Diagnostics

This page gives each diagnostic that urn-forge can show. Each diagnostic has a stable **code**. The codes are in groups, one group for each pass or gate. Each message starts with its manifest key or its URN. The `<…>` text shows a value that changes.

## The parts of a diagnostic

```
domain.manifest.yaml:10:12  error  unresolved-ref  urn:demo:math:geometry:entity:circle: fields[1].ref "geometry.field.diameter" does not resolve (…)
```

| Part | Example | Description |
| --- | --- | --- |
| File | `domain.manifest.yaml` | The file that has the problem, relative to the current directory |
| Line and column | `10:12` | The position of the problem in the file. Both start at 1. Some diagnostics do not have a position, for example a file that is not there |
| Severity | `error` | `error` makes the command fail. `warning` does not |
| Code | `unresolved-ref` | A stable name for the problem. Use it to find the problem on this page |
| Message | `urn:demo:…: fields[1].ref …` | The problem. It starts with the manifest key or the URN |

The position points to the part of the manifest that has the problem:

- A bad value: the position of the value.
- A bad key or a property that the entry does not accept: the position of the key.
- A property that is not there: the position of the entry key.
- A problem with an atom as a whole, for example two atoms with the same brand identifier: the position of the entry key.

With `--format json`, each diagnostic is one JSON object on one line. Refer to [CLI](./cli#output-formats).

## Read the configuration

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `config-unreadable` | `cannot load config: <reason>` | urn-forge cannot load the configuration file. The file is not there, or it has a TypeScript or JavaScript error | Make sure that `--config` gives the correct file, and correct the error in the file |
| `config-invalid` | `config.<setting>: <message>` | The file has no default export, an unknown setting, a value of the wrong type, an unknown plugin, or a plugin two times | Correct the setting. Refer to [Configuration file](./config) |

## Read the manifest

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `manifest-unreadable` | `cannot read manifest: <reason>` | The manifest file is not there, or urn-forge cannot read it | Make sure that `--manifest` gives the correct file |
| `yaml-syntax` | `YAML: <parser message>` | The file is not valid YAML | Correct the YAML |
| `duplicate-key` | `YAML: Map keys must be unique` | A key occurs two times in one mapping | Remove one of the keys. A key that occurs two times is always an error |

## Meta-schema (pass 1)

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `not-a-mapping` | `manifest must be a YAML mapping` | The top level is not a set of keys | Start the file with `manifest:` and the atom keys |
| `missing-header` | `manifest: missing header (namespace, domain, version)` | The file has no `manifest:` key | Add the [header](../guide/manifest#header) |
| `invalid-key` | `invalid key "<key>": expected <context>.<kind>.<identifier>, …` | A top-level key is not a valid short key | Change the name of the key, for example to `geometry.field.radius` |
| `unsupported-kind` | `invalid key "<key>": kind "<kind>" is not supported yet (MVP kinds: field, entity, operation, error)` | The kind is `invariant` or `event`. The specification has these kinds, but urn-forge does not at this time | Remove the entry. Refer to [MVP scope](./scope) |
| `unknown-kind` | `invalid key "<key>": unknown kind "<kind>" …` | The middle segment is not a known kind | Use `field`, `entity`, `operation` or `error` |
| `unknown-primitive` | `<key>.primitive: unknown primitive "<name>" (MVP primitives: boolean, float, integer, string)` | The MVP does not accept this primitive | Use `boolean`, `float`, `integer` or `string` |
| `constraint-not-allowed` | `<key>.<constraint>: "<constraint>" is not a constraint of primitive "<primitive>" (allowed: …)` | A field has a property that is not a constraint of its primitive, for example `minLength` on a `float` | Use a constraint from the list in the message |
| `unknown-property` | `<key>.<property>: unknown property "<property>"` | An entity, an operation or the header has a key that it does not accept | Remove the key, or correct its name |
| `invalid-value` | `<key>.<property>: <Valibot message>` | A value has the wrong type or form. Examples: `min: "abc"`, `max: 1.5` on an `integer`, a `regex` that is not a valid regular expression, an error `category` that is not one of the five categories, `recordAs` on an error (this needs the `event` kind), an empty `fields` list, no `description`, or a `namespace` that is not snake_case | Correct the value. The message tells the necessary type or form |

## Uniqueness (pass 3)

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `duplicate-urn` | `<urn>: declared more than once` | Two entries expand to the same URN | Remove one of the entries |
| `duplicate-brand` | `<urn>: brandIdentifier "<Brand>" is already used by <urn>; rename one of them` | Two atoms make the same PascalCase name. This is an error also if the atoms are of different kinds | Change one context or one identifier |
| `duplicate-property` | `<urn>: fields[<i>].ref <urn> and <urn> both become property "<name>"` | One entity contains two fields with the same identifier | Change the identifier of one field |
| `duplicate-ref` | `<urn>: fields[<i>].ref lists <urn> more than once` | One entity refers to the same field two times | Remove the second reference |
| `reserved-property` | `<urn>: fields[<i>].ref <urn> becomes property "kind", which an error reserves for its URN; rename the field` | An error has a field with the identifier `kind`. Each error payload has a `kind` property that contains the URN of the error | Change the identifier of the field, for example to `item_kind` |

## References (pass 4)

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `unresolved-ref` | `<urn>: <where> "<short key>" does not resolve (no atom <urn> in this manifest)` | A `ref`, `input` or `output` refers to an atom that the manifest does not declare | Declare the atom, or correct the short key |
| `wrong-ref-kind` | `<urn>: <where> "<short key>" must name a field, but <urn> is an entity` | A `ref` refers to an atom that is not a field, or an `input` or `output` refers to an atom that is not an entity | Refer to an atom of the correct kind. To use a field as an input or output, put it in an entity |

## Message templates (pass 6)

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `unknown-placeholder` | `<urn>: message placeholder {<name>} names no field of the error (required fields: …)` | A `{placeholder}` in the `message` of an error is not a field of the error, or it is an optional field. A placeholder must name a mandatory field. Then each message is complete | Correct the name, or make the field mandatory |

## Constraint coherence (pass 7)

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `incoherent-constraints` | `<urn>: min (<n>) is greater than max (<n>), so no value is valid` | The constraints of a field do not accept a value, or a value in its `oneOf` list can never be valid. Examples: `min` is larger than `max`, `minLength` is larger than `maxLength`, or `min` and `max` are equal and `notEqual` has the same value, or a `oneOf` value is shorter than `minLength`, longer than `maxLength` or does not match `regex` | Correct the constraints. The position gives the constraint to examine |

## Plugins

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `export-collision` | `<urn>: generated export "<Name>" collides with an export of <urn>; rename one of them` | Two atoms make the same export name. For example, `geometry.field.radius_input` exports `GeometryRadiusInput`. This is also the input type of `geometry.field.radius` | Change the name of one atom |
| `unsupported-construct` | `<urn>: the <plugin> plugin does not handle kind "<kind>"`, `… does not handle primitive "<primitive>"` or `… cannot translate constraint "<constraint>"` | A plugin cannot make code for an atom, a primitive or a constraint in the manifest. Each plugin declares the parts that it can use, and urn-forge examines the manifest before the plugins start | Remove the plugin from the configuration, or do not use the part. The shipped plugins can use all the parts of the MVP |
| `plugin-config` | `plugin <name> config: <message>` | The configuration of a plugin in the `plugins` list is not valid | Correct the configuration. The shipped plugins accept only `{}` |
| `missing-plugin` | `plugin <name> requires plugin <name>, which is not enabled` | A plugin uses the output of a plugin that is not in the `plugins` list | Add the necessary plugin to the list |
| `output-conflict` | `plugin <name> writes <file>, which another plugin already wrote` | Two plugins make a file with the same name | The CLI cannot cause this error in the MVP, because its two plugins make different files |

## Gate 1: completeness

For the procedure of each gate, refer to [Verification gates](../guide/verify).

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `tsconfig-unreadable` | `<TypeScript message>` | The `--tsconfig` file is not there, or it is not valid | Make sure that `--tsconfig` gives a valid file |
| `core-not-found` | `core entry not found` | The `--core` file is not there | Make sure that `--core` gives the correct file |
| `type-error` | `TS<number>: <TypeScript message>` | TypeScript finds an error in the core or in a file that it imports. A handler that is not there or that has the wrong type causes this error | Correct the type error |
| `missing-satisfies` | ``no export uses `satisfies DomainCoreImplementation` from <file>; …`` | No export of the core file uses `satisfies` with the generated `DomainCoreImplementation` | Declare the core as `export const core = { … } satisfies DomainCoreImplementation;` |

## Gate 3: Gherkin traceability

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `features-unreadable` | `cannot read features: <reason>` | The `--features` directory is not there | Make sure that `--features` gives the correct directory |
| `feature-parse-error` | `cannot parse: <parser message>` | A `.feature` file is not valid Gherkin | Correct the Gherkin |
| `unresolved-tag` | `tag @<urn> does not resolve to a URN in the manifest` | A `@urn:` tag does not agree with a URN in the manifest | Correct the tag |
| `untagged-operation` | `operation <urn> has no feature or scenario tagged @<urn>` | No feature or scenario has the tag of the operation | Add a feature for the operation |
| `missing-column` | `the table of "I run the operation with:" has no column for required input field(s) "<name>" of <urn>; …` | The input table of the operation does not have a column for a mandatory input field | Add the column. To make a test with a missing value, keep the column and leave the cell empty |
| `undeclared-error` | `"<error URN>" is not a declared error of <operation URN> (errors: …)` | A step `Then the operation fails with "<error URN>"` gives an error that the operation of the scenario does not declare | Give an error from the list, or add the error to `errors` of the operation |
| `uncovered-error` | `error <error URN> of <operation URN> has no scenario that expects it; …` | This is a warning. No scenario of the operation expects the error | Add a scenario with `Then the operation fails with "<error URN>"` |
| `ambiguous-tag` | `scenario is tagged with more than one operation or entity: <urns>` | A scenario receives two or more operation or entity tags | Keep one operation or entity tag for each scenario |
| `unknown-header` | `table header "<name>" is not a field key of <owner> (allowed: …)` | A table header is not a property of the input or output of the operation, or of the entity | Use a name from the list in the message |

## Gate 4: drift

| Code | Message | Cause | Correction |
| --- | --- | --- | --- |
| `generated-missing` | ``missing; run `urn-forge compile` `` | A generated file is not in the `--out` directory | Run `urn-forge compile` and commit the result |
| `generated-differs` | ``differs from a fresh compile (hand-edited or stale); run `urn-forge compile` `` | A person edited the file, or the manifest changed without a new compile. The position gives the first line that is different | Run `urn-forge compile` and commit the result |
| `generated-orphan` | `generated file has no source in the current compile; delete it` | A `*.generated.*` file that the current compile does not make | Delete the file |
