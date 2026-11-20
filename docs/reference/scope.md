# MVP scope

urn-forge is an MVP. It keeps the four links of the traceability chain (manifest, IR, generated contracts and the Gherkin check) and cuts everything that only adds breadth. Each cut item is in [spec v1.1](../project/spec-v1-1) and comes back later without reworking what exists.

| Area | The MVP has | Not yet |
| --- | --- | --- |
| Atom kinds | `field`, `entity`, `operation` | `invariant`, `event`, `error`, lifecycle metadata |
| Primitives | `integer`, `float`, `string` | `decimal`, `boolean`, `timestamp`, `list`, `record`, `ref` |
| Constraints | `min`, `max`, `notEqual`, `minLength`, `maxLength` | `regex`, `format`, `oneOf`, `precision` |
| Optionality | `required` per field reference | `nullable` |
| Operation input/output | Entities | Fields |
| Compiler passes | Meta-schema, expansion, uniqueness, references | Cycles, rule typing, constraint coherence, lifecycle |
| Determinism | Sorted output, no clock, fingerprint header | A CI run in another locale, `referenceDate` |
| Plugins | Valibot, FCIS (handlers return output directly) | `Result` type, Gherkin parameter types, Postgres |
| Gates | 1 completeness, 3 tags + headers, 4 drift | 2 lint profile, 3 boundary coverage, 5 compatibility |
| CLI | `compile`, `verify` | `init`, `diff`, `inspect`, `graph`, a config file |
| Diagnostics | Key or URN plus message | `file:line:col` for manifest problems, `--format json` |
| Distribution | Run from a clone | An npm package |

## Where the MVP departs from spec v1.1

The MVP plan found two conflicts in spec v1.1 and builds the proposed fix for each:

1. **Handlers return unbranded output.** The spec types handlers as returning branded output, but its lint gate forbids the core from minting brands. So handlers return the plain output shape, and `executeOperation` brands it by parsing.
2. **Feature tables may use output fields.** The spec allowed only input fields as table headers, which ruled out expected-output columns like `quotient`. Gate 3 allows fields from the operation's input or output.

See the [MVP plan](../project/mvp-plan) for the full build order.
