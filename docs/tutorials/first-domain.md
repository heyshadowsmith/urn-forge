# Build the shipping domain

In this tutorial, you build a small domain from an empty folder. At the end, `urn-forge verify` shows that each link of the chain is correct: from the manifest, to the generated code, to the core, to the scenarios.

The domain is `shipping`. It has one operation, `quote_shipping`. The operation gets a parcel and gives the price to send it.

Before you start, do the steps in [Tutorials](./). All the commands run from `packages/urn-forge`.

## 1. Make the folder

Make a new folder for your domain:

```bash
mkdir my-shipping
```

The folder is empty. You add each file in the steps that follow.

## 2. Write the configuration file

Make the file `my-shipping/urn-forge.config.ts` with this content:

```ts
import { defineConfig } from 'urn-forge/config';

export default defineConfig({
  manifest: './domain.manifest.yaml',
  out: './generated',
  core: './core.ts',
  features: './features',
  tsconfig: '../tsconfig.json',
});
```

The paths are relative to the configuration file. They tell urn-forge where your manifest, your generated files, your core and your features are. The `tsconfig` path points to `packages/urn-forge/tsconfig.json`. Gate 1 of `verify` uses its compiler options. For each key, refer to [The configuration file](../reference/configuration).

## 3. Write the manifest header

Make the file `my-shipping/domain.manifest.yaml`. Write the header:

```yaml
manifest:
  namespace: demo
  domain: shipping
  version: 0.1.0
```

The namespace and the domain are the start of each URN in this domain. For example, the URN of the operation is `urn:demo:shipping:quote:operation:quote_shipping`.

## 4. Add the fields

Add the four fields below the header:

```yaml
parcel.field.weight_grams:
  primitive: integer
  min: 1
  max: 30000
  description: The weight of the parcel in grams
parcel.field.zone:
  primitive: enum
  values: [domestic, international]
  description: Where the parcel goes
parcel.field.express:
  primitive: boolean
  description: Whether the parcel goes by express delivery
quote.field.price_cents:
  primitive: integer
  min: 0
  description: The price of the delivery in cents
```

Each key has the format `<context>.<kind>.<identifier>`. A field has a primitive and constraints. For example, `weight_grams` must be an integer from 1 to 30000. `zone` is an `enum`: its value must be one of the names in `values`.

## 5. Add the entities

Add the two entities below the fields:

```yaml
parcel.entity.parcel:
  description: A parcel to send
  fields:
    - ref: parcel.field.weight_grams
    - ref: parcel.field.zone
    - ref: parcel.field.express
      required: false
quote.entity.quote:
  description: The price to send a parcel
  fields:
    - ref: quote.field.price_cents
```

An entity is a list of field references. Each field is mandatory, but `required: false` makes `express` optional.

## 6. Add the operation

Add the operation at the end of the file:

```yaml
quote.operation.quote_shipping:
  description: Calculate the price to send a parcel
  input: parcel.entity.parcel
  output: quote.entity.quote
```

The operation gets a `parcel` and gives a `quote`. Your manifest is now complete. Make sure that it is the same as this file:

<<< @/../packages/urn-forge/tutorial/1-first-domain/domain.manifest.yaml

For each key of the manifest, refer to [The manifest](../reference/manifest).

## 7. Compile the manifest

Run this command:

```bash
npx urn-forge compile --config my-shipping/urn-forge.config.ts
```

The command shows this output:

```
wrote      my-shipping/generated/domain.runtime.generated.ts
wrote      my-shipping/generated/domain.schemas.generated.ts
fingerprint sha256:40bd31f60e13cbb2b5a8223690a04d4856b7e8b3c82fb1a732a2af1dbe8f8d92
```

Your fingerprint is the same, because the compile is deterministic. The same manifest always gives the same files.

## 8. Examine the generated files

Open `my-shipping/generated/domain.runtime.generated.ts`. Find the type of the handler and the `DomainCoreImplementation` interface:

```ts
/** urn:demo:shipping:quote:operation:quote_shipping — Calculate the price to send a parcel */
export type QuoteQuoteShippingHandler = (
  input: s.ParcelParcel,
) => Result<s.QuoteQuoteInput, never>;

// Registry

export interface DomainCoreImplementation {
  readonly 'urn:demo:shipping:quote:operation:quote_shipping': QuoteQuoteShippingHandler;
}
```

