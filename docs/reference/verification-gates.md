# Verification gates

The command `urn-forge verify` examines the chain from the manifest to the core, the features and the generated files. It reads files and does a type check. It does not run the core or the scenarios. The command `urn-forge diff` is gate 5: it compares two manifests. This page gives what `verify` does, each gate, each check of a gate, and the output. For the options of the command, refer to [The CLI](./cli). For the reasons for the gates, refer to [What the gates show](../explanation/what-the-gates-show).

## What `verify` does

`verify` does these steps in this sequence:

1. It reads the [configuration file](./configuration), if there is one. If the file is not valid, `verify` shows the diagnostics and stops. No gate runs.
2. It reads the manifest and compiles it in memory, with the same plugins and the same reference date as `compile`. It does not write files. If the manifest has an error, `verify` shows the diagnostics and stops. No gate runs.
   If the manifest has a `sunsetDate` and there is no reference date, `verify` writes `note: sunset dates are not checked: set --reference-date or referenceDate in the config`.
3. It reads each `.feature` file in the `--features` directory and its subdirectories, in path sequence. It reads each file one time, and all gates use the result.
4. It runs gate 1, gate 3 and gate 4, in this sequence. Each gate runs also if a gate before it failed.
5. It shows the result of each gate and the last line.

A gate fails if one or more of its problems has the severity `error`. A warning or a note does not make a gate fail. `verify` passes if all gates pass.

The gates examine the live IR: the IR with no sunset atoms. A sunset operation thus needs no handler and no scenario, and a sunset field has no boundary cases. A deprecated atom gets all the checks.

