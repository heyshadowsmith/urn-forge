# Declare an error

A declared error is a named rejection: the operation refuses the input, and nothing changes. This guide declares an error, lists it on an operation, returns it from the handler and tests it with a scenario.

The examples come from `packages/urn-forge/tutorial/2-declared-errors/`, which CI tests. The operation `quote_shipping` refuses an express parcel over 5000 grams.

## Before you start

- You have an operation with a handler and a feature. Refer to [Add an operation](add-an-operation).
- Declare the fields that the error carries. Refer to [Add a field](add-a-field).
- Use a declared error only for a rule of the domain. If the input does not match the schema, the shell rejects it before the handler runs. Refer to [Results and declared errors](../explanation/results-and-errors).

## 1. Write the error entry

Add an entry with the short key `<context>.error.<identifier>`:

```yaml
quote.error.too_heavy_for_express:
  description: The parcel is too heavy for express delivery
  category: precondition
  retryable: false
  message: An express parcel can weigh 5000 grams at most, not {weight_grams}
  fields:
    - ref: parcel.field.weight_grams
```

| Key | Value |
| --- | --- |
| `description` | Necessary. What the error means |
| `category` | Necessary. One of `validation`, `conflict`, `not_found`, `forbidden`, `precondition` |
| `retryable` | Necessary. `true` if the same call can succeed later |
| `message` | Necessary. A template. Each `{placeholder}` names a field of the error |
| `fields` | Optional. Field references, as in an entity. The default is no fields |

For the full rules, refer to [The manifest](../reference/manifest).

## 2. Obey the placeholder and `kind` rules

- **A placeholder must name a required field of the error.** Then the message is always complete.
- **No field of the error can have the identifier `kind`.** The error payload uses the property `kind` for the URN of the error.

If you do not obey these rules, `compile` stops:

```
bad-error.yaml:20:12  error  reserved-property  urn:demo:shop:order:error:price_unavailable: fields[1].ref urn:demo:shop:order:field:kind becomes property "kind", which an error reserves for its URN; rename the field
bad-error.yaml:17:12  error  unknown-placeholder  urn:demo:shop:order:error:price_unavailable: message placeholder {note} names an optional field; placeholders must name required fields (required fields: sku, kind)
bad-error.yaml:17:12  error  unknown-placeholder  urn:demo:shop:order:error:price_unavailable: message placeholder {region} names no field of the error (required fields: sku, kind)
```

## 3. List the error on the operation

Add the short key of the error to `errors` on the operation:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/domain.manifest.yaml{yaml}

An operation can list more than one error. One error can be on more than one operation.

## 4. Compile

Run this command:

```bash
npx urn-forge compile
```

The error type of the handler is now the payload of `too_heavy_for_express`. If an operation lists no errors, the error type is `never`, and the handler can only return `ok(…)`.

## 5. Return the error from the handler

Import `fail` from the generated runtime. Call it with the URN of the error and its fields:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/core.ts

- `fail` does not take `kind`. It adds `kind` itself.
- If the error has no fields, call `fail` with the URN only, for example `fail('urn:demo:shop:order:error:pricing_offline')`.
- If the operation does not list the error, gate 1 fails with `TS2322`. The type of `fail(…)` is not assignable to the result type of the handler.

To choose between more than one error, use a `switch`, as in `packages/urn-forge/self/core.ts`:

<<< @/../packages/urn-forge/self/core.ts

## 6. Write a scenario that expects the error

Add a scenario that ends with `Then the operation fails with "<error URN>"`. To check the fields of the error, add a table after a colon:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/features/quote_shipping.feature{gherkin}

- The step must name an error that the operation lists. If not, gate 3 fails with `undeclared-error`.
- The table columns must be fields of the error. A field that is not in the table is not checked.

If no scenario expects an error, gate 3 shows a warning:

```
features  warning  uncovered-error  error urn:demo:shipping:quote:error:too_heavy_for_express of urn:demo:shipping:quote:operation:quote_shipping has no scenario that expects it; add one with Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express"
```

In a strict feature, this warning is an error. Refer to [Adopt strict coverage](adopt-strict-coverage).

## Result

`npx urn-forge verify` shows that each declared error has a scenario:

```
gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
```

To show the error to a caller, refer to [Call an operation from the shell](call-an-operation).

## Related pages

- [Tutorial: add a declared error](../tutorials/declared-errors)
- [Results and declared errors](../explanation/results-and-errors)
- [The manifest](../reference/manifest)
- [The generated runtime](../reference/generated-runtime)
- [Gherkin steps](../reference/gherkin-steps)
