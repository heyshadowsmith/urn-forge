# Call an operation from the shell

The shell is the code around your core: an HTTP handler, a queue consumer, a CLI. It reads the request, loads what the operation needs into the input, calls the generated `runOperation`, and acts on the result. It never calls a function of the core directly.

## Handle each result

`runOperation(core, operation, input)` takes an `unknown` input, such as a parsed JSON body, and gives one of three results:

| Result | Meaning | What the shell does |
| --- | --- | --- |
| `ok: true` | The answer keeps the contract. `output` names the output, `value` holds it | Send it. A refusal is a normal answer |
| `ok: false`, `kind: 'InputRejected'` | The input breaks a rule. The core did not run | Tell the caller; `failures` names each rule |
| `ok: false`, `kind: 'ContractViolation'` | The core answered what the contract does not allow | A bug in the core: log it, do not send the answer |

If the core throws, `runOperation` does not catch the exception.

This shell answers HTTP requests for the shipping domain of the tutorial, in `src/shell/http.ts`:

```ts
import { core } from '../core';
import { runOperation } from '../generated/domain.generated';

/** Answers an HTTP request to quote a parcel. */
export function handleQuote(body: unknown): { status: number; body: unknown } {
  const result = runOperation(core, 'quote_shipping', body);
  if (!result.ok) {
    // The caller sent an input that breaks the contract.
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

TypeScript narrows `result.value` by `result.output`. When the manifest gets a new output, the `switch` no longer covers every case and `tsc` reports the missing return. The status codes are this shell's choice; the manifest has none.

These are real results of `handleQuote`:

```json
{"status":200,"body":{"price_cents":800}}
{"status":422,"body":{"weight_grams":6000}}
{"status":400,"body":{"failures":[{"definition":"weight_grams","rule":"minimum","path":"weight_grams","message":"Must be at least 1"},{"definition":"zone","rule":"enum","path":"zone","message":"Must be one of domestic, international"}]}}
```

## Let gate 2 check the shell

Name the shell's files and folders in `urn-forge.config.ts`:

```ts
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  coverage: 'error',
  // The shell: gate 2 fails if one of its files calls the core without the harness.
  shell: ['src/shell'],
});
```

`verify` then counts the shell file:

```
gate 2  boundary      PASS  1 core file(s), 1 shell file(s): 0 problem(s)
```

A call such as `core.quote_shipping(…)` in a shell file fails the gate:

```
gate 2  boundary      FAIL  1 core file(s), 1 shell file(s): 1 problem(s)
    src/shell/http.ts:20  error  direct-call  core.quote_shipping runs the core without the harness; call runOperation(core, …), which checks the input and the answer
```

## Check a value without an operation

The generated `check(definition, value)` checks one value against one definition, for example before the shell stores it. It gives `{ ok: true, value }` or `{ ok: false, failures }`. Each schema, such as `ParcelSchema`, is also a Standard Schema that a library such as tRPC or a form library can use. Refer to [The generated code](../reference/generated-code).
