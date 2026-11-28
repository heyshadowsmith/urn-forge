# urn-forge

Coding agents write the code. You own the contract. urn-forge generates a harness that checks the code against the contract on each call. Its gates fail CI when the code, the scenarios or a change break the contract.

- **State the rules** of a domain in one short contract that you review: the values, the operations, the answers of each operation, and named rules with messages.
- **Let the agent write the code.** `init` writes an `AGENTS.md` for any coding agent and a skill for Claude Code. Each problem has a stable code and one sentence that says what to do, as text or JSON.
- **Generate** one TypeScript file with no dependency: a type and a check for each definition, and `runOperation`. This harness checks the input before the code runs, and the answer after it.
- **Prove** with `urn-forge verify` that the contract and the code agree. The core has a function for each operation, and the shell calls it only through the harness. Scenarios cover each operation, answer and rule, and the generated files are current. Gate 5 fails a change that removes a rule, an answer or a scenario without a new version. `urn-forge diff` fails a change that breaks callers, unless the major version increases.

## Start

You must have Node 22 or newer. urn-forge 0.2.3 is not on npm yet. To make the tarball, run `npm run pack:tarball` in the repository.

```bash
npm init -y
npm install urn-forge-0.2.3.tgz
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

The documentation is in the [`docs/` folder of the repository](https://github.com/heyshadowsmith/urn-forge/tree/main/docs). It has the methodology, and a reference of the manifest, the rule syntax and the CLI.
