# General constructs only

urn-forge is an enabler. It gives general constructs: definitions, rules and operations. It has no construct for an idea of one domain, such as a request, a refund, a booking state or an HTTP status. This page tells why, and what it means for your manifest.

## The rule

Before urn-forge adds a construct, the construct must pass three tests:

1. Its name and its meaning do not name an idea of one domain.
2. No construct that exists can state the promise, also with more lines.
3. Its meaning is one sentence that names no domain, and the generated code enforces exactly that sentence.

A promise that only a construct of one domain could state stays a workaround, or it is out of scope.

## Why

**Fewer and more general constructs serve more contracts.** A keyword for "states and moves" serves only the contracts whose states move in the way that the keyword knows. A stored record in the input, and rules that compare it with the output, serve each of them. The bookings contract states its moves this way. So does the booking fixture:

```yaml
      - booking: [was_confirmed, is_seated, keeps_the_party]
      - invalid_state: [was_not_confirmed, names_the_request]
```

**A general construct has a meaning that a reader can learn one time.** `required` means the same in each manifest. A keyword such as `retryable` on an error would mean what one team means by a retry, and the next team would mean something else.

**A construct of one domain hides a promise.** When urn-forge decided who could call, when a repeat was the same request, or when a time had passed, the manifest said less than the code did. The rule was in urn-forge, not in the manifest. Now the caller, the first call and the time are values of the input, and each rule about them is in the manifest, where a reader can see it.

## What urn-forge 0.2 removed

urn-forge 0.1 had keywords for errors and their categories, events and their delivery, states and their moves, callers, idempotency keys and changes on a clock. Each named an idea of some domains. In 0.2, each is something that you build from the general constructs:

| An idea | In 0.2 |
| --- | --- |
| An error | An output object. The operation gives it its role. Refer to [Declare a refusal](../how-to/declare-a-refusal) |
| An event | A property of an output object, which the shell sends |
| A state and its moves | A stored record in the input, and rules of each output |
| Who may call | A caller object in the input, and rules |
| The current time | A `format: date-time` string in the input, and rules with `timestamp()` |
| A reference to another object | A value whose type is the identifier of that object |
| A repeat of the same request | The first call in the input, and rules. The store of first calls is the shell's |

Refer to [Model a stored record, the caller and the time](../how-to/model-the-input).

## The cost

A manifest without these keywords has more lines. A rule such as `caller_may_act` is longer than `callers: [guest, staff]`. In return:

- each promise has a name and a message;
- the harness checks each promise on each call;
- `diff` compares each promise by its name and its argument;
- a scenario can break each promise of a definition.

urn-forge may add optional libraries outside the manifest for patterns that many contracts share, such as a store of first calls. Such a library builds on the generated code. It does not add a keyword.

## Related pages

- [The contract](./the-contract)
- [JSON Schema's words and CEL](./json-schema-and-cel)
- [The core and the shell](./core-and-shell)
