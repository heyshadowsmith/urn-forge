# Operations and outputs

An operation is a signature and its rules: one input object, a list of output objects, and the rules that relate them. All operations are in the section `operations`. The shape is the shape of an operation in TypeSpec.

## Keys

```yaml
operations:
  seat_booking:
    description: Seat the party of a booking
    input: seat_request
    output:
      - booking: [was_confirmed, is_seated, keeps_the_party]
      - invalid_state: [was_not_confirmed, names_the_request]
```

| Key | Required | Value |
| --- | --- | --- |
| `description` | Yes | What the operation does |
| `input` | Yes | The name of one object definition |
| `output` | Yes | A list of one or more entries. Each entry is one object definition, with the rules that hold when it comes back |
| `rules` | No | Rules that hold for each answer of the operation |
| `deprecated` | No | `true` or `false` |

An operation has no other key. There is no key for errors, states, callers, idempotency or events. Each of these is an object or a rule that you declare. Refer to [Model a stored record, the caller and the time](../how-to/model-the-input).

## Input

`input` names one object definition. A definition of another type stops `compile` with `not-an-object`:

```
domain.manifest.yaml:28  error  not-an-object  the input of quote_shipping must be an object; weight_grams is of type integer
```

## Outputs

Each entry of `output` is one of these:

| Entry | Meaning |
| --- | --- |
| `- quote` | The output `quote`, with no rule of its own |
| `- quote: []` | The same |
| `- quote: [fits_express]` | The output `quote`. When it comes back, `fits_express` holds |

- Each output is an object definition.
- Each output occurs one time. Otherwise, `compile` stops with `duplicate-output`.
- The core returns exactly one output for each call: `answer('<object>', value)`.

A refusal, such as `invalid_state`, is an output like any other. An event is a property of an output object. The operation gives an object its role: the same object can be an input of one operation, and an output of another.

## Rules of an output

In the rules of an output entry:

- `input` is the input of the call.
- `output` is the object of that entry, with its type. No rule needs to test which output came back.

The rules of each output say when it can come back. Make them exclude each other, so that each input allows one output:

```yaml
      - quote: [fits_express]
      - too_heavy_for_express: [over_express_limit, names_the_weight]
```

## Rules of the operation

The `rules` of the operation hold for each output. They can read `input`. They can read `output` only if the operation has one output.

## What the harness does

`runOperation(core, operation, input)` does these steps:

1. It checks the input against its definition. If the input breaks a rule, the result is `InputRejected`, and the core does not run.
2. It calls the function of the core with the input.
3. It checks that the answer names an output of the operation. Otherwise, the result is `ContractViolation` with the rule `output`.
4. It checks the value of the answer against the definition of that output.
5. It checks the rules of that output entry, then the rules of the operation.
6. If a check fails, the result is `ContractViolation`. Otherwise, the result is the answer, with `ok: true`.

Refer to [The generated code](./generated-code).

## Coverage

Gate 3 of `verify` asks for a scenario that runs each operation, and a scenario that ends with each output. The rules of outputs and of operations need no scenario that breaks them: the harness checks them on each answer. Refer to [Verification gates](./verification-gates).

## Related pages

- [Add an operation](../how-to/add-an-operation)
- [Declare a refusal](../how-to/declare-a-refusal)
- [Rules and the standard rules](./rules)
