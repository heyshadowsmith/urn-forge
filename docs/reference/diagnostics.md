# Diagnostics

A diagnostic is a problem that urn-forge finds in the config, the manifest or the project. Each has a code, a severity and a message. This page gives each code, its cause and its correction. The examples are real outputs of `npx urn-forge compile` and `npx urn-forge verify`.

`compile` and `verify` show a diagnostic of the config or the manifest as one line:

```
<file>:<line>  <severity>  <code>  <message>
```

An `error` stops the command. A `warning` does not.

`diff` shows the errors of each manifest as `<file>  error  <code>  <message>`, with no line.

## The command and the config

| Code | Cause | Correction |
| --- | --- | --- |
| `manifest-unreadable` | The manifest file does not exist | Correct `--manifest`, or `manifest` in the config |
| `config-unreadable` | `--config` names a file that does not exist | Correct the path |
| `config-invalid` | The config does not load, or an option is wrong | Correct the option that the message names. Refer to [The configuration file](./configuration) |
| `postgres-config` | An entry of `postgres` names a table, a property or a reference that is not correct | Correct the entry. Refer to [The Postgres schema](./postgres-schema) |

```
nothere.yaml  error  manifest-unreadable  the manifest does not exist
bad.config.ts  error  config-invalid  config.coverage must be 'warn' or 'error'
urn-forge.config.ts  error  postgres-config  postgres.tables.0: parcel has no identifier; a table needs one for its primary key
```

## The shape of the manifest

| Code | Cause | Correction |
| --- | --- | --- |
| `yaml-syntax` | The file is not valid YAML, or a map has a key two times | Correct the YAML at the line |
| `manifest-shape` | A key is not allowed, a required key is not there, or a value has the wrong shape | Use the keys of [The manifest](./manifest) |

```
domain.manifest.yaml:4  error  manifest-shape  manifest.version must be a semver version, such as 0.1.0
domain.manifest.yaml:9  error  manifest-shape  definitions.weight_grams.primitive is not a key here; the keys are description, type, properties, items, identifier, rules, deprecated
```

## Names between the parts

| Code | Cause | Correction |
| --- | --- | --- |
| `unknown-definition` | A `type`, a property, `items`, a parameter, an `input` or an output names a definition that is not there | Correct the name, or add the definition. A type is one of the six types of JSON Schema |
| `type-cycle` | A chain of `type` names comes back to its start | End the chain at one of the six types |
| `duplicate-property` | An object lists a property two times | Remove one |
| `unknown-property` | `required` names a property that the object does not have | Correct the name, or add it to `properties` |
| `invalid-identifier` | The identifier is not a property, is optional, or is an object or a list | Use a required property with one value |
| `not-an-object` | The input or an output is not an object | Name an object definition |
| `duplicate-output` | An operation lists an output two times | Remove one |

```
domain.manifest.yaml:9  error  unknown-definition  int is not a definition of this manifest
domain.manifest.yaml:9  error  type-cycle  a has a cycle of types: a → b → a
domain.manifest.yaml:18  error  unknown-property  weight is not a property of parcel
domain.manifest.yaml:23  error  invalid-identifier  the identifier weight_grams is optional; list it in the required rule of quote
domain.manifest.yaml:28  error  not-an-object  the input of quote_shipping must be an object; weight_grams is of type integer
domain.manifest.yaml:31  error  duplicate-output  quote_shipping lists the output quote two times
```

## Rules

| Code | Cause | Correction |
| --- | --- | --- |
| `unknown-rule` | A piece applies a rule that is not in the manifest or the standard set | Correct the name, or declare the rule |
| `standard-name` | A rule of the manifest has the name of a standard rule | Give the rule another name |
| `rule-argument` | The argument does not fit the parameters of the rule, or breaks a rule of the parameter's definition | Give an argument of the correct type and value |
| `invalid-message` | A message names `{x}`, but `x` is not a parameter of the rule | Use only the names of the parameters |
| `rule-syntax` | The rule does not parse, or uses a form of CEL that is not in the subset | Write the rule in the subset. Refer to [The rule language](./rule-language) |
| `rule-type` | A type in the rule is wrong, or the rule does not give a `bool` | Correct the types that the message names |
| `rule-guard` | The rule reads an optional property without `has()` before it | Add `has(…) &&` or `!has(…) \|\|` before it |
| `rule-scope` | The rule reads a name that does not exist where it is applied | Apply the rule where its names exist, or change the names |

