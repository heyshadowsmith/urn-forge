# What is urn-forge?

urn-forge is a compiler and a CI gate for domain contracts. You declare the atoms of a domain (its fields, entities and operations) in a YAML manifest, and urn-forge gives each one a permanent URN:

```
urn:<namespace>:<domain>:<context>:<kind>:<identifier>
urn:demo:math:arithmetic:operation:safe_divide
```

From that one declaration, urn-forge generates TypeScript contracts, checks that your hand-written code implements them, and checks that your Gherkin features exercise them. If any link breaks, `urn-forge verify` fails the build.

## The traceability chain

The MVP proves one claim: **a URN declared in YAML traces to a typed handler and a passing Gherkin scenario, and CI fails when any link in that chain breaks.**

| Link | What it is | Who writes it | What breaks it |
| --- | --- | --- | --- |
| Manifest | `domain.manifest.yaml` declares fields, entities and operations | You | Invalid structure, dangling references, name collisions |
| IR | A sorted, fully resolved graph of URNs | `urn-forge compile` | Nothing: it is derived from the manifest |
| Generated contracts | Valibot schemas, handler types, `executeOperation` | `urn-forge compile` | Hand edits, or not recompiling after a manifest change (gate 4) |
| Core | `export const core = { … } satisfies DomainCoreImplementation` | You | A missing or mistyped handler (gate 1) |
| Features | `.feature` files tagged `@urn:…:operation:…` | You | Unknown tags, untagged operations, wrong table headers (gate 3), failing scenarios (Cucumber) |

## How the pieces fit

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

1. **`compile`** validates the manifest, builds the IR and runs two plugins. Every generated file starts with an `@generated` header and a fingerprint, so the output for a given input is byte-for-byte reproducible.
2. **Your core** is plain, synchronous functions keyed by operation URN. Each one receives *branded* input (already parsed and validated) and returns a plain output object.
3. **`executeOperation`** is the shell's gatekeeper. It parses the raw payload, calls your handler, then parses (and so brands) the handler's output. Bad input never reaches the core, and output that breaks the contract is reported as a `ContractViolation`.
4. **Features** describe behavior in terms of field names. Three generic steps, which ship with urn-forge, read the operation URN from the feature's tag and call `executeOperation`.
5. **`verify`** checks the links statically, without running anything. Cucumber then checks that the scenarios pass.

## Functional core, imperative shell

The generated runtime follows the FCIS pattern. The **core** holds your business logic: pure, synchronous and free of I/O. The **shell** (the generated `executeOperation`, plus whatever calls it) handles parsing, validation and anything effectful. Branded types make the boundary visible in the type system: only a generated parser can produce an `ArithmeticDivisor`, so a handler that receives one knows its value has already passed `notEqual: 0`.

## Where to go next

- [Getting started](./getting-started) walks through the math example end to end.
- [Writing a manifest](./manifest) covers every key the MVP accepts.
- [MVP scope](../reference/scope) lists what the full spec has that the MVP doesn't yet.
