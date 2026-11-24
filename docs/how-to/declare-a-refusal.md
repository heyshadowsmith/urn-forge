# Declare a refusal

Give an operation an answer that refuses the request, for example "the parcel is too heavy for express delivery". A refusal is an output of the operation, an object like any other. urn-forge has no special kind for an error.

## Before you start

- The operation exists. Refer to [Add an operation](add-an-operation).

## Steps

1. Add an object definition for the refusal. Give it the properties that a caller needs to understand the refusal.
2. Add the object to the `output` list of the operation.
3. Add a rule that says when the refusal comes back. It reads `input`.
4. Add the opposite rule to each other output, so that only one output is possible for each input.
5. Add a rule that ties the properties of the refusal to the input, if the refusal repeats a value of the input.
6. Run `npx urn-forge compile`.
7. In the core, return `answer('<refusal>', value)` when the refusal applies.
8. Add a scenario that ends with `Then the output is "<refusal>"`.
9. Add a scenario that checks a value of the refusal and breaks its `required` rule. No input can break a rule of an output, so use `When I check a "<refusal>" with:`.

## Example

This is the refusal of tutorial 2, from `packages/urn-forge/tutorial/2-declared-errors/domain.manifest.yaml`:

```yaml
definitions:
  too_heavy_for_express:
    description: The parcel is too heavy for express delivery
    type: object
    properties: [weight_grams]
    rules:
      - required: [weight_grams]

rules:
  fits_express:
    description: A parcel that goes by express weighs 5000 grams at most
    rule: '!has(input.express) || !input.express || input.weight_grams <= 5000'
    message: An express parcel can weigh 5000 grams at most

  over_express_limit:
    description: The parcel goes by express and weighs more than 5000 grams
    rule: has(input.express) && input.express && input.weight_grams > 5000
    message: The parcel fits express delivery

  names_the_weight:
    description: The refusal names the weight of the parcel
    rule: output.weight_grams == input.weight_grams
    message: The refusal names another weight

operations:
  quote_shipping:
    description: Calculate the price to send a parcel
    input: parcel
    output:
      - quote: [fits_express]
      - too_heavy_for_express: [over_express_limit, names_the_weight]
```

The rules make each output possible only for its inputs. If the core gives a quote for an express parcel of 6000 grams, `runOperation` gives this result in place of the answer:

```json
{
  "ok": false,
  "operation": "quote_shipping",
  "kind": "ContractViolation",
  "failures": [
    {
      "definition": "quote_shipping",
      "rule": "fits_express",
      "path": "",
      "message": "An express parcel can weigh 5000 grams at most"
    }
  ]
}
```

## Name the refusal for the caller

A caller reads the name of the output. Name the refusal for what happened, for example `too_heavy_for_express` or `invalid_state`. Do not put an HTTP status or a retry flag in the manifest: how the shell maps a refusal to its transport is the shell's choice. The contracts in `contracts/` use names such as `booking_not_found` and `forbidden`, each an ordinary object.

## A refusal and a rejected input

These two are different:

| | A refusal | A rejected input |
| --- | --- | --- |
| What it is | An output of the operation | A failure of the harness |
| Who decides | The core | The harness, before the core runs |
| When | The input is valid, but the business rules refuse it | The input breaks a rule of a definition |
| In `runOperation` | `ok: true`, with the output name | `ok: false`, `kind: 'InputRejected'` |
| In a scenario | `Then the output is "<refusal>"` | `Then the input is rejected by "<rule>" of "<definition>"` |

A caller can expect a refusal and handle it. A rejected input means that the caller sent a value that the contract does not allow.

## Result

`verify` passes when a scenario gives the refusal and a scenario breaks each rule of its definition. The generated answer type of the operation has the refusal as one of its members.

## Related pages

- [Tutorial: add a refusal](../tutorials/declared-errors)
- [Operations and outputs](../reference/operations)
- [The generated code](../reference/generated-code)
