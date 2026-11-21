# Call an operation from the shell

The shell is the code that calls the core, for example an HTTP handler. It calls `executeOperation` from the generated runtime. `executeOperation` parses the input, calls the handler, and parses the output and the events, or the declared error. This guide calls an operation and turns each result into an HTTP response. It also parses a single value, and lets gate 2 examine the shell.

The examples use the shipping domain of `packages/urn-forge/tutorial/2-declared-errors/`.

## Before you start

- You have a core that uses `satisfies DomainCoreImplementation`. Refer to [Add an operation](add-an-operation).
- You have compiled the manifest. The shell imports `executeOperation` from `domain.runtime.generated.ts`.

## 1. Call `executeOperation`

Give `executeOperation` three arguments:

1. The URN of the operation.
2. The raw payload, for example the parsed JSON body of a request. Its type is `unknown`.
3. The core.

```ts
const result = executeOperation(urn, body, core);
```

`executeOperation` does not throw for a bad payload. It always returns a result object.

## 2. Switch on `ok` and `kind`

The result has one of five forms:

| `ok` | `kind` | Meaning | Data |
| --- | --- | --- | --- |
| `true` | | The handler returned `ok(…)`, and the output and the events are valid | `output`, parsed and branded. `events`, each with `urn` and `fields` |
| `false` | `UnknownOperation` | The URN names no operation of the domain | `issues` |
| `false` | `InputRejected` | The payload does not match the input schema. The handler did not run | `issues`, each with `path`, `fieldUrn` and `message` |
| `false` | `DomainError` | The handler returned a declared error | `error`. If the error has `recordAs`, `error.record` has the event |
| `false` | `ContractViolation` | The core has a bug: no handler, no `Result`, an undeclared error or event, or an output or event that does not match its schema | `issues` |

First check `ok`. Then switch on `kind`. TypeScript narrows the type in each `case`.

## 3. Map each result to a response

This function turns each result into an HTTP status and a body:

```ts
import { core } from './core';
import { executeOperation, type ErrorCategory } from './generated/domain.runtime.generated';

const STATUS: Record<ErrorCategory, number> = {
  validation: 422,
  conflict: 409,
  not_found: 404,
  forbidden: 403,
  precondition: 422,
};

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export function handle(urn: string, body: unknown): HttpResponse {
  const result = executeOperation(urn, body, core);
  if (result.ok) return { status: 200, body: result.output };
  switch (result.kind) {
    case 'UnknownOperation':
      return { status: 404, body: { issues: result.issues } };
    case 'InputRejected':
      return { status: 400, body: { issues: result.issues } };
    case 'DomainError': {
      const { urn: error, category, retryable, message, fields } = result.error;
      return { status: STATUS[category], body: { error, message, retryable, fields } };
    }
    case 'ContractViolation':
      console.error(result.urn, result.issues);
      return { status: 500, body: { message: 'internal error' } };
  }
}
```

- **The category** of a declared error comes from the manifest. Choose one status for each category. A `Record<ErrorCategory, number>` makes `tsc` find a category that has no status.
- **`retryable`** tells the caller if the same call can succeed later. Send it to the caller, or use it to set a retry policy.
- **`message`** is the template of the error, with the field values in the placeholders. You can show it to a person.
- **`ContractViolation`** is a bug in the core, not an error of the caller. Write it to the log, and do not show the issues to the caller.

If the shell keeps the output in Postgres, write it after `ok` is `true`. Refer to [Store entities in Postgres](store-in-postgres).

## 4. Publish the events and the records

If the operation lists events under `emits`, publish `result.events` after a success. If a declared error has `recordAs`, publish `result.error.record` after the refusal. The shipping domain has no events, so this example uses the insurance domain of `packages/urn-forge/insurance/`:

```ts
import { core } from './core';
import { executeOperation } from './generated/domain.runtime.generated';

/** Your publisher, for example a message queue or an outbox table. */
declare function publish(urn: string, fields: unknown): void;

export function cancel(body: unknown): unknown {
  const result = executeOperation('urn:acme:insurance:policy:operation:cancel_policy', body, core);
  if (result.ok) {
    for (const event of result.events) publish(event.urn, event.fields);
    return result.output;
  }
  if (result.kind === 'DomainError' && result.error.record) {
    publish(result.error.record.urn, result.error.record.fields);
  }
  return result;
}
```

- **`events`** has the events in the order that the handler gave them. Each event is parsed and branded, and its `fields` include `kind`.
- **`record`** is there only if the error has `recordAs`. It is not an event of the operation. Keep it apart, for example in an audit trail.
- If an event is not correct, the result is `ContractViolation`, and the shell gets no output and no event.

