# Build the shipping domain

In this tutorial, you build a small domain in a new project. The domain is `shipping`. It has one operation, `quote_shipping`, that gets a parcel and gives the price to send it. At the end, `urn-forge verify` shows that the generated code, the core and the scenarios agree with the manifest.

Before you start, do the steps in [Tutorials](./).

## 1. Make the project

1. Make a folder for the project, and go into it:

   ```bash
   mkdir my-shipping
   cd my-shipping
   ```

2. Make a `package.json`, and install urn-forge. Give the path of your tarball:

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

The starter project splits a bill. You replace its domain with the shipping domain. You change four files: `urn-forge.config.ts`, `domain.manifest.yaml`, `src/core.ts` and the feature. Keep the other files. All the commands in the tutorials run from the `my-shipping` folder.

## 2. Write the configuration file

Replace the content of `urn-forge.config.ts` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/urn-forge.config.ts

With the default settings, a boundary gap is only a warning. You make it an error in [tutorial 3](./strict-coverage).

## 3. Write the manifest

Replace the content of `domain.manifest.yaml` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/domain.manifest.yaml

The manifest has four parts:

- The header gives the namespace and the domain. They are the start of each URN, for example `urn:demo:shipping:quote:operation:quote_shipping`.
- Each field has a primitive and constraints. For example, `weight_grams` must be an integer from 1 to 30000.
- Each entity is a list of field references. `required: false` makes `express` optional.
- The operation gets a `parcel` and gives a `quote`.

Each key has the format `<context>.<kind>.<identifier>`.

## 4. Compile the manifest

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

The same manifest always gives the same files. Thus, your fingerprint is the same.

## 5. Examine the handler type

Open `src/generated/domain.runtime.generated.ts`. Find these lines:

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
- The handler gets a `ParcelParcel`: the parsed parcel, with a brand on each value.
- The handler returns a `Result`. The error type is `never`, because the operation declares no errors.

Do not edit the generated files. Gate 4 of `verify` finds each manual change.

## 6. Write the core

Replace the content of `src/core.ts` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/src/core.ts

The core is one object. Its key is the operation URN, and it `satisfies` the generated `DomainCoreImplementation`. Thus, TypeScript knows the type of each parameter. The handler returns its output in `ok(…)`.

## 7. Write the feature

Remove the feature of the starter:

```bash
rm features/split.feature
```

Then make the file `features/quote_shipping.feature` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/features/quote_shipping.feature{gherkin}

Examine these parts of the feature:

- The tag on line 1 is the URN of the operation. The steps use it to find the operation, and `verify` uses it to trace the feature to the manifest.
- The table headers are the field names of the input and the output.
- An empty cell sends no value. Thus, the second parcel goes by usual delivery.
- The last scenario sends the weight `0`. The schema refuses it before the core gets the parcel.

The file `features/support/steps.ts` connects these steps to your generated runtime and your core. You do not change it.

## 8. Run Cucumber

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

Cucumber counts each `Examples` row as one scenario.

## 9. Run verify

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

Each gate examines one link:

- **Gate 1** makes sure that the core has a correct handler for each operation.
- **Gate 2** makes sure that the core does not make a branded value without a parse.
- **Gate 3** makes sure that the feature traces to a real operation and uses real field names.
- **Gate 4** makes sure that the generated files are the same as a new compile.

The two warnings are boundary gaps. Your scenarios do not send the values at the edges of the constraints, for example the weight `30001`. You close these gaps in tutorial 3.

## Next

Continue to [tutorial 2: Add a declared error](./declared-errors).

## Related pages

- [The contract](../explanation/the-contract)
- [The manifest](../reference/manifest)
- [Verification gates](../reference/verification-gates)