```
domain.manifest.yaml:12  error  unknown-rule  positive is not a rule of this manifest or a standard rule
domain.manifest.yaml:34  error  standard-name  minimum is a standard rule; give this rule another name
domain.manifest.yaml:11  error  rule-argument  minimum: "one" is not a number; bound is a number that a value is compared with
domain.manifest.yaml:11  error  rule-argument  minLength: -1 breaks minimum of count: Must be at least 0
domain.manifest.yaml:37  error  invalid-message  {value} is not a parameter of even; the rule has no parameter
domain.manifest.yaml:36  error  rule-syntax  even: the character = is not in the subset, at column 10 of the rule
domain.manifest.yaml:36  error  rule-syntax  even: a chain of comparisons is not in the subset; join them with &&, at column 10 of the rule
domain.manifest.yaml:36  error  rule-syntax  first: the method startsWith() is not in the subset, at column 6 of the rule
domain.manifest.yaml:12  error  rule-type  half gives the type int; a rule must give a bool
domain.manifest.yaml:11  error  rule-type  minLength: size(self): size() takes a string or a list, not int
domain.manifest.yaml:19  error  rule-type  heavy: has(self.weight_grams) is always true: weight_grams is required
domain.manifest.yaml:12  error  rule-type  recent: '1d' is not a duration; write hours, minutes or seconds, such as '2h', '30m' or '1h30m'
domain.manifest.yaml:30  error  rule-guard  same_weight: output.weight_grams can be absent: read it after has(output.weight_grams) &&, or after !has(output.weight_grams) ||
domain.manifest.yaml:30  error  rule-scope  positive: self is not a name here; the names are input, output (applied to the output quote of quote_shipping)
domain.manifest.yaml:12  error  rule-scope  same_weight: output is not a name here; the names are self (applied to the definition weight_grams)
```

A `rule-syntax` error gives the column in the text of the rule. Its line is the line of `rule:`. The other rule errors are at the line where the rule is applied.

## Deprecation

| Code | Severity | Cause | Correction |
| --- | --- | --- | --- |
| `deprecated-use` | warning | A piece that is not deprecated uses a deprecated definition or rule | Move the use to the replacement that the `description` names |

```
domain.manifest.yaml:124  warning  deprecated-use  booking uses the deprecated definition note
```

## The gates

`verify` shows a problem of a gate as an indented line below the gate. For the cause and the correction of each code, refer to [Fix a failing gate](../how-to/fix-a-failing-gate).

| Code | Gate | Severity |
| --- | --- | --- |
| `type-error` | 1 | error |
| `core-not-satisfying` | 1 | error |
| `core-not-found` | 1 | error |
| `tsconfig-unreadable` | 1 | error |
| `direct-call` | 2 | error |
| `suppressed-check` | 2 | error |
| `unknown-name` | 3 | error |
| `feature-syntax` | 3 | error |
| `uncovered-operation` | 3 | warning, or error with `coverage: 'error'` |
| `uncovered-output` | 3 | warning, or error with `coverage: 'error'` |
| `uncovered-rule` | 3 | warning, or error with `coverage: 'error'` |
| `drift` | 4 | error |

```
    src/core.ts  error  core-not-satisfying  the core exports no value that satisfies DomainCore of the generated file: export const core = { … } satisfies DomainCore
    src/core.ts:7  error  suppressed-check  @ts-ignore can hide a broken contract; fix the type error
    features/split.feature:41  error  unknown-name  share is not a definition of the manifest
    features  warning  uncovered-output  no scenario of quote_shipping answers too_heavy_for_express; add one that ends with Then the output is "too_heavy_for_express"
```

## Related pages

- [Fix a failing gate](../how-to/fix-a-failing-gate)
- [The CLI](./cli)
- [The rule language](./rule-language)
