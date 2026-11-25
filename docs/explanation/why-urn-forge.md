# Why urn-forge works this way

urn-forge rests on a few choices. Each one costs something, and this page says what it buys.

## The contract, apart from the logic

A domain makes promises to everything outside it: the values it accepts, the operations it offers, the answers each can give, and when each answer comes back. That is its contract. The business logic is different: it looks at one request and decides which allowed answer to give.

"A party of 7 or more pays a deposit" needs only the booking, so a rule can state it, and the harness can check it on every call. "There is a free table at 19:00" needs the other bookings of the evening; it is contract only if the shell puts those bookings in the input. Otherwise it is logic, and lives in the core.

Written in one place, the contract becomes something every part can be checked against: the code, the scenarios, the database and the next version.

## A harness, not a framework

urn-forge does not run your application. It generates one file, and your code stays plain TypeScript. The design is a functional core and an imperative shell:

- **The core** is a set of synchronous functions, one per operation, with no I/O. It gets a checked input and returns an answer. It is deterministic, and a scenario only has to give an input and read the answer.
- **The shell** does everything else. It reads the request, loads the stored record, the caller and the time into the input, calls `runOperation`, and stores or sends the result.

The harness stands between them. Before the core runs, it checks the input, so bad data has one entrance. After the core answers, it checks that the answer is one of the operation's outputs, that its value is valid, and that the output's rules hold. That second check is what types cannot do: a type can say the core returns a `Booking`, but not that it only seats a confirmed one.

The core trusts its input and does not check it again. That trust is safe only if every call goes through the harness, which is why gate 2 fails on a direct call.

The cost: the shell does more work, and the input grows, since data that a core would fetch must be loaded first. An operation that needs data halfway through becomes two operations.

## A refusal is an answer

"Too heavy for express" is not an exception. It is an output, an object like any other, listed in the operation. So `tsc` checks the core returns only declared outputs, gate 3 asks for a scenario that reaches it, rules say when it may come back, and the shell can tell a refusal (`ok: true`) from a bug (`ContractViolation`).

## General constructs only

urn-forge has definitions, rules and operations, and nothing that belongs to one kind of domain: no keyword for errors, states, callers, events, idempotency or clocks. Each of these is built from the general constructs:

| An idea | Built as |
| --- | --- |
| An error | An output object |
| A state and its moves | The stored record in the input, and rules of each output |
| Who may call | A caller object in the input, and rules |
| The time | A `format: date-time` string in the input |
| An event | A property of an output |
| A reference to another object | A value whose type is that object's identifier |

A manifest gets longer: `caller_may_act` is longer than `callers: [guest, staff]` would be. In return, every promise has a name and a message, sits in the manifest where a reader sees it, is checked on every call, can be broken by a scenario, and is compared by `diff`.

## JSON Schema's words, CEL's rules

A new format is a new language to learn. Most developers already read JSON Schema, so the manifest uses its words with their meanings: `type`, `properties`, `items`, `required`, `enum`, `minimum`, `pattern`, `format`, `deprecated`. It adds a word only where JSON Schema has none, such as `identifier`.

JSON Schema itself is not enough. A contract needs operations, names for its rules (so a failure says which promise broke, and `diff` can compare promises), and rules across values, such as "a booking ends after it starts". So in the manifest, JSON Schema's keywords are rules like any other: `minimum` has a name, a parameter, the text `self >= bound` and a message. One checker, one code generator and one `diff` handle the standard rules and yours alike.

The rules are a subset of CEL, the expression language that Kubernetes and protovalidate use on schemas. It is small, has no loops or side effects, and is already known. urn-forge parses the subset itself, because it must type each rule, translate it to TypeScript and SQL, and compare two rules in `diff`. The generated code is plain TypeScript, with no CEL library at run time. The subset grows only for a real need.

Operations take TypeSpec's shape: a signature with one input and a union of outputs.

## Conformance, not correctness

The gates show that the parts agree with the manifest. They do not show that the logic is right.

| Check | It shows | It cannot show |
| --- | --- | --- |
| Gate 1 | Every operation has a function of the generated type | That the function computes the right value |
| Gate 2 | The shell calls the core only through the harness | A call from a file it does not examine |
| Gate 3 | Every operation, output and rule of a definition has a scenario | That a scenario passes, or expects the right value |
| Gate 4 | The generated files match a fresh compile | That the manifest is right |
| The harness | Each input and answer keeps the manifest's rules | That the core chose the right allowed answer |
| `diff` | No change can break a caller without a new major version | A change of meaning with the same values, such as cents becoming euros |

Only a person can say what the right answer is; the scenarios are where they say it. A static check finds what is missing (an output with no scenario does not fail a Cucumber run, as there is nothing to run). A run finds what is wrong. CI needs both.

Rules of a definition need a scenario that breaks them, because a rule that never refuses anything may be wrong without a sign. Rules of an output need none: the harness checks them on every answer. Their edges are where a wrong core slips through, so test the edges.

A gap is a warning by default, so a team with a large manifest can adopt urn-forge gradually; `coverage: 'error'` makes it strict.

## Same input, same bytes

The compiler reads no clock, no random value and no environment, so the same manifest, config and version give the same bytes on any machine. Gate 4 depends on that: otherwise it would fail on a clean checkout, and a team would learn to ignore it. A rule about time compares a time in the input, never the clock, so a rerun of an old commit gives the same verdict.

## Compatibility by side, judged by the version

Whether a change breaks a caller depends on which way the value travels: a narrower rule on what callers send can refuse a request that worked, and a wider rule on what they receive can hand them a value they do not expect. When `diff` cannot tell whether a change accepts more or less, as with two regular expressions, it calls the change breaking: a false "breaking" costs a version number, a false "compatible" costs a broken caller in production. The version is the only signal, as for any package; the manifest has no stability levels or dates.

## What urn-forge does not own, and cannot say yet

The shell owns authentication, loading records, delivering events, de-duplicating repeated requests, and the mapping to HTTP. The manifest can state the rules about each, once the shell puts the data in the input.

Some promises cannot be stated yet: times in a time zone or calendar months, `filter`, `min()` or `max()` of a list, either-or shapes and maps with free keys, and check digits. For these, put the rule in the core with a refusal as an output, and test its edges.
