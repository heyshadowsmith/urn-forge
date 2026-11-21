# Departures from the specification

urn-forge follows [specification v1.1](../project/spec-v1-1), with some differences. Some rules of the specification could not work together, some could not work with the tools, and some left a question open. This page lists each place where urn-forge 0.1.0 differs, and why. The plans in the Project section record each decision when it was made.

This page does not list the parts of the specification that urn-forge does not have at this time. Examples are gate 2, gate 5, invariants and the Postgres plugin. [Scope](../reference/scope) lists them. It does list the places where a part that is not built changes a part that is.

## Handlers and results

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| A handler returns branded output (§7.2) | A handler returns the plain output shape. `executeOperation` parses the output, which adds the brands | Gate 2 forbids the core to make brands, so a handler cannot get a branded output value. The two rules cannot both hold. Refer to [The functional core and brands](./functional-core) |
| Error types in a `Result` (§7.2) do not say if their fields are branded | A handler gives plain fields to `fail`. `executeOperation` parses and brands them | The same rule as for output: the core does not make brands |
| A successful `Result` holds `value` and `events` (§7.2) | A successful `Result` holds `value` only | urn-forge does not have the `event` kind at this time. An `events` list that is always empty would only be noise |
| An error can name an event in `recordAs` (§4.6) | The manifest refuses `recordAs`: it "needs the event kind" | `recordAs` names an event, so it cannot exist without events |
| The specification does not say how a handler makes a `Result` | The generated helpers `ok(value)` and `fail(errorUrn, fields)`. `fail` is typed for each error URN | `tsc` checks the fields of each error. The handlers do not write the shape of a `Result` themselves |
| The specification does not say if an operation without errors returns a `Result` | Every handler returns a `Result`. Without declared errors, its error type is `never` | One shape for all handlers. A first error on an operation does not change the signature again |
| A declared error is returned with its metadata (§7.2, step 4) | A separate outcome, `kind: 'DomainError'`, with the error URN, `category`, `retryable`, the message and the parsed fields | A shell can tell a refusal from `InputRejected` and `ContractViolation` by `kind` alone |
| The specification does not say what happens when a handler returns a value that is not a `Result` | `ContractViolation` | A handler that gets past the types is a bug in the core, like any other broken contract |

Sources: the [MVP plan](../project/mvp-plan), spec gap 1; the [error kind plan](../project/error-kind-plan), decisions 1 to 6 and 10.

## Errors and messages

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| A message placeholder names a field of the error (§4.6) | A placeholder must name a field with `required: true` | An optional field can be absent. Then the message would not be complete |
| The specification does not define the form of a placeholder | A placeholder is `{…}` with no space and no brace inside | Text such as `{ and }` stays text, but a typo such as `{Quantity}` is still checked |
| An error schema has a literal `kind` with the error URN (§7.1) | The same. Also, no field of an error can have the identifier `kind` (`reserved-property`) | A field with that name would collide with the URN in the payload |

Sources: the [error kind plan](../project/error-kind-plan), decision 7 and steps 1 and 2.

## Gherkin and gate 3

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| A table header must be a field of the input entity (§8) | A table header can be a field of the input or of the output | The rule of the specification forbids a column for an expected output, such as `quotient` |
| The specification does not cover tables of expected errors | The table of `Then the operation fails with "<urn>":` must use fields of that error | The fields of an error are not fields of the input or the output |
| A table with no column for a required field fails (§8: "missing required fields fail") | The table of `When I run the operation with:` must have a column for each required input field. An empty cell sends the payload without that key | A scenario can still test a field that is not there. It keeps the column and leaves the cell empty |
| Each `@urn:` tag resolves to a URN in the IR (§8) | A tag resolves only if it names a field, an entity or an operation. A tag with an error URN gets `unresolved-tag` | No plan records a reason. A scenario names the error that it expects in a step, not in a tag |
| A Gherkin plugin writes parameter types and `urn-forge.lint.json`, and `verify` reads that file (§7.3) | Five generic steps convert each cell with the primitive of its field. Gate 3 reads the IR directly | The MVP plan cut the Gherkin plugin. The generic steps do not depend on a domain, so they ship with urn-forge |

