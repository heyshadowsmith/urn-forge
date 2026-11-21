# The traceability chain

urn-forge is a compiler and a CI gate for domain contracts. You declare the atoms of a domain once, in a YAML manifest: fields, entities, invariants, operations, events and errors. Each atom gets a URN, a name that does not change. urn-forge then makes sure that the same URN connects the declaration, the code that implements it and the scenario that tests it. This page tells why that connection is the product.

## One URN, six links

Each link in the chain holds the URN of the operation. The shipping domain of the [first tutorial](../tutorials/first-domain) has one operation, `urn:demo:shipping:quote:operation:quote_shipping`. These are the places where its URN occurs:

1. **The manifest.** You write the atom with a short key. The header of the manifest gives the namespace and the domain.

   ```yaml
   quote.operation.quote_shipping:
     description: Calculate the price to send a parcel
     input: parcel.entity.parcel
     output: quote.entity.quote
   ```

2. **The IR.** `compile` expands the short key to the full URN, resolves each reference and sorts the result. Each node has its URN as its key.

   ```json
   "urn:demo:shipping:quote:operation:quote_shipping": {
     "brandIdentifier": "QuoteQuoteShipping",
     "description": "Calculate the price to send a parcel",
     "emits": [],
     "errors": [],
     "input": "urn:demo:shipping:parcel:entity:parcel",
     "output": "urn:demo:shipping:quote:entity:quote",
     "urn": "urn:demo:shipping:quote:operation:quote_shipping"
   }
   ```

3. **The generated contracts.** The FCIS plugin writes a handler type for the operation, and a registry that has the URN as a key.

   ```ts
   export interface DomainCoreImplementation {
     readonly 'urn:demo:shipping:quote:operation:quote_shipping': QuoteQuoteShippingHandler;
   }
   ```

4. **The core.** Your handler has the same URN as its key. The `satisfies` clause connects it to the registry.

   <<< @/../packages/urn-forge/tutorial/1-first-domain/core.ts

5. **The features.** The feature file has the URN as a tag. The generic steps read the tag to find the operation that they call.

   ```gherkin
   @urn:demo:shipping:quote:operation:quote_shipping
   Feature: Shipping quotes
   ```

6. **The gates.** `urn-forge verify` examines the links without a run of the code. Gate 1 finds a handler that is not there. Gate 3 finds an operation with no tagged feature, or a table column that is not a field. Gate 4 finds a generated file that is not equal to a fresh compile.

A Cucumber run then sends each scenario through `executeOperation`, with the URN from the tag. Thus the scenario tests the handler that the manifest declares, and no other code.

## Why traceability is the product

[Specification v1.1](../project/spec-v1-1) says it directly: "That traceability, from declaration to handler to scenario, is the product. Schema-to-type codegen is table stakes."

Many tools make TypeScript types from a schema. Valibot and Zod infer types from a schema in code. OpenAPI and JSON Schema tools make types from a document. None of these tools can tell you that a declared operation has a handler and a scenario. They also cannot tell you that the scenario uses the names of real fields. These questions need one name that all three parts share, and a check that reads all three parts.

The URN is that name. The generated code is only the means to connect the parts. This choice has these results:

- urn-forge makes little code: one schema file and one runtime file. It does not try to make a full application.
- urn-forge writes custom checks only where other tools cannot see. `tsc` already finds a handler that is not there or that has the wrong type, so gate 1 uses `tsc`. Gate 3 is the main custom gate, because no other tool connects Gherkin to a manifest.
- Each diagnostic names a URN. When a link breaks, the message tells you which atom is the cause.

## Why the chain came first

Specification v1.0 put the Gherkin check last on the roadmap. Version 1.1 moved it into the first slice of the work, because traceability is the part that makes urn-forge different. If the idea did not pay off, the project had to know early.

The [MVP plan](../project/mvp-plan) thus proved one claim before it added breadth. A URN in YAML traces to a typed handler and to a Gherkin scenario that passes. CI fails when a link in that chain breaks. It used a small math domain with three primitives and three kinds.

The MVP was done when CI turned red on three one-line changes: a deleted handler, a renamed table column and a hand-edited generated file. The later work added declared errors and boundary coverage to the same chain. It did not change the chain.

## The limits of the chain

The chain shows that the parts agree. It does not show that the handler logic is correct. A handler that returns the wrong price still satisfies its type, and a scenario with the wrong expected value can still exist. The Cucumber run shows if a scenario passes, but a scenario only tests the cases that someone wrote. [What the gates show](./what-the-gates-show) gives the full limits of each gate.

The chain also covers one domain at a time. A manifest cannot refer to atoms in a different manifest. [URNs as permanent names](./urns) tells why.

## Related pages

- [Tutorial: build the shipping domain](../tutorials/first-domain)
- [URNs as permanent names](./urns)
- [What the gates show](./what-the-gates-show)
- [Verification gates](../reference/verification-gates)
- [Scope](../reference/scope)