| Gate | Name | What it shows | Status |
| --- | --- | --- | --- |
| 1 | `completeness` | The core has a handler of the correct type for each operation | Built |
| 2 | Lint profile | — | urn-forge does not have this gate at this time. Refer to [Scope](./scope) |
| 3 | `gherkin` | The features use real URNs and real field names, and they cover the declared errors, the events, the input invariants and the boundary values | Built |
| 4 | `drift` | The generated files in the repository are the same as a new compile | Built |
| 5 | Compatibility | No change breaks a consumer of a live URN | Built, as the separate command `urn-forge diff`. Refer to [Gate 5: compatibility](#gate-5-compatibility) |

## Output

In the text format, `verify` writes one line for each gate to stdout:

```
gate <number>  <name>  PASS|FAIL  <summary>
```

The name has 12 characters, with spaces at the end. Below the line of a gate, `verify` writes each problem of the gate in the [diagnostic format](./diagnostics), with an indent of four spaces. Each line of a message with more than one line gets the indent.

The last line has one of these forms:

| Last line | Stream | Condition |
| --- | --- | --- |
| `verify passed (gates 1, 3, 4; gate 2 is not built; gate 5 is urn-forge diff)` | stdout | All gates passed, with no warnings |
| `verify passed with <n> warning(s) (gates 1, 3, 4; gate 2 is not built; gate 5 is urn-forge diff)` | stdout | All gates passed, with `<n>` warnings |
| `verify failed: gate <numbers>` | stderr | One or more gates failed, for example `verify failed: gate 1, 4` |
| `verify failed: the manifest cannot be read` | stderr | urn-forge cannot read the manifest |
| `verify failed: the manifest does not compile` | stderr | The manifest has an error |
| `verify failed: the config is not valid` | stderr | The configuration file is not valid |

The number of warnings counts the diagnostics with the severity `warning`. Notes are not counted. For the output with `--format json`, refer to [JSON output](./json-output).

The snapshot of tutorial 2 passes with two warnings:

```bash
npx urn-forge verify --config tutorial/2-declared-errors/urn-forge.config.ts
```

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/2-declared-errors/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
    tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/2-declared-errors/generated
verify passed with 2 warning(s) (gates 1, 3, 4; gate 2 is not built; gate 5 is urn-forge diff)
```

## Exit codes

| Exit code | Condition |
| --- | --- |
| `0` | All gates passed. Warnings and notes do not change the exit code |
| `1` | One or more gates failed, the manifest has an error or cannot be read, or the configuration file is not valid |
| `2` | A usage error, for example an unknown option |

## Gate 1: completeness

**The core has a handler of the correct type for each operation.**

| Input | Option |
| --- | --- |
| The core entry | `--core` (default `src/core.ts`) |
| The compiler options | `--tsconfig` (default `tsconfig.json`) |
| The generated runtime file | `<--out>/domain.runtime.generated.ts` |

The gate does these checks in this sequence:

| Check | Rule | Code |
| --- | --- | --- |
| 1. Read the tsconfig | The `--tsconfig` file can be read and parsed. If not, the gate stops | `tsconfig-unreadable` |
| 2. Find the core | The `--core` file exists. If not, the gate stops | `core-not-found` |
| 3. Type check | TypeScript finds no error in the core entry and in the files that it imports. The gate uses the compiler options of the tsconfig, with `noEmit`. The root of the program is the core entry only. Only diagnostics in the TypeScript category `Error` count | `type-error` |
| 4. The `satisfies` clause | One or more exports of the core file use `satisfies DomainCoreImplementation`, and this name refers to the interface in the generated runtime file | `missing-satisfies` |

Check 4 accepts these forms. Parentheses around the expression are permitted:

- `export const <name> = <expression> satisfies DomainCoreImplementation;`
- `export default <expression> satisfies DomainCoreImplementation;`
- `const <name> = <expression> satisfies DomainCoreImplementation;` and then, in the same file, `export { <name> };`, `export { <name> as <other> };` or `export default <name>;`.
- A qualified name, for example `rt.DomainCoreImplementation`, or an imported alias of the interface.

Check 4 does not accept a `let`, because a `let` can get a different value later. It does not accept an interface with the same name that is not in the generated runtime file.

The summary has one of these forms:

| Summary | Condition |
| --- | --- |
| ``tsc: <n> error(s) over <core>; `<names>` satisfies DomainCoreImplementation`` | The gate ran checks 3 and 4. Check 4 found the exports in `<names>`, for example `core` or `default` |
| `` tsc: <n> error(s) over <core>; no `satisfies DomainCoreImplementation` `` | The gate ran checks 3 and 4. Check 4 found no export |
| `tsconfig unreadable` | Check 1 failed |
| `core entry missing` | Check 2 failed |

## Gate 3: Gherkin traceability

**The features use real URNs and real field names, and they cover the declared errors, the events, the input invariants and the boundary values.** The gate reads the syntax tree of each feature file. It does not run the scenarios. Cucumber runs them. Refer to [Gherkin steps](./gherkin-steps).

### The tags of a scenario

The gate gives each scenario the tags of its feature, of its `Rule` block and of the scenario. For the header and the values of an `Examples` block, the gate also adds the tags of that `Examples` block. The steps of a `Background` block are part of each scenario after it.

The **owner** of a scenario is the one operation or entity that its tags name. A tag that is not an operation or entity URN, for example `@wip`, has no effect on the owner.

### Checks

The gate does these checks. The table gives them in the sequence of the output.

| Check | Rule | Code | Severity |
| --- | --- | --- | --- |
| Read the directory | The `--features` directory can be read | `features-unreadable` | `error` |
| Parse the files | Each `.feature` file is valid Gherkin | `feature-parse-error` | `error` |
| Tags resolve | Each tag that starts with `@urn:` is the URN of a field, an entity, an invariant, an operation or an error of the manifest. The URN of an event is not a tag that resolves. The gate examines each tag one time, where it is written | `unresolved-tag` | `error` |
| One owner | A scenario or an `Examples` block has one owner or no owner, not two or more | `ambiguous-tag` | `error` |
| Headers | Each header of a step table and of an `Examples` table is a property of the owner. For an operation, this is a property of its input or output entity. For an entity, this is a property of the entity. A scenario with no owner, or with two or more owners, is not examined. The names in an object cell are not headers. The next check examines them | `unknown-header` | `error` |
| Error headers | Each header of the table of `the operation fails with "<error URN>":` is a field of that error. The gate examines this only if the operation declares the error | `unknown-header` | `error` |
| Event headers | Each header of the table of `the operation emits "<event URN>":` is a field of that event. The gate examines this only if the operation emits the event | `unknown-header` | `error` |
| Required columns | The table of `I run the operation with:` has a column for each mandatory input field of the operation. Fields with `required: false` are not mandatory | `missing-column` | `error` |
| Input invariants | The invariant URN in `the input is rejected by "<invariant URN>"` is an invariant of the input entity of the operation of the scenario, or of an entity that the input embeds, at any depth. The URN can be in double or single quotes. The gate examines this only if the owner is an operation | `undeclared-invariant` | `error` |
| Declared errors | The error URN in `the operation fails with "<error URN>"` is a declared error of the operation of the scenario. The URN can be in double or single quotes. The gate examines this only if the owner is an operation | `undeclared-error` | `error` |
| Events | The event URN in `the operation emits "<event URN>"` is in the `emits` of the operation of the scenario. The URN can be in double or single quotes. The gate examines this only if the owner is an operation | `undeclared-event` | `error` |
| Tagged operations | Each operation of the manifest has its URN in one or more tags, in any feature file | `untagged-operation` | `error` |
| Error coverage | Each declared error of each tagged operation has one or more scenarios of that operation with `the operation fails with "<error URN>"`. An untagged operation already has `untagged-operation`, so the gate does not examine its errors | `uncovered-error` | Coverage mode |
| Event coverage | Each event in the `emits` of each tagged operation has one or more scenarios of that operation with `the operation emits "<event URN>"`, with or without a table. `the operation emits no event` does not count | `uncovered-event` | Coverage mode |
| Invariant coverage | Each invariant of the input entity of each tagged operation has one or more scenarios of that operation with `the input is rejected by "<invariant URN>"`. The invariants of the entities that the input embeds, at any depth, are input invariants too. An invariant of an output entity only needs no scenario | `uncovered-invariant` | Coverage mode |
| Waiver form | Each comment that starts with `# urn-forge:waive` has a field URN and a reason | `invalid-waiver` | `error` |
| Cells | Each list or object cell in the table of `I run the operation with:` has the correct syntax. Each name in an object cell is a property of its entity | `invalid-cell` | `error` |
| Boundary coverage | For each tagged operation and each input property with boundary cases, at any depth, the values that the scenarios send include each boundary case | `uncovered-boundary` | Coverage mode |
| Waiver result | Each valid waiver names a constrained input field of an operation of its feature file. Then it removes a gap, or it removes nothing | `unknown-waiver`, `waived-boundary`, `unused-waiver` | `error`, `note`, `warning` |
| Ratchet | If `boundaryCoverage` is `warn`, the directory has one or more features, each feature is strict, and the gate has no error, the gate gives a note | `ratchet-ready` | `note` |

The gate finds the step texts as written in the feature file, without the keyword. The text `the operation fails with "<error URN>"` can use double or single quotes, as Cucumber accepts both. It can have a colon at the end or not. The text `the input is rejected by "<invariant URN>"` can also use double or single quotes. The same applies to `the operation emits "<event URN>"`, with a colon at the end or not. An invariant tag, for example `@urn:acme:insurance:policy:invariant:term_is_positive`, resolves, but it does not change the owner of a scenario. The gate does not run the rules. Cucumber runs them through the generated schemas.

### File and position of each problem

| Code | File | Position |
| --- | --- | --- |
| `features-unreadable` | The `--features` directory | None |
| `feature-parse-error` | The feature file | None |
| `unresolved-tag` | The feature file | The tag |
| `ambiguous-tag` | The feature file | The scenario or the `Examples` block |
| `unknown-header` | The feature file | The header cell |
| `invalid-cell` | The feature file | The header cell of the column in the table of `I run the operation with:` |
| `missing-column` | The feature file | The table |
| `undeclared-error`, `undeclared-event`, `undeclared-invariant` | The feature file | The step |
| `untagged-operation`, `uncovered-error`, `uncovered-event`, `uncovered-invariant`, `uncovered-boundary`, `ratchet-ready` | The `--features` directory | None |
| `invalid-waiver`, `unknown-waiver`, `waived-boundary`, `unused-waiver` | The feature file | The comment |

### The coverage mode

The severity of `uncovered-error`, `uncovered-event`, `uncovered-invariant` and `uncovered-boundary` depends on the coverage mode of the operation:

| Condition | Severity |
| --- | --- |
| `boundaryCoverage: 'error'` in the configuration file | `error`, for all operations |
| A feature file with `@urn-forge:strict` in the tags of its `Feature` line also has the URN of the operation in a tag | `error`, for that operation |
| All other conditions (`boundaryCoverage: 'warn'` is the default) | `warning` |

A feature is strict only if `@urn-forge:strict` is a tag of the `Feature` line. The tag on a scenario has no effect. For the reasons for the coverage mode, refer to [Boundary coverage and the ratchet](../explanation/boundary-coverage).

### The values that the scenarios send

Boundary coverage reads the values of each input field from these places:

- The tables of the step `I run the operation with:`, in scenarios with exactly one operation tag. A scenario with two or more operation tags sends no values.
- In a Scenario Outline, each `<placeholder>` in a cell gets the value of its column in each row of each `Examples` block. This is the same as the substitution of Cucumber. The tags of the `Examples` block are added to find the operation.

The gate converts each cell with the primitive of the field, in the same way as the steps. An empty cell is not a value. The text `""` is the empty string for a `string` or an `enum` field. For a field reference with `many`, the cell is a list, for example `[1, 2, 3]`. For an embedded entity, the cell is an object, for example `{ peril: fire, limit: 1000.00 }`. A link is a plain cell with the value of the key. A column that is not an input property is not read. Refer to [Gherkin steps](./gherkin-steps).

If a list or object cell is malformed, or names a property that its entity does not have, the gate reports `invalid-cell` and does not use the cell. A cell for a list that does not start with `[`, or a cell for an embedded entity that does not start with `{`, stays text. It is not an `invalid-cell`. The schema refuses it when Cucumber runs the scenario. These problems come from a real run of the insurance domain with two rows added to an `Examples` block of `coverages`:

```
    insurance/features/issue_policy.feature:59:128  error  invalid-cell  coverages: "lmit" is not a property of urn:acme:insurance:policy:entity:coverage (properties: peril, limit, note, remark) (at column 17 of the cell): [{ peril: fire, lmit: 1 }]
    insurance/features/issue_policy.feature:59:128  error  invalid-cell  coverages: expected "," or "]" (at column 27 of the cell): [{ peril: fire, limit: 1 }
```

Each operation needs its own values. If two operations have the same field in their input, each operation needs scenarios with the values. An operation with no tag has no boundary check, because `untagged-operation` is already an error.

### Boundary cases

Each constraint of an input field needs the values in this table. The label is the text in the message of `uncovered-boundary`, after `has no`.

| Primitive | Constraint | Necessary value | Label |
| --- | --- | --- | --- |
| `boolean` | `mustBe` | The value of `mustBe` | `value <mustBe> (mustBe)` |
| `boolean` | `mustBe` | The other boolean value | `value <not mustBe> (not mustBe)` |
| `date` | `min` | The day `min` | `value at min <min>` |
| `date` | `min` | The day before `min` | `day before min (<day>)` |
| `date` | `max` | The day `max` | `value at max <max>` |
| `date` | `max` | The day after `max` | `day after max (<day>)` |
| `decimal` | `min` | The value `min` | `value at min <min>` |
| `decimal` | `min` | With `scale`: the value one step of the scale below `min`. Without `scale`, or if `min` has more digits after the point than `scale`: a value smaller than `min` | `value one step below min (<value>)`, or `value below min <min>` |
| `decimal` | `exclusiveMin` | The value `exclusiveMin` | `value at exclusiveMin <bound>` |
| `decimal` | `exclusiveMin` | A value larger than `exclusiveMin` | `value above exclusiveMin <bound>` |
| `decimal` | `max` | The value `max` | `value at max <max>` |
| `decimal` | `max` | With `scale`: the value one step of the scale above `max`. Without `scale`, or if `max` has more digits after the point than `scale`: a value larger than `max` | `value one step above max (<value>)`, or `value above max <max>` |
| `decimal` | `exclusiveMax` | The value `exclusiveMax` | `value at exclusiveMax <bound>` |
| `decimal` | `exclusiveMax` | A value smaller than `exclusiveMax` | `value below exclusiveMax <bound>` |
| `decimal` | `scale` | A value with `scale` digits after the point | `value with <scale> digit(s) after the point (scale)` |
| `decimal` | `scale` | A value with `scale + 1` digits after the point | `value with <scale + 1> digits after the point (above scale)` |
| `decimal` | `notIn` | Each value of the list | `value <value> (notIn)` |
| `enum` | `values` | Each value of the list | `value "<value>" (values)` |
| `enum` | `values` | A text that is not in the list | `value outside values` |
| `float` | `min` | The value `min` | `value at min <min>` |
| `float` | `min` | A number smaller than `min` | `value below min <min>` |
| `float` | `exclusiveMin` | The value `exclusiveMin` | `value at exclusiveMin <bound>` |
| `float` | `exclusiveMin` | A number larger than `exclusiveMin` | `value above exclusiveMin <bound>` |
| `float` | `max` | The value `max` | `value at max <max>` |
| `float` | `max` | A number larger than `max` | `value above max <max>` |
| `float` | `exclusiveMax` | The value `exclusiveMax` | `value at exclusiveMax <bound>` |
| `float` | `exclusiveMax` | A number smaller than `exclusiveMax` | `value below exclusiveMax <bound>` |
| `float` | `notIn` | Each value of the list | `value <value> (notIn)` |
| `integer` | `min` | The value `min` | `value at min <min>` |
| `integer` | `min` | The value `min − 1` | `value at min − 1 (<min − 1>)` |
| `integer` | `max` | The value `max` | `value at max <max>` |
| `integer` | `max` | The value `max + 1` | `value at max + 1 (<max + 1>)` |
| `integer` | `multipleOf` | An integer that is a multiple of `multipleOf` | `multiple of <n> (multipleOf)` |
| `integer` | `multipleOf` | An integer that is not a multiple of `multipleOf` | `value that is not a multiple of <n>` |
| `integer` | `notIn` | Each value of the list | `value <value> (notIn)` |
| `string` | `minLength` | A text with the length `minLength` | `value of length <n> (minLength)` |
| `string` | `minLength` | A text with the length `minLength − 1`. Only if `minLength` is more than 0 | `value of length <n − 1> (below minLength)` |
| `string` | `maxLength` | A text with the length `maxLength` | `value of length <n> (maxLength)` |
| `string` | `maxLength` | A text with the length `maxLength + 1` | `value of length <n + 1> (above maxLength)` |
| `string` | `regex` | A text that matches the whole pattern | `valid value for regex <pattern>` |
| `string` | `regex` | A text that does not match the whole pattern | `invalid value for regex <pattern>` |
| `string` | `format` | A text of the format | `valid <format> (format)` |
| `string` | `format` | A text that is not of the format | `value that is not a valid <format>` |
| `timestamp` | `min` | The instant `min` | `value at min <min>` |
| `timestamp` | `min` | An instant before `min` | `value before min <min>` |
| `timestamp` | `exclusiveMin` | The instant `exclusiveMin` | `value at exclusiveMin <bound>` |
| `timestamp` | `exclusiveMin` | An instant after `exclusiveMin` | `value after exclusiveMin <bound>` |
| `timestamp` | `max` | The instant `max` | `value at max <max>` |
| `timestamp` | `max` | An instant after `max` | `value after max <max>` |
| `timestamp` | `exclusiveMax` | The instant `exclusiveMax` | `value at exclusiveMax <bound>` |
| `timestamp` | `exclusiveMax` | An instant before `exclusiveMax` | `value before exclusiveMax <bound>` |

The comparisons of the values:

- `integer` and `float` values compare with `===`. Thus `0` and `-0` both cover a bound of `0`.
- `decimal` values compare exactly, as numbers. Thus `"0.010"` covers `value at min 0.01`. A value that is not a decimal covers no case.
- `date` values compare as text. Thus a `date` value must have the form `YYYY-MM-DD`.
- `timestamp` values compare as instants. Thus `2026-01-01T00:00:00.000Z` covers `value at min 2026-01-01T00:00:00Z`.
- The length of a text is its number of Unicode code points. Thus one emoji counts as 1.

Examples of labels from the tests: `value one step below min (0.00)` for `min: "0.01", scale: 2`, and `day before min (2024-02-29)` for `min: 2024-03-01`.

A field with no constraints has no boundary cases. The gate examines only that the values are there. Cucumber examines that the scenarios pass.

### Boundary cases of a link and of an embedded entity

A link counts as a value of the key field of the linked entity. Thus the boundary cases of a link are the cases of the key field, and the message has the URN of the key field.

The values of an embedded entity count for its properties, at any depth. Each value of the property `limit` in each object of `coverages` is a value of the field `limit`. The message then gives the path of the property, with no list indexes, after `at`:

```
urn:acme:insurance:policy:field:limit at coverages.limit in the input of urn:acme:insurance:policy:operation:issue_policy has no value with 3 digits after the point (above scale)
```

This message comes from the insurance domain with the row `[{ peril: fire, limit: 1.005 }]` removed. A field at the top level of the input has no `at` part.

The gate examines each path one time for each operation. If one field is at two paths in the input of one operation, each path needs its own values.

### Boundary cases of a list

If the field reference has `many`, each item of each list counts as a value of the field for the cases of its constraints. The lists themselves need the values in this table:

| Property of `many` | Necessary value | Label |
| --- | --- | --- |
| `minItems` | A list with `minItems` items | `list of <n> item(s) (minItems)` |
| `minItems` | A list with `minItems − 1` items. Only if `minItems` is more than 0 | `list of <n − 1> item(s) (below minItems)` |
| `maxItems` | A list with `maxItems` items | `list of <n> item(s) (maxItems)` |
| `maxItems` | A list with `maxItems + 1` items | `list of <n + 1> item(s) (above maxItems)` |
| `unique: true` | A list in which a value occurs two or more times | `list with a repeated value (unique)` |
| `unique: true` on a list of an embedded entity | A list in which a key value occurs in two or more objects | `list with a repeated <key> (unique)` |

The list cases of a list of an embedded entity have the URN of the entity in the message, and the path of the property after `at`. This message comes from the insurance domain with the two rows that repeat the peril `fire` removed. One of the rows also had four coverages:

```
urn:acme:insurance:policy:entity:coverage at coverages in the input of urn:acme:insurance:policy:operation:issue_policy has no list of 4 item(s) (above maxItems), no list with a repeated peril (unique)
```

`many: true` has no list cases. If the field also has no constraints, the field has no boundary cases. The list cases come after the cases of the constraints in the message.

An example from a real run, for `sku` with `regex` and `many: { minItems: 1, maxItems: 3, unique: true }`, and one scenario that sends `[ABC-0001, ABC-0002]`:

```
urn:demo:shop:order:field:sku in the input of urn:demo:shop:order:operation:count_items has no invalid value for regex [A-Z]{3}-[0-9]{4}, no list of 1 item(s) (minItems), no list of 0 item(s) (below minItems), no list of 3 item(s) (maxItems), no list of 4 item(s) (above maxItems), no list with a repeated value (unique)
```

The message of `uncovered-boundary` gives all the cases that are not there, in the sequence of the table:

```
urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at min − 1 (0), no value at max 30000, no value at max + 1 (30001)
```

### Waivers

A waiver is a comment line in a feature file:

```gherkin
# urn-forge:waive <field URN> <reason>
```

| Item | Rule |
| --- | --- |
| Form | `#`, optional spaces, `urn-forge:waive`, one or more spaces, a URN that starts with `urn:`, one or more spaces, and a reason that is not empty |
| Position | Any comment line in the feature file |
| Scope | The operations whose URN is in any tag of the same feature file |
| Effect | The waiver removes all the boundary gaps of the field for the operations of its scope, at each path. A waiver with the URN of an embedded entity removes the list cases of a list of that entity. A waiver has no effect on `uncovered-error` |
| Result | `waived-boundary` (a note with the reason) if it removed a gap. `unused-waiver` (a warning) if the field had no gap. `unknown-waiver` (an error) if no operation of its scope has the field in its input with boundary cases |

A comment that starts with `# urn-forge:waive` but does not have this form gets `invalid-waiver`. The summary counts only the valid waivers.

### Summary

The summary of gate 3 has this form. The parts in brackets occur only in some conditions:

```
<F> feature(s), <S> scenario(s), <T>/<O> operations tagged[, <E>/<D> errors expected][, <V>/<M> events expected][, <B>/<N> invariants broken], strict: <K>/<F> features[ (boundaryCoverage: error)][, <W> waiver(s)]
```

| Field | Description | Condition |
| --- | --- | --- |
| `<F>` | The number of feature files that the gate parsed | Always |
| `<S>` | The number of scenarios in the syntax tree. A Scenario Outline counts one time, so Cucumber can count more scenarios | Always |
| `<T>/<O>` | The operations with a tag, and all the operations of the manifest | Always |
| `<E>/<D>` | The pairs of operation and declared error that a scenario expects, and all such pairs | Only if one or more operations declare errors |
| `<V>/<M>` | The pairs of operation and event that a scenario expects, and all such pairs | Only if one or more operations emit events |
| `<B>/<N>` | The pairs of operation and input invariant that a scenario breaks, and all such pairs | Only if the input entity of one or more operations has invariants |
| `<K>/<F>` | The strict features, and all the features | Always |
| `(boundaryCoverage: error)` | The coverage mode of the configuration | Only if `boundaryCoverage` is `error` |
| `<W>` | The number of valid waivers | Only if there is one or more |

Examples from real runs:

```
gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
gate 3  gherkin       PASS  3 feature(s), 18 scenario(s), 3/3 operations tagged, 3/3 errors expected, strict: 3/3 features (boundaryCoverage: error)
gate 3  gherkin       FAIL  2 feature(s), 4 scenario(s), 1/1 operations tagged, 0/1 errors expected, strict: 1/2 features, 1 waiver(s)
gate 3  gherkin       PASS  2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 2/2 events expected, 4/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
```

The last example is the insurance domain (`npm run verify:insurance`). Its 4 input invariants include `limit_is_positive`, the invariant of the embedded entity `coverage`. For the next run, the step that breaks `term_is_positive` named an invariant of a different entity:

```
gate 3  gherkin       FAIL  2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 2/2 events expected, 3/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features/issue_policy.feature:82:5  error  undeclared-invariant  "urn:acme:insurance:policy:invariant:cancellation_within_term" is not an invariant of the input of urn:acme:insurance:policy:operation:issue_policy (invariants: urn:acme:insurance:policy:invariant:deductible_below_premium, urn:acme:insurance:policy:invariant:term_is_positive, urn:acme:insurance:policy:invariant:limit_is_positive)
    insurance/features  error  uncovered-invariant  invariant urn:acme:insurance:policy:invariant:term_is_positive on the input of urn:acme:insurance:policy:operation:issue_policy has no scenario that breaks it; add one with Then the input is rejected by "urn:acme:insurance:policy:invariant:term_is_positive"
```

For the next run, the scenario of `cancel_policy` that expects `policy_cancelled` lost its `emits` step:

```
gate 3  gherkin       FAIL  2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 1/2 events expected, 4/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features  error  uncovered-event  event urn:acme:insurance:policy:event:policy_cancelled of urn:acme:insurance:policy:operation:cancel_policy has no scenario that expects it; add one with Then the operation emits "urn:acme:insurance:policy:event:policy_cancelled"
```

For the next run, the first scenario of `issue_policy` got two more steps. One expects an event of a different operation. The other has a table header that is not a field of the event:

```
gate 3  gherkin       FAIL  2 feature(s), 13 scenario(s), 2/2 operations tagged, 1/1 errors expected, 2/2 events expected, 4/4 invariants broken, strict: 2/2 features (boundaryCoverage: error)
    insurance/features/issue_policy.feature:15:5  error  undeclared-event  "urn:acme:insurance:policy:event:policy_cancelled" is not an event of urn:acme:insurance:policy:operation:issue_policy (emits: urn:acme:insurance:policy:event:policy_issued)
    insurance/features/issue_policy.feature:17:9  error  unknown-header  table header "premum" is not a field key of the event urn:acme:insurance:policy:event:policy_issued (allowed: policy_id, holder, premium)
```

## Gate 4: drift

**The generated files in the repository are the same as a new compile.**

The gate writes the files of the compile from step 2 to a temporary directory, with the same writer as `compile`. Then it compares each file, byte for byte, with the file of the same name in the `--out` directory. At the end, it deletes the temporary directory.

| Check | Rule | Code |
| --- | --- | --- |
| Each file is there | Each file of the new compile is in the `--out` directory | `generated-missing` |
| Each file is the same | Each file has the same bytes as the file of the new compile. The position of the problem is the first line that is different | `generated-differs` |
| No old files | Each file in the `--out` directory and its subdirectories with `.generated.` in its name is a file of the new compile | `generated-orphan` |

A change to the manifest, to the plugin list or to the urn-forge version changes the fingerprint in the header. Thus such a change makes each file different, also if the other lines are the same. Refer to [The generated schemas](./generated-schemas).

The summary has this form:

```
<n> generated file(s) compared byte for byte against <out>
```

## Gate 5: compatibility

**No change breaks a consumer of a live URN.** A live URN is the URN of an atom that is not sunset.

Gate 5 compares two manifests. `verify` has one manifest and no git history, so gate 5 is the separate command `urn-forge diff`. CI gives it the manifest of the base branch and the manifest of the change. For the options, the output and the exit codes, refer to [The CLI](./cli). For the reasons for the rules, refer to [Compatibility and the direction of use](../explanation/compatibility).

```bash
urn-forge diff <old manifest> <new manifest> --config urn-forge.config.ts
```

`diff` compiles the two manifests in memory, with no reference date. Then it gives each change one of three classes:

| Class | Meaning | Line | Effect |
| --- | --- | --- | --- |
| `compatible` | No consumer that worked before the change can fail after it | `compatible` | None |
| `lifecycle` | A `status` that moves forward, a new `supersededBy` or `sunsetDate`, or the removal of a property whose target was deprecated | `lifecycle` | None |
| `breaking` | A consumer that worked before the change can fail after it | `breaking`, and the diagnostic `breaking-change` | An error. A warning if the old manifest has `stability: experimental` |

### The uses

The class of most changes depends on how the URN is used. `diff` finds the uses of each atom in the live IR of the old manifest. For a URN that is new, it uses the new manifest.

| Use | The atoms that have it | Message text |
| --- | --- | --- |
| In | The input entity of each operation. Each field and entity that it embeds, at any depth. The key field of each entity that it links | `callers send` |
| Out | The output entity of each operation, with its embedded entities and the key fields of its links. Each declared error of each operation, each event in its `emits`, and the `recordAs` event of each declared error, with the same parts of their fields | `callers receive` |
| Stored | Each entity in the `tables` of the `postgres` plugin of `--config`, with its embedded entities and the key fields of its links | `the database stores` |

An invariant has the uses of its entity. An atom can have zero, one, two or three uses. If no operation and no table uses an atom, each change to it is compatible.

### The relation of a change

For each change to the values of an atom, `diff` finds the relation of the new set of correct values to the old set. The relation and the uses give the class:

| Relation | Verb in the message | In | Out | Stored |
| --- | --- | --- | --- | --- |
| Narrower: fewer values | `narrows` | `breaking` | `compatible` | `breaking` |
| Wider: more values | `widens` | `compatible` | `breaking` | `compatible` |
| Neither: `diff` cannot say narrower or wider | `changes` | `breaking` | `breaking` | `breaking` |

A change is breaking if one or more of its uses breaks. The message names all the uses, and then the uses that break:

```
breaking    urn:acme:insurance:policy:field:remark  maxLength 40 → 60 widens a value that callers send and callers receive and the database stores, which breaks callers that receive it
compatible  urn:demo:shop:order:field:qty  max 10 → 20 widens a value that callers send
compatible  urn:demo:shop:order:field:spare  min none → 5 narrows a value that nothing uses
```

### Changes to a field

A change of `primitive` is "neither". For the same primitive, `diff` compares each aspect of the constraints:

| Aspect | Constraints | Narrower | Wider | Neither |
| --- | --- | --- | --- | --- |
| Lower bound | `min`, `exclusiveMin`, `minLength` | A new bound, a higher bound, or the same value that becomes exclusive | No bound, a lower bound, or the same value that becomes inclusive | — |
| Upper bound | `max`, `exclusiveMax`, `maxLength` | A new bound, a lower bound, or the same value that becomes exclusive | No bound, a higher bound, or the same value that becomes inclusive | — |
| Step | `multipleOf` | The new step is a multiple of the old step. No `multipleOf` is a step of 1 | The new step is a divisor of the old step | Each other change |
| Scale | `scale` | A new `scale`, or a smaller `scale` | No `scale`, or a larger `scale` | — |
| Excluded values | `notIn` | The new list has each old value, and more | The old list has each new value, and more | Each other change |
| Allowed values | `values` of an `enum` | The old list has each new value, and more | The new list has each old value, and more | Each other change |
| Shape | `regex`, `format`, `mustBe` | A new constraint | No constraint | A changed value |

- `decimal` bounds compare as exact numbers, `timestamp` bounds as instants, and `date` bounds as text.
- The values of `notIn` and of `values` compare as sets. Their sequence is not important.
- If the aspects that change all have one relation, the field has that relation. If they have different relations, the field has "neither".
- A changed `regex` or `format` is always "neither", also if the new pattern accepts more values. Thus `regex [A-Z]+ → [A-Z]*` is breaking for each use.

### Changes to an entity, an event or an error

`diff` compares the properties of an entity, an event or an error by property name. The relation applies to the uses of the atom:

| Change | Relation | Message |
| --- | --- | --- |
| A new required property | Narrower | `the new required property "<name>"` |
| A new optional property | Compatible for each use | `adds the optional property "<name>"` |
| A property that is not there any more | Wider | `removing the <required \| optional> property "<name>"` |
| A property that is not there any more, whose target was deprecated in the old manifest | `lifecycle` | `removes the property "<name>", whose target <urn> was deprecated` |
| `required: false` becomes `required: true` | Narrower | `the property "<name>" (optional → required)` |
| `required: true` becomes `required: false` | Wider | `the property "<name>" (required → optional)` |
| A change to the `many` rule of a list | `minItems` and `maxItems` as bounds. `unique: true` added is narrower, removed is wider | `the list "<name>" (<changes>)` |
| A different target, or a change between one value and a list | Neither | `the property "<name>" (<old target> → <new target>)` |
| A different `key` of an entity | Neither | `key <old> → <new>` |

A new name with `as` is a removal and an addition. A removed property with a deprecated target is a lifecycle change, also on an entity that callers receive. The deprecation warned its callers, and they had until the sunset date to move. A change of the target atom itself, for example a tighter field, is a change to that atom, not to the entity.

### Changes to the other kinds

| Change | Class |
| --- | --- |
| A new invariant | Narrower, on the uses of its entity in the old manifest |
| A changed `rule` or `on` of an invariant | Neither |
| A changed `message` of an invariant or an error | `compatible` |
| A changed `category` or `retryable` of an error | Neither, on the uses of the error |
| A changed `recordAs` of an error, also a new or a removed `recordAs` | Neither, on the uses of the error |
| A changed `input` or `output` of an operation | `breaking` |
| A new declared error in the `errors` of an operation | Wider, on Out: `breaking` |
| A declared error that is not in the `errors` of an operation any more | Narrower, on Out: `compatible` |
| A new event in the `emits` of an operation | Wider, on Out: `breaking` |
| An event that is not in the `emits` of an operation any more | Narrower, on Out: `compatible` |
| A changed `description` of an atom | `compatible` |

### Atoms, the lifecycle and the manifest

| Change | Class | Message |
| --- | --- | --- |
| A new atom, except an invariant | `compatible` | `is new` |
| An atom that is not in the new manifest. Also a sunset atom | `breaking` | `is removed; deprecate it, and set status: sunset when no one uses it`, or for a sunset atom `is removed; keep a sunset atom in the manifest, so its URN is never used again` |
| `status` moves forward: `active` to `deprecated`, `active` to `sunset`, or `deprecated` to `sunset` | `lifecycle` | `status <old> → <new>` |
| An entity, an event or an error that removes a property whose target was deprecated in the old manifest | `lifecycle` | `removes the property "<name>", whose target <urn> was deprecated` |
| A changed `supersededBy` or `sunsetDate`, with the same `status` | `lifecycle` | `<key> <old> → <new>` |
| `status` moves back, for example `sunset` to `active` | `breaking` | `status <old> → <new>: a status only moves forward; declare a new URN instead` |
| Any change to an atom that is sunset in the two manifests | Not reported | — |
| Other changes to an atom that becomes sunset | Not reported. Only the `lifecycle` line | — |
| A different `namespace` or `domain` | `breaking`, one line for the manifest and no other line | `the namespace or domain changed to urn:<namespace>:<domain>, so every URN changed` |
| `stability: experimental` to `stable` | `compatible` | `stability experimental → stable: from now on, a breaking change fails` |
| `stability: stable` to `experimental` | `breaking` | `stability stable → experimental: a published manifest cannot go back to experimental` |

`diff` does not compare the `version` of the header with the class of the changes.

### The cases in `tests/diff/`

Each directory of `tests/diff/` holds one rule: `old.yaml`, `new.yaml` and `expected.txt`. `tests/diff.test.ts` runs each case. Examples from real runs, with `--config tests/diff/no-config.ts`:

```
breaking    urn:demo:shop:order:field:total  max 1000 → 2000 widens a value that callers receive, which breaks callers that receive it
compatible  urn:demo:shop:order:field:total  max 1000 → 500 narrows a value that callers receive
breaking    urn:demo:shop:order:entity:order  the new required property "spare" narrows a value that callers send, which breaks callers that send it
compatible  urn:demo:shop:order:entity:order  removing the optional property "note" widens a value that callers send
breaking    urn:demo:shop:order:field:pack  multipleOf 2 → 4 narrows a value that callers send, which breaks callers that send it
breaking    urn:demo:shop:order:error:out_of_stock  retryable true → false changes a value that callers receive, which breaks callers that receive it
breaking    urn:demo:shop:order:field:spare  status sunset → active: a status only moves forward; declare a new URN instead
lifecycle   urn:demo:shop:order:entity:receipt  removes the property "spare", whose target urn:demo:shop:order:field:spare was deprecated
compatible  urn:demo:shop:order:event:placed  is new
breaking    urn:demo:shop:order:operation:place  the new event urn:demo:shop:order:event:placed widens a value that callers receive, which breaks callers that receive it
```

The last two lines come from `tests/diff/event-added`. With the two manifests in the opposite sequence, the result is:

```
breaking    urn:demo:shop:order:event:placed  is removed; deprecate it, and set status: sunset when no one uses it
compatible  urn:demo:shop:order:operation:place  removing the event urn:demo:shop:order:event:placed narrows a value that callers receive
```

### Gate 5 in CI

The CI job `compatibility` runs `npm run diff:base -- HEAD^1 --report` for each pull request. The script runs `urn-forge diff` for each domain of the repository, from its manifest on the base branch to the manifest of the pull request. With `--report`, a breaking change shows, but the job does not fail: the domains of this repository are test domains, which change on purpose. For the steps in your own CI, refer to [Check compatibility in CI](../how-to/check-compatibility).

## Related pages

- [Diagnostics](./diagnostics)
- [JSON output](./json-output)
- [Fix a gate that fails](../how-to/fix-a-failing-gate)
- [Adopt strict coverage](../how-to/adopt-strict-coverage)
- [What the gates show](../explanation/what-the-gates-show)
