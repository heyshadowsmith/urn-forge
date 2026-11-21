# Verification gates

The `urn-forge verify` command does a static check of each link in the chain. It reads files and does a type check on them, but it does not run code.

1. The command compiles the manifest. If the compile fails, the command shows the diagnostics and does not run the gates.
2. The command runs three gates and shows the result of each gate.
3. If one or more gates fail, the command stops with exit code `1`.

A gate fails if it finds one or more errors. A warning does not make a gate fail. If there are warnings, the last line gives their number, for example `verify passed with 2 warning(s)`. At this time, only `uncovered-error` of gate 3 is a warning.

```
gate 1  completeness  PASS  tsc: 0 error(s) over example/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  2 feature(s), 4 scenario(s), 2/2 operations tagged
gate 4  drift         PASS  2 generated file(s) compared byte for byte against example/generated
verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
```

The specification also has gate 2 (the lint profile) and gate 5 (a compatibility check with the previous manifest). The MVP does not have these gates.

## Gate 1: completeness

**Each operation has a handler of the generated type.**

1. The gate does a type check on the core entry (`--core`). It uses the compiler options from `--tsconfig`. The core uses `satisfies DomainCoreImplementation`. As a result, a handler that is not there, that is not in the contract, or that has the wrong type causes a type error.
2. The gate makes sure that the core file exports a value with `… satisfies DomainCoreImplementation`. The name must refer to the interface in the generated runtime file. Without this check, a person can remove the `satisfies` clause and stop the gate without a message. An interface with the same name in a different file does not count.

The gate accepts `export const core = …` and `export default …`. It also accepts a type with a namespace, for example `rt.DomainCoreImplementation`.

```
gate 1  completeness  FAIL  tsc: 1 error(s) over example/core.ts; `core` satisfies DomainCoreImplementation
    example/core.ts:6:3  error  type-error  TS1360: Type '{ … }' does not satisfy the expected type 'DomainCoreImplementation'.
      Property ''urn:demo:math:arithmetic:operation:safe_divide'' is missing in type '{ … }' but required in type 'DomainCoreImplementation'.
```

## Gate 3: Gherkin traceability

**Features trace to real URNs, and their tables use real field names.** The gate reads each `.feature` file in the `--features` directory.

1. **Tags.** Each `@urn:…` tag must agree with a URN in the manifest. Each operation must have a tag on one or more features or scenarios.
2. **Headers.** These rules apply to a scenario with an operation tag. Each header in its tables must be a property of the input or output entity of the operation. The table of `Then the operation fails with "<error URN>":` is different: each header must be a field of that error. This applies to step tables and to `Examples` blocks. If the tag is an entity tag, each header must be a property of that entity. A scenario receives the tags of its feature, of its `Rule` block and of its `Examples` blocks.
3. **Required columns.** The table of the step `When I run the operation with:` must have a column for each mandatory field of the input of the operation. Fields with `required: false` are not mandatory. To make a test with a missing value, keep the column and leave the cell empty. Then the step sends the payload without that key.
4. **Declared errors.** The step `Then the operation fails with "<error URN>"` must give an error that the operation of the scenario declares. If not, the gate fails (`undeclared-error`). Each declared error must have one or more scenarios that expect it. If an error has no scenario, the gate gives a warning (`uncovered-error`), but it does not fail. A later version can make this check an error.

A scenario with two or more operation or entity tags fails, because the steps must have one tag only.

The change of a column name from `divisor` to `denominator` causes two errors. The new name is not a field, and the table has no `divisor` column:

```
gate 3  gherkin       FAIL  2 feature(s), 4 scenario(s), 2/2 operations tagged
    example/features/safe_divide.feature:6:22  error  unknown-header  table header "denominator" is not a field key of the input or output of urn:demo:math:arithmetic:operation:safe_divide (allowed: dividend, divisor, quotient)
    example/features/safe_divide.feature:6:7  error  missing-column  the table of "I run the operation with:" has no column for required input field(s) "divisor" of urn:demo:math:arithmetic:operation:safe_divide; to test a missing value, keep the column and leave the cell empty
```

Gate 3 counts the scenarios in the syntax tree. It counts each Scenario Outline one time. Cucumber counts each row of each `Examples` table. As a result, the scenario count of Cucumber is larger.

## Gate 4: drift

**The generated files in the repository are the same as a new compile.** The gate compiles the manifest into a temporary directory. It uses the same writer as `compile`. Then it compares each file, byte for byte, with the file in `--out`.

The gate shows these problems:

- **A file that is different.** The message gives the first line that is different. The cause is a manual edit, or a manifest change without a new compile.
- **A file that is not there.**
- **An old file.** This is a `*.generated.*` file that the current compile does not make.

```
gate 4  drift         FAIL  2 generated file(s) compared byte for byte against example/generated
    example/generated/domain.schemas.generated.ts:21:1  error  generated-differs  differs from a fresh compile (hand-edited or stale); run `urn-forge compile`
```

To correct a gate 4 failure, run `urn-forge compile` and commit the result.

## The errors that each gate finds

The MVP uses these three errors as tests of the gates. Each error makes CI fail at its gate:

| Error | Gate that finds it |
| --- | --- |
| Remove the `safe_divide` handler from `core.ts` | Gate 1 |
| Change the name of the `divisor` column to `denominator` in the feature | Gate 3 |
| Edit `domain.schemas.generated.ts` manually | Gate 4 |

Gate 3 shows that the scenarios exist and use the correct names. Cucumber shows if the scenarios pass. CI runs the two checks.
