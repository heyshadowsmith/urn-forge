# The core and the shell

urn-forge divides an application into two parts. The core holds the business logic. The shell holds everything else: the transport, the I/O, and the call to `runOperation`. urn-forge is a harness between the two: it checks what goes into the core and what comes out. This page tells why urn-forge uses this design, and what it costs.

## Functional core, imperative shell

The core is an object with a function for each operation. A function is plain and synchronous. It receives data and returns data. It does no I/O.

The shell reads a request, loads data, calls `runOperation`, and writes the result. The generated `runOperation` checks the input, calls the function of the core, and checks its answer.

This division has these advantages:

- **A core is easy to test.** A scenario only has to give an input and read the answer. The Cucumber steps of urn-forge do exactly this.
- **A core is deterministic.** It has no clock, no network and no database, so the same input always gives the same answer.
- **Untrusted data has one entrance.** The core never sees a value that did not pass the checks of its definition.

The functions are synchronous for the same reason. The generated type of a function returns an answer, not a `Promise`, so `tsc` refuses an `async` function at gate 1. If an operation needs data from a database, the shell loads the data and puts it in the input. The same is true for the time and the caller. Refer to [Model a stored record, the caller and the time](../how-to/model-the-input).

## A harness, not a framework of the logic

urn-forge does not run your application. It does not route requests, open transactions or call a database. It makes one file, with a schema and a check for each definition and a harness for each operation. With `postgres` in the config, it also makes a schema of tables and a store file. The store file gives the statements of a write or a read, and the shell runs them with its own driver, in its own transaction. The business logic stays in your code, in plain TypeScript.

The harness checks both sides of the core:

- **Before the core runs**, it checks the input against its definition: the structure, then each rule. A bad input never reaches the core.
- **After the core answers**, it checks that the answer is one of the outputs of the operation, that its value keeps the rules of its definition, and that the rules of that output and of the operation hold.

The second check is the important one. Types can show that a function returns a `Quote`. They cannot show that a quote comes back only for a parcel that fits express delivery, or that a refusal names the weight of the request. The rules of an output can, and the harness checks them on each call.

## Four ways that a call ends

| Result | Cause | Who must act |
| --- | --- | --- |
| `ok: true`, with an output | The core answered, and the answer keeps the contract. The output can be a refusal | The shell sends the answer. A refusal is a normal answer for the caller |
| `ok: false`, `kind: 'InputRejected'` | The input broke a rule. The core did not run | The caller. The request was not valid |
| `ok: false`, `kind: 'ContractViolation'` | The core answered what the contract does not allow | The team that owns the core. This is a bug |
| An exception | The core threw. `runOperation` does not catch it | The shell, as for any other fault |

Each result has its own shape, so the shell can map each one to a response, for example an HTTP status. urn-forge does not make this map.

## A refusal is an output

A refusal, such as `too_heavy_for_express`, is an output like any other. It is not an exception and not a special kind:

- The type of the function lists it, so `tsc` makes sure that the core returns only outputs of the operation.
- Gate 3 asks for a scenario that ends with it.
- Rules say when it can come back, and the harness checks them.
- The shell can tell a refusal from a bug: a refusal is `ok: true`, and a bug is `ContractViolation`.

## Why the core does not check its input

The core gets a value of the generated type, for example `Parcel`, and it trusts it. It does not check the weight again. This trust is safe only if each call goes through the harness. Gate 2 makes sure of it: a shell file that calls a function of the core directly fails with `direct-call`.

## What the design costs

- **The shell has more work.** Each read and write moves to the shell. An operation that needs data in the middle of its logic must become two operations, or must get all the data before the call.
- **The input is larger.** A stored record, the caller and the time are properties of the input, so each input object has more properties than the request of the caller.
- **The types do not stop all mistakes in the output.** A core can put a weight into a price, because both are numbers. Only the rules of the output, and the scenarios, find this mistake.

## Related pages

- [Call an operation](../how-to/call-an-operation)
- [Declare a refusal](../how-to/declare-a-refusal)
- [The generated code](../reference/generated-code)
