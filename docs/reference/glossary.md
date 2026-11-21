# Glossary

This page gives each term that this site uses, in alphabetical sequence. The pages of the site use each term with this definition only.

| Term | Definition |
| --- | --- |
| **atom** | One declaration in the manifest: a field, an entity, an operation or an error. Each atom has one URN. |
| **boundary case** | A value that gate 3 must find in the scenarios of an operation for a constrained input field, for example the value at `min` and the value at `min − 1`. Refer to [Primitives and constraints](./primitives). |
| **boundary coverage** | The check of gate 3 that the scenarios of each operation send each boundary case of its input fields. A case that is not there causes `uncovered-boundary`. |
| **`boundaryCoverage`** | The setting that makes the coverage gaps of gate 3 warnings (`warn`, the default) or errors (`error`). Refer to [The configuration file](./configuration). |
| **brand** | A TypeScript type mark that only a generated schema adds to a value, with `v.brand("<field URN>")`. A value with a brand has passed the schema of its field. |
| **brand identifier** | The PascalCase form of the context and the identifier of an atom, for example `OrderUnitCost`. The generated export names start with it. Refer to [URNs and names](./naming). |
| **category** | A property of an error: `validation`, `conflict`, `not_found`, `forbidden` or `precondition`. The shell can use it. The core does not read it. |
| **coherence** | The agreement of the constraints of one field: they accept one or more values. Pass 7 examines it. |
| **compile** | The command that examines the manifest and writes the generated files. Refer to [The CLI](./cli). |
| **configuration file** | The file `urn-forge.config.ts`, which gives the paths, `boundaryCoverage` and the plugins of a project. |
| **constraint** | A property of a field that limits its values, for example `min` or `regex`. Each primitive accepts a fixed set of constraints. |
| **context** | The first segment of a short key. It groups atoms of one subject, for example `order`. |
| **contract** | The generated types and schemas of an operation: its input, its output, its declared errors and its handler type. |
| **ContractViolation** | A result of `executeOperation` when the core breaks its contract. Examples: the handler returns an undeclared error, an output that its schema rejects, or a value that is not a `Result`. It shows a defect in the core. |
| **core** | The handlers of a project, in the core entry file. The core receives only values with a brand and does no I/O. |
| **core entry** | The file that exports the core with `satisfies DomainCoreImplementation`. The default is `src/core.ts`. Gate 1 type-checks it. |
| **declared error** | An error that an operation lists in its `errors`. Its handler can return it with `fail(…)`. |
| **diagnostic** | One problem that urn-forge reports, with a file, a position, a severity, a code and a message. Refer to [Diagnostics](./diagnostics). |
| **diagnostic code** | The stable name of a kind of problem, for example `unresolved-ref`. |
| **DispatchMap** | The generated constant that gives, for each operation URN, the schemas and field data of its input, its output and its declared errors. |
| **DomainCoreImplementation** | The generated interface that maps each operation URN to its handler type. The core must use `satisfies DomainCoreImplementation`. |
| **DomainError** | A result of `executeOperation` when the handler returns a declared error. It has the URN, the category, the `retryable` value, the message and the fields of the error. |
| **drift** | A difference between a generated file in the repository and the output of a new compile. Gate 4 finds it. |
| **entity** | A kind of atom: a named group of field references. The input and the output of an operation are entities. |
| **error** | A kind of atom: a named refusal of an operation. The operation refused, and nothing changed. |
| **executeOperation** | The generated function that the shell calls. It parses the input, calls the handler, and parses the output or the declared error. |
| **feature** | A Gherkin `.feature` file. It contains scenarios. The feature or its scenarios have tags with the URN of an operation. |
| **field** | A kind of atom: one value, with a primitive and constraints. |
| **field reference** | An item of the `fields` list of an entity or an error: `ref` and `required`. |
| **fingerprint** | A SHA-256 hash of the IR, the plugin names, versions and configurations, and the urn-forge version. Each generated file has it in its header. |
| **gate** | One check of the `verify` command: 1 (completeness), 3 (Gherkin traceability) or 4 (drift). A gate fails if it finds an error. Refer to [Verification gates](./verification-gates). |
| **generated file** | A file that `compile` writes: `domain.schemas.generated.ts` or `domain.runtime.generated.ts`. If a person edits it, gate 4 fails. |
| **Gherkin** | The language of the feature files: `Feature`, `Scenario`, `Given`, `When`, `Then` and tables. Cucumber runs it. |
| **handler** | The function in the core for one operation. It receives the input with a brand and returns a `Result`. |
| **header** | The `manifest` key of the manifest: `namespace`, `domain`, `version` and `stability`. |
| **identifier** | The third segment of a short key, for example `unit_cost`. In an entity or an error, the identifier of a field is its property name. |
| **input** | The entity that an operation receives. |
| **InputRejected** | A result of `executeOperation` when the input schema rejects the payload. It shows an incorrect request, not a defect in the core. |
| **IR** | The intermediate representation: the result of the compiler passes, with URNs and sorted keys. The plugins and the gates read only the IR. |
| **kind** | The second segment of a short key: `field`, `entity`, `operation` or `error`. |
| **`kind` property** | The property of each error payload that contains the URN of the error. No field of an error can use this name. |
| **manifest** | The YAML file that declares the atoms of one domain. Refer to [The manifest](./manifest). |
| **message template** | The `message` of an error. Each `{placeholder}` names a mandatory field of the error. |
| **note** | A diagnostic that gives information only. It does not fail a command, and `verify` does not count it. |
| **operation** | A kind of atom: a handler contract with an input entity, an output entity and declared errors. |
| **output** | The entity that an operation returns when it succeeds. |
| **pass** | One step of the compiler, from 1 to 8 in the specification. urn-forge 0.1.0 has passes 1 to 4, 6 and 7. Refer to [Compiler passes](./compiler-passes). |
| **placeholder** | A name in braces in the message of an error, for example `{sku}`. The runtime puts the value of the field in its place. |
| **plugin** | A part of urn-forge that makes generated files from the IR: `valibot` or `fcis`. |
| **primitive** | The base type of a field: `boolean`, `float`, `integer` or `string`. |
| **property name** | The name of a field in an entity or an error payload. It is the identifier of the field. |
| **ratchet** | The change of `boundaryCoverage` from `warn` to `error` when each feature is strict. After the change, a new feature is strict too. |
| **Result** | The return type of each handler: `ok(value)` or `fail(errorUrn, fields)`. |
| **retryable** | A property of an error. `true` means that the same request can be correct at a later time. |
| **scenario** | One example in a feature. It runs the operation with a table of input values and examines the result. |
| **Scenario Outline** | A scenario that Cucumber runs one time for each row of its `Examples` table. |
| **severity** | The level of a diagnostic: `error`, `warning` or `note`. |
| **shell** | The code that calls `executeOperation`. It does the I/O and handles the results. |
| **short key** | The name of an atom in the manifest: `<context>.<kind>.<identifier>`, for example `order.field.quantity`. |
| **stability** | A property of the header: `stable` (the default) or `experimental`. urn-forge 0.1.0 writes it to the IR and does not use it for a check. |
| **step** | One line of a scenario, for example `When I run the operation with:`. urn-forge gives five generic steps. Refer to [Gherkin steps](./gherkin-steps). |
| **strict** | A feature with the tag `@urn-forge:strict`. The coverage gaps of its operations are errors, also if `boundaryCoverage` is `warn`. |
| **UnknownOperation** | A result of `executeOperation` when the URN is not an operation of the domain. |
| **URN** | The permanent name of an atom: `urn:<namespace>:<domain>:<context>:<kind>:<identifier>`. Refer to [URNs and names](./naming). |
| **verify** | The command that compiles the manifest in memory and runs the gates. |
| **waiver** | A comment `# urn-forge:waive <field URN> <reason>` in a feature file. It removes the boundary gaps of one field, and `verify` shows it as a note. |
| **warning** | A diagnostic that does not fail a command. `verify` counts it in its last line. |

## Related pages

- [URNs and names](./naming)
- [Diagnostics](./diagnostics)
- [The traceability chain](../explanation/traceability)
- [The functional core and brands](../explanation/functional-core)
