# Use branded values in the core

The input of a handler is branded. Each value has its plain type and a brand, for example `number & Brand<"urn:demo:shipping:parcel:field:weight_grams">`. The brand shows that the shell parsed the value. This guide shows how to read branded values, how to use them as object keys, and what to return.

## Before you start

- You have a handler in a core that uses `satisfies DomainCoreImplementation`. Refer to [Add an operation](add-an-operation).
- To know why the input has brands, read [The functional core and brands](../explanation/functional-core).

## 1. Read and compare the values

A branded value is also a value of its plain type. Thus, you can use it as the plain type. Arithmetic, comparisons, `===` and `switch` work with no change:

```ts
import type { ParcelParcel } from './generated/domain.schemas.generated';

export function examples({ weight_grams, zone, express }: ParcelParcel) {
  const heavy = weight_grams > 5000;
  const kilograms = Math.ceil(weight_grams / 1000);
  const abroad = zone === 'international';
  let base = 0;
  switch (zone) {
    case 'domestic':
      base = 500;
      break;
    case 'international':
      base = 1500;
      break;
  }
  const fast = express === true;
  return { heavy, kilograms, abroad, base, fast };
}
```

In a handler, you do not write the input type. `satisfies DomainCoreImplementation` gives it.

## 2. Use a `oneOf` value as an object key

A `string` field with `oneOf` has a union type with a brand, for example `("domestic" | "international") & Brand<…>`. TypeScript does not let this type index an object. If you write `BASE_CENTS[zone]`, gate 1 fails:

```
core.ts:13:19  error  type-error  TS7053: Element implicitly has an 'any' type because expression of type '("domestic" | "international") & Brand<"urn:demo:shipping:parcel:field:zone">' can't be used to index type '{ readonly domestic: 500; readonly international: 1500; }'.
```

To correct it, do these steps:

1. Assign the value to a constant with the plain union type.
2. Use that constant as the key.

<<< @/../packages/urn-forge/tutorial/1-first-domain/core.ts{8,9,11}

The assignment is correct, because a branded value is also a value of its plain type. It does not change the value at run time.

## 3. Do not make branded values in the core

The core gets branded values. It does not make them. A plain value is not assignable to a branded type:

```ts
const limit: ParcelWeightGrams = 5000;
```

```
error TS2322: Type 'number' is not assignable to type 'number & Brand<"urn:demo:shipping:parcel:field:weight_grams">'.
```

Do not cast a plain value to a branded type with `as`. A brand must mean that a schema parsed the value. Only the shell parses values, in `executeOperation`.

## 4. Return plain output

The output type and the error types of a handler are plain. They have no brands:

- Give plain values to `ok(…)` and to `fail(…)`.
- A branded input value is also permitted, because it is also a plain value. For example, the core in `tutorial/2-declared-errors` gives the branded `weight_grams` to `fail(…)`.

`executeOperation` parses the output, or the error, with its schema. The parse adds the brands. If the output does not match the schema, the result is `ContractViolation`. Refer to [Call an operation from the shell](call-an-operation).

## Result

Run `npx urn-forge verify`. Gate 1 shows no type errors:

```
gate 1  completeness  PASS  tsc: 0 error(s) over core.ts; `core` satisfies DomainCoreImplementation
```

## Related pages

- [The functional core and brands](../explanation/functional-core)
- [The generated schemas](../reference/generated-schemas)
- [The generated runtime](../reference/generated-runtime)
- [Fix a gate that fails](fix-a-failing-gate)