[Emit an event](emit-an-event) shows the real values of `events` and `record`.

## 5. Parse a value outside an operation

The shell can read a value that is not the input of an operation, for example a weight from a query string. Parse the value with its generated schema. The schema gives the branded value. Add this function to `shell.ts`, the file of step 3:

```ts
import * as v from 'valibot';
import { ParcelWeightGramsSchema } from './generated/domain.schemas.generated';

/** A weight from a query string, for example `?weight_grams=2500`. */
export function weightFrom(text: string) {
  const parsed = v.safeParse(ParcelWeightGramsSchema, Number(text));
  return parsed.success ? parsed.output : undefined;
}
```

- `weightFrom('2500')` gives `2500`, with the brand of `weight_grams`. `weightFrom('0')` and `weightFrom('abc')` give `undefined`.
- The shell can import `valibot` and the generated schemas, because the shell parses values. The core cannot. Gate 2 refuses it with `core-parser-import`.
- Do not use a type assertion, such as `Number(text) as ParcelWeightGrams`. The value then has a brand, but no schema parsed it.

## 6. Connect the function to a server

This example uses `node:http`. The path of the request is the URN of the operation:

```ts
import { createServer } from 'node:http';
import { handle } from './shell';

createServer((request, response) => {
  let text = '';
  request.on('data', (chunk) => (text += chunk));
  request.on('end', () => {
    const urn = decodeURIComponent((request.url ?? '/').slice(1));
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
    const { status, body: payload } = handle(urn, body);
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(payload));
  });
}).listen(3000);
```

Start it with `npx tsx server.ts`.

## 7. Let gate 2 examine the shell

Gate 2 makes sure that no code makes a branded value without a parse. By default, it examines only the core. To make it examine the shell too, set `shell` in the config. Give a list of files or folders, relative to the config file:

```ts
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  manifest: './domain.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../../tsconfig.json',
  shell: ['./shell.ts', './server.ts'],
});
```

A folder adds each TypeScript file in it, at all depths. Gate 2 does not examine the generated files.

Run `verify`. The output that follows comes from a copy of `tutorial/2-declared-errors/` with `shell.ts`, `server.ts` and this config. The gate 2 summary counts the shell files:

```bash
npx urn-forge verify --config tutorial/2-declared-errors/urn-forge.config.ts
```

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/2-declared-errors/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 2 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
    tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    tutorial/2-declared-errors/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against tutorial/2-declared-errors/generated
verify passed with 2 warning(s) (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

If `weightFrom` returns `Number(text) as ParcelWeightGrams`, gate 2 fails:

```
gate 2  boundary      FAIL  1 core file(s), 2 shell file(s): 1 problem(s)
    tutorial/2-declared-errors/shell.ts:39:10  error  brand-assertion  Number(text) as ParcelWeightGrams asserts the branded type ParcelWeightGrams; only a generated parser makes a branded value
```

In the shell, gate 2 refuses a type assertion to a branded type, an `any` where a branded type belongs, and a comment that turns off a type check. For each code, refer to [Fix a gate that fails](fix-a-failing-gate).

## Result

Send a request for each case. The commands run from a second terminal.

A valid parcel gives the output:

```bash
curl -i -X POST localhost:3000/urn:demo:shipping:quote:operation:quote_shipping -d '{"weight_grams":2500,"zone":"domestic"}'
```

```
HTTP/1.1 200 OK
content-type: application/json

{"price_cents":800}
```

A weight of `0` is out of range, so the shell rejects the input:

```
HTTP/1.1 400 Bad Request
content-type: application/json

{"issues":[{"path":"weight_grams","fieldUrn":"urn:demo:shipping:parcel:field:weight_grams","message":"Invalid value: Expected >=1 but received 0"}]}
```

An express parcel of 6000 grams gives the declared error:

```
HTTP/1.1 422 Unprocessable Entity
content-type: application/json

{"error":"urn:demo:shipping:quote:error:too_heavy_for_express","message":"An express parcel can weigh 5000 grams at most, not 6000","retryable":false,"fields":{"kind":"urn:demo:shipping:quote:error:too_heavy_for_express","weight_grams":6000}}
```

A URN that is not an operation of the domain:

```
HTTP/1.1 404 Not Found
content-type: application/json

{"issues":[{"path":"","message":"unknown operation urn:demo:shipping:quote:operation:nothing"}]}
```

The response headers above do not show `date`, `connection`, `keep-alive` and `content-length`.

## Related pages

- [The generated runtime](../reference/generated-runtime)
- [Results and declared errors](../explanation/results-and-errors)
- [The functional core and brands](../explanation/functional-core)
- [Declare an error](declare-an-error)
- [Store entities in Postgres](store-in-postgres)
