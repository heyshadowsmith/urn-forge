# Verification gates

The command `urn-forge verify` examines the chain from the manifest to the core, the features and the generated files. It reads files and does a type check. It does not run the core or the scenarios. This page gives what `verify` does, each gate, each check of a gate, and the output. For the options of the command, refer to [The CLI](./cli). For the reasons for the gates, refer to [What the gates show](../explanation/what-the-gates-show).

## What `verify` does

`verify` does these steps in this sequence:

1. It reads the [configuration file](./configuration), if there is one. If the file is not valid, `verify` shows the diagnostics and stops. No gate runs.
2. It reads the manifest and compiles it in memory, with the same plugins as `compile`. It does not write files. If the manifest has an error, `verify` shows the diagnostics and stops. No gate runs.
3. It reads each `.feature` file in the `--features` directory and its subdirectories, in path sequence. It reads each file one time, and all gates use the result.
4. It runs gate 1, gate 3 and gate 4, in this sequence. Each gate runs also if a gate before it failed.
5. It shows the result of each gate and the last line.

A gate fails if one or more of its problems has the severity `error`. A warning or a note does not make a gate fail. `verify` passes if all gates pass.

| Gate | Name | What it shows | Status |
| --- | --- | --- | --- |
| 1 | `completeness` | The core has a handler of the correct type for each operation | Built |
| 2 | Lint profile | — | urn-forge does not have this gate at this time. Refer to [Scope](./scope) |
| 3 | `gherkin` | The features use real URNs and real field names, and they cover the declared errors and the boundary values | Built |
| 4 | `drift` | The generated files in the repository are the same as a new compile | Built |
| 5 | Compatibility | — | urn-forge does not have this gate at this time. Refer to [Scope](./scope) |

## Output

In the text format, `verify` writes one line for each gate to stdout:

```
gate <number>  <name>  PASS|FAIL  <summary>
```

The name has 12 characters, with spaces at the end. Below the line of a gate, `verify` writes each problem of the gate in the [diagnostic format](./diagnostics), with an indent of four spaces. Each line of a message with more than one line gets the indent.

The last line has one of these forms:

