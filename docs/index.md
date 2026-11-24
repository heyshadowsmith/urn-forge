---
layout: home

hero:
  name: urn-forge
  text: One contract, and proof that each part agrees with it
  tagline: Write the contract of a domain in one YAML manifest. urn-forge makes a harness that checks each input and each answer of your code, and gates that fail CI when the code, the scenarios or a change break the contract.
  actions:
    - theme: brand
      text: Start the tutorial
      link: /tutorials/first-domain
    - theme: alt
      text: What is the contract?
      link: /explanation/the-contract
    - theme: alt
      text: Reference
      link: /reference/
  image:
    src: /hero-trace.svg
    alt: The manifest traced through the generated code and the core to a feature that passes

features:
  - icon:
      light: /icons/manifest-light.svg
      dark: /icons/manifest-dark.svg
    title: Declare
    details: Write definitions, rules and operations in YAML. The words are the words of JSON Schema, such as type, minimum and required. Each rule is an expression in a subset of CEL.
  - icon:
      light: /icons/contracts-light.svg
      dark: /icons/contracts-dark.svg
    title: Generate
    details: The urn-forge compile command writes TypeScript types, a check for each definition, and runOperation, a harness that checks the input before your core runs and the answer after it.
  - icon:
      light: /icons/gate-light.svg
      dark: /icons/gate-dark.svg
    title: Prove
    details: The urn-forge verify command type-checks the core, finds calls that skip the harness, asks for a scenario for each output and each rule, and finds manual edits. The urn-forge diff command finds changes that break callers.
---

## Where to go

| Section | Use it when |
| --- | --- |
| [Tutorials](./tutorials/) | You are new. Start with [Build the shipping domain](./tutorials/first-domain) |
| [How-to guides](./how-to/) | You have a task to do, for example to declare a refusal |
| [Reference](./reference/) | You must find a fact, for example a standard rule or a diagnostic code |
| [Explanation](./explanation/) | You want to know why urn-forge operates as it does |

This site describes urn-forge 0.2.0. If you want to change urn-forge itself, read [CONTRIBUTING.md](https://github.com/heyshadowsmith/urn-forge/blob/main/CONTRIBUTING.md).
