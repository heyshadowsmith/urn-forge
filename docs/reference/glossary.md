# Glossary

| Term | Definition |
| --- | --- |
| **atom** | One declaration in the manifest: a field, an entity, an invariant, an operation, an event or an error. Each atom has one URN. |
| **boundary case** | A value that gate 3 must find in the scenarios for a constrained input field, for example `min` and `min − 1`. Refer to [Primitives and constraints](./primitives). |
| **boundary coverage** | The check of gate 3 that the scenarios of each operation send each boundary case. A missing case causes `uncovered-boundary`. |
| **boundary discipline** | Gate 2: no core file and no shell file makes a branded value without a parse. |
| **brand** | A TypeScript type mark that only a generated schema adds. A value with a brand has passed the schema of its field. |
| **brand identifier** | The PascalCase form of the context and the identifier of an atom, for example `OrderUnitCost`. Generated export names start with it. |
| **breaking change** | A change after which a consumer that worked before can fail. `urn-forge diff` reports it as `breaking-change`. |
| **category** | A property of an error: `validation`, `conflict`, `not_found`, `forbidden` or `precondition`. The shell can use it. |
| **coherence** | The constraints of one field accept one or more values. Else `compile` reports `incoherent-constraints`. |
| **compatible change** | A change after which no consumer that worked before can fail, for example a new optional property. |
| **constraint** | A property of a field that limits its values, for example `min` or `regex`. |
| **context** | The first segment of a short key, for example `order`. It groups the atoms of one subject. |
| **contract** | The generated types and schemas of an operation: input, output, declared errors, events and handler type. |
| **ContractViolation** | A result of `executeOperation` when the core breaks its contract, for example with an undeclared error. It shows a defect in the core. |
| **core** | The handlers of a project. The core receives branded values, does no I/O and makes no branded value. |
| **core entry** | The file that exports the core with `satisfies DomainCoreImplementation`. The default is `src/core.ts`. |
| **core file** | The core entry, or a file in its directory that it imports. Gate 2 examines each core file. |
| **declared error** | An error that an operation lists in `errors`. The handler returns it with `fail(…)`. |
| **deprecated** | A `status` of an atom. Its code stays, with a mark. A reference from an active atom is the warning `deprecated-ref`. |
| **diagnostic** | One problem that urn-forge reports, with a file, a position, a severity, a code and a message. Refer to [Diagnostics](./diagnostics). |
| **diff** | The command `urn-forge diff`, gate 5. It classifies each change between two manifests as `compatible`, `breaking` or `lifecycle`. |
| **direction of use** | How a consumer uses a URN: In (callers send it), Out (callers receive it) or Stored (in a table). The class of a change depends on it. |
| **DispatchMap** | The generated constant that gives the schemas and field data of each operation. |
| **DomainCoreImplementation** | The generated interface that maps each operation URN to its handler type. |
| **DomainError** | A result of `executeOperation` when the handler returns a declared error. It has the URN, category, `retryable`, message, fields and, with `recordAs`, the `record`. |
| **drift** | A difference between a generated file and the output of a new compile. Gate 4 finds it. |
| **embedded entity** | An entity that a property holds as an object, with `ref: <entity>`. Its invariants apply inside each object. |
| **emit** | To return an event: `ok(value, [emit(eventUrn, fields)])`. Only the events in `emits` are correct. |
| **entity** | A kind of atom: a named group of properties. The input and the output of an operation are entities. |
| **error** | A kind of atom: a named refusal of an operation. Nothing changed. |
| **event** | A kind of atom: a fact that an operation returns when it succeeds. An event never tells of a refusal. |
| **executeOperation** | The generated function that the shell calls. It parses the input, calls the handler, and parses the result. |
| **feature** | A Gherkin `.feature` file of scenarios, tagged with the URN of an operation. |
| **field** | A kind of atom: one value, with a primitive and constraints. |
| **field reference** | An item of the `fields` list of an entity, an event or an error. It makes one property. |
| **fingerprint** | A SHA-256 hash in the header of each generated file. The same manifest, plugins and urn-forge version give the same fingerprint. |
| **forge** | To make a branded value without a parse: a type assertion, an `any` value or a `@ts-` comment. Gate 2 refuses it. |
| **gate** | One check: 1 completeness, 2 boundary discipline, 3 Gherkin traceability and 4 drift in `verify`, and 5 compatibility in `diff`. Refer to [Verification gates](./verification-gates). |
| **generated file** | A file that `compile` writes. If you edit it, gate 4 fails. |
| **guard** | `x is present and …` or `x is absent or …` in a rule. A rule can use an optional property only after a guard. |
| **handler** | The function in the core for one operation. It receives the branded input and returns a `Result`. |
| **InputRejected** | A result of `executeOperation` when the input schema or an invariant rejects the payload. It shows an incorrect request. |
| **invariant** | A kind of atom: a rule over the properties of one entity, for example `expiry_date > effective_date`. |
| **key** | The field of an entity that a link holds and that `unique` compares. It is also the primary key of its Postgres table. |
| **kind** | The second segment of a short key: `field`, `entity`, `invariant`, `operation`, `event` or `error`. |
| **`kind` property** | The property of each error and event payload that holds its URN. No declared property can have this name. |
| **lifecycle** | The `status` of an atom: `active`, then `deprecated`, then `sunset`. It only moves forward. |
| **link** | A property with `link: <entity>`. It holds the key value of that entity. urn-forge does not make sure that the object exists. |
| **manifest** | The YAML file that declares the atoms of one domain. Refer to [The manifest](./manifest). |
| **operation** | A kind of atom: a handler contract with an input, an output, declared errors and events. |
| **placeholder** | A name in braces in the message of an error, for example `{sku}`. The runtime puts the value in its place. |
| **plugin** | A part of urn-forge that writes generated files: `valibot`, `fcis` or `postgres`. |
| **primitive** | The base type of a field: `boolean`, `date`, `decimal`, `enum`, `float`, `integer`, `string` or `timestamp`. |
| **property name** | The name of a property: the `as` of the field reference, or the identifier of the target. |
| **ratchet** | The change of `boundaryCoverage` from `warn` to `error` when each feature is strict. |
| **record** | The `recordAs` event of a declared error, on the `DomainError`. The shell can keep it in an audit trail. |
| **reference date** | The day to compare each `sunsetDate` with, from `--reference-date` or `referenceDate`. urn-forge never reads the clock. |
| **Result** | The return type of a handler: `ok(value, events)` or `fail(errorUrn, fields)`. |
| **retryable** | A property of an error. `true` means that the same request can be correct at a later time. |
| **rule language** | The language of invariant rules. Refer to [The rule language](./rule-language). |
| **scenario** | One example in a feature. It runs the operation and examines the result. |
| **severity** | The level of a diagnostic. An `error` fails the command. A `warning` does not, and `verify` counts it. A `note` gives information only. |
| **shell** | The code that calls `executeOperation`. It does the I/O. |
| **shell file** | A file of the `shell` setting. Gate 2 examines it. |
| **short key** | The name of an atom in the manifest: `<context>.<kind>.<identifier>`. |
| **stability** | A header property: `stable` or `experimental`. While the old manifest is `experimental`, `diff` gives breaking changes as warnings. |
| **step** | One line of a scenario. urn-forge gives generic steps. Refer to [Gherkin steps](./gherkin-steps). |
| **strict** | A feature with the tag `@urn-forge:strict`. Its coverage gaps are errors. |
| **sunset** | The last `status`. The atom makes no code and gets no checks. It stays in the manifest, so that its URN never gets a second meaning. |
| **URN** | The permanent name of an atom: `urn:<namespace>:<domain>:<context>:<kind>:<identifier>`. |
| **waiver** | A comment `# urn-forge:waive <field URN> <reason>` in a feature file. It removes the boundary gaps of one field. |

## Related pages

- [The contract](../explanation/the-contract)
- [Diagnostics](./diagnostics)
