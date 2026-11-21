# Build the shipping domain

In this tutorial, you build a small domain in a new project. At the end, `urn-forge verify` shows that each link of the chain is correct: from the manifest, to the generated code, to the core, to the scenarios.

The domain is `shipping`. It has one operation, `quote_shipping`. The operation gets a parcel and gives the price to send it.

Before you start, do the steps in [Tutorials](./).

## 1. Make the project

1. Make a folder for the project, and go into it:

   ```bash
   mkdir my-shipping
   cd my-shipping
   ```

2. Make a `package.json`, and install urn-forge. Give the path of the tarball that you made in [Tutorials](./#before-you-start):

   ```bash
   npm init -y
   npm install /path/to/urn-forge-0.1.0.tgz
   ```

3. Write a starter project:

   ```bash
   npx urn-forge init --namespace demo --domain shipping
   ```

   The command shows this output:

   ```
   wrote      cucumber.json
   wrote      domain.manifest.yaml
   wrote      features/split.feature
   wrote      features/support/steps.ts
   wrote      register-tsx.mjs
   wrote      src/core.ts
   wrote      tsconfig.json
   wrote      urn-forge.config.ts
   updated    package.json
   wrote      src/generated/domain.runtime.generated.ts
   wrote      src/generated/domain.schemas.generated.ts
   fingerprint sha256:6431175d253fe08f43536faf50064c29a29687f59e2bdbcf92d9d7dd9cf83c9c
   next: npm run verify, then npm run test:features
   ```

The starter project splits a bill. In this tutorial, you replace its domain with the shipping domain. You change four files: `urn-forge.config.ts`, `domain.manifest.yaml`, `src/core.ts` and the feature. You keep the other files that `init` wrote:

| File | What it does |
| --- | --- |
| `tsconfig.json` | The compiler options. Gate 1 of `verify` type-checks the core with them |
| `features/support/steps.ts` | Connects the Gherkin steps to your core. You examine it in step 10 |
| `cucumber.json` and `register-tsx.mjs` | Let Cucumber run the features, which use TypeScript |
| `package.json` | `init` added `"type": "module"` and the scripts `compile`, `verify` and `test:features` |

All the commands in the tutorials run from the `my-shipping` folder.

## 2. Write the configuration file

Replace the content of `urn-forge.config.ts` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/urn-forge.config.ts

The file sets no value, so each setting has its default:

| Setting | Default | What it is |
| --- | --- | --- |
| `manifest` | `domain.manifest.yaml` | The manifest |
| `out` | `src/generated` | The folder of the generated files |
| `core` | `src/core.ts` | The core |
| `features` | `features` | The folder of the feature files |
| `tsconfig` | `tsconfig.json` | The compiler options of gate 1 |
| `boundaryCoverage` | `'warn'` | A boundary gap is a warning |

The starter set `boundaryCoverage: 'error'`, so that each boundary gap makes `verify` fail. In this tutorial, a gap is only a warning. In [tutorial 3](./strict-coverage), you set `'error'` again. For each setting, refer to [The configuration file](../reference/configuration).

## 3. Write the manifest header

Replace the content of `domain.manifest.yaml` with this header:

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
npx urn-forge compile
```

The command shows this output:

```
wrote      src/generated/domain.runtime.generated.ts
wrote      src/generated/domain.schemas.generated.ts
fingerprint sha256:40bd31f60e13cbb2b5a8223690a04d4856b7e8b3c82fb1a732a2af1dbe8f8d92
```

Your fingerprint is the same, because the compile is deterministic. The same manifest always gives the same files.

## 8. Examine the generated files

Open `src/generated/domain.runtime.generated.ts`. Find the type of the handler and the `DomainCoreImplementation` interface:

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

Replace the content of `src/core.ts` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/src/core.ts

The core is one object. Its key is the operation URN, and it `satisfies` the generated `DomainCoreImplementation`. As a result, TypeScript knows the type of each parameter, and you do not write type annotations. The handler returns its output in `ok(…)`.

Line 9 gives `zone` its plain type before line 11 uses it as an object index. The value of `zone` has a brand, and a branded value cannot index an object. For more about this, refer to [Use branded values in the core](../how-to/use-branded-values).

## 10. Examine the support file

`init` wrote the file `features/support/steps.ts`. It has this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/features/support/steps.ts

This file connects the generic Gherkin steps of urn-forge to your generated runtime and your core. The steps call `executeOperation`, which parses the input, calls your handler and parses the output. The file imports the paths of the defaults, `src/core.ts` and `src/generated/`. Thus, you do not change it.

## 11. Write the feature

Remove the feature of the starter:

```bash
rm features/split.feature
```

Then make the file `features/quote_shipping.feature` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/features/quote_shipping.feature{gherkin}

Examine these parts of the feature:

- The tag on line 1 is the URN of the operation. The steps use it to find the operation, and `verify` uses it to trace the feature to the manifest.
- The table headers are field names of the input and the output.
- In the second `Examples` row, the `express` cell is empty. An empty cell sends no value, thus the parcel goes by usual delivery.
- The last scenario sends a weight of `0`. The schema refuses it at the boundary, before the core gets the parcel.

For each step, refer to [Gherkin steps](../reference/gherkin-steps).

## 12. Run Cucumber

Run this command:

```bash
npx cucumber-js
```

The command shows this output:

```
...............

5 scenarios (5 passed)
15 steps (15 passed)
0m 0.015s (0m 0.003s executing your code)
```

Cucumber counts each `Examples` row as one scenario. Thus, the Scenario Outline gives four scenarios, and the last scenario gives one.

## 13. Run verify

Run this command:

```bash
npx urn-forge verify
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, strict: 0/1 features
    features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
gate 4  drift         PASS  2 generated file(s) compared byte for byte against src/generated
verify passed with 2 warning(s) (gates 1, 2, 3, 4; gate 5 is urn-forge diff)
```

Each gate examines one link of the chain:

- **Gate 1** makes sure that the core has a correct handler for each operation.
- **Gate 2** makes sure that the core does not make a branded value without a parse.
- **Gate 3** makes sure that the feature traces to a real operation and uses real field names.
- **Gate 4** makes sure that the generated files are the same as a new compile.

The two warnings are boundary gaps. Your scenarios do not send the values at the edges of the constraints, for example the weight `30001`. A warning does not make a gate fail. You close these gaps in [tutorial 3](./strict-coverage). For each gate, refer to [Verification gates](../reference/verification-gates).

## What you learned

- `urn-forge init` makes a project that runs. You replace its domain with your domain.
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
