---
layout: home

hero:
  name: urn-forge
  text: One contract, and proof that each part agrees with it
  tagline: urn-forge gives a domain a single source of truth for its contract. It also gives proof that the schemas, the core and the scenarios agree with that contract.
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
    alt: A URN traced from the manifest through the generated code and the core to a feature that passes

features:
  - icon:
      light: /icons/manifest-light.svg
      dark: /icons/manifest-dark.svg
    title: Declare
    details: Write the contract of your domain in one YAML manifest. It has fields, entities, invariants, operations, events and errors. Each item has a short key and a permanent URN.
  - icon:
      light: /icons/contracts-light.svg
      dark: /icons/contracts-dark.svg
    title: Derive
    details: The urn-forge compile command makes Valibot schemas and a typed runtime from the manifest. Your core gets only parsed values, and it can return only the errors that you declare.
  - icon:
      light: /icons/gate-light.svg
      dark: /icons/gate-dark.svg
    title: Prove
    details: The urn-forge verify command type-checks the core, examines the brands, traces each Gherkin scenario to a URN and finds manual edits. The urn-forge diff command finds changes that break callers.
---

## Where to go

| Section | Use it when |
| --- | --- |
| [Tutorials](./tutorials/) | You are new. Start with [Build the shipping domain](./tutorials/first-domain) |
| [How-to guides](./how-to/) | You have a task to do, for example to declare an error |
| [Reference](./reference/) | You must find a fact, for example a manifest key or a diagnostic code |
| [Explanation](./explanation/) | You want to know why urn-forge operates as it does |

If you want to change urn-forge itself, read [CONTRIBUTING.md](https://github.com/heyshadowsmith/urn-forge/blob/main/CONTRIBUTING.md).
