# Why urn-forge works this way

urn-forge rests on a few choices. Each costs something; this page says what it buys.

## The contract, apart from the logic

A domain's contract is what it promises everything outside it: the values it accepts, its operations, the answers each can give, and when each comes back. The business logic decides which allowed answer to give one request. Written in one place, the contract is something the code, the scenarios, the database and the next version can each be checked against.

## A harness, not a framework

urn-forge generates one file and does not run your application. The design is a functional core and an imperative shell. **The core** is one synchronous function per operation, with no I/O, so a scenario only gives an input and reads the answer. **The shell** does everything else: it loads the stored record, the caller and the time into the input, calls `runOperation`, and stores or sends the result.

The harness checks the input, so bad data has one entrance and the core need not check it again; gate 2 makes sure every call goes through it. It then checks the answer against the rules of its output, which a type cannot do. The cost: the shell does more work, and an operation that needs data halfway through becomes two.

## General constructs only

There is no keyword for errors, states, callers, events or clocks:

| An idea | Built as |
| --- | --- |
| An error | An output object |
| A state and its moves | The stored record in the input, and rules of each output |
| Who may call | A caller object in the input, and rules |
| The time | A `format: date-time` string in the input |
| An event | A property of an output |

A manifest gets longer. In return, every promise has a name and a message, is checked on every call, can be broken by a scenario, and is compared by `diff`. Because a refusal is an output and not an exception, `tsc` checks that the core returns only declared outputs, and the shell can tell a refusal (`ok: true`) from a bug (`ContractViolation`).

## JSON Schema's words, CEL's rules

Most developers already read JSON Schema, so the manifest uses its words with their meanings. But a contract also needs operations, named rules (so a failure says which promise broke, and `diff` can compare promises) and rules across values. So JSON Schema's keywords are rules like any other: `minimum` has a name, a parameter, the text `self >= bound` and a message, and one checker, generator and `diff` handle them and yours alike.

Rules are a subset of CEL, which Kubernetes and protovalidate use on schemas: small, with no loops or side effects. urn-forge parses it itself, to type each rule, translate it to TypeScript and SQL, and compare two rules.

## Conformance, not correctness

The gates show that the parts agree with the manifest, not that the logic is right.

| Check | It shows | It cannot show |
| --- | --- | --- |
| Gate 1 | Every operation has a function of the generated type | That it computes the right value |
| Gate 2 | The shell calls the core only through the harness | A call from a file it does not examine |
| Gate 3 | Every operation, output and rule of a definition has a scenario | That the scenario expects the right value |
| Gate 4 | The generated files match a fresh compile | That the manifest is right |
| The harness | Each input and answer keeps the rules | That the core chose the right allowed answer |
| `diff` | No change breaks a caller without a new major version | A change of meaning, such as cents becoming euros |

Only a person can say what the right answer is; the scenarios are where they say it. A static check finds what is missing and a run finds what is wrong, so CI needs both. A gap is a warning by default, so a team can adopt urn-forge step by step.

The compiler reads no clock, random value or environment, so the same manifest gives the same bytes on any machine. Gate 4 depends on that. And when `diff` cannot tell whether a change accepts more or less, it calls it breaking: a false "breaking" costs a version number, a false "compatible" costs a broken caller.

## What it cannot say yet

The shell owns authentication, loading records, delivering events, de-duplicating requests and the mapping to HTTP; the manifest can state rules about each once the data is in the input. Some promises cannot be stated yet: time zones and calendar months, `filter`, `min()` or `max()` of a list, either-or shapes, maps with free keys, and check digits. Put these in the core, with a refusal as an output, and test their edges.
