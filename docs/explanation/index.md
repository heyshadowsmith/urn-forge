# Explanation

These pages tell why urn-forge works as it does. They do not give steps. For steps, use the [tutorials](../tutorials/) and the [how-to guides](../how-to/). For facts, use the [reference](../reference/).

- [The contract](./the-contract): what a domain contract is, how the manifest states it, the test of declared, and what a manifest cannot state.
- [General constructs only](./general-constructs): why urn-forge has no construct for an idea of one domain, and what it removed for this reason.
- [JSON Schema's words and CEL](./json-schema-and-cel): why the manifest uses the words of JSON Schema, rules in a subset of CEL, and operations in the shape of TypeSpec.
- [The core and the shell](./core-and-shell): why the core is a plain function, what the harness checks, and how a call ends.
- [How urn-forge proves it](./how-urn-forge-proves-it): the chain from the manifest to a scenario, what each gate shows, and why the output is always the same.
- [Compatibility](./compatibility): when a change breaks callers, and how the version tells them.
