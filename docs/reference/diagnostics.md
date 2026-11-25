# Diagnostics

Each problem that urn-forge finds has a code, a severity and a message that says what to do. `compile` and `verify` show a problem of the config or the manifest as one line, with the line of the manifest where it is:

```
domain.manifest.yaml:13  error  unknown-rule  positive is not a rule of this manifest or a standard rule
```

An `error` stops the command; a `warning` does not. The examples on this page are real outputs on the tutorial's manifest, with one thing broken in each.

## The config

| Code | Cause | Fix |
| --- | --- | --- |
| `manifest-unreadable` | The manifest file does not exist | Correct `--manifest` or `manifest` in the config |
| `config-unreadable` | `--config` names a file that does not exist | Correct the path |
| `config-invalid` | The config does not load, or an option is unknown or of the wrong type | Correct the option the message names |
| `postgres-config` | A table has no identifier, or an entry of `postgres` names something that is not there | Correct the entry |
| `postgres-column` | Two parts give one column name, a name is longer than 63 bytes, or a list holds lists | Rename a property, or wrap the inner list in an object |

```
bad.config.ts  error  config-invalid  config.coverage must be 'warn' or 'error'
urn-forge.config.ts  error  postgres-config  postgres.tables.0: parcel has no identifier; a table needs one for its primary key
```

## The manifest

| Code | Cause | Fix |
| --- | --- | --- |
| `yaml-syntax` | Not valid YAML, or a key twice in one map | Correct the YAML at the line |
| `manifest-shape` | A key that is not allowed, a missing key, or a value of the wrong shape | Use the keys of [the manifest](./manifest) |
| `unknown-definition` | A `type`, property, `items`, parameter, input or output names no definition | Correct the name, or add the definition |
| `type-cycle` | A chain of `type` names comes back to its start | End the chain at one of the six types |
| `duplicate-property` | An object lists a property twice | Remove one |
| `unknown-property` | `required` names a property the object does not have | Correct the name, or add the property |
| `invalid-identifier` | The identifier is not a required property with one value | Use a required property that is not an object or a list |
| `not-an-object` | The input or an output is not an object | Name an object definition |
| `duplicate-output` | An operation lists an output twice | Remove one |
| `deprecated-use` (warning) | A live piece uses a deprecated one | Move to the replacement its `description` names |

```
domain.manifest.yaml:11  error  manifest-shape  definitions.weight_grams.primitive is not a key here; the keys are description, type, properties, items, identifier, rules, deprecated
domain.manifest.yaml:11  error  unknown-definition  int is not a definition of this manifest
domain.manifest.yaml:37  error  unknown-property  weight is not a property of parcel
domain.manifest.yaml:72  error  not-an-object  the input of quote_shipping must be an object; weight_grams is of type integer
```

## Rules

| Code | Cause | Fix |
| --- | --- | --- |
| `unknown-rule` | A piece applies a rule that does not exist | Correct the name, or declare the rule |
| `standard-name` | A rule of the manifest has the name of a standard rule | Rename it |
| `rule-argument` | An argument does not fit the rule's parameters, or breaks a rule of a parameter's definition | Give a valid argument |
| `invalid-message` | A message names `{x}`, but `x` is not a parameter | Use only the parameters' names |
| `rule-syntax` | The rule does not parse, or uses CEL outside the subset | Write it in [the subset](./rule-language#the-language) |
| `rule-type` | A type in the rule is wrong, or the rule does not give a `bool` | Correct the types the message names |
| `rule-guard` | The rule reads an optional property without `has()` | Add `has(…) &&` or `!has(…) \|\|` before it |
| `rule-scope` | The rule reads a name that does not exist where it is applied | Apply it where its names exist |

```
domain.manifest.yaml:20  error  rule-argument  minLength: -1 breaks minimum of count: Must be at least 0
domain.manifest.yaml:66  error  rule-syntax  names_the_weight: the character = is not in the subset, at column 21 of the rule
domain.manifest.yaml:13  error  rule-type  minLength: size(self): size() takes a string or a list, not int
domain.manifest.yaml:75  error  rule-guard  over_express_limit: input.express can be absent: read it after has(input.express) &&, or after !has(input.express) ||
domain.manifest.yaml:30  error  rule-scope  names_the_weight: output is not a name here; the names are self (applied to the definition price_cents)
```

A `rule-syntax` error is at the line of `rule:`, with the column in the rule's text. The other rule errors are at the line where the rule is applied.

## The gates

`verify` shows a problem of a gate as an indented line under it.

| Code | Gate | Cause | Fix |
| --- | --- | --- | --- |
| `type-error` | 1 | `tsc` fails over the core: a missing function (`TS1360`), an extra one (`TS2353`), or a return that is not an answer of the operation (`TS2322`) | Fix the function the message names; return `answer('<output>', value)` |
| `core-not-satisfying` | 1 | No export of the core file `satisfies DomainCore` | Write `export const core = { … } satisfies DomainCore` |
| `core-not-found` | 1 | The `core` path names no file | Correct the path; it is relative to the config |
| `tsconfig-unreadable` | 1 | The `tsconfig` path names no valid file | Correct the path or the file |
| `direct-call` | 2 | A shell file calls a function of the core directly | Call `runOperation(core, '<operation>', input)` |
| `suppressed-check` | 2 | `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` in a core or shell file | Remove it, and fix the type error |
| `unknown-name` | 3 | A step names something the manifest does not have | Correct the name in the step |
| `feature-syntax` | 3 | A feature is not valid Gherkin | Correct it at the line |
| `uncovered-operation` | 3 | No scenario runs the operation | Add `When I run "<operation>" with:` |
| `uncovered-output` | 3 | No scenario ends with the output | Add `Then the output is "<output>"` |
| `uncovered-rule` | 3 | No scenario breaks a rule of a definition | Add `Then the input is rejected by …` or `Then the value is rejected by …` |
| `drift` | 4 | A generated file is not current, is missing, or is no longer made | Run `npx urn-forge compile` and commit |

The three `uncovered-` codes are warnings, or errors with `coverage: 'error'`. The others are errors.

```
    src/core.ts:3  error  type-error  TS1360: Type '{}' does not satisfy the expected type 'DomainCore'.
  Property 'quote_shipping' is missing in type '{}' but required in type 'DomainCore'.
    src/core.ts  error  core-not-satisfying  the core exports no value that satisfies DomainCore of the generated file: export const core = { … } satisfies DomainCore
    src/shell/http.ts:20  error  direct-call  core.quote_shipping runs the core without the harness; call runOperation(core, …), which checks the input and the answer
    features  error  uncovered-rule  no scenario breaks required of too_heavy_for_express; add one that ends with Then the input is rejected by "required" of "too_heavy_for_express", or Then the value is rejected by …
    src/generated/domain.generated.ts:246  error  drift  the generated file is not current; run urn-forge compile
```

If an error points into a generated file, the file is probably stale or missing: fix gate 4 first.
