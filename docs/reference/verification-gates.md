# Verification gates

`urn-forge verify` compiles the manifest, then runs four gates. Each gate examines one link between the manifest and your project. `urn-forge diff` is a separate check of a change. Refer to [Diff and versions](./diff).

If the config is not valid or the manifest does not compile, `verify` runs no gate.

## The output

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 15 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

Each gate has one line: its number, its name, `PASS` or `FAIL`, and a summary. Each problem of a gate is an indented line below it: `<file>:<line>  <severity>  <code>  <message>`. A problem with no line has only the file.

The last line is one of these:

| Last line | Exit code |
| --- | --- |
| `verify passed (gates 1, 2, 3, 4)` | `0` |
| `verify passed with <n> warning(s) (gates 1, 2, 3, 4)` | `0` |
| `verify failed: gate <numbers>` | `1` |
| `verify failed: the config is not valid` | `1` |
| `verify failed: the manifest does not compile` | `1` |

## Gate 1: completeness

Gate 1 shows that the core has a function of the correct type for each operation.

- It type-checks the core file with `tsc` and the `compilerOptions` of the project's `tsconfig.json`. Each error of `tsc` in the core or in a file that it imports is a problem `type-error`.
- It looks for an exported value of the core file whose initializer `satisfies DomainCore`, where `DomainCore` is the type of the generated file. Without it, the problem is `core-not-satisfying`. Thus a removed `satisfies` does not turn the gate off.

| Code | Severity |
| --- | --- |
| `type-error` | error |
| `core-not-satisfying` | error |
| `core-not-found` | error |
| `tsconfig-unreadable` | error |

## Gate 2: boundary

Gate 2 shows that the shell runs the core only through the harness.

It reads the core files (the core file, and the files that it imports from its own folder) and the shell files (the files and folders of `shell` in the config).

| Code | Severity | Cause |
| --- | --- | --- |
| `direct-call` | error | A shell file reads a property of an export of the core, such as `core.quote_shipping`. To pass `core` to `runOperation` is correct |
| `suppressed-check` | error | A core file or a shell file has `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` |

Without `shell` in the config, gate 2 checks only the core files.

## Gate 3: Gherkin

Gate 3 shows that the scenarios cover the manifest. It reads each `.feature` file of the features folder as Cucumber does: each row of an `Examples` table is one scenario. It does not run the scenarios. `cucumber-js` runs them.

| Code | Severity | Cause |
| --- | --- | --- |
| `unknown-name` | error | A step names an operation, a definition, an output or a rule that the manifest does not have |
| `feature-syntax` | error | A feature is not valid Gherkin |
| `uncovered-operation` | gap | No scenario runs the operation |
| `uncovered-output` | gap | No scenario of the operation ends with the output |
| `uncovered-rule` | gap | No scenario breaks the rule of the definition, on an input or on a checked value |

A gap is a warning. With `coverage: 'error'` in the config, a gap is an error.

A rule counts as broken for a definition if a scenario ends with `Then the input is rejected by "<rule>" of "<definition>"` or `Then the value is rejected by "<rule>" of "<definition>"`. Only the rules of definitions need a scenario. The rules of outputs and operations are checked by the harness on each answer.

The summary counts the features, the scenarios, the operations that a scenario runs, and the pairs of a definition and a rule that a scenario breaks.

## Gate 4: drift

Gate 4 shows that the generated files are the files that `compile` gives now.

- It compiles the manifest again, and compares each generated file with the file on disk, byte for byte. A difference is a problem `drift`, at the first line that is different.
- A generated file that is not on disk is a problem `drift`.
- A file in the output folder whose name ends with `.generated.ts` or `.generated.sql`, and that `compile` no longer makes, is a problem `drift`.

## Related pages

- [Fix a failing gate](../how-to/fix-a-failing-gate)
- [Diagnostics](./diagnostics)
- [How urn-forge proves it](../explanation/how-urn-forge-proves-it)
