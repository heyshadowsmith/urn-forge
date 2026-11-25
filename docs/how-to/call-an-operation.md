# Call an operation from your application

The shell is the code around your core, for example an HTTP handler, a queue consumer or a CLI. The shell reads the request, and loads the data of the operation into the input. Then it calls the generated `runOperation`, and does an action for the result. It never calls a function of the core directly.

## Handle each result

`runOperation(core, operation, input)` takes an `unknown` input, such as a parsed JSON body. It checks the input and calls the core. Then it checks the answer against the definition and the rules of its output. It does not catch an exception of the core.

| Result | What it tells | What the shell does |
| --- | --- | --- |
| `ok: true` | `output` names the output, and `value` contains it | Send it. A refusal is a normal answer |
| `ok: false`, `kind: 'InputRejected'` | The input breaks a rule | Tell the caller. `failures` names each rule |
| `ok: false`, `kind: 'ContractViolation'` | The core gave an answer that the contract does not allow | This is a bug. Log it, and do not send the answer |

This shell, in `src/shell/http.ts`, answers HTTP requests for the shipping domain of the tutorial:

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

TypeScript narrows `result.value` by `result.output`. If the manifest gets a new output, the `switch` does not cover all cases, and `tsc` reports that a return is not there. The shell selects the status codes. The manifest has no status codes. These are real results:

```json
{"status":200,"body":{"price_cents":800}}
{"status":422,"body":{"weight_grams":6000}}
{"status":400,"body":{"failures":[{"definition":"weight_grams","rule":"minimum","path":"weight_grams","message":"Must be at least 1"},{"definition":"zone","rule":"enum","path":"zone","message":"Must be one of domestic, international"}]}}
```

## A failure

| Property | Value |
| --- | --- |
| `definition` | The definition whose rule broke. For a rule of an output or an operation, it is the operation |
| `rule` | The name of the rule, or a rule of the structure. `type` is a wrong type. `properties` is an unknown key. `required` is a property that is not there. `output` is an answer that is not an output of the operation |
| `path` | The location of the value: `weight_grams`, `contact.email`, `dishes[0].amount`. In an answer, it starts with `output`. It is `''` for the full value, and for a rule of an output or an operation |
| `message` | The `message` of the rule, with its arguments |

## Let gate 2 check the shell

Write the files and folders of the shell in `urn-forge.config.ts`:

```ts
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  coverage: 'error',
  // The shell: gate 2 fails if one of its files calls the core without the harness.
  shell: ['src/shell'],
});
```

Then a direct call in a shell file, such as `core.quote_shipping(body)`, fails `verify`:

```
gate 2  boundary      FAIL  1 core file(s), 1 shell file(s): 1 problem(s)
    src/shell/http.ts:6  error  direct-call  core.quote_shipping runs the core without the harness; call runOperation(core, …), which checks the input and the answer
      fix: Call the core through runOperation(core, operation, input), which checks the input and the answer.
```

## The generated file

`urn-forge compile` writes `domain.generated.ts` (in `src/generated` by default). The file imports only `valibot`, and the same manifest always gives the same bytes. Do not edit the file, because gate 4 finds all edits. The name of a definition in PascalCase is the name of its type. With `Schema` added, it is the name of its schema. For example, `party_size` gives `PartySize` and `PartySizeSchema`.

| Export | What it is |
| --- | --- |
| `<Name>` | The type of each definition |
| `<Name>Schema` | The Valibot schema of each definition, with its rules. It is a [Standard Schema](https://standardschema.dev). tRPC, Hono or a form library can use it. The `requirement` of an issue contains the definition and the rule |
| `check(definition, value)` | Checks one value, for example before the shell stores it. It gives `{ ok: true, value }` or `{ ok: false, failures }` |
| `answer(output, value)` | Makes an answer of the core |
| `DomainCore` | The type of the core: a function for each operation. Your core file exports a value that `satisfies DomainCore` |
| `runOperation(core, operation, input)` | The harness |
| `<Operation>Answer`, `OperationResult`, `Failure`, `CheckResult` | The types of answers, results and failures |
| `Definitions`, `Operations` | The shape of each definition and operation, for the Gherkin steps |

The generated code marks a part with `deprecated: true` as `@deprecated`.
