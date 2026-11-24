# urn-forge

Write the contract of a domain in one YAML manifest, and get a TypeScript harness that checks your code against it.

- **Declare** definitions, rules and operations, in the words of JSON Schema (`type`, `properties`, `required`, `enum`, `minimum`, …). Write your own rules in a subset of CEL.
- **Generate** one TypeScript file with no dependencies: a type and a check for each definition, and `runOperation`, a harness that checks the input before your core runs and the answer after it.
- **Prove** with `urn-forge verify`: the core has a function for each operation, the shell calls it only through the harness, a scenario covers each output and each rule, and the generated files are current.
- **Compare** two manifests with `urn-forge diff`: each change is breaking or compatible for callers, judged by semver.
- **Store** objects in Postgres: an optional schema with a `CHECK` constraint for each rule that SQL can state.

## Start

Node 22 or newer.

```bash
npm install urn-forge-0.2.0.tgz
npx urn-forge init
npx urn-forge compile
npx urn-forge verify
npx cucumber-js
```

`init` writes a small domain that splits a bill, with a manifest, a core, a feature and the config. `verify` passes on it with no warning.

## A manifest

```yaml
manifest:
  namespace: demo
  domain: shipping
  version: 0.1.0

definitions:
  weight_grams:
    description: The weight of the parcel in grams
    type: integer
    rules:
      - minimum: 1
      - maximum: 30000

  parcel:
    description: A parcel to send
    type: object
    properties: [weight_grams]
    rules:
      - required: [weight_grams]

  price_cents:
    description: The price of the delivery in cents
    type: integer
    rules:
      - minimum: 0

  quote:
    description: The price to send a parcel
    type: object
    properties: [price_cents]
    rules:
      - required: [price_cents]

operations:
  quote_shipping:
    description: Calculate the price to send a parcel
    input: parcel
    output:
      - quote: []
```

## A core

```ts
import { answer, type DomainCore } from './generated/domain.generated';

export const core = {
  quote_shipping: ({ weight_grams }) => answer('quote', { price_cents: 500 + Math.ceil(weight_grams / 1000) * 100 }),
} satisfies DomainCore;
```

The shell calls `runOperation(core, 'quote_shipping', input)`. The result is the answer, `InputRejected` for an input that breaks a rule, or `ContractViolation` for an answer that breaks the contract.

## Documentation

The documentation is in the `docs/` folder of the repository: three tutorials, how-to guides, a reference of each key and diagnostic, and the reasons behind the design.
