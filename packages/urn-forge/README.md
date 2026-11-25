# urn-forge

Write the contract of a domain in one YAML manifest. urn-forge generates a TypeScript harness that checks your code against it on every call, and gates that fail CI when the code, the scenarios or a change break it.

- **Declare** definitions, rules and operations in JSON Schema's words (`type`, `properties`, `required`, `enum`, `minimum`, …), and your own rules in a subset of CEL.
- **Generate** one TypeScript file: a type and a Valibot schema (a Standard Schema) for each definition, and `runOperation`, a harness that checks the input before your core runs and the answer after. It imports only `valibot`.
- **Prove** with `urn-forge verify`: the core has a function for each operation, the shell calls it only through the harness, scenarios cover each operation, output and rule, and the generated files are current. `urn-forge diff` fails a change that breaks callers without a new major version.
- **Store** objects in Postgres, optionally: a schema with the rules as `CHECK` constraints, and the statements to write and read the rows.

## Start

Node 22 or newer. urn-forge 0.2.0 is not on npm yet; make the tarball with `npm run pack:tarball` in the repository.

```bash
npm install urn-forge-0.2.0.tgz
npx urn-forge init
npx urn-forge compile
npx urn-forge verify
npx cucumber-js
```

`init` writes a small domain that splits a bill. Its operation, and the rules that say when each output comes back:

```yaml
operations:
  split:
    description: Split a bill into equal shares
    input: split_request
    output:
      - share: [shares_add_up]
      - uneven_split: [total_does_not_divide, names_the_total]
```

Its core is a plain function, typed by the generated `DomainCore`:

```ts
import { answer, type DomainCore } from './generated/domain.generated';

export const core = {
  split: ({ total_cents, people }) => {
    if (total_cents % people.length !== 0) return answer('uneven_split', { total_cents });
    return answer('share', { share_cents: total_cents / people.length });
  },
} satisfies DomainCore;
```

The shell calls `runOperation(core, 'split', input)`. The result is the answer, `InputRejected` for an input that breaks a rule, or `ContractViolation` for an answer that breaks the contract.

The documentation, in the repository's `docs/` folder, has a tutorial, guides, a reference, and the reasons behind the design.