| Last line | Stream | Condition |
| --- | --- | --- |
| `verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)` | stdout | All gates passed, with no warnings |
| `verify passed with <n> warning(s) (gates 1, 3, 4; gates 2 and 5 are not in the MVP)` | stdout | All gates passed, with `<n>` warnings |
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
    tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside oneOf
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/2-declared-errors/generated
verify passed with 2 warning(s) (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
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

**The features use real URNs and real field names, and they cover the declared errors and the boundary values.** The gate reads the syntax tree of each feature file. It does not run the scenarios. Cucumber runs them. Refer to [Gherkin steps](./gherkin-steps).

### The tags of a scenario

The gate gives each scenario the tags of its feature, of its `Rule` block and of the scenario. For the header and the values of an `Examples` block, the gate also adds the tags of that `Examples` block. The steps of a `Background` block are part of each scenario after it.

The **owner** of a scenario is the one operation or entity that its tags name. A tag that is not an operation or entity URN, for example `@wip`, has no effect on the owner.

### Checks

The gate does these checks. The table gives them in the sequence of the output.

| Check | Rule | Code | Severity |
| --- | --- | --- | --- |
| Read the directory | The `--features` directory can be read | `features-unreadable` | `error` |
| Parse the files | Each `.feature` file is valid Gherkin | `feature-parse-error` | `error` |
| Tags resolve | Each tag that starts with `@urn:` is the URN of a field, an entity, an operation or an error of the manifest. The gate examines each tag one time, where it is written | `unresolved-tag` | `error` |
| One owner | A scenario or an `Examples` block has one owner or no owner, not two or more | `ambiguous-tag` | `error` |
| Headers | Each header of a step table and of an `Examples` table is a property of the owner. For an operation, this is a property of its input or output entity. For an entity, this is a property of the entity. A scenario with no owner, or with two or more owners, is not examined | `unknown-header` | `error` |
| Error headers | Each header of the table of `the operation fails with "<error URN>":` is a field of that error. The gate examines this only if the operation declares the error | `unknown-header` | `error` |
| Required columns | The table of `I run the operation with:` has a column for each mandatory input field of the operation. Fields with `required: false` are not mandatory | `missing-column` | `error` |
| Declared errors | The error URN in `the operation fails with "<error URN>"` is a declared error of the operation of the scenario. The URN can be in double or single quotes. The gate examines this only if the owner is an operation | `undeclared-error` | `error` |
| Tagged operations | Each operation of the manifest has its URN in one or more tags, in any feature file | `untagged-operation` | `error` |
| Error coverage | Each declared error of each operation has one or more scenarios of that operation with `the operation fails with "<error URN>"` | `uncovered-error` | Coverage mode |
| Waiver form | Each comment that starts with `# urn-forge:waive` has a field URN and a reason | `invalid-waiver` | `error` |
| Boundary coverage | For each tagged operation and each input field with constraints, the values that the scenarios send include each boundary case | `uncovered-boundary` | Coverage mode |
| Waiver result | Each valid waiver names a constrained input field of an operation of its feature file. Then it removes a gap, or it removes nothing | `unknown-waiver`, `waived-boundary`, `unused-waiver` | `error`, `note`, `warning` |
| Ratchet | If `boundaryCoverage` is `warn`, the directory has one or more features, each feature is strict, and the gate has no error, the gate gives a note | `ratchet-ready` | `note` |

The gate finds the step texts as written in the feature file, without the keyword. The text `the operation fails with "<error URN>"` can use double or single quotes, as Cucumber accepts both. It can have a colon at the end or not.

### File and position of each problem

| Code | File | Position |
| --- | --- | --- |
| `features-unreadable` | The `--features` directory | None |
| `feature-parse-error` | The feature file | None |
| `unresolved-tag` | The feature file | The tag |
| `ambiguous-tag` | The feature file | The scenario or the `Examples` block |
| `unknown-header` | The feature file | The header cell |
| `missing-column` | The feature file | The table |
| `undeclared-error` | The feature file | The step |
| `untagged-operation`, `uncovered-error`, `uncovered-boundary`, `ratchet-ready` | The `--features` directory | None |
| `invalid-waiver`, `unknown-waiver`, `waived-boundary`, `unused-waiver` | The feature file | The comment |

### The coverage mode

The severity of `uncovered-error` and `uncovered-boundary` depends on the coverage mode of the operation:

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

The gate converts each cell with the primitive of the field, in the same way as the steps. An empty cell is not a value. The text `""` is the empty string for a `string` field. A column that is not an input field is not read. Refer to [Gherkin steps](./gherkin-steps).

Each operation needs its own values. If two operations have the same field in their input, each operation needs scenarios with the values. An operation with no tag has no boundary check, because `untagged-operation` is already an error.

### Boundary cases

Each constraint of an input field needs the values in this table. The label is the text in the message of `uncovered-boundary`, after `has no`.

| Primitive | Constraint | Necessary value | Label |
| --- | --- | --- | --- |
| `integer` | `min` | The value `min` | `value at min <min>` |
| `integer` | `min` | The value `min − 1` | `value at min − 1 (<min − 1>)` |
| `integer` | `max` | The value `max` | `value at max <max>` |
| `integer` | `max` | The value `max + 1` | `value at max + 1 (<max + 1>)` |
| `integer` | `notEqual` | The value `notEqual` | `value equal to notEqual <value>` |
| `float` | `min` | The value `min` | `value at min <min>` |
| `float` | `min` | A number smaller than `min` | `value below min <min>` |
| `float` | `max` | The value `max` | `value at max <max>` |
| `float` | `max` | A number larger than `max` | `value above max <max>` |
| `float` | `notEqual` | The value `notEqual` | `value equal to notEqual <value>` |
| `string` | `minLength` | A text with the length `minLength` | `value of length <n> (minLength)` |
| `string` | `minLength` | A text with the length `minLength − 1`. Only if `minLength` is more than 0 | `value of length <n − 1> (below minLength)` |
| `string` | `maxLength` | A text with the length `maxLength` | `value of length <n> (maxLength)` |
| `string` | `maxLength` | A text with the length `maxLength + 1` | `value of length <n + 1> (above maxLength)` |
| `string` | `regex` | A text that matches the whole pattern | `valid value for regex <pattern>` |
| `string` | `regex` | A text that does not match the whole pattern | `invalid value for regex <pattern>` |
| `string` | `oneOf` | Each value of the list | `value "<value>" (oneOf)` |
| `string` | `oneOf` | A text that is not in the list | `value outside oneOf` |
| `boolean` | `mustBe` | The value of `mustBe` | `value <mustBe> (mustBe)` |
| `boolean` | `mustBe` | The other boolean value | `value <not mustBe> (not mustBe)` |

The numeric comparison uses `===`. Thus `0` and `-0` both cover a bound of `0`. The length of a text is its number of UTF-16 code units. A field with no constraints has no boundary cases. The gate examines only that the values are there. Cucumber examines that the scenarios pass.

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
| Effect | The waiver removes all the boundary gaps of the field for the operations of its scope. It has no effect on `uncovered-error` |
| Result | `waived-boundary` (a note with the reason) if it removed a gap. `unused-waiver` (a warning) if the field had no gap. `unknown-waiver` (an error) if no operation of its scope has the field in its input with boundary cases |

A comment that starts with `# urn-forge:waive` but does not have this form gets `invalid-waiver`. The summary counts only the valid waivers.

### Summary

The summary of gate 3 has this form. The parts in brackets occur only in some conditions:

```
<F> feature(s), <S> scenario(s), <T>/<O> operations tagged[, <E>/<D> errors expected], strict: <K>/<F> features[ (boundaryCoverage: error)][, <W> waiver(s)]
```

| Field | Description | Condition |
| --- | --- | --- |
| `<F>` | The number of feature files that the gate parsed | Always |
| `<S>` | The number of scenarios in the syntax tree. A Scenario Outline counts one time, so Cucumber can count more scenarios | Always |
| `<T>/<O>` | The operations with a tag, and all the operations of the manifest | Always |
| `<E>/<D>` | The pairs of operation and declared error that a scenario expects, and all such pairs | Only if one or more operations declare errors |
| `<K>/<F>` | The strict features, and all the features | Always |
| `(boundaryCoverage: error)` | The coverage mode of the configuration | Only if `boundaryCoverage` is `error` |
| `<W>` | The number of valid waivers | Only if there is one or more |

Examples from real runs:

```
gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
gate 3  gherkin       PASS  3 feature(s), 18 scenario(s), 3/3 operations tagged, 3/3 errors expected, strict: 3/3 features (boundaryCoverage: error)
gate 3  gherkin       FAIL  2 feature(s), 4 scenario(s), 1/1 operations tagged, 0/1 errors expected, strict: 1/2 features, 1 waiver(s)
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

## Related pages

- [Diagnostics](./diagnostics)
- [JSON output](./json-output)
- [Fix a gate that fails](../how-to/fix-a-failing-gate)
- [Adopt strict coverage](../how-to/adopt-strict-coverage)
- [What the gates show](../explanation/what-the-gates-show)
