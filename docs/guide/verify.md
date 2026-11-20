# Verification gates

`urn-forge verify` checks every link in the chain statically: it reads files and type-checks them, but runs nothing. It first compiles the manifest; if that fails, it prints the diagnostics and runs no gate. Then it runs three gates, reports each one, and exits `1` if any failed.

```
gate 1  completeness  PASS  tsc: 0 error(s) over example/core.ts; `core` satisfies DomainCoreImplementation
gate 3  gherkin       PASS  2 feature(s), 4 scenario(s), 2/2 operations tagged
gate 4  drift         PASS  2 generated file(s) compared byte for byte against example/generated
verify passed (gates 1, 3, 4; gates 2 and 5 are not in the MVP)
```

Gates 2 (the lint profile) and 5 (compatibility against the previous manifest) are in the spec but not in the MVP.

## Gate 1: completeness

**Every operation has a handler of the generated type.**

1. Type-checks the core entry (`--core`) with the compiler options from `--tsconfig`. Because the core uses `satisfies DomainCoreImplementation`, a missing, extra or mistyped handler is a type error.
2. Checks that the core file exports a value declared as `… satisfies DomainCoreImplementation`, and that the name resolves to the interface in the generated runtime file. Without this check, deleting the `satisfies` clause would silently switch the gate off. A look-alike interface declared elsewhere doesn't count.

Both `export const core = …` and `export default …` are accepted, and so is a namespace-qualified type such as `rt.DomainCoreImplementation`.

```
gate 1  completeness  FAIL  tsc: 1 error(s) over example/core.ts; `core` satisfies DomainCoreImplementation
    example/core.ts(6,3): error TS1360: Type '{ … }' does not satisfy the expected type 'DomainCoreImplementation'.
      Property ''urn:demo:math:arithmetic:operation:safe_divide'' is missing in type '{ … }' but required in type 'DomainCoreImplementation'.
```

## Gate 3: Gherkin traceability

**Features trace to real URNs, and their tables use real field names.** It reads every `.feature` file under `--features`.

1. **Tags.** Every `@urn:…` tag must resolve to a URN in the manifest, and every operation must be tagged on at least one feature or scenario.
2. **Headers.** In a scenario tagged with an operation, every step table header and every `Examples` header must be a property of the operation's input or output entity. Under an entity tag, headers must be that entity's properties. Tags are inherited from the feature, `Rule` and `Examples` blocks.

A scenario with more than one operation or entity tag fails, because the steps need exactly one.

```
gate 3  gherkin       FAIL  2 feature(s), 4 scenario(s), 2/2 operations tagged
    example/features/safe_divide.feature:6:22  table header "denominator" is not a field key of the input or output of urn:demo:math:arithmetic:operation:safe_divide (allowed: dividend, divisor, quotient)
```

Gate 3 counts AST scenarios, where each Scenario Outline counts once. Cucumber counts every `Examples` row, so its scenario count is higher.

## Gate 4: drift

**The committed generated files equal a fresh compile.** It compiles into a temp directory with the same writer `compile` uses, then compares each file byte for byte with the copy in `--out`.

It reports:

- **A file that differs,** with the first differing line. This means it was hand-edited, or the manifest changed and nobody recompiled.
- **A file that's missing.**
- **A leftover file:** a `*.generated.*` file that the current compile doesn't produce.

```
gate 4  drift         FAIL  2 generated file(s) compared byte for byte against example/generated
    example/generated/domain.schemas.generated.ts:21  differs from a fresh compile (hand-edited or stale); run `urn-forge compile`
```

The fix is always to run `urn-forge compile` and commit the result.

## What each gate catches

These are the seeded failures from the MVP's definition of done. Each turns CI red at its own gate:

| Sabotage | Caught by |
| --- | --- |
| Delete the `safe_divide` handler from `core.ts` | Gate 1 |
| Rename the `divisor` column to `denominator` in the feature | Gate 3 |
| Hand-edit `domain.schemas.generated.ts` | Gate 4 |

Gate 3 shows that the scenarios exist and use the right names. Cucumber shows whether they pass. CI runs both.
