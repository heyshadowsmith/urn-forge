---
layout: home

hero:
  name: urn-forge
  text: One URN, traced end to end
  tagline: Declare your domain in YAML. Get typed contracts, a runtime gatekeeper and Gherkin checks, plus a CI gate that fails when any link in the chain breaks.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: What is urn-forge?
      link: /guide/what-is-urn-forge
    - theme: alt
      text: CLI reference
      link: /reference/cli
  image:
    src: /hero-trace.svg
    alt: A URN traced from manifest.yaml through the IR, generated contracts and core.ts to a passing feature

features:
  - icon:
      light: /icons/manifest-light.svg
      dark: /icons/manifest-dark.svg
    title: A manifest of URNs
    details: Fields, entities and operations live in one YAML file. Each gets a permanent URN such as urn:demo:math:arithmetic:operation:safe_divide.
  - icon:
      light: /icons/contracts-light.svg
      dark: /icons/contracts-dark.svg
    title: Generated contracts
    details: urn-forge compile writes branded Valibot schemas, typed handler contracts and an executeOperation gatekeeper, deterministically.
  - icon:
      light: /icons/trace-light.svg
      dark: /icons/trace-dark.svg
    title: Features that trace back
    details: Tag a feature with an operation URN, and three generic steps run it through the real gatekeeper. No glue code per operation.
  - icon:
      light: /icons/gate-light.svg
      dark: /icons/gate-dark.svg
    title: A gate for every link
    details: urn-forge verify fails CI on a missing handler, a table header that isn't a field, or a hand-edited generated file.
---
