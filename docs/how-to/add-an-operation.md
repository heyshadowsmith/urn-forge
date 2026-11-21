# Add an operation

An operation takes an input entity and gives an output entity and its events, or one of its declared errors. This guide adds an operation to the manifest, writes its handler in the core, and tags a feature with its URN.

The examples come from the math example: [`packages/urn-forge/tests/fixtures/math/domain.manifest.yaml`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/math/domain.manifest.yaml), [`packages/urn-forge/example/core.ts`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/example/core.ts) and [`packages/urn-forge/example/features/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/example/features/).

## Before you start

- Declare the input entity and the output entity. Refer to [Add an entity](add-an-entity).
- Choose the short key of the operation: `<context>.operation.<identifier>`, for example `arithmetic.operation.safe_divide`. Its URN is `urn:<namespace>:<domain>:<context>:operation:<identifier>`.

## 1. Write the operation entry

Add the entry to the manifest. Give a `description`, an `input` and an `output`:

<<< @/../packages/urn-forge/tests/fixtures/math/domain.manifest.yaml{yaml}

- `input` and `output` are short keys of entities.
- One entity can be the input or the output of more than one operation.
- To add declared errors, refer to [Declare an error](declare-an-error).
- To add events, list them under `emits`. Refer to [Emit an event](emit-an-event).

For the full rules, refer to [The manifest](../reference/manifest).

## 2. Compile

Run this command:

```bash
npx urn-forge compile
```

`compile` adds a handler type for the operation to `domain.runtime.generated.ts`, and adds the operation to `DomainCoreImplementation`.

## 3. Write the handler

Run `npx urn-forge verify`. Before you write the handler, gate 1 fails, because the core does not satisfy `DomainCoreImplementation`. This output comes from the shipping domain of the tutorials, after you add the operation `quote.operation.quote_return`:

```
gate 1  completeness  FAIL  tsc: 1 error(s) over core.ts; `core` satisfies DomainCoreImplementation
    core.ts:18:3  error  type-error  TS1360: Type '{ 'urn:demo:shipping:quote:operation:quote_shipping': … }' does not satisfy the expected type 'DomainCoreImplementation'.
      Property ''urn:demo:shipping:quote:operation:quote_return'' is missing in type '{ … }' but required in type 'DomainCoreImplementation'.
```

Add a handler to the core object. Its key is the URN of the operation:

<<< @/../packages/urn-forge/example/core.ts

The handler rules:

- The handler gets the input entity, parsed and branded. Refer to [Use branded values in the core](use-branded-values).
- The handler returns `ok(…)` with a plain output object, or `fail(…)` with a declared error. If the operation has `emits`, give `ok` a list of events as its second argument.
- The handler is synchronous. Do the I/O in the shell, not in the handler.

For the handler types, refer to [The generated runtime](../reference/generated-runtime).

## 4. Tag a feature with the URN

Gate 3 needs at least one feature or scenario for each operation. Without one, it fails. This is the output for `quote_return`:

```
features  error  untagged-operation  operation urn:demo:shipping:quote:operation:quote_return has no feature or scenario tagged @urn:demo:shipping:quote:operation:quote_return
```

Make a `.feature` file. Put `@` and the URN of the operation on the line above `Feature:`:

<<< @/../packages/urn-forge/example/features/safe_divide.feature{gherkin}

The tag tells the generic steps which operation to run. For the steps, refer to [Write scenarios](write-scenarios).

## Result

1. Run `npx urn-forge verify`. Gate 1 and gate 3 pass.
2. Run the scenarios with `npx cucumber-js`. All scenarios pass.

To call the operation from your application, refer to [Call an operation from the shell](call-an-operation).

## Related pages

- [The manifest](../reference/manifest)
- [The generated runtime](../reference/generated-runtime)
- [Write scenarios](write-scenarios)
- [Declare an error](declare-an-error)
- [The functional core and brands](../explanation/functional-core)
