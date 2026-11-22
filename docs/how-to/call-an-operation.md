# Call an operation from the shell

Call an operation from the shell, for example from an HTTP handler, and turn each result into a response.

## Before you start

- You have a core that uses `satisfies DomainCoreImplementation`. Refer to [Add an operation](add-an-operation).
- You have compiled the manifest. The shell imports `executeOperation` from `domain.runtime.generated.ts`.

## Steps

1. Call `executeOperation` with the URN of the operation, the raw payload and the core. It does not throw for a bad payload. It always returns a result.
2. Check `ok`. If it is `true`, use `result.output`.
3. If `ok` is `false`, switch on `kind`. TypeScript narrows the type in each `case`:

   | `kind` | Meaning |
   | --- | --- |
   | `UnknownOperation` | The URN names no operation of the domain |
   | `InputRejected` | The payload does not match the input schema. The handler did not run. `issues` gives each `path`, `fieldUrn` and `message` |
   | `DomainError` | The handler returned a declared error. `error` gives its `urn`, `category`, `retryable`, `message` and `fields` |
   | `ContractViolation` | The core has a bug, for example an output that does not match its schema. Write it to the log. Do not show it to the caller |

4. Set `shell` in `urn-forge.config.ts`, so that gate 2 examines the shell files too:

   ```ts
   import { defineConfig } from 'urn-forge/config';

   export default defineConfig({
     shell: ['./src/shell.ts', './src/server.ts'],
   });
   ```

5. Run `npx urn-forge verify`. Gate 1 type-checks only the core, so also run `npx tsc --noEmit -p .` over the whole project.

To parse a single value outside an operation, parse it with its generated schema, for example `v.safeParse(ParcelWeightGramsSchema, Number(text))`. Do not use a type assertion such as `as ParcelWeightGrams`. Gate 2 refuses it.

To publish events after a success, refer to [Emit an event](emit-an-event). To keep the output in Postgres, refer to [Store entities in Postgres](store-in-postgres).

## Example

`src/shell.ts` maps each result of the shipping domain of tutorial 2 to an HTTP status:

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

A `Record<ErrorCategory, number>` makes `tsc` find a category that has no status.

`src/server.ts` uses the path of the request as the URN of the operation:

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

Start it with `npx tsx src/server.ts`.

## Result

The gate 2 summary counts the shell files:

```
gate 2  boundary      PASS  1 core file(s), 2 shell file(s): 0 problem(s)
```

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

The response headers above do not show `date`, `connection`, `keep-alive` and `content-length`.

## Related pages

- [The generated code](../reference/generated-code)
- [The core and the shell](../explanation/core-and-shell)
- [Declare an error](declare-an-error)
