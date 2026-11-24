# Build the shipping domain

In this tutorial, you build a small domain in a new project. The domain is `shipping`. It has one operation, `quote_shipping`, that gets a parcel and gives the price to send it. At the end, `urn-forge verify` shows that the generated code, the core and the scenarios agree with the manifest.

Before you start, do the steps in [Tutorials](./).

## 1. Make the project

1. Make a folder for the project, and go into it:

   ```bash
   mkdir my-shipping
   cd my-shipping
   ```

2. Make a `package.json`:

   ```bash
   npm init -y
   ```

3. Install urn-forge. Give the path of your tarball:

   ```bash
   npm install /path/to/urn-forge-0.2.0.tgz
   ```

4. Write a starter project:

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
   next: npm install, then npx urn-forge compile, then npx urn-forge verify
   ```

The starter project splits a bill. You replace its domain with the shipping domain. You change four files: `urn-forge.config.ts`, `domain.manifest.yaml`, `src/core.ts` and the feature. Keep the other files. All the commands in the tutorials run from the `my-shipping` folder.

## 2. Write the configuration file

Replace the content of `urn-forge.config.ts` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/urn-forge.config.ts

With the default settings, a gap in the scenarios is only a warning. You make it an error in [tutorial 3](./strict-coverage).

## 3. Write the manifest

Replace the content of `domain.manifest.yaml` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/domain.manifest.yaml

The manifest has three parts:

- The header, `manifest`, gives the namespace, the domain and the version of the contract.
- `definitions` gives each value a name, a `description` and a `type`. The types are the six types of JSON Schema. `rules` lists what must be true of the value. For example, `weight_grams` is an integer, with the rules `minimum: 1` and `maximum: 30000`.
- `operations` gives each operation an `input` and a list of outputs. `quote_shipping` gets a `parcel` and gives a `quote`.

An object, such as `parcel`, lists its properties by the names of other definitions. The rule `required` lists the properties that an object must have. `express` is not in `required`, so a parcel can have no `express`.

`minimum`, `maximum`, `enum` and `required` are standard rules. urn-forge ships them. In tutorial 2, you write rules of your own.

## 4. Compile the manifest

Run this command:

```bash
npx urn-forge compile
```

The command shows this output:

```
wrote      src/generated/domain.generated.ts
```

The same manifest always gives the same file. Do not edit the generated file. Gate 4 of `verify` finds each manual change.

## 5. Examine the generated types

Open `src/generated/domain.generated.ts`. Find these lines:

```ts
/** A parcel to send */
export interface Parcel {
  /** The weight of the parcel in grams */
  readonly weight_grams: WeightGrams;
  /** Where the parcel goes */
  readonly zone: Zone;
  /** Whether the parcel goes by express delivery */
  readonly express?: Express;
}
```

Then find these lines:

```ts
/** The answers of quote_shipping. */
export type QuoteShippingAnswer = Answer<"quote", Quote>;

/** The core: a function for each operation, from its input to one of its answers. */
export interface DomainCore {
  /** Calculate the price to send a parcel */
  readonly quote_shipping: (input: Parcel) => QuoteShippingAnswer;
}
```

These lines tell you three things:

- Your core must have one function for each operation.
- The function gets a `Parcel`. `express` is optional, because the `required` rule of `parcel` does not list it. The type of `zone` is `"domestic" | "international"`, from the `enum` rule.
- The function returns an answer: the name of an output and its value. You make an answer with the generated function `answer`.

## 6. Write the core

Replace the content of `src/core.ts` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/src/core.ts

The core is one object. It has a function for each operation, and it `satisfies` the generated `DomainCore`. Thus, TypeScript knows the type of each parameter. The core does not check the input. The harness, `runOperation`, checks the input before the core runs.

## 7. Write the feature

Remove the feature of the starter:

```bash
rm features/split.feature
```

Then make the file `features/quote_shipping.feature` with this content:

<<< @/../packages/urn-forge/tutorial/1-first-domain/features/quote_shipping.feature{gherkin}

Examine these parts of the feature:

- `When I run "quote_shipping" with:` sends the table to the operation through the harness.
- The table headers are the names of the properties of the input.
- An empty cell sends no value. Thus, the second parcel has no `express`.
- `Then the output is "quote":` expects the output `quote`, with the values of the table.
- `Then the input is rejected by "minimum" of "weight_grams"` expects the harness to refuse the input before the core runs, because the input breaks that rule.
- `When I check a "quote" with:` checks a value against a definition. It does not run the core. Use it for a rule that no input can break, for example a rule of an output.

The file `features/support/steps.ts` connects these steps to your generated file and your core. You do not change it.

## 8. Run Cucumber

Run this command:

```bash
npx cucumber-js
```

The command shows this output:

```
..............................

10 scenarios (10 passed)
30 steps (30 passed)
0m 0.022s (0m 0.005s executing your code)
```

Cucumber counts each `Examples` row as one scenario.

## 9. Run verify

Run this command:

```bash
npx urn-forge verify
```

The command shows this output:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 10 scenario(s), 1/1 operation(s) run, 6 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

Each gate examines one link:

- **Gate 1** makes sure that the core has a function of the correct type for each operation.
- **Gate 2** makes sure that no code calls the core without the harness.
- **Gate 3** makes sure that a scenario runs each operation, gives each output, and breaks each rule of each definition. The manifest applies six rules to definitions, and a scenario breaks each one.
- **Gate 4** makes sure that the generated file is the same as a new compile.

## Next

Continue to [tutorial 2: Add a refusal](./declared-errors).

## Related pages

- [The contract](../explanation/the-contract)
- [The manifest](../reference/manifest)
- [Verification gates](../reference/verification-gates)
