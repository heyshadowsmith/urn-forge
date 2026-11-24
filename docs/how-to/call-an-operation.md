# Call an operation

Call an operation from the shell of your application, for example from an HTTP handler, and handle each result. The shell calls the generated `runOperation`. It never calls a function of the core directly.

## Before you start

- The operation has a function in the core, and `verify` passes. Refer to [Add an operation](add-an-operation).

## Steps

1. Import `core` from your core file, and `runOperation` from the generated file.
2. Put the data that the operation needs in the input: the request, and the stored record, the caller or the time if the input has them. Refer to [Model a stored record, the caller and the time](model-the-input).
3. Call `runOperation(core, '<operation>', input)`. The input can be `unknown`, for example a parsed JSON body. The harness checks it.
4. If `result.ok` is `false` and `result.kind` is `'InputRejected'`, tell the caller that the input is not valid. `result.failures` names each rule that it breaks.
5. If `result.ok` is `false` and `result.kind` is `'ContractViolation'`, the core answered what the contract does not allow. This is a bug in the core. Log it, and do not send the answer.
6. If `result.ok` is `true`, read `result.output` and `result.value`. Handle each output of the operation.
7. Add the shell files to `shell` in `urn-forge.config.ts`, so that gate 2 checks them.

## Example

This shell answers an HTTP request for the shipping domain of the tutorials:

```ts
import { core } from '../core';
import { runOperation } from '../generated/domain.generated';

/** Answers an HTTP request to quote a parcel. */
export function handleQuote(body: unknown): { status: number; body: unknown } {
  const result = runOperation(core, 'quote_shipping', body);
  if (!result.ok) {
    // The caller sent a value that the contract does not allow.
    if (result.kind === 'InputRejected') return { status: 400, body: { failures: result.failures } };
    // The core answered what the contract does not allow: a bug in the core.
    throw new Error(`quote_shipping broke the contract: ${JSON.stringify(result.failures)}`);
  }
  switch (result.output) {
    case 'quote':
      return { status: 200, body: result.value };
    case 'too_heavy_for_express':
      return { status: 422, body: result.value };
  }
}
```

TypeScript narrows `result.value` by `result.output`. If the manifest gets a new output, the `switch` no longer covers each output, and `tsc` reports the missing return.

The HTTP status codes are a choice of this shell. The manifest does not contain them.

Add the folder of the shell to the config:

```ts
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  coverage: 'error',
  // The files of the shell, which gate 2 checks for calls that skip the harness.
  shell: ['src/shell'],
});
```

## Result

For an express parcel of 6000 grams, `handleQuote` returns:

```json
{"status":422,"body":{"weight_grams":6000}}
```

For a parcel of 0 grams, it returns:

```json
{"status":400,"body":{"failures":[{"definition":"weight_grams","rule":"minimum","path":"weight_grams","message":"Must be at least 1"}]}}
```

`npx urn-forge verify` counts the shell file at gate 2:

```
gate 2  boundary      PASS  1 core file(s), 1 shell file(s): 0 problem(s)
```

If a shell file calls `core.quote_shipping(…)` directly, gate 2 fails with `direct-call`.

## Related pages

- [The generated code](../reference/generated-code)
- [The core and the shell](../explanation/core-and-shell)
- [Verification gates](../reference/verification-gates)
