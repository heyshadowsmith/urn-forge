# Add an operation

Add an operation: it takes an input entity and gives an output entity or one of its declared errors.

## Before you start

- Declare the input entity and the output entity. Refer to [Add an entity](add-an-entity).
- Choose the short key: `<context>.operation.<identifier>`, for example `quote.operation.quote_return`.

## Steps

1. Add the entry to the manifest, with a `description`, an `input` and an `output`:

   ```yaml
   arithmetic.operation.safe_divide:
     description: Divide; the divisor is never zero
     input: arithmetic.entity.division
     output: arithmetic.entity.division_result
   ```

2. Run `npx urn-forge compile`. `DomainCoreImplementation` then asks for a handler of the operation.
3. Run `npx urn-forge verify`. Gate 1 fails, because the core has no handler:

   ```
   gate 1  completeness  FAIL  tsc: 1 error(s) over core.ts; `core` satisfies DomainCoreImplementation
       core.ts:18:3  error  type-error  TS1360: Type '{ 'urn:demo:shipping:quote:operation:quote_shipping': … }' does not satisfy the expected type 'DomainCoreImplementation'.
         Property ''urn:demo:shipping:quote:operation:quote_return'' is missing in type '{ … }' but required in type 'DomainCoreImplementation'.
   ```

4. Add a handler to the core object. Its key is the URN of the operation. Return `ok(…)` with a plain output object. Keep the handler synchronous, and do the I/O in the shell.

   <<< @/../packages/urn-forge/example/core.ts

5. Make a `.feature` file. Put `@` and the URN of the operation on the line above `Feature:`. Without it, gate 3 fails with `untagged-operation`.

   <<< @/../packages/urn-forge/example/features/safe_divide.feature{gherkin}

For the steps, refer to [Write scenarios](write-scenarios). To add a refusal, refer to [Declare an error](declare-an-error). To add events, refer to [Emit an event](emit-an-event).

## Result

`npx urn-forge verify` passes, and `npx cucumber-js` runs the scenarios with no failure. To call the operation from your application, refer to [Call an operation from the shell](call-an-operation).

## Related pages

- [The manifest](../reference/manifest)
- [The generated code](../reference/generated-code)
- [The core and the shell](../explanation/core-and-shell)
