# What is urn-forge?

urn-forge is a compiler and a CI gate for domain contracts. You write the parts of a domain in a YAML manifest. These parts are fields, entities and operations. urn-forge gives each part a permanent URN:

```
urn:<namespace>:<domain>:<context>:<kind>:<identifier>
urn:demo:math:arithmetic:operation:safe_divide
```

urn-forge uses this one declaration to do three tasks:

1. It generates TypeScript contracts.
2. It makes sure that your code obeys the contracts.
3. It makes sure that your Gherkin features test the contracts.

If a link in this chain breaks, `urn-forge verify` makes the build fail.

## The traceability chain

The MVP shows one claim: **a URN in a YAML file traces to a typed handler and to a Gherkin scenario that passes. CI fails if a link in that chain breaks.**

| Link | Description | Author | Cause of a failure |
| --- | --- | --- | --- |
| Manifest | `domain.manifest.yaml` declares fields, entities and operations | You | A structure that is not correct, a reference to an item that is not there, or two items with the same name |
| IR | A sorted graph of URNs with all references resolved | `urn-forge compile` | None. urn-forge makes the IR from the manifest |
| Generated contracts | Valibot schemas, handler types and `executeOperation` | `urn-forge compile` | A person edits a generated file, or does not compile again after a manifest change (gate 4) |
| Core | `export const core = { … } satisfies DomainCoreImplementation` | You | A handler that is not there or that has the wrong type (gate 1) |
| Features | `.feature` files with a `@urn:…:operation:…` tag | You | An unknown tag, an operation with no feature, or a wrong table header (gate 3). Also, a scenario that fails in Cucumber |

## How the parts connect

```
domain.manifest.yaml
        │  urn-forge compile
        ▼
   meta-schema ─▶ IR builder ─▶ Valibot plugin ─▶ domain.schemas.generated.ts
                               └▶ FCIS plugin   ─▶ domain.runtime.generated.ts
                                                        │
          your core.ts ── satisfies DomainCoreImplementation
                                                        │
          your *.feature ── generic steps ─▶ executeOperation(urn, payload, core)

urn-forge verify: gate 1 (tsc + satisfies) · gate 3 (tags + headers) · gate 4 (drift)
```

1. **`compile`** validates the manifest, builds the IR and runs two plugins. Each generated file starts with an `@generated` header and a fingerprint. The same input always gives the same bytes.
2. **Your core** is a set of plain, synchronous functions. Each function has the URN of its operation as its key. Each function receives *branded* input, which the shell parsed and validated before. Each function returns `ok(output)`, or `fail(…)` with an error that its operation declares.
3. **`executeOperation`** is the gatekeeper of the shell. It parses the raw payload and calls your handler. Then it parses the output or the declared error of the handler, which brands it. Input that is not correct does not go to the core. If the result breaks the contract, `executeOperation` gives a `ContractViolation`.
4. **Features** tell the behavior with field names. urn-forge supplies three generic steps. These steps read the operation URN from the tag of the feature and call `executeOperation`.
5. **`verify`** does a static check of the links. It does not run the code. Then Cucumber makes sure that the scenarios pass.

## Functional core, imperative shell

The generated runtime uses the FCIS pattern:

- The **core** contains your business logic. It is pure and synchronous, and it does no I/O.
- The **shell** does the parse, the validation and the I/O. The generated `executeOperation` is part of the shell, and so is the code that calls it.

Branded types show this boundary in the type system. Only a generated parser can make an `ArithmeticDivisor`. As a result, a handler that receives an `ArithmeticDivisor` knows that the value is not zero.

## Next steps

- Read [First steps](./getting-started) to build the math example from start to end.
- Read [The manifest](./manifest) for each key that the MVP accepts.
- Read [MVP scope](../reference/scope) for the parts of the full specification that the MVP does not have.
