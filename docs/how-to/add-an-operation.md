# Add an operation

Declare an operation, write its function in the core, and add the scenarios that run it.

## Before you start

- The input and each output are object definitions. Refer to [Add an object or a list](add-an-object-or-a-list).

## Steps

1. Open `domain.manifest.yaml`, and find the section `operations`. If it is not there, add it at the top level.
2. Add a key with the name of the operation, for example `quote_shipping`.
3. Add `description`: what the operation does.
4. Add `input` with the name of one object.
5. Add `output`, a list of one or more objects. Each entry is `- <object>: [rules]`: the rules that hold when that object comes back. For an output with no rule of its own, write `- <object>: []` or `- <object>`.
6. Run `npx urn-forge compile`.
7. In `src/core.ts`, add a function with the name of the operation. It gets the input, and it returns `answer('<object>', value)` for one of the outputs.
8. Add a scenario that runs the operation for each output. Refer to [Write scenarios](write-scenarios).
9. Run `npx urn-forge verify`.

## Example

The operation of `packages/urn-forge/tutorial/1-first-domain/domain.manifest.yaml`:

```yaml
operations:
  quote_shipping:
    description: Calculate the price to send a parcel
    input: parcel
    output:
      - quote: []
```

Its function in `src/core.ts`:

<<< @/../packages/urn-forge/tutorial/1-first-domain/src/core.ts

The core does not check the input. The harness, `runOperation`, checks it before the function runs, and checks the answer after. The function must be synchronous, and it must not do I/O. If it needs data from a database or the time, the shell puts that data in the input. Refer to [Model a stored record, the caller and the time](model-the-input).

## Add a rule that relates the input and the output

A rule of an operation reads `input` and `output`, not `self`. Put the rule in the list of the output that it applies to. In it, `output` is that object:

```yaml
rules:
  shares_add_up:
    description: The shares add up to the total
    rule: output.share_cents * size(input.people) == input.total_cents
    message: The shares do not add up to the total

operations:
  split:
    description: Split a bill into equal shares
    input: split_request
    output:
      - share: [shares_add_up]
      - uneven_split: [total_does_not_divide, names_the_total]
```

These lines come from `packages/urn-forge/templates/starter/domain.manifest.yaml`.

An operation can also have its own `rules`, next to `output`. They hold for each answer. If the operation has one output, they can read `output`. If it has two or more, they can read only `input`, because the output has a different type for each.

## Return more than one object

An output is one object. To return a record and an event, make an object that holds both. This output comes from `packages/urn-forge/insurance/domain.manifest.yaml`:

```yaml
  issued:
    description: The policy as issued, with its event
    type: object
    properties: [policy, policy_issued]
    rules:
      - required: [policy, policy_issued]
```

The shell stores `policy` and publishes `policy_issued`. The rules of the output can state what the event holds, for example that it names the policy of the input.

## Result

- Gate 1 fails until the core has a function of the correct type.
- Gate 3 asks for a scenario that runs the operation, and for a scenario that ends with each output.
- `runOperation(core, '<operation>', input)` runs the operation through the harness. Refer to [Call an operation](call-an-operation).

## Related pages

- [Operations and outputs](../reference/operations)
- [Declare a refusal](declare-a-refusal)
- [The core and the shell](../explanation/core-and-shell)
