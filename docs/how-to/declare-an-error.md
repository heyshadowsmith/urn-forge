# Declare an error

Give an operation a declared error: a named rejection that the handler returns, and after which nothing changes.

## Before you start

- You have an operation with a handler and a feature. Refer to [Add an operation](add-an-operation).
- Declare the fields that the error carries. Refer to [Add a field](add-a-field).
- Use a declared error only for a rule of the domain. The shell rejects an input that does not match the schema before the handler runs.

## Steps

1. Add an entry with the short key `<context>.error.<identifier>`. Give `description`, `category`, `retryable` and `message`. Add `fields` if the error carries values. Each `{placeholder}` in `message` must name a required field of the error.
2. Add the short key of the error to `errors` on the operation.
3. Run `npx urn-forge compile`. The error type of the handler becomes the payload of the error.
4. In the handler, return `fail(…)` with the URN of the error and its fields. `fail` adds `kind` itself.
5. Add a scenario that ends with `Then the operation fails with "<error URN>"`. To check the fields of the error, end the step with a colon and add a table.

## Example

The shipping domain of `packages/urn-forge/tutorial/2-declared-errors/` refuses an express parcel over 5000 grams:

```yaml
quote.error.too_heavy_for_express:
  description: The parcel is too heavy for express delivery
  category: precondition
  retryable: false
  message: An express parcel can weigh 5000 grams at most, not {weight_grams}
  fields:
    - ref: parcel.field.weight_grams
```

```yaml
  errors:
    - quote.error.too_heavy_for_express
```

<<< @/../packages/urn-forge/tutorial/2-declared-errors/src/core.ts

<<< @/../packages/urn-forge/tutorial/2-declared-errors/features/quote_shipping.feature{gherkin}

The runtime parses each field of the error with its schema. If the handler gives a value that the field refuses, the result is `ContractViolation`, not the error. Thus, choose a field that accepts each value that the error can carry.

If no scenario expects the error, gate 3 shows a warning:

```
features  warning  uncovered-error  error urn:demo:shipping:quote:error:too_heavy_for_express of urn:demo:shipping:quote:operation:quote_shipping has no scenario that expects it; add one with Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express"
```

To keep a refusal as an event, refer to [Emit an event](emit-an-event).

## Result

`npx urn-forge verify` shows that each declared error has a scenario:

```
gate 3  gherkin       PASS  1 feature(s), 3 scenario(s), 1/1 operations tagged, 1/1 errors expected, strict: 0/1 features
```

## Related pages

- [Tutorial: add a declared error](../tutorials/declared-errors)
- [The manifest](../reference/manifest)
- [Call an operation from the shell](call-an-operation)
