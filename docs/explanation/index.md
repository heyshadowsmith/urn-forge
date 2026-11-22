# Explanation

These pages tell why urn-forge works as it does. They give the context of each decision, the alternatives that the project did not use, and the limits. They do not give steps. For steps, use the [tutorials](../tutorials/) and the [how-to guides](../how-to/). For facts, use the [reference](../reference/).

## The pages

| Page | Topic |
| --- | --- |
| [The traceability chain](./traceability) | What urn-forge is, and why the chain from a URN to a scenario is the product |
| [URNs as permanent names](./urns) | The six segments, short keys, one manifest for each domain, and why a URN never changes its meaning |
| [The functional core and brands](./functional-core) | The core and the shell, brands as proof of a parse, and why handlers are synchronous |
| [Results and declared errors](./results-and-errors) | Why every handler returns a `Result`, the four ways that a call can fail, and events beside refusals |
| [Determinism and the fingerprint](./determinism) | Why the same input always gives the same bytes, and why drift is a byte comparison |
| [What the gates show](./what-the-gates-show) | Conformance, not correctness: what each gate shows and what it cannot show |
| [Boundary coverage and the ratchet](./boundary-coverage) | Why gate 3 looks for boundary values, and how a project makes the check strict |
| [Compatibility and the direction of use](./compatibility) | When a change to a URN breaks its consumers, and how a URN retires |
| [What a contract cannot say yet](./known-holes) | Contract and business logic, and the promises that a manifest cannot state at this time, with what to do in their place |
| [The MECE model of primitives](./primitives-model) | Why each kind of value has one primitive, and each constraint one aspect |
| [How urn-forge is built](./architecture) | The pipeline, the registries, and how `tsc` keeps them complete |
| [Dogfooding](./dogfooding) | How urn-forge tests itself, and what that found |
| [Departures from the specification](./departures-from-the-spec) | Each place where urn-forge differs from specification v1.1, and why |

## An order to read the pages

Each page stands alone. If you want to read all of them, use this order:

1. [The traceability chain](./traceability). It gives the idea that the other pages refer to.
2. [URNs as permanent names](./urns).
3. [The functional core and brands](./functional-core).
4. [Results and declared errors](./results-and-errors).
5. [What the gates show](./what-the-gates-show).
6. [Boundary coverage and the ratchet](./boundary-coverage).
7. [Compatibility and the direction of use](./compatibility).
8. [What a contract cannot say yet](./known-holes).
9. [The MECE model of primitives](./primitives-model).
10. [Determinism and the fingerprint](./determinism).
11. [How urn-forge is built](./architecture). Read this page first if you want to change urn-forge.
12. [Dogfooding](./dogfooding).
13. [Departures from the specification](./departures-from-the-spec). Read this page first if you know [specification v1.1](../project/spec-v1-1).

## Related pages

- [Tutorial: build the shipping domain](../tutorials/first-domain)
- [How-to guides](../how-to/)
- [Glossary](../reference/glossary)
- [Scope](../reference/scope)
