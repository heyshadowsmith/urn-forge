# Glossary

This page gives each term that this site uses, in alphabetical sequence. The pages of the site use each term with this definition only.

| Term | Definition |
| --- | --- |
| **atom** | One declaration in the manifest: a field, an entity, an invariant, an operation, an event or an error. Each atom has one URN. |
| **boundary case** | A value that gate 3 must find in the scenarios of an operation for a constrained input field, for example the value at `min` and the value at `min − 1`. Refer to [Primitives and constraints](./primitives). |
| **boundary coverage** | The check of gate 3 that the scenarios of each operation send each boundary case of its input fields. A case that is not there causes `uncovered-boundary`. |
| **`boundaryCoverage`** | The setting that makes the coverage gaps of gate 3 warnings (`warn`, the default) or errors (`error`). Refer to [The configuration file](./configuration). |
| **brand** | A TypeScript type mark that only a generated schema adds to a value, with `v.brand("<field URN>")`. A value with a brand has passed the schema of its field. |
| **brand identifier** | The PascalCase form of the context and the identifier of an atom, for example `OrderUnitCost`. The generated export names start with it. Refer to [URNs and names](./naming). |
| **breaking change** | A change to a live URN after which a consumer that worked before can fail. `urn-forge diff` reports it as `breaking-change`. The correct change is a new URN. Refer to [Verification gates](./verification-gates). |
| **canonical text** | The text of an invariant rule with one space around each operator and only the necessary parentheses. The IR keeps it as `ruleText`. Refer to [The rule language](./rule-language). |
| **category** | A property of an error: `validation`, `conflict`, `not_found`, `forbidden` or `precondition`. The shell can use it. The core does not read it. |
| **child table** | A table of the Postgres schema for a list or an embedded entity of a stored entity. Its key is the key of its parent table and, for a list, `position`. Refer to [The Postgres schema](./postgres-schema). |
| **coherence** | The agreement of the constraints of one field: they accept one or more values. Pass 7 examines it. |
| **compatible change** | A change to a URN after which no consumer that worked before can fail, for example a new optional property. |
| **compile** | The command that examines the manifest and writes the generated files. Refer to [The CLI](./cli). |
| **configuration file** | The file `urn-forge.config.ts`, which gives the paths, `boundaryCoverage`, `referenceDate` and the plugins of a project. |
| **constraint** | A property of a field that limits its values, for example `min` or `regex`. Each primitive accepts a fixed set of constraints. |
| **context** | The first segment of a short key. It groups atoms of one subject, for example `order`. |
| **contract** | The generated types and schemas of an operation: its input, its output, its declared errors, its events and its handler type. |
| **ContractViolation** | A result of `executeOperation` when the core breaks its contract. Examples: the handler returns an undeclared error, an output that its schema rejects or that breaks an invariant, an event that its operation does not emit or that its schema rejects, or a value that is not a `Result`. It shows a defect in the core. |
| **core** | The handlers of a project, in the core entry file. The core receives only values with a brand and does no I/O. |
| **core entry** | The file that exports the core with `satisfies DomainCoreImplementation`. The default is `src/core.ts`. Gate 1 type-checks it. |
| **count trigger** | A deferred constraint trigger of the Postgres schema that counts the rows of a child table when the transaction commits. It enforces `minItems`, `maxItems` and a required embedded entity. |
| **declared error** | An error that an operation lists in its `errors`. Its handler can return it with `fail(…)`. |
| **deprecated** | A `status` of an atom: it still makes all its code, with a mark, and a reference to it from an active atom is the warning `deprecated-ref`. |
| **diagnostic** | One problem that urn-forge reports, with a file, a position, a severity, a code and a message. Refer to [Diagnostics](./diagnostics). |
| **diagnostic code** | The stable name of a kind of problem, for example `unresolved-ref`. |
| **diff** | The command `urn-forge diff`, gate 5. It compares two manifests and gives each change a class: `compatible`, `breaking` or `lifecycle`. Refer to [The CLI](./cli). |
| **direction of use** | How a consumer uses a URN: In (a value that callers send), Out (a value that callers receive) or Stored (a value in a table). The class of a change depends on it. Refer to [Compatibility and the direction of use](../explanation/compatibility). |
| **DispatchMap** | The generated constant that gives, for each operation URN, the schemas and field data of its input, its output, its declared errors and its events. |
| **domain** | In the Postgres schema, the SQL type of one field, `"<context>"."<identifier>_value"`, with one `CHECK` for all the constraints of the field. |
| **DomainCoreImplementation** | The generated interface that maps each operation URN to its handler type. The core must use `satisfies DomainCoreImplementation`. |
| **DomainError** | A result of `executeOperation` when the handler returns a declared error. It has the URN, the category, the `retryable` value, the message and the fields of the error. If the error has `recordAs`, it also has the `record`. |
| **drift** | A difference between a generated file in the repository and the output of a new compile. Gate 4 finds it. |
| **embedded entity** | An entity that a field reference holds as an object, with `ref: <entity>`. Its invariants apply inside each object. An entity cannot embed itself, directly or through other entities (`embedding-cycle`). Refer to [The manifest](./manifest). |
| **emit** | To return an event. A handler gives its events to `ok(value, [emit(eventUrn, fields), …])`. Only the events in the `emits` of the operation are correct. |
| **`emits`** | The list of the events of an operation in the manifest. The operation returns them only when it succeeds. Refer to [The manifest](./manifest). |
| **entity** | A kind of atom: a named group of properties, each from one field reference. The input and the output of an operation are entities. |
| **error** | A kind of atom: a named refusal of an operation. The operation refused, and nothing changed. |
| **event** | A kind of atom: a named fact that an operation returns when it succeeds, for example `policy_issued`. An event never tells of a refusal. The shell can publish it to other systems. |
| **executeOperation** | The generated function that the shell calls. It parses the input, calls the handler, and parses the output and the events, or the declared error. |
| **feature** | A Gherkin `.feature` file. It contains scenarios. The feature or its scenarios have tags with the URN of an operation. |
| **field** | A kind of atom: one value, with a primitive and constraints. |
| **field reference** | An item of the `fields` list of an entity, an event or an error. It has `ref` to a field or an entity, or `link` to an entity, and optional `as`, `required` and `many`. Each field reference makes one property. |
| **fingerprint** | A SHA-256 hash of the IR, the plugin names, versions and configurations, and the urn-forge version. Each generated file has it in its header. |
| **gate** | One check of the chain: 1 (completeness), 3 (Gherkin traceability) and 4 (drift) in the `verify` command, and 5 (compatibility), which is the `diff` command. A gate fails if it finds an error. Refer to [Verification gates](./verification-gates). |
| **generated file** | A file that `compile` writes: `domain.schemas.generated.ts`, `domain.runtime.generated.ts` or `schema.generated.sql`. If a person edits it, gate 4 fails. |
| **Gherkin** | The language of the feature files: `Feature`, `Scenario`, `Given`, `When`, `Then` and tables. Cucumber runs it. |
| **guard** | `x is present and …` or `x is absent or …` on the left side of a rule. An invariant rule can use the value of an optional field only after a guard. |
| **handler** | The function in the core for one operation. It receives the input with a brand and returns a `Result`. |
| **header** | The `manifest` key of the manifest: `namespace`, `domain`, `version` and `stability`. |
| **identifier** | The third segment of a short key, for example `unit_cost`. In an entity or an error, the identifier of the target is the property name, if the field reference has no `as`. |
| **input** | The entity that an operation receives. |
| **InputRejected** | A result of `executeOperation` when the input schema rejects the payload, also when the payload breaks an invariant. It shows an incorrect request, not a defect in the core. |
| **invariant** | A kind of atom: a named rule over the fields of one entity, for example `expiry_date > effective_date`. The entity is in its `on`. Refer to [The rule language](./rule-language). |
| **IR** | The intermediate representation: the result of the compiler passes, with URNs and sorted keys. The plugins and the gates read only the IR. |
| **key** | The field of an entity that a link holds, and that `unique` compares in a list of the entity. It is also the primary key of the root table of the entity in the Postgres schema. It is one of the required, single fields of the entity. The entity sets it with `key`. |
| **kind** | The second segment of a short key: `field`, `entity`, `invariant`, `operation`, `event` or `error`. |
| **`kind` property** | The property of each error payload and event payload that contains the URN of the error or the event. No property of an error or an event can use this name. |
| **lifecycle** | The `status` of an atom: `active` (the default), then `deprecated`, then `sunset`. It only moves forward. The lifecycle keys are `status`, `supersededBy` and `sunsetDate`. Refer to [The manifest](./manifest). |
| **lifecycle change** | A `status` that moves forward, a new `supersededBy` or `sunsetDate`, or the removal of a property whose target was deprecated. `urn-forge diff` reports it, and it needs no action. |
| **link** | A field reference with `link: <entity>`. The property holds the value of the `key` of that entity, with the brand of the key field. urn-forge does not make sure that the linked object exists. |
| **live IR** | The IR with no sunset atoms. The plugins and the gates read it. The function `liveIr` makes it. |
| **live URN** | The URN of an atom that is not sunset. |
| **manifest** | The YAML file that declares the atoms of one domain. Refer to [The manifest](./manifest). |
| **message template** | The `message` of an error. Each `{placeholder}` names a mandatory, single property of the error: a field or a link. |
| **note** | A diagnostic that gives information only. It does not fail a command, and `verify` does not count it. |
| **operation** | A kind of atom: a handler contract with an input entity, an output entity, declared errors and events. |
| **output** | The entity that an operation returns when it succeeds. |
| **pass** | One step of the compiler, from 1 to 8. Refer to [Compiler passes](./compiler-passes). |
| **placeholder** | A name in braces in the message of an error, for example `{sku}`. The runtime puts the value of the field in its place. |
| **plugin** | A part of urn-forge that makes generated files from the IR: `valibot`, `fcis` or `postgres`. |
| **primitive** | The base type of a field: `boolean`, `date`, `decimal`, `enum`, `float`, `integer`, `string` or `timestamp`. Refer to [Primitives and constraints](./primitives). |
| **property** | One key of an entity, an event or an error payload, from one field reference. It holds a value of a field, an embedded object, or the key value of a link, or a list of one of them. |
| **property name** | The name of a property in an entity, an event or an error payload. It is the `as` of the field reference, or the identifier of the target if there is no `as`. |
| **ratchet** | The change of `boundaryCoverage` from `warn` to `error` when each feature is strict. After the change, a new feature is strict too. |
| **record** | The `recordAs` event of a declared error, as `executeOperation` gives it on the `DomainError`: `{ urn, fields }`. The shell can keep it in an audit trail. |
| **`recordAs`** | A property of an error that names an event. `executeOperation` makes this event from the fields of the error. The core does not return it. |
| **reference date** | The day that pass 8 compares each `sunsetDate` with, from `--reference-date` or `referenceDate`. urn-forge never uses the clock. Without it, pass 8 does not compare sunset dates. |
| **Result** | The return type of each handler: `ok(value, events)` or `fail(errorUrn, fields)`. A success holds the output and the events. A failure holds one declared error. |
| **retryable** | A property of an error. `true` means that the same request can be correct at a later time. |
| **root table** | A table of the Postgres schema for an entity in the `tables` option of the `postgres` plugin. Its primary key is the `key` of the entity. |
| **rule** | The condition of an invariant, in the rule language. Pass 6 examines it, and the generated schema of the entity runs it. |
| **rule language** | The small language of invariant rules: fields, literals, comparisons, `+` and `-`, `and`, `or`, `not`, `is present` and `is absent`. Refer to [The rule language](./rule-language). |
| **scenario** | One example in a feature. It runs the operation with a table of input values and examines the result. |
| **Scenario Outline** | A scenario that Cucumber runs one time for each row of its `Examples` table. |
| **severity** | The level of a diagnostic: `error`, `warning` or `note`. |
| **shell** | The code that calls `executeOperation`. It does the I/O and handles the results. |
| **short key** | The name of an atom in the manifest: `<context>.<kind>.<identifier>`, for example `order.field.quantity`. |
| **stability** | A property of the header: `stable` (the default) or `experimental`. While the old manifest is `experimental`, `urn-forge diff` gives a breaking change as a warning. |
| **step** | One line of a scenario, for example `When I run the operation with:`. urn-forge gives nine generic steps. Refer to [Gherkin steps](./gherkin-steps). |
| **strict** | A feature with the tag `@urn-forge:strict`. The coverage gaps of its operations are errors, also if `boundaryCoverage` is `warn`. |
| **sunset** | The last `status` of an atom: it makes no code, no gate examines it, and a reference to it from an active or a deprecated atom is the error `sunset-ref`. It stays in the manifest as a tombstone. |
| **tombstone** | A sunset atom that stays in the manifest, so that its URN never gets a second meaning. `urn-forge diff` reports its removal as a breaking change. |
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
