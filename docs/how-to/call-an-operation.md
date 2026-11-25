# Call an operation from your application

The shell is the code around your core: an HTTP handler, a queue consumer, a CLI. It reads the request, loads what the operation needs into the input, calls the generated `runOperation`, and acts on the result. It never calls a function of the core directly.

## Handle each result

`runOperation(core, operation, input)` takes an `unknown` input, such as a parsed JSON body. It checks the input, calls the core, then checks the answer against its output's definition and rules. It does not catch an exception of the core.

| Result | Meaning | What the shell does |
| --- | --- | --- |
| `ok: true` | `output` names the output, `value` holds it | Send it. A refusal is a normal answer |
| `ok: false`, `kind: 'InputRejected'` | The input breaks a rule | Tell the caller; `failures` names each rule |
| `ok: false`, `kind: 'ContractViolation'` | The core answered what the contract does not allow | A bug: log it, do not send the answer |

This shell answers HTTP requests for the tutorial's shipping domain, in `src/shell/http.ts`:

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

TypeScript narrows `result.value` by `result.output`. When the manifest gets a new output, the `switch` no longer covers every case and `tsc` reports the missing return. The status codes are the shell's choice; the manifest has none. Real results:

```json
{"status":200,"body":{"price_cents":800}}
{"status":422,"body":{"weight_grams":6000}}
{"status":400,"body":{"failures":[{"definition":"weight_grams","rule":"minimum","path":"weight_grams","message":"Must be at least 1"},{"definition":"zone","rule":"enum","path":"zone","message":"Must be one of domestic, international"}]}}
```

## A failure

| Property | Value |
| --- | --- |
| `definition` | The definition whose rule broke; for a rule of an output or an operation, the operation |
| `rule` | The rule's name, or a rule of the structure: `type` (a wrong type), `properties` (an unknown key), `required` (a missing property), `output` (an answer that is not an output of the operation) |
| `path` | Where the value is: `weight_grams`, `contact.email`, `dishes[0].amount`. In an answer, it starts with `output`. It is `''` for the whole value and for a rule of an output or an operation |
| `message` | The rule's `message`, with its arguments |

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

A direct call such as `core.quote_shipping(body)` in a shell file then fails `verify`:

```
gate 2  boundary      FAIL  1 core file(s), 1 shell file(s): 1 problem(s)
    src/shell/http.ts:6  error  direct-call  core.quote_shipping runs the core without the harness; call runOperation(core, …), which checks the input and the answer
```

## The generated file

`urn-forge compile` writes `domain.generated.ts` (in `src/generated` by default). It imports only `valibot`, and the same manifest always gives the same bytes. Do not edit it: gate 4 finds any edit. A definition's name in PascalCase gives its type, and with `Schema`, its schema: `party_size` gives `PartySize` and `PartySizeSchema`.

| Export | What it is |
| --- | --- |
| `<Name>` | The type of each definition |
| `<Name>Schema` | The Valibot schema of each definition, with its rules. It is a [Standard Schema](https://standardschema.dev), so tRPC, Hono or a form library can take it. An issue's `requirement` holds the definition and the rule |
| `check(definition, value)` | Checks one value, for example before the shell stores it: `{ ok: true, value }` or `{ ok: false, failures }` |
| `answer(output, value)` | Makes an answer of the core |
| `DomainCore` | The type of the core: a function for each operation. Your core file exports a value that `satisfies DomainCore` |
| `runOperation(core, operation, input)` | The harness |
| `<Operation>Answer`, `OperationResult`, `Failure`, `CheckResult` | The types of answers, results and failures |
| `Definitions`, `Operations` | The shape of each definition and operation, for the Gherkin steps |

A piece with `deprecated: true` is marked `@deprecated`.
