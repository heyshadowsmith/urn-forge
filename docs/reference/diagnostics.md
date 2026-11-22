# Diagnostics

Each diagnostic has a stable code. The tables on this page give each code, in groups: the configuration, the manifest, each compiler pass, the plugins, `urn-forge diff` and each gate of `verify`.

## The parts of a diagnostic

```
domain.manifest.yaml:10:12  error  unresolved-ref  urn:demo:math:geometry:entity:circle: fields[1].ref "geometry.field.diameter" does not resolve (no atom urn:demo:math:geometry:field:diameter in this manifest)
```

| Part | Example | Description |
| --- | --- | --- |
| File | `domain.manifest.yaml` | Relative to the current directory. For some gate 3 problems, the `--features` directory |
| Line and column | `10:12` | From 1. Not there if the diagnostic has no position |
| Severity | `error` | Refer to [Severities](#severities) |
| Code | `unresolved-ref` | The stable name of the problem |
| Message | `urn:demo:math:…` | Starts with the manifest key or the URN. Can have more than one line |

In a manifest, the position is the bad value, the bad key, or the entry key if a property is not there.

For the JSON form, refer to [The CLI](./cli).

## Severities

| Severity | Effect | Counted in `verify passed with <n> warning(s)` |
| --- | --- | --- |
| `error` | `compile` writes no files. A gate fails. If the error is in the manifest, no gate runs | No |
| `warning` | None | Yes |
| `note` | None | No |

These codes change their severity:

- `uncovered-error`, `uncovered-event`, `uncovered-record`, `uncovered-invariant`, `uncovered-state` and `uncovered-boundary`: the coverage mode. Refer to [Verification gates](./verification-gates).
- `unenforced-in-sql`: the `unenforced` option of the `postgres` plugin.
- `breaking-change`: `warning` if the old manifest has `stability: experimental`.

## The configuration

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `config-unreadable` | `error` | urn-forge cannot load the configuration file | Make sure that `--config` names the correct file, and correct the error in it |
| `config-invalid` | `error` | No default export, an unknown option, a value of the wrong type, or an incorrect `plugins` list | Correct the option. Refer to [The configuration file](./configuration) |

## The manifest file

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `manifest-unreadable` | `error` | urn-forge cannot read the manifest file | Make sure that `--manifest` names the correct file |
| `yaml-syntax` | `error` | The file is not valid YAML | Correct the YAML |
| `duplicate-key` | `error` | A key occurs two times in one mapping | Remove one of the keys |

## Pass 1: meta-schema

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `not-a-mapping` | `error` | The top level of the file is not a mapping | Start the file with `manifest:` and the atom keys |
| `missing-header` | `error` | The file has no `manifest:` key | Add the header. Refer to [The manifest](./manifest) |
| `invalid-key` | `error` | A top-level key is not a valid short key | Use the form `<context>.<kind>.<identifier>` in snake_case |
| `unknown-kind` | `error` | The kind segment of a key is not a kind | Use `field`, `entity`, `invariant`, `operation`, `event` or `error` |
| `unknown-primitive` | `error` | A field has no `primitive`, or an unknown one | Use a primitive from the message. For a list, use `many`. For another entity, use `ref` or `link` |
| `constraint-not-allowed` | `error` | A constraint of a different primitive, for example `minLength` on a `float` | Use a constraint from the message. On an `integer` or a `date`, use `min` in place of `exclusiveMin` |
| `unknown-property` | `error` | An atom or the header has a key that it does not accept | Remove or correct the key. For `oneOf`, use `primitive: enum`. For `notEqual`, use `notIn` |
| `missing-property` | `error` | An entry does not have a necessary property, for example `description` or `values` | Add the property |
| `invalid-value` | `error` | A value has the wrong type or form | Correct the value as the message says |
| `invalid-lifecycle` | `error` | An active atom sets `supersededBy` or `sunsetDate`, or `supersededBy` names the atom itself | Set `status: deprecated` or `status: sunset`, or remove the key |

## Pass 3: uniqueness

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `duplicate-brand` | `error` | Two atoms make the same brand identifier, for example `geo_metry.field.radius` and `geo.field.metry_radius` | Change one context or identifier |
| `duplicate-property` | `error` | Two references of one entity, event or error make the same property name | Rename one with `as` |
| `duplicate-ref` | `error` | A list names the same target two times with the same name | Rename one with `as`, or remove one |
| `invalid-entity-key` | `error` | The `key` of an entity is not one of its own required, single-valued fields | Name such a field |
| `reserved-property` | `error` | A property of an error or an event has the name `kind` | Rename it with `as` |

## Pass 4: references

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `unresolved-ref` | `error` | A reference, or an item of `tables` of the `postgres` plugin, names no atom | Declare the atom, or correct the short key |
| `wrong-ref-kind` | `error` | A reference names an atom of the wrong kind, for example a field as an `input` | Name an atom of the correct kind |

## Pass 5: structure

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `invalid-unique` | `error` | `unique: [ … ]` is on a list of values, or names a property that the item does not have, or one that holds a list or an entity, or one name two times | Name properties of the item that hold one value, each one time; on a list of values, write `unique: true` |
| `invalid-callers` | `error` | In a domain whose header names a `caller`, an operation has no `callers`; or an operation has `callers` and the header names no `caller`; or a rule of `allow` names a value that it cannot read; or `otherwise` is not in `errors`, or has a required field that neither the caller, the input nor the record has | Add `callers` to each operation, with `allow: any` for every caller; name the caller in the header; use `caller.`, `input.` and `current.` only |
| `invalid-reads` | `error` | An operation has both `reads` and `changes`, or `reads.missing` is not in `errors`, or has a required field that the input does not have | Leave out `reads` when the operation changes the record; add the error to `errors`; give the input the field |
| `invalid-delivery` | `error` | The `delivery` of an event names a property that the event does not have, or one that is optional, a list or an embedded entity; or `id` is not a `string`, or `sequence` is not an `integer`; or it names one property two times | Name required properties of the event that hold one value: a `string` for `id`, an `integer` for `sequence` |
| `missing-key` | `error` | A `link`, a `unique` list of an embedded entity, or a Postgres table names an entity with no `key` | Set `key` on the entity |
| `embedding-cycle` | `error` | Entities embed each other in a cycle | Change one embedding to a `link` |

## Pass 6: rules and messages

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `unknown-placeholder` | `error` | A `{placeholder}` in an error message is not a required, single-valued field of the error | Correct the name, or make the field required |
| `invalid-record-as` | `error` | The `recordAs` event cannot be made from the fields of the error | Give the event each property of the error, and make its other properties optional |
| `rule-syntax` | `error` | A `rule` is not valid in the rule language | Correct the rule at the column. Refer to [The rule language](./rule-language) |
| `unknown-rule-field` | `error` | A rule names a property that the entity does not have | Use a property name from the message |
| `rule-type` | `error` | A rule mixes primitives, or uses an operator or literal that does not fit | Correct the rule as the message says |
| `unguarded-field` | `error` | A rule uses an optional field with no guard on its left | Add `<name> is present and …` or `<name> is absent or …` |
| `invalid-report-on` | `error` | `reportOn` is not a property name that the rule uses | Name a property of the rule |

## States and moves

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `invalid-moves` | `error` | A state in `moves` is not one of the `values` of the field, or a move is listed two times | Use only values of the field, each one time |
| `invalid-condition` | `error` | A `requires` or `ensures` rule names a value with no prefix, `current.` on an operation with no `changes`, or `output.` in `requires`; or the `otherwise` of a `requires` rule is not in `errors`, or the input and the record do not have a required property of it | Correct the part that the message names |
| `invalid-changes` | `error` | `changes` does not fit: its entity has no state field or two, the state is optional or a list, a state of `from` or `to` is not a value, a `from` state cannot move to `to`, `otherwise` is not in `errors`, or the record and the input do not have a required property of `otherwise` | Correct the part that the message names |

## Pass 7: constraint coherence

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `conflicting-constraints` | `error` | Two constraints set one side of one aspect, for example `min` and `exclusiveMin`, or `regex` and `format` | Remove one |
| `incoherent-constraints` | `error` | The constraints accept no value, or `many` accepts no list | Correct the constraints |

## Pass 8: lifecycle

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `deprecated-ref` | `warning` | An active atom refers to a deprecated atom | Refer to the replacement before the sunset date |
| `sunset-ref` | `error` | An atom refers to a sunset atom, or to an atom whose `sunsetDate` is on or before the reference date | Refer to the replacement |

## Plugins

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `plugin-config` | `error` | The configuration of a plugin is not valid | Correct it. `valibot` and `fcis` accept only `{}`. Refer to [The Postgres schema](./postgres-schema) |
| `unsupported-construct` | `error` | A plugin cannot make code for a kind, primitive or constraint | Remove the plugin, or do not use the construct |
| `export-collision` | `error` | Two atoms make the same export name | Rename one atom. Refer to [Generated code](./generated-code) |
| `output-conflict` | `error` | Two plugins write the same file | Remove one plugin |
| `missing-plugin` | `error` | A plugin needs a plugin that is not in the list, for example `fcis` needs `valibot` | Add the plugin |
| `unenforced-in-sql` | `warning`, or `error` with `unenforced: 'error'` | The `postgres` plugin cannot write a rule in SQL with the same effect | Accept it, because the schema still enforces the rule, or change the rule. Refer to [The Postgres schema](./postgres-schema) |
| `invalid-sql-name` | `error` | A Postgres name is longer than 63 bytes, or two parts get the same name | Use a shorter identifier, or rename with `as` |

## `urn-forge diff`

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `breaking-change` | `error`, or `warning` if the old manifest is experimental | A change can break a consumer that worked before it | Declare a new URN and deprecate the old one. Refer to [Change the contract](../how-to/change-the-contract) |

## Gate 1: completeness

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `tsconfig-unreadable` | `error` | The `--tsconfig` file is not there or not valid | Name a valid file |
| `core-not-found` | `error` | The `--core` file is not there | Name the correct file |
| `type-error` | `error` | TypeScript finds an error in the core, for example a missing handler | Correct the type error |
| `missing-satisfies` | `error` | No export of the core uses `satisfies DomainCoreImplementation` | Write `export const core = { … } satisfies DomainCoreImplementation;` |

## Gate 2: boundary

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `brand-assertion` | `error` | A type assertion to a type that carries a brand | Parse the value with a generated schema |
| `brand-from-any` | `error` | A value of type `any` where a branded type belongs | Parse the value with a generated schema |
| `suppressed-check` | `error` | A `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` comment | Remove the comment and correct the type |
| `shell-not-found` | `warning` | An item of the `shell` setting matches no TypeScript file | Correct or remove the item |
| `core-parser-import` | `error` | The core imports the generated schemas or `valibot` as a value | Use `import type` |

## Gate 3: Gherkin

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `features-unreadable` | `error` | urn-forge cannot read the `--features` directory | Name the correct directory |
| `feature-parse-error` | `error` | A `.feature` file is not valid Gherkin | Correct the Gherkin at the position |
| `unresolved-tag` | `error` | A `@urn:` tag is not a URN of the manifest | Correct the tag |
| `untagged-operation` | `error` | No tag has the URN of an operation | Tag a feature or a scenario with it |
| `ambiguous-tag` | `error` | A scenario has two or more operation or entity tags | Keep one |
| `unknown-header` | `error` | A table header is not a property of the input, output, error or event | Use a name from the message |
| `invalid-cell` | `error` | A list or object cell is malformed, or names an unknown property | Correct the cell at the column |
| `missing-column` | `error` | The input table has no column for a required input field | Add the column. Leave the cell empty to send no value |
| `undeclared-error` | `error` | A step expects an error that the operation does not declare | Use a declared error, or add it to `errors` |
| `uncovered-error` | `warning` or `error` | No scenario expects a declared error | Add `Then the operation fails with "<error URN>"` |
| `undeclared-event` | `error` | A step expects an event that is not in `emits` | Use an event of `emits`, or add it |
| `uncovered-event` | `warning` or `error` | No scenario expects an event of `emits`, or no successful scenario is without an event that has `when` | Add `Then the operation emits "<event URN>"`, or `Then the operation emits no "<event URN>"` |
| `undeclared-record` | `error` | A step expects a record that no declared error has as `recordAs` | Use a `recordAs` event of the operation |
| `uncovered-record` | `warning` or `error` | No scenario expects the `recordAs` event of a declared error | Add `Then the refusal is recorded as "<event URN>"` |
| `undeclared-invariant` | `error` | A step names an invariant that is not on the input entity | Use an invariant from the message |
| `uncovered-invariant` | `warning` or `error` | No scenario breaks an invariant of the input | Add `Then the input is rejected by "<invariant URN>"` |
| `uncovered-state` | `warning`, or `error` when strict | A state in the `from` of an operation has no scenario that starts from it, or no scenario gives a state outside `from` and expects `otherwise` | Add a scenario with `Given the current <entity> is:` for the state |
| `invalid-current` | `error` | `Given the current <entity> is:` is on an operation with no `changes`, or names another entity; or an operation with `changes` runs with no current record | Give the record of the entity that the operation changes, before `When I run the operation with:` |
| `uncovered-boundary` | `warning` or `error` | The scenarios do not send each boundary value of an input field | Add the values in the message, or waive the field |
| `ratchet-ready` | `note` | Each feature is strict, and `boundaryCoverage` is `warn` | Set `boundaryCoverage: 'error'` |
| `waived-boundary` | `note` | A waiver removed the boundary gaps of a field | None |
| `invalid-waiver` | `error` | A `# urn-forge:waive` comment has no field URN or no reason | Write `# urn-forge:waive <field URN> <reason>` |
| `unknown-waiver` | `error` | A waiver names no constrained input field of the tagged operations | Correct the URN, or remove the waiver |
| `unused-waiver` | `warning` | A waiver names a field with no boundary gap | Remove the waiver |

## Gate 4: drift

| Code | Severity | Meaning | Correction |
| --- | --- | --- | --- |
| `generated-missing` | `error` | A generated file is not in `--out` | Run `urn-forge compile` |
| `generated-differs` | `error` | A generated file differs from a new compile, at the position | Run `urn-forge compile` |
| `generated-orphan` | `error` | A `*.generated.*` file in `--out` that the compile does not make | Run `urn-forge compile`. If urn-forge did not write the file, rename or delete it |

## Related pages

- [Verification gates](./verification-gates)
- [The CLI](./cli)
- [Fix a gate that fails](../how-to/fix-a-failing-gate)
