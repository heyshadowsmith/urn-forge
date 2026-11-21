---
layout: home

hero:
  name: urn-forge
  text: One URN, traced from end to end
  tagline: Write your domain in a YAML file. urn-forge makes typed contracts, a runtime gatekeeper and Gherkin checks. CI fails if a link in the chain breaks.
  actions:
    - theme: brand
      text: Start here
      link: /guide/getting-started
    - theme: alt
      text: What is urn-forge?
      link: /guide/what-is-urn-forge
    - theme: alt
      text: CLI reference
      link: /reference/cli
  image:
    src: /hero-trace.svg
    alt: A URN traced from the manifest through the IR, the generated contracts and core.ts to a feature that passes

features:
  - icon:
      light: /icons/manifest-light.svg
      dark: /icons/manifest-dark.svg
    title: A manifest of URNs
    details: You write fields, entities, operations and errors in one YAML file. Each item has a permanent URN, for example urn:demo:math:arithmetic:operation:safe_divide.
  - icon:
      light: /icons/contracts-light.svg
      dark: /icons/contracts-dark.svg
    title: Generated contracts
    details: The urn-forge compile command writes branded Valibot schemas, typed handler contracts and an executeOperation gatekeeper. The output is the same each time.
  - icon:
      light: /icons/trace-light.svg
      dark: /icons/trace-dark.svg
    title: Features linked to URNs
    details: Put an operation URN tag on a feature. Five generic steps send it through the real gatekeeper. You do not write glue code for each operation.
  - icon:
      light: /icons/gate-light.svg
      dark: /icons/gate-dark.svg
    title: A gate for each link
    details: The urn-forge verify command makes CI fail for three errors. A handler is not there, a table header is not a field, or a person edits a generated file.
---
