# Diagnostics

This page gives each diagnostic that urn-forge can show. Each diagnostic has a stable **code**. The codes are in groups, one group for each step of `compile` and for each gate of `verify`. In a message, the `<…>` text shows a value that changes.

## The parts of a diagnostic

```
domain.manifest.yaml:10:12  error  unresolved-ref  urn:demo:math:geometry:entity:circle: fields[1].ref "geometry.field.diameter" does not resolve (no atom urn:demo:math:geometry:field:diameter in this manifest)
```

| Part | Example | Description |
| --- | --- | --- |
| File | `domain.manifest.yaml` | The file that has the problem, relative to the current directory, with forward slashes. For some gate 3 problems, this is the `--features` directory |
| Line and column | `10:12` | The position of the problem in the file. Both start at 1. A diagnostic without a position has no `:<line>:<column>` part |
| Severity | `error` | Refer to [Severities](#severities) |
| Code | `unresolved-ref` | The stable name of the problem. The tables on this page use it |
| Message | `urn:demo:math:…` | The problem. A manifest message starts with the manifest key or the URN. A message can have more than one line, for example a TypeScript message |

In the text format, `compile` and `verify` write manifest diagnostics to stderr. `verify` writes the problems of each gate to stdout, below the line of the gate, with an indent of four spaces. With `--format json`, each diagnostic is one JSON object on one line. Refer to [JSON output](./json-output).

The position in a manifest points to the part that has the problem:

- A bad value: the position of the value.
- A bad key, or a property that the entry does not accept: the position of the key.
- A property that is not there: the position of the entry key.
- A problem with an atom as a whole, for example two atoms with the same brand identifier: the position of the entry key.

## Severities

| Severity | Effect on the command | Counted in the last line of `verify` |
| --- | --- | --- |
| `error` | `compile` writes no files. In `verify`, the gate fails, or no gate runs if the error is in the manifest | No |
| `warning` | None | Yes, for example `verify passed with 2 warning(s)` |
| `note` | None. The note gives information only | No |

Most codes always have the same severity. The severity of `uncovered-error` and `uncovered-boundary` changes with the coverage mode. Refer to [Verification gates](./verification-gates).

## Read the configuration

These diagnostics have the configuration file as their file, and no position.

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `config-unreadable` | `error` | `cannot load config: <reason>` | urn-forge cannot load the configuration file. The file is not there, or it has a TypeScript or JavaScript error. The message gives the full reason, which can have more than one line. File paths in it are relative to the working directory | Make sure that `--config` gives the correct file. Correct the error in the file |
| `config-invalid` | `error` | ``config: the file must `export default` the config``<br>`config.<option>: unknown option "<option>"`<br>`config.<option>: <Valibot message>`<br>`config.plugins[<i>]: unknown plugin "<name>" (plugins: valibot, fcis)`<br>`config.plugins[<i>]: plugin "<name>" is listed more than once`<br>`config.plugins: must list one or more plugins`<br>`config.plugins[<i>]: must be a plugin name or [name, config]` | The file has no default export, an unknown option, a value of the wrong type, an unknown plugin, the same plugin two times, an empty `plugins` list, or a plugin entry that is not a name or a `[name, config]` pair. An example of a Valibot message: `config.out: must not be empty` | Correct the option. Refer to [The configuration file](./configuration) |

## Read the manifest

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `manifest-unreadable` | `error` | `cannot read manifest: <reason>` | The manifest file is not there, or urn-forge cannot read it. The diagnostic has no position. The path in the reason is relative to the working directory. `verify` then stops with `verify failed: the manifest cannot be read` | Make sure that `--manifest` gives the correct file |
| `yaml-syntax` | `error` | `YAML: <parser message>` | The file is not valid YAML | Correct the YAML |
| `duplicate-key` | `error` | `YAML: Map keys must be unique` | A key occurs two times in one mapping. The position is the second key | Remove one of the keys |

## Pass 1: meta-schema

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `not-a-mapping` | `error` | `manifest must be a YAML mapping` | The top level of the file is not a mapping, for example a list | Start the file with `manifest:` and the atom keys |
| `missing-header` | `error` | `manifest: missing header (namespace, domain, version)` | The file has no `manifest:` key | Add the header. Refer to [The manifest](./manifest) |
| `invalid-key` | `error` | `invalid key "<key>": expected <context>.<kind>.<identifier>, where context and identifier are lowercase snake_case starting with a letter (max 63 characters)` | A top-level key is not a valid short key | Change the key, for example to `geometry.field.radius` |
| `unsupported-kind` | `error` | `invalid key "<key>": kind "<kind>" is not supported yet (MVP kinds: field, entity, operation, error)` | The kind is `invariant` or `event`. The specification has these kinds, but urn-forge does not have them at this time | Remove the entry. Refer to [Scope](./scope) |
| `unknown-kind` | `error` | `invalid key "<key>": unknown kind "<kind>" (MVP kinds: field, entity, operation, error)` | The middle segment of the key is not a known kind | Use `field`, `entity`, `operation` or `error` |
| `unknown-primitive` | `error` | `<key>.primitive: unknown primitive "<name>" (MVP primitives: boolean, float, integer, string)`<br>`<key>.primitive: a field must have a primitive (MVP primitives: boolean, float, integer, string)` | The `primitive` of a field is not a known primitive, or the field has no `primitive` | Use `boolean`, `float`, `integer` or `string` |
| `constraint-not-allowed` | `error` | `<key>.<property>: "<property>" is not a constraint of primitive "<primitive>" (allowed: <constraints>)` | A field has a constraint of a different primitive, for example `minLength` on a `float`. A key that is a constraint of no primitive gets `unknown-property` | Use a constraint from the list in the message |
| `unknown-property` | `error` | `<key>.<property>: unknown property "<property>"` | An atom or the header has a key that it does not accept. On a field, this is a key that is a constraint of no primitive, for example `colour` | Remove the key, or correct its name |
| `missing-property` | `error` | `<key>.<property>: missing property "<property>"` | An entry does not have a property that it must have, for example the `description` of an entity | Add the property |
| `invalid-value` | `error` | `<key>.<property>: <message>` | A value has the wrong type or form, or a necessary property is not there. Refer to the examples after this table | Correct the value. The message gives the necessary type or form |

Examples of `invalid-value` messages:

```
geometry.field.t.min: Invalid type: Expected number but received "abc"
geometry.field.u.regex: must be a valid regular expression: Invalid regular expression: /[a-/u: Unterminated character class
geometry.entity.c.fields: must list at least one field
geometry.error.e.recordAs: needs the event kind, which urn-forge does not support yet
manifest.namespace: must be lowercase snake_case, start with a letter and be at most 63 characters
```

## Pass 3: uniqueness

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `duplicate-brand` | `error` | `<urn>: brandIdentifier "<Brand>" is already used by <urn>; rename one of them` | Two atoms make the same PascalCase name, for example `geo_metry.field.radius` and `geo.field.metry_radius`. This is an error also if the atoms are of different kinds | Change one context or one identifier |
| `duplicate-property` | `error` | `<urn>: fields[<i>].ref <urn> and <urn> both become property "<name>"` | An entity or an error refers to two fields with the same identifier, for example `geometry.field.size` and `shape.field.size` | Remove one reference, or change the identifier of one field |
| `duplicate-ref` | `error` | `<urn>: fields[<i>].ref lists <urn> more than once`<br>`<urn>: errors[<i>] lists <urn> more than once` | An entity or an error refers to the same field two times, or an operation lists the same error two times | Remove the second reference |
| `reserved-property` | `error` | `<urn>: fields[<i>].ref <urn> becomes property "kind", which an error reserves for its URN; rename the field` | An error refers to a field with the identifier `kind`. Each error payload has a `kind` property that contains the URN of the error | Change the identifier of the field, for example to `item_kind` |

## Pass 4: references

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `unresolved-ref` | `error` | `<urn>: <where> "<short key>" does not resolve (no atom <urn> in this manifest)` | A `fields[<i>].ref`, `input`, `output` or `errors[<i>]` refers to an atom that the manifest does not declare | Declare the atom, or correct the short key |
| `wrong-ref-kind` | `error` | `<urn>: <where> "<short key>" must name <kind>, but <urn> is <kind>` | A reference refers to an atom of the wrong kind. A `fields[<i>].ref` must name a field. An `input` or `output` must name an entity. An `errors[<i>]` must name an error. Example: `input "geometry.field.radius" must name an entity, but urn:demo:math:geometry:field:radius is a field` | Refer to an atom of the correct kind. To use a field as an input or an output, put it in an entity |

## Pass 6: message templates

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `unknown-placeholder` | `error` | `<urn>: message placeholder {<name>} names no field of the error (required fields: <names>)`<br>`<urn>: message placeholder {<name>} names an optional field; placeholders must name required fields (required fields: <names>)` | A `{placeholder}` in the `message` of an error is not a field of the error, or it is a field with `required: false`. If the error has no mandatory fields, the list is `none` | Correct the name, or make the field mandatory |

## Pass 7: constraint coherence

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `conflicting-constraints` | `error` | `<urn>: <constraint> and <constraint> both set <a lower bound \| an upper bound \| the shape>; keep one` | A field sets two constraints for one side of one aspect: `min` and `exclusiveMin`, `max` and `exclusiveMax`, or `regex` and `format`. Pass 7 then does not examine the field | Remove one of the two constraints |
| `incoherent-constraints` | `error` | `<urn>: min (<n>) is greater than max (<n>), so no value is valid`<br>`<urn>: min and max are both <n> and notEqual is <n>, so no value is valid`<br>`<urn>: minLength (<n>) is greater than maxLength (<n>), so no value is valid`<br>`<urn>: oneOf value "<value>" is shorter than minLength (<n>), so it is never valid`<br>`<urn>: oneOf value "<value>" is longer than maxLength (<n>), so it is never valid`<br>`<urn>: oneOf value "<value>" does not match regex <pattern>, so it is never valid` | The constraints of a field accept no value, or a value in its `oneOf` list can never be valid. The position is the constraint to examine | Correct the constraints |

## Plugins

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `plugin-config` | `error` | `plugin <name> config: unknown option "<option>"`<br>`plugin <name> config: <option>: <Valibot message>` | The configuration of a plugin in the `plugins` list is not valid. Example: `plugin valibot config: unknown option "x"`. If the configuration is not an object, the message has no option. The file is the configuration file | Correct the configuration. The shipped plugins accept only `{}` |
| `unsupported-construct` | `error` | `<urn>: the <plugin> plugin does not handle kind "<kind>"`<br>`<urn>: the <plugin> plugin does not handle primitive "<primitive>"`<br>`<urn>: the <plugin> plugin cannot translate constraint "<constraint>"` | A plugin cannot make code for an atom, a primitive or a constraint in the manifest. urn-forge compares the manifest with the parts that each plugin declares, before the plugins start | Remove the plugin from the configuration, or do not use the part. The shipped plugins can use all the parts of urn-forge 0.1.0 |
| `export-collision` | `error` | `<urn>: generated export "<Name>" collides with an export of <urn>; rename one of them` | Two atoms make the same export name. Example: `geometry.field.radius_input` exports `GeometryRadiusInput`, which is also the input type of `geometry.field.radius` | Change the name of one atom |
| `output-conflict` | `error` | `plugin <name> writes <file>, which another plugin already wrote` | Two plugins make a file with the same name. The two shipped plugins make different files, so the CLI cannot cause this error | Remove one of the plugins |
| `missing-plugin` | `error` | `plugin <name> requires plugin <name>, which is not enabled` | A plugin uses the output of a plugin that is not in the `plugins` list. Example: `plugin fcis requires plugin valibot, which is not enabled`. The file is the configuration file | Add the necessary plugin to the list |

## Gate 1: completeness

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `tsconfig-unreadable` | `error` | `<TypeScript message>`, for example `Cannot read file 'tsconfig.json'.` | The `--tsconfig` file is not there, or it is not valid. The path is relative to the working directory | Make sure that `--tsconfig` gives a valid file |
| `core-not-found` | `error` | `core entry not found` | The `--core` file is not there | Make sure that `--core` gives the correct file |
| `type-error` | `error` | `TS<number>: <TypeScript message>` | TypeScript finds an error in the core or in a file that it imports. A handler that is not there, or a handler with the wrong type, causes this error | Correct the type error |
| `missing-satisfies` | `error` | `` no export uses `satisfies DomainCoreImplementation` from <runtime file>; declare the core as `export const core = { … } satisfies DomainCoreImplementation;` `` | No export of the core file uses `satisfies` with the generated `DomainCoreImplementation`. These forms count: `export const core = … satisfies …`, a `const` with `satisfies` that `export { core }`, `export { core as other }` or `export default core` exports later, and `export default … satisfies …` | Declare the core with `satisfies DomainCoreImplementation`. Import the type from the generated runtime file |

## Gate 3: Gherkin traceability

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `features-unreadable` | `error` | `cannot read features: <reason>` | The `--features` directory is not there, or urn-forge cannot read it. The path in the reason is relative to the working directory | Make sure that `--features` gives the correct directory |
| `feature-parse-error` | `error` | `<parser message>`, for example `expected: #EOF, #TableRow, …, got 'more text'` or `inconsistent cell count within the table` | A `.feature` file is not valid Gherkin. urn-forge gives one diagnostic for each parser error, at its line and column | Correct the Gherkin at the position |
| `unresolved-tag` | `error` | `tag @<urn> does not resolve to a URN in the manifest` | A `@urn:` tag is not the URN of a field, an entity, an operation or an error in the manifest | Correct the tag |
| `untagged-operation` | `error` | `operation <urn> has no feature or scenario tagged @<urn>` | No tag in any feature file has the URN of the operation | Add a feature or a scenario with the tag of the operation |
| `ambiguous-tag` | `error` | `scenario is tagged with more than one operation or entity: <urns>` | A scenario or an `Examples` block receives two or more different operation or entity tags | Keep one operation or entity tag for each scenario |
| `unknown-header` | `error` | `table header "<name>" is not a field key of <owner> (allowed: <names>)` | A table header is not a property of the input or output of the operation, of the entity, or of the error in the step. The owner is `the input or output of <operation URN>`, `<entity URN>` or `the error <error URN>` | Use a name from the list in the message |
| `missing-column` | `error` | `the table of "I run the operation with:" has no column for required input field(s) "<name>", … of <operation URN>; to test a missing value, keep the column and leave the cell empty` | The input table of the operation does not have a column for a mandatory input field | Add the column. To send no value, keep the column and leave the cell empty |
| `undeclared-error` | `error` | `"<error URN>" is not a declared error of <operation URN> (errors: <error URNs>)` | A step `the operation fails with "<error URN>"` gives an error that the operation of the scenario does not declare. If the operation declares no errors, the list is `none` | Give an error from the list, or add the error to the `errors` of the operation |
| `uncovered-error` | `warning` or `error` | `error <error URN> of <operation URN> has no scenario that expects it; add one with Then the operation fails with "<error URN>"` | No scenario of the operation expects this declared error. The step can use double or single quotes. An operation with no scenario gets only `untagged-operation`, not this code. The severity is `error` for a strict operation or with `boundaryCoverage: 'error'` | Add a scenario with `Then the operation fails with "<error URN>"` |
| `uncovered-boundary` | `warning` or `error` | `<field URN> in the input of <operation URN> has no <case>, no <case>, …` | The values that the scenarios of the operation send for this field do not include each boundary case of its constraints. The severity is the same as for `uncovered-error` | Add a scenario or an `Examples` row with each value that is not there, or waive the field. Refer to [Verification gates](./verification-gates) |
| `ratchet-ready` | `note` | `every feature is @urn-forge:strict; set boundaryCoverage: 'error' in the config so new features are strict too` | Each feature has the tag `@urn-forge:strict` and gate 3 passes, but `boundaryCoverage` is `warn`. While gate 3 fails, this note does not show | Set `boundaryCoverage: 'error'` in the [configuration file](./configuration) |
| `waived-boundary` | `note` | `boundary coverage of <field URN> is waived: <reason>` | A waiver in a feature file removed the boundary gaps of the field. The note shows the waiver in each run | No correction is necessary. To remove the waiver, add the scenarios that are not there |
| `invalid-waiver` | `error` | `a waiver must read "# urn-forge:waive <field URN> <reason>": <comment>` | A comment starts with `# urn-forge:waive`, but it has no field URN or no reason | Write the full URN of the field, and then a reason |
| `unknown-waiver` | `error` | `waiver for <field URN>, which is not a constrained input field of <operation URNs>`<br>`waiver for <field URN>, which is not a constrained input field of any operation of this feature` | No operation that the feature file tags has this field in its input with a constraint that has boundary cases. The URN can be incorrect, or the waiver can be old | Correct the URN, or remove the waiver |
| `unused-waiver` | `warning` | `waiver for <field URN> waives nothing: the field has no boundary gap; remove the waiver` | The scenarios already send each boundary value of the field | Remove the waiver |

## Gate 4: drift

| Code | Severity | Message | Cause | Correction |
| --- | --- | --- | --- | --- |
| `generated-missing` | `error` | `` missing; run `urn-forge compile` `` | A generated file is not in the `--out` directory | Run `urn-forge compile` and commit the result |
| `generated-differs` | `error` | `` differs from a fresh compile (hand-edited or stale); run `urn-forge compile` `` | A person edited the file, or the manifest or urn-forge changed without a new compile. The position is the first line that is different, column 1 | Run `urn-forge compile` and commit the result |
| `generated-orphan` | `error` | ``generated file has no source in the current compile; run `urn-forge compile`, which removes it``<br>`generated file has no source in the current compile, and urn-forge did not write it (no urn-forge header); rename or delete it` | A file in the `--out` directory has `.generated.` in its name, but the current compile does not make it. The message depends on the first line of the file | If urn-forge wrote the file, run `urn-forge compile`. If not, rename or delete the file |

## Related pages

- [Verification gates](./verification-gates)
- [JSON output](./json-output)
- [Compiler passes](./compiler-passes)
- [Fix a gate that fails](../how-to/fix-a-failing-gate)
- [What the gates show](../explanation/what-the-gates-show)