These lines tell you three things:

- Your core must have one handler for each operation URN.
- The handler gets a `ParcelParcel`. This is the parsed parcel, with a brand on each value.
- The handler returns a `Result`. The second type is `never`, because the operation has no declared errors at this time.

The other file, `domain.schemas.generated.ts`, has a Valibot schema for each field and entity. Do not edit the generated files. Gate 4 of `verify` finds each manual change.

## 9. Write the core

Make the file `my-shipping/core.ts` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/core.ts

The core is one object. Its key is the operation URN, and it `satisfies` the generated `DomainCoreImplementation`. As a result, TypeScript knows the type of each parameter, and you do not write type annotations. The handler returns its output in `ok(…)`.

Line 9 gives `zone` its plain type before line 11 uses it as an object index. The value of `zone` has a brand, and a branded value cannot index an object. For more about this, refer to [Use branded values in the core](../how-to/use-branded-values).

## 10. Write the support file

Make the file `my-shipping/features/support/steps.ts` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/features/support/steps.ts

This file connects the generic Gherkin steps of urn-forge to your generated runtime and your core. The steps call `executeOperation`, which parses the input, calls your handler and parses the output.

## 11. Add a Cucumber profile

Open `packages/urn-forge/cucumber.json`. Add this profile to the top-level object:

```json
  "my-shipping": {
    "paths": [
      "my-shipping/features/**/*.feature"
    ],
    "import": [
      "src/gherkin/register-tsx.mjs",
      "my-shipping/features/support/**/*.ts"
    ],
    "format": [
      "progress"
    ],
    "strict": true
  }
```

Put a comma between this profile and the profile before it. The first `import` entry registers `tsx`. Then Cucumber can load your support file, which is TypeScript.

## 12. Write the feature

Make the file `my-shipping/features/quote_shipping.feature` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/features/quote_shipping.feature{gherkin}

Examine these parts of the feature:

- The tag on line 1 is the URN of the operation. The steps use it to find the operation, and `verify` uses it to trace the feature to the manifest.
- The table headers are field names of the input and the output.
- In the second `Examples` row, the `express` cell is empty. An empty cell sends no value, thus the parcel goes by usual delivery.
- The last scenario sends a weight of `0`. The schema refuses it at the boundary, before the core gets the parcel.

For each step, refer to [Gherkin steps](../reference/gherkin-steps).

## 13. Run Cucumber

Run this command:

```bash
npx cucumber-js --profile my-shipping
```

The command shows this output:

```
...............

5 scenarios (5 passed)
15 steps (15 passed)
0m 0.012s (0m 0.002s executing your code)
```

Cucumber counts each `Examples` row as one scenario. Thus, the Scenario Outline gives four scenarios, and the last scenario gives one.

## 14. Run verify

Run this command:

```bash
npx urn-forge verify --config my-shipping/urn-forge.config.ts
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over my-shipping/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, strict: 0/1 features
    my-shipping/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    my-shipping/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against my-shipping/generated
verify passed with 2 warning(s) (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

Each gate examines one link of the chain:

- **Gate 1** makes sure that the core has a correct handler for each operation.
- **Gate 2** makes sure that the core does not make a branded value without a parse.
- **Gate 3** makes sure that the feature traces to a real operation and uses real field names.
- **Gate 4** makes sure that the generated files are the same as a new compile.

The two warnings are boundary gaps. Your scenarios do not send the values at the edges of the constraints, for example the weight `30001`. A warning does not make a gate fail. You close these gaps in [tutorial 3](./strict-coverage). For each gate, refer to [Verification gates](../reference/verification-gates).

## What you learned

- A manifest declares fields, entities and operations. Each has a short key and a URN.
- `urn-forge compile` makes the schemas and the runtime from the manifest.
- The core is one object that `satisfies` the generated `DomainCoreImplementation`.
- A feature traces to an operation through its URN tag, and its tables use field names.
- `urn-forge verify` examines the chain from the manifest to the scenarios.

## Next

Continue to [tutorial 2: Add a declared error](./declared-errors).

## Related pages

- [The traceability chain](../explanation/traceability)
- [The functional core and brands](../explanation/functional-core)
- [The manifest](../reference/manifest)
- [The CLI](../reference/cli)
- [Use branded values in the core](../how-to/use-branded-values)
