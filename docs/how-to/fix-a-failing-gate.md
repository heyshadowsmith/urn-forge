# Fix a failing gate

Find the cause of a gate that fails, and correct it. This page gives the most common problems of each gate. For every code, refer to [Diagnostics](../reference/diagnostics).

## Before you start

- You have a project that `urn-forge verify` examines. Refer to [Set up a project](set-up-a-project).
- The examples come from the project of the tutorials, with one part broken for each example.

## Steps

1. Run `npx urn-forge verify`.
2. Find each gate line that shows `FAIL`.
3. Read the indented lines below that gate. Each line is one problem: `<file>:<line>  <severity>  <code>  <message>`. Some problems have no line.
4. Fix the problems with the severity `error`. A `warning` does not fail a gate.
5. If one change causes more than one problem, fix the first problem. The others often go away with it.
6. Run `verify` again.

If the manifest does not compile, `verify` runs no gate. Correct the manifest at the line that the problem gives:

```
domain.manifest.yaml:7  error  manifest-shape  manifest.owner is not a key here; the keys are namespace, domain, version, compatibility
verify failed: the manifest does not compile
```

## Gate 1: completeness

Gate 1 type-checks the core with `tsc`. It also looks for an export that uses `satisfies DomainCore`.

| Code | Cause | Fix |
| --- | --- | --- |
| `type-error` with `TS1360` | The core has no function for an operation | Add a function with the name that the message gives. Refer to [Add an operation](add-an-operation) |
| `type-error` with `TS2353` | The core has a function for an operation that the manifest does not have | Remove it, or correct its name |
| `type-error` with `TS2322` | A function returns a plain object, or an output that the operation does not have | Return `answer('<output>', value)` with an output of the operation |
| `core-not-satisfying` | No export uses `satisfies DomainCore` | Declare the core as the message shows |
| `core-not-found` | The `core` path names no file | Correct the path. A path in the config is relative to the config file |
| `tsconfig-unreadable` | The `tsconfig` path names no file, or the file is not valid | Correct the path or the file |

A function is not there:

```
gate 1  completeness  FAIL  tsc: 1 error(s) over src/core.ts; core satisfies DomainCore
    src/core.ts:3  error  type-error  TS1360: Type '{}' does not satisfy the expected type 'DomainCore'.
  Property 'quote_shipping' is missing in type '{}' but required in type 'DomainCore'.
```

A function returns a plain object, not an answer:

```
gate 1  completeness  FAIL  tsc: 1 error(s) over src/core.ts; core satisfies DomainCore
    src/core.ts:10  error  type-error  TS2322: Type '({ weight_grams, zone, express }: Parcel) => Answer<"too_heavy_for_express", { weight_grams: number; }> | { price_cents: number; }' is not assignable to type '(input: Parcel) => QuoteShippingAnswer'.
  Type 'Answer<"too_heavy_for_express", { weight_grams: number; }> | { price_cents: number; }' is not assignable to type 'QuoteShippingAnswer'.
    Type '{ price_cents: number; }' is not assignable to type 'QuoteShippingAnswer'.
```

If the error is in a generated file, the generated file is possibly not there. Fix gate 4 first.

::: warning
Do not remove the `satisfies` clause to make `tsc` pass. Gate 1 then fails with `core-not-satisfying`.
:::

## Gate 2: boundary

Gate 2 makes sure that the shell calls the core only through `runOperation`, and that no file turns off the type check.

| Code | Cause | Fix |
| --- | --- | --- |
| `direct-call` | A shell file reads a function of the core, such as `core.quote_shipping(…)` | Call `runOperation(core, 'quote_shipping', input)` |
| `suppressed-check` | `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` in a core file or a shell file | Remove the comment, and correct the type error that gate 1 then shows |

```
gate 2  boundary      FAIL  1 core file(s), 1 shell file(s): 1 problem(s)
    src/shell/http.ts:9  error  direct-call  core.quote_shipping runs the core without the harness; call runOperation(core, …), which checks the input and the answer
```

Gate 2 checks the shell only if `shell` in the config names its files. Refer to [Call an operation](call-an-operation).

## Gate 3: Gherkin

Gate 3 reads the features, and asks for a scenario for each operation, each output and each rule of a definition.

| Code | Cause | Fix |
| --- | --- | --- |
| `unknown-name` | A step names an operation, a definition, an output or a rule that the manifest does not have | Correct the name in the step |
| `uncovered-operation` | No scenario runs the operation | Add a scenario with `When I run "<operation>" with:` |
| `uncovered-output` | No scenario ends with the output | Add a scenario that ends with `Then the output is "<output>"` |
| `uncovered-rule` | No scenario breaks a rule of a definition | Add a scenario that ends with `Then the input is rejected by …` or `Then the value is rejected by …` |
| `feature-syntax` | A feature is not valid Gherkin | Correct the feature at the line that the message gives |

A gap is a warning, or an error with `coverage: 'error'`:

```
gate 3  gherkin       FAIL  1 feature(s), 11 scenario(s), 1/1 operation(s) run, 6 rule(s) broken
    features  error  uncovered-rule  no scenario breaks required of too_heavy_for_express; add one that ends with Then the input is rejected by "required" of "too_heavy_for_express", or Then the value is rejected by …
```

Gate 3 does not run the scenarios. A scenario that fails is a failure of `cucumber-js`, not of `verify`.

## Gate 4: drift

Gate 4 compares each generated file with a new compile.

| Code | Cause | Fix |
| --- | --- | --- |
| `drift` | A generated file is not current, is not there, or is a file that compile no longer makes | Run `npx urn-forge compile`, and commit the result |

```
gate 4  drift         FAIL  1 generated file(s) compared byte for byte against src/generated
    src/generated/domain.generated.ts:418  error  drift  the generated file is not current; run urn-forge compile
    src/generated/old.generated.ts  error  drift  compile no longer makes this file; run urn-forge compile, which removes it
```

## Result

Each gate line shows `PASS`, and the last line is `verify passed (gates 1, 2, 3, 4)`.

## Related pages

- [Verification gates](../reference/verification-gates)
- [Diagnostics](../reference/diagnostics)
- [Run verify in CI](run-verify-in-ci)
