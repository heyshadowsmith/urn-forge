# The contract

A domain makes promises to each party outside its core: to the callers, to the systems that read what it returns, and to the database that keeps its records. Together, these promises are the contract of the domain. A manifest states the contract, and urn-forge makes sure that the code keeps it. This page tells what a contract is, how the manifest states it, when a promise counts as declared, and what a manifest cannot state.

## What a contract is

A contract is a set of promises that a party outside can rely on without knowledge of the code. "A parcel weighs from 1 to 30000 grams." "The operation `quote_shipping` takes a parcel and gives a quote or a refusal." "A refusal comes back only for an express parcel over 5000 grams, and it names the weight."

A party outside does not read your core. It reads the contract. If the contract is clear and the code keeps it, the party can call the domain and use its answers with no surprise.

## Contract and business logic

The contract says what **can** happen. The business logic decides what **does** happen.

- The contract gives the values that the domain accepts, the operations, each possible answer, and the rules that relate an answer to its request.
- The business logic looks at one request. It selects one of the possible answers, and it calculates the values.

A rule that needs only the input and the answer is contract, also if it sounds like logic. "A party of 7 or more pays a deposit" needs only the booking, so a rule can state it. "There is a free table at 19:00" needs the bookings of the evening. It is contract only if the shell puts that data in the input. Otherwise, it is business logic.

urn-forge makes sure that the business logic stays inside the contract. The core gets only a valid input, and its answer must be one of the outputs, with valid values, and with the rules of that output. urn-forge does not check that the logic selects the correct answer among the allowed answers. Your scenarios do that.

## The parts of a contract

| Part | The promise | In the manifest |
| --- | --- | --- |
| Values | These values, and only these, are valid | `definitions`, with `type`, `properties`, `items` and their `rules` |
| Operations | These operations exist, and each takes this input | `operations`, with `input` |
| Answers | An operation answers only with one of its outputs, and each output comes back only when its rules hold | `output`, with the rules of each entry |
| Change | A change keeps the promises that each party relies on, or the version says that it does not | `version`, `compatibility`, `deprecated`, and `urn-forge diff` |

Each rule has a name, a description for a reader, and a message for a failure. Thus each promise has a name, in one place, in the words of the domain.

## The test of declared

A promise is declared only if this question has the answer "no":

> Can the promise break while every generated check passes?

The test assumes that the shell uses the generated boundary as the docs say: it calls `runOperation`, and it applies the generated SQL. A part of the promise that the shell or the caller must keep in another way is not declared.

A promise is declared only if:

1. each part of it maps to a piece of the manifest whose documented meaning is that part;
2. a reader of the manifest alone can recover the promise.

For example, "a refusal names the weight of the parcel" is declared by the rule `names_the_weight` on the output `too_heavy_for_express`. If the core returns another weight, `runOperation` gives a `ContractViolation`. The promise cannot break while the checks pass.

"A booking is seated only from the state `confirmed`" is declared only if the input holds the stored booking, and a rule ties it to the request (`names_the_booking`). Without that rule, the shell can load the wrong booking, and each check still passes.

The repository measures this. `contracts/` has six contracts of real domains, each with its promises in `promises.yaml`, and each promise has a status: declared, workaround or not declarable. `npm run corpus` gives the share that is declared:

```
contract corpus: 64 of 143 promises declared (44.8%), minimum 44.8%
  workaround      77
  not declarable  2
  by hole: C3 21, C1 10, D4 9, C2 8, D3 8, A2 5, E3 5, E4 5, D1 2, E1 2, A1 1, A3 1, B1 1, B4 1
  bookings         9 of 24 declared
  claims          11 of 24 declared
  inventory       10 of 23 declared
  payments        13 of 24 declared
  subscriptions   11 of 24 declared
  ticketing       10 of 24 declared
```

A workaround states a part of the promise, and a comment in `promises.yaml` names the part that can break. A wrong literal value, such as a wrong limit, is an error of the author, not a break.

## What urn-forge does not own

urn-forge owns the contract and the proof that the code keeps it. Other parts of a system own these promises:

| Promise | Example | Who owns it |
| --- | --- | --- |
| Who the caller is | "The caller is the holder of the policy" | The shell authenticates the caller. The manifest states what each caller may do, with the caller in the input |
| That a referred record exists | "The restaurant of the booking exists" | The shell loads the record into the input, or a foreign key in the Postgres config |
| The delivery of events | "Each event arrives one time" | Your message tools, after the shell sends the event that the output holds |
| A repeat of the same request | "A second call with the same key gives the first answer" | The shell, or a library on top of the generated code. The manifest can state the rule if the shell puts the first call in the input |
| Operations that take a long time | "The claim is checked within two days" | Your workflow tools. Each operation gives one answer at once |

urn-forge does not do the work of the shell. It does not map an output to an HTTP status, read or write rows, or publish events. The core does no I/O, so the shell loads data before a call and stores the result after it.

## What a contract cannot say yet

Some promises are contract, but a manifest cannot state them at this time. The rule language grows only for a real need, and these are the needs that are known:

- **A time in a zone.** "The start time is on the day of the booking, in the zone of the restaurant." A rule has timestamps and durations in UTC. It has no time zones and no calendar months.
- **A minimum or a filter of a list.** A rule can use `all`, `exists`, `exists_one`, `map` and `sum`, but not `filter`, `min()` or `max()`.
- **A value that another record holds.** A rule reads only the input and the output. If the promise needs another record, the shell must put it in the input.
- **Either-or shapes and maps.** An object has a fixed list of properties. There is no "one of these shapes" and no map with free keys.
- **A check digit.** A `pattern` checks the shape of a value, not a sum of its digits.

For each of these, put the rule in the core, with a refusal as an output, and write the scenarios at its edges. The contract then states the refusal, but not when it comes back.

## Related pages

- [General constructs only](./general-constructs)
- [The core and the shell](./core-and-shell)
- [How urn-forge proves it](./how-urn-forge-proves-it)
