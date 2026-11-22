# Use branded values in the core

Read and compare the branded input of a handler, and return plain output.

## Before you start

- You have a handler in a core that uses `satisfies DomainCoreImplementation`. Refer to [Add an operation](add-an-operation).

## Steps

1. Use a branded value as its plain type. Arithmetic, comparisons, `===` and `switch` work with no change.
2. To use an `enum` value as an object key, assign it to a constant with the plain union type first. Then use the constant as the key.
3. To calculate with a `decimal` or a `date`, import `urn-forge/exact`. These values are strings, so `+` and `<` work on them as text.
4. Give a link to a function that takes the type of the key field of its target, for example `CustomerCustomerId`. `tsc` refuses the identifier of a different entity.
5. Give plain values to `ok(…)` and `fail(…)`. `executeOperation` parses them and adds the brands.
6. Do not make a branded value in the core. Use the plain type for a fixed value, for example `const LIGHT = 1000;`. Parse a value from outside in the shell.

## Example

The core of tutorial 1 uses `zone` as an object key (highlighted):

<<< @/../packages/urn-forge/tutorial/1-first-domain/src/core.ts{8,9,11}

Without the constant, `BASE_CENTS[zone]` fails gate 1:

```
core.ts:9:19  error  type-error  TS7053: Element implicitly has an 'any' type because expression of type '("domestic" | "international") & Brand<"urn:demo:shipping:parcel:field:zone">' can't be used to index type '{ readonly domestic: 500; readonly international: 1500; }'.
```

A core that makes branded values without a parse passes gate 1, but fails gate 2:

```ts
import type { ParcelWeightGrams } from './generated/domain.schemas.generated';

const LIGHT = 1000 as ParcelWeightGrams;
const HEAVY: ParcelWeightGrams = JSON.parse('30000');
```

```
gate 2  boundary      FAIL  1 core file(s), 0 shell file(s): 2 problem(s)
    tutorial/1-first-domain/src/core.ts:6:15  error  brand-assertion  1000 as ParcelWeightGrams asserts the branded type ParcelWeightGrams; only a generated parser makes a branded value
    tutorial/1-first-domain/src/core.ts:7:34  error  brand-from-any  JSON.parse('30000') is any where the branded type ParcelWeightGrams belongs; parse the value with a generated schema in the shell
```

Gate 2 also refuses `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck`, and a value import of the generated schemas or of `valibot` in the core. Use `import type` for the branded types. `as const` is not a problem.

## Result

`npx urn-forge verify` shows no type errors at gate 1 and no problems at gate 2:

```
gate 1  completeness  PASS  tsc: 0 error(s) over tutorial/1-first-domain/src/core.ts; `core` satisfies DomainCoreImplementation
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
```

## Related pages

- [The core and the shell](../explanation/core-and-shell)
- [The package API](../reference/public-api)
- [Fix a gate that fails](fix-a-failing-gate)
