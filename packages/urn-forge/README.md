# urn-forge

Write the contract of a domain in one YAML manifest. urn-forge generates a TypeScript harness that checks your code against the contract on each call. It also gives gates that fail CI when the code, the scenarios or a change break the contract.

- **Declare** definitions, rules and operations with the words of JSON Schema (`type`, `properties`, `required`, `enum`, `minimum`, …). Write your own rules in a subset of CEL.
- **Generate** one TypeScript file: a type and a Valibot schema (a Standard Schema) for each definition, and `runOperation`. This harness checks the input before your core runs, and the answer after it. The file imports only `valibot`.
- **Prove** with `urn-forge verify` that the contract and the code agree. The core has a function for each operation, and the shell calls it only through the harness. Scenarios cover each operation, output and rule, and the generated files are current. `urn-forge diff` fails a change that breaks callers, unless the major version increases.
- **Store** objects in Postgres, if you want. urn-forge writes a schema with the rules as `CHECK` constraints. It also writes the statements that write and read the rows.

## Start

You must have Node 22 or newer. urn-forge 0.2.0 is not on npm yet. To make the tarball, run `npm run pack:tarball` in the repository.

```bash
npm install urn-forge-0.2.0.tgz
npx urn-forge init
npx urn-forge compile
npx urn-forge verify
npx cucumber-js
```

`init` writes a small domain that splits a bill. This is its operation, with the rules that are true for each output:

```yaml
operations:
  split:
    description: Split a bill into equal shares
    input: split_request
    output:
      - share: [shares_add_up]
      - uneven_split: [total_does_not_divide, names_the_total]
```

Its core is a plain function. Its type is the generated `DomainCore`:

```ts
import { answer, type DomainCore } from './generated/domain.generated';

export const core = {
  split: ({ total_cents, people }) => {
    if (total_cents % people.length !== 0) return answer('uneven_split', { total_cents });
    return answer('share', { share_cents: total_cents / people.length });
  },
} satisfies DomainCore;
```

The shell calls `runOperation(core, 'split', input)`. The result is one of three: the answer; `InputRejected` for an input that breaks a rule; or `ContractViolation` for an answer that breaks the contract.

The documentation is in the `docs/` folder of the repository. It has a tutorial, guides, a reference, and the reasons for the design.
