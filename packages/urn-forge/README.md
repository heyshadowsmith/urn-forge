# urn-forge

Write the contract of a domain in one YAML manifest, and get a TypeScript harness that checks your code against it on every call, and gates that fail CI when the code, the scenarios or a change break it.

- **Declare** definitions, rules and operations, in JSON Schema's words (`type`, `properties`, `required`, `enum`, `minimum`, …). Write your own rules in a subset of CEL.
- **Generate** one TypeScript file: a type and a Valibot schema for each definition, `check`, and `runOperation`, a harness that checks the input before your core runs and the answer after. Each schema is a Standard Schema, so tRPC, Hono and form libraries can use it. The file imports only `valibot`.
- **Prove** with `urn-forge verify`: the core has a function for each operation, the shell calls it only through the harness, a scenario covers each operation, output and rule, and the generated files are current.
- **Compare** two manifests with `urn-forge diff`: each change is breaking or compatible for callers, judged by semver.
- **Store** objects in Postgres, optionally: a schema with a `CHECK` constraint for each rule that SQL can state, and the statements to write and read the rows, for your own driver.

## Start

Node 22 or newer. urn-forge 0.2.0 is not on npm yet; make the tarball with `npm run pack:tarball` in the repository.

```bash
npm install urn-forge-0.2.0.tgz
npx urn-forge init
npx urn-forge compile
npx urn-forge verify
npx cucumber-js
```

`init` writes a small domain that splits a bill: a manifest, a core, a feature and the config. `verify` passes on it with no warning.

## A manifest

The operation of the starter, and the rules that say when each output comes back:

```yaml
rules:
  shares_add_up:
    description: The shares add up to the total
    rule: output.share_cents * size(input.people) == input.total_cents
    message: The shares do not add up to the total

  total_does_not_divide:
    description: The total does not divide into equal shares
    rule: input.total_cents % size(input.people) != 0
    message: The total divides into equal shares

  names_the_total:
    description: The refusal names the total of the request
    rule: output.total_cents == input.total_cents
    message: The refusal names another total

operations:
  split:
    description: Split a bill into equal shares
    input: split_request
    output:
      - share: [shares_add_up]
      - uneven_split: [total_does_not_divide, names_the_total]
```

## A core

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

## Documentation

The documentation is in the `docs/` folder of the repository: a tutorial, guides for the common tasks, a compact reference, and the reasons behind the design.
