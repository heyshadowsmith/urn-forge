# MVP scope

urn-forge is an MVP. It keeps the four links of the traceability chain: the manifest, the IR, the generated contracts and the Gherkin check. It does not have the parts that only make the product larger. [Specification v1.1](../project/spec-v1-1) contains each of these parts. Later versions will add them, without a change to the current parts.

| Area | Parts in the MVP | Parts not in the MVP at this time |
| --- | --- | --- |
| Atom kinds | `field`, `entity`, `operation`. `error` is in progress: urn-forge examines error entries, but the plugins do not make code for them at this time. Refer to the [error kind plan](../project/error-kind-plan) | `invariant`, `event`, lifecycle data |
| Primitives | `boolean`, `integer`, `float`, `string` | `decimal`, `timestamp`, `list`, `record`, `ref` |
| Constraints | `mustBe`, `min`, `max`, `notEqual`, `minLength`, `maxLength`, `regex`, `oneOf` | `format`, `precision` |
| Optional fields | `required` on each field reference | `nullable` |
| Operation input and output | Entities | Fields |
| Compiler passes | Meta-schema, expansion, uniqueness, references, constraint coherence | Cycles, rule types, lifecycle |
| Deterministic output | Sorted output, no clock, fingerprint header, a CI run in a different locale and time zone | `referenceDate` |
| Plugins | Valibot and FCIS. Handlers return the output directly | The `Result` type, Gherkin parameter types, Postgres |
| Gates | 1 (completeness), 3 (tags and headers), 4 (drift) | 2 (lint profile), the boundary coverage part of 3, 5 (compatibility) |
| CLI | `compile`, `verify`, a [configuration file](./config) | `init`, `diff`, `inspect`, `graph` |
| Diagnostics | A stable code, `file:line:col`, the key or URN and a message. `--format json` | — |
| Distribution | Run from a clone of the repository. Packages in the same workspace can import `urn-forge`, `urn-forge/config` and `urn-forge/cucumber` | An npm package with compiled JavaScript |

## Differences from specification v1.1

The MVP plan found two conflicts in specification v1.1. The MVP uses the proposed correction for each conflict:

1. **Handlers return output without a brand.** The specification gives handlers a branded output type. But the lint gate of the specification does not let the core make brands. As a result, a handler returns the plain output shape, and `executeOperation` adds the brand when it parses the output.
2. **Feature tables can use output fields.** The specification accepts only input fields as table headers. This rule does not let a table have a column for an expected output, for example `quotient`. Gate 3 accepts fields from the input or the output of the operation.

For the full sequence of the build, refer to the [MVP plan](../project/mvp-plan).
