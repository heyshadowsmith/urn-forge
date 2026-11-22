# Declare preconditions and postconditions

Some promises connect the request, the stored record and the answer: "a party of 13 or more books by phone", "a refund never exceeds the captured amount", "the new version is one higher than the version sent". This guide declares them as conditions of an operation. urn-forge then refuses a request that breaks a precondition before your handler runs, and finds an answer that breaks a postcondition.

The examples come from [`packages/urn-forge/tests/fixtures/conditions/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tests/fixtures/conditions/).

## Before you start

- You have an operation, and a declared error for each refusal. Refer to [Declare an error](declare-an-error).
- To read the stored record in a rule, the operation has `changes`. Refer to [Declare states and moves](declare-states).
- Use an [invariant](add-an-invariant) for a rule on the shape of one entity: the caller gets `InputRejected` on a property. Use a condition when the promise names a declared error, or when the rule needs the record or the answer.

## 1. Add a precondition

Add `requires` to the operation: a list of rules, each with the declared error that answers when it does not hold.

```yaml
booking.operation.create_booking:
  description: Make a booking
  input: booking.entity.request
  output: booking.entity.booking
  requires:
    - rule: input.party_size < 13
      otherwise: booking.error.party_too_large_for_online
    - rule: input.party_size < 7 or input.deposit_token is present
      otherwise: booking.error.deposit_required
  errors: [booking.error.party_too_large_for_online, booking.error.deposit_required]
```

A rule uses the [rule language](../reference/rule-language), and each name has a prefix:

| Prefix | The value | Where |
| --- | --- | --- |
| `input.` | The request, parsed | `requires` and `ensures` |
| `current.` | The record that the operation changes | `requires` and `ensures`, only with `changes` |
| `output.` | The answer, parsed | `ensures` only |

`otherwise` must be in `errors`. urn-forge fills its fields from the request and the record, by property name, so each required field of the error must be a property of the input or of the record. When both have the property, the value of the record is used: a version conflict gives the stored version.

## 2. Add a postcondition

Add `ensures`: a list of rules that each answer must keep.

```yaml
claim.operation.submit_claim:
  description: Submit a draft claim
  input: claim.entity.change
  output: claim.entity.claim
  changes:
    entity: claim.entity.claim
    from: [DRAFT]
    to: SUBMITTED
    otherwise: claim.error.invalid_state
  requires:
    - rule: input.version = current.version
      otherwise: claim.error.version_conflict
  ensures:
    - output.version = input.version + 1
  errors: [claim.error.invalid_state, claim.error.version_conflict]
```

A rule that does not fit stops `compile`:

```text
domain.manifest.yaml:50:13  error  invalid-condition  urn:demo:conditions:booking:operation:create_booking: requires.0.rule: "output.party_size" reads the answer, which a requires rule runs before; use it in ensures
```

## 3. Remove the rule from the handler

`executeOperation` checks the conditions:

1. The input parses.
2. With `changes`, the state of the record is in `from`.
3. Each `requires` rule, in order. The first that does not hold answers its `otherwise` error, and the handler does not run.
4. The handler runs, and its answer parses.
5. Each `ensures` rule. An answer that breaks one is a `ContractViolation`:

```text
the handler for urn:demo:conditions:claim:operation:submit_claim answered a value that breaks ensures: output.version = input.version + 1
```

Thus the handler does not need to examine a precondition again. Remove that code from the core.

## 4. Write the scenarios

Each `otherwise` is a declared error, so gate 3 asks for a scenario that expects it. Write the scenarios at the edge of each rule yourself, for example 12 and 13 guests:

```gherkin
@urn:demo:conditions:booking:operation:create_booking
Scenario Outline: A party of 13 or more books by phone
  When I run the operation with:
    | party_size   |
    | <party_size> |
  Then the operation fails with "urn:demo:conditions:booking:error:party_too_large_for_online"

  Examples:
    | party_size |
    | 13         |
    | 20         |
```

## Result

- The manifest states the rules between the request, the record and the answer.
- A request that breaks a precondition gets the declared error, with no code in the handler.
- `urn-forge diff` reports a new or changed `requires` rule, and a removed `ensures` rule, as breaking. Refer to [Change the contract](change-the-contract).

## Related pages

- [The manifest](../reference/manifest)
- [The rule language](../reference/rule-language)
- [The generated code](../reference/generated-code)
