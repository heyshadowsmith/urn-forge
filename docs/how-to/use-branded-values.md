# Use branded values in the core

The input of a handler is branded. Each value has its plain type and a brand, for example `number & Brand<"urn:demo:shipping:parcel:field:weight_grams">`. The brand shows that the shell parsed the value. This guide shows how to read branded values and use them as object keys. It also shows how to use links and embedded entities, and what to return.

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

## 2. Use an `enum` value as an object key

An `enum` field has a union type of its `values`, with a brand, for example `("domestic" | "international") & Brand<…>`. TypeScript does not let this type index an object. If you write `BASE_CENTS[zone]`, gate 1 fails:

```
core.ts:9:19  error  type-error  TS7053: Element implicitly has an 'any' type because expression of type '("domestic" | "international") & Brand<"urn:demo:shipping:parcel:field:zone">' can't be used to index type '{ readonly domestic: 500; readonly international: 1500; }'.
```

To correct it, do these steps:

1. Assign the value to a constant with the plain union type.
2. Use that constant as the key.

<<< @/../packages/urn-forge/tutorial/1-first-domain/core.ts{8,9,11}

The assignment is correct, because a branded value is also a value of its plain type. It does not change the value at run time.

## 3. Use a link and an embedded entity

A link holds the value of the key of its target. Thus, it has the type and the brand of the key field. In the insurance domain, `holder` links to a customer, and the key of a customer is `customer.field.customer_id`. The generated schema uses the key field schema:

```ts
  holder: CustomerCustomerIdSchema,
```

Thus, `holder` has the type `CustomerCustomerId`. A function of the core that takes a customer identifier accepts it with no cast:

```ts
import type { CustomerCustomerId } from './generated/domain.schemas.generated';

function isBlocked(customer: CustomerCustomerId): boolean {
  return customer === '00000000-0000-0000-0000-000000000000';
}
```

`isBlocked(policy.holder)` passes gate 1. The identifier of a different entity has a different brand, so `tsc` refuses it. Here the handler of `issue_policy` calls `isBlocked(policy.policy_id)`:

```
gate 1  completeness  FAIL  tsc: 1 error(s) over insurance/core.ts; `core` satisfies DomainCoreImplementation
    insurance/core.ts:29:33  error  type-error  TS2345: Argument of type 'string & Brand<"urn:acme:insurance:policy:field:policy_id">' is not assignable to parameter of type 'string & Brand<"urn:acme:insurance:customer:field:customer_id">'.
      Type 'string & Brand<"urn:acme:insurance:policy:field:policy_id">' is not assignable to type 'Brand<"urn:acme:insurance:customer:field:customer_id">'.
        Types of property '[BrandSymbol]' are incompatible.
          Property '"urn:acme:insurance:customer:field:customer_id"' is missing in type '{ "urn:acme:insurance:policy:field:policy_id": "urn:acme:insurance:policy:field:policy_id"; }' but required in type '{ "urn:acme:insurance:customer:field:customer_id": "urn:acme:insurance:customer:field:customer_id"; }'.
```

Both values are UUID strings, but only the brand of the key field is correct for a link to a customer.

An embedded entity has the parsed type of its entity. Each object of `coverages` is a `PolicyCoverage`, so its fields have their brands too. For example, each `limit` in `policy.coverages.map((c) => c.limit)` is a branded decimal string.

## 4. Do not make branded values in the core

The core gets branded values. It does not make them. A plain value is not assignable to a branded type:

```ts
const limit: ParcelWeightGrams = 5000;
```

```
error TS2322: Type 'number' is not assignable to type 'number & Brand<"urn:demo:shipping:parcel:field:weight_grams">'.
```

Do not cast a plain value to a branded type with `as`. A brand must mean that a schema parsed the value. Only the shell parses values, in `executeOperation`.

## 5. Return plain output

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
- [Add an entity](add-an-entity)
- [Fix a gate that fails](fix-a-failing-gate)
