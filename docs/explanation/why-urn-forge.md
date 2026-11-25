# Why urn-forge works this way

urn-forge has its design because of a small number of decisions. Each decision has a cost. This page tells you what each decision gives in return.

## The contract, apart from the logic

The contract of a domain is what the domain promises to all code outside it. It gives the values that the domain accepts, its operations, the answers of each operation, and when each answer is permitted. The business logic selects which permitted answer to give to one request. When the contract is in one place, you can check the code, the scenarios, the database and the next version against it.

## A harness, not a framework

urn-forge generates one file, and it does not run your application. The design is a functional core and an imperative shell. **The core** is one synchronous function for each operation, with no I/O. Because of this, a scenario only gives an input and reads the answer.

**The shell** does all other work. It loads the stored record, the caller and the time into the input, and calls `runOperation`. Then it stores or sends the result.

The harness checks the input. Bad data has only this one entry point, and the core does not check the input again. Gate 2 makes sure that each call goes through the harness. Then the harness checks the answer against the rules of its output, which a type cannot do. The cost is that the shell does more work. Also, an operation that must get data at its midpoint becomes two operations.

## General constructs only

The manifest has no keyword for errors, states, callers, events or clocks. You make each of these with general constructs:

| An idea | Built as |
| --- | --- |
| An error | An output object |
| A state and its changes | The stored record in the input, and rules of each output |
| Who can call | A caller object in the input, and rules |
| The time | A `format: date-time` string in the input |
| An event | A property of an output |

A manifest becomes longer. In return, each rule has a name and a message. The harness checks each rule on each call, a scenario can break each rule, and `diff` compares each rule. Because a refusal is an output and not an exception, `tsc` checks that the core returns only declared outputs. Also, the shell can know the difference between a refusal (`ok: true`) and a bug (`ContractViolation`).

## The words of JSON Schema, the rules of CEL

Most developers can already read JSON Schema. For this reason, the manifest uses the words of JSON Schema, with their meanings. But a contract must also have operations, named rules and rules that relate two or more values.

With named rules, a failure tells which rule broke, and `diff` can compare rules. For this reason, the keywords of JSON Schema are rules like all other rules. `minimum` has a name, a parameter, the text `self >= bound` and a message. One checker, one generator and `diff` use these rules and your rules in the same way.

Rules are in a subset of CEL, which Kubernetes and protovalidate use on schemas. This subset is small, and has no loops and no side effects. urn-forge parses the subset itself, because it must find the type of each rule, change each rule into TypeScript and SQL, and compare two rules.

## Conformance, not correctness

The gates show that the parts agree with the manifest. They do not show that the logic is correct.

| Check | It shows | It cannot show |
| --- | --- | --- |
| Gate 1 | Each operation has a function of the generated type | That the function calculates the correct value |
| Gate 2 | The shell calls the core only through the harness | A call from a file that gate 2 does not examine |
| Gate 3 | Each operation, output and rule of a definition has a scenario | That the scenario expects the correct value |
| Gate 4 | The generated files are the same as the files of a new compile | That the manifest is correct |
| The harness | Each input and each answer keeps the rules | That the core selected the correct permitted answer |
| `diff` | No change breaks a caller without a new major version | A change in what a value means, for example from cents to euros |

Only a person can say which answer is correct. The person says it in the scenarios. A static check finds what is not there, and a run finds what is wrong. CI must have the two. By default, a gap is a warning, so that a team can start to use urn-forge in steps.

The compiler reads no clock, no random value and no environment. Because of this, the same manifest gives the same bytes on all machines, and gate 4 uses this. If `diff` cannot find whether a change accepts more or less, it calls the change breaking. A false "breaking" costs a version number, but a false "compatible" costs a broken caller.

## What it cannot say yet

The shell does these tasks: authentication, the load of records, the delivery of events, the removal of duplicate requests, and the map to HTTP. When the data is in the input, the manifest can state rules about each of these tasks. The manifest cannot state some rules yet. These are time zones and calendar months, `filter`, `min()` or `max()` of a list, either-or shapes, maps with free keys, and check digits. Put these rules in the core, with a refusal as an output. Then test their edges.