Sources: the [MVP plan](../project/mvp-plan), spec gap 2 and build step 8; the [foundations plan](../project/foundations-plan), phase 5; the [error kind plan](../project/error-kind-plan), step 4; `src/verify/gherkin.ts`.

## Boundary coverage

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| A waiver is the tag `@urn-forge:waive(<field URN>, <reason>)` (§8) | A waiver is the comment `# urn-forge:waive <field URN> <reason…>` | A Gherkin tag cannot contain a space. A tag with a real reason makes the parser refuse the file |
| Waivers are listed in the output of `verify` (§8) | Each applied waiver is a `note`, a third severity. A waiver for a field that is not constrained is an error. A waiver that removes no gap is a warning | A note stays visible but does not count as a warning. A stale waiver cannot hide a future gap |
| The specification has no way to send the empty string from a table | A cell of `""` sends the empty string to a `string` field | Without it, `minLength: 1` could never be covered |
| `boundaryCoverage` is in the configuration of the `gherkin` plugin (§7.5) | `boundaryCoverage` is at the top level of `urn-forge.config.ts` | urn-forge has no `gherkin` plugin, and gate 3 is not a plugin |
| `@urn-forge:strict` makes a feature strict (§8) | It makes strict every operation that the feature tags. An operation is strict if any of its features is strict | Coverage is counted for each operation across all features. The tag must reach the gaps that it is there to fail |
| The rules do not name `notEqual` or `mustBe` (§8) | `notEqual` needs the excluded value. `mustBe` needs both `true` and `false` | The excluded value is the one case that the constraint exists for |
| The rules give `integer` and `decimal` bounds (§8) | A `float` bound needs the value at the bound and any value past it | A `float` has no step |
| Coverage reads "all its scenarios' example values" (§8) | Coverage reads only the input tables of `When I run the operation with:` | A boundary is about what the operation accepts. An output value is a result, not a case |

Sources: the [boundary coverage plan](../project/boundary-coverage-plan), the rules table and decisions 1, 3, 4, 6, 7, 9 and 10.

## The compiler and determinism

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| The fingerprint covers the IR, the resolved configuration, the version and the plugins (§6) | It also covers the registries: the constraint keys of each primitive, and the names of the kinds | A new primitive changed the bytes of the generated runtime, but not the fingerprint |
| The fingerprint covers "the resolved config" (§6) | It covers the configuration of each plugin, not the paths or `boundaryCoverage` | These settings do not change the generated files |
| `manifestHash` is the hash of the canonical manifest (§5) | The hash leaves out the kind groups that are empty | A new kind in urn-forge does not change the hash of a manifest that does not use it |
| A field reference in the IR has `field`, `required` and `nullable` (§5) | It also has `name`, the property name of the field | Every plugin and gate reads the same name from the IR, and none of them derives it again |
| The input and output of an operation are an entity or a field (§5) | The input and output are entities | The MVP kept its scope small. No plan records a further reason |
| A brand collision is a compile error (§3) | The same. Also, two atoms whose generated exports have the same name give `export-collision` | Brand identifiers can be unique, while `<A>Input` of one atom is still `<B>` of a different atom |

Sources: the [foundations plan](../project/foundations-plan), acceptance test 1; the [error kind plan](../project/error-kind-plan), step 1 and the findings of step 3; `src/engine.ts`, `src/ir/types.ts`, `src/plugins/valibot.plugin.ts`.

## Related pages

- [Scope](../reference/scope)
- [Specification v1.1](../project/spec-v1-1)
- [The functional core and brands](./functional-core)
- [Boundary coverage and the ratchet](./boundary-coverage)
- [Dogfooding](./dogfooding)
