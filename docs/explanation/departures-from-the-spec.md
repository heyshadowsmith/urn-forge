# Departures from the specification

urn-forge follows [specification v1.1](../project/spec-v1-1), with some differences. Some rules of the specification could not work together, some could not work with the tools, and some left a question open. This page lists each place where urn-forge 0.1.0 differs, and why. The plans in the Project section record each decision when it was made.

This page does not list the parts of the specification that urn-forge does not have at this time. Examples are `urn-forge graph` and the `nullable` key. [Scope](../reference/scope) lists them. It does list the places where a part that is not built changes a part that is.

## Handlers and results

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| A handler returns branded output (§7.2) | A handler returns the plain output shape. `executeOperation` parses the output, which adds the brands | Gate 2 forbids the core to make brands, so a handler cannot get a branded output value. The two rules cannot both hold. Refer to [The functional core and brands](./functional-core) |
| Error types in a `Result` (§7.2) do not say if their fields are branded | A handler gives plain fields to `fail`. `executeOperation` parses and brands them | The same rule as for output: the core does not make brands |
| `Result<T, E>` holds `value` and `events`, and `EmittedEvent` is a union of the `emits` of the operation (§7.2) | `Result<T, E, V = never>`. `V` is the union of the event payloads of the operation. `EmittedEvent<U>` is the parsed event that `executeOperation` gives: `{ urn, fields }` | An operation with no events keeps a type with two arguments. `tsc` refuses an event of a different operation at gate 1. The shell can switch on `urn` |
| The fields of a `recordAs` event are a superset of the fields of the error (§4.6) | The event has each property of the error, with the same target, `required` and `many`. Each other property must be optional (`invalid-record-as`) | `executeOperation` makes the event from the fields of the error. A mandatory property that the error does not have would make that impossible |
| A valid error is returned "plus its `recordAs` event" (§7.2, step 4) | The event is `record` on the `DomainError`: `{ urn, fields }`, parsed and branded | The record is apart from the events of a success, so the stream of facts has no refusals |
| The specification does not say how a handler makes a `Result` | The generated helpers `ok(value, events)`, `emit(eventUrn, fields)` and `fail(errorUrn, fields)`. `emit` and `fail` are typed for each URN. `ok(value)` with no events is correct | `tsc` checks the fields of each event and each error. The handlers do not write the shape of a `Result` themselves |
| The specification does not say if an operation without errors returns a `Result` | Every handler returns a `Result`. Without declared errors, its error type is `never` | One shape for all handlers. A first error on an operation does not change the signature again |
| A declared error is returned with its metadata (§7.2, step 4) | A separate outcome, `kind: 'DomainError'`, with the error URN, `category`, `retryable`, the message and the parsed fields | A shell can tell a refusal from `InputRejected` and `ContractViolation` by `kind` alone |
| The specification does not say what happens when a handler returns a value that is not a `Result` | `ContractViolation` | A handler that gets past the types is a bug in the core, like any other broken contract |

Sources: the [MVP plan](../project/mvp-plan), spec gap 1; the [error kind plan](../project/error-kind-plan), decisions 1 to 6 and 10; the [events plan](../project/events-plan), decisions 4 to 6.

## Primitives and constraints

The [primitives plan](../project/primitives-plan) made the set of primitives and constraints MECE: one primitive for each kind of value, and one constraint for each aspect of a value. Some primitives and constraints of §4.1 do not agree with that rule, so urn-forge changes them. For the model, refer to [The MECE model of primitives](./primitives-model).

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| A closed set of names is a `string` with `oneOf` (§4.1) | The `enum` primitive with `values`. `oneOf` on a field gives `unknown-property`, with a hint | `oneOf` overlapped `minLength`, `maxLength` and `regex` on one field. Pass 7 had to examine each listed value against them. As its own primitive, a closed set cannot meet a length or shape constraint |
| `notEqual` excludes one value (§4.1) | `notIn: [ … ]` excludes a list of values, on `integer`, `float` and `decimal`. `notEqual` gives `unknown-property`, with a hint | One value is a list of one. "Not 0 and not 13" could not be written. Two constraints for one aspect would not be mutually exclusive |
| `decimal` has `precision: [p, s]` (§4.1) | `decimal` has `scale` only. The range limits the size | `precision` mixes the size of a value with its step. `scale` is the step. The Postgres plugin needs no precision: `NUMERIC` keeps the digits that it gets, and a check holds the scale |
| `timestamp` has `after` and `before` (§4.1) | `date` and `timestamp` use `min` and `max`, as every ordered primitive does | One name for one aspect. `min` is an inclusive lower bound on each primitive that has a range |
| `min` and `max` are the only bounds (§4.1) | `float`, `decimal` and `timestamp` also have `exclusiveMin` and `exclusiveMax`. `integer` and `date` do not | "A price above 0" could not be written. On a discrete primitive, an exclusive bound is always an inclusive bound one step further, so it would be a second form of the same bound |
| The specification does not say if a field can set two constraints for one side of a value | A field can set one constraint for each side of an aspect. `min` with `exclusiveMin`, or `regex` with `format`, gives `conflicting-constraints` | Two constraints for one side of one aspect say the same thing two times, or disagree |
| `string` has `format: iso-date`, and there is a `timestamp` primitive (§4.1) | A `date` primitive for a calendar day. `format` has `uuid`, `email` and `uri` only | One kind of value would have two forms. `format` holds only shapes that a `regex` cannot express clearly |
| `list` is a primitive with `of`, `minItems`, `maxItems` and `unique` (§4.1) | A list is `many: { minItems, maxItems, unique }` on a field reference. There is no `list` primitive | A primitive tells what one value is. A list tells how many values there are, which is a property of the reference, as `required` is. A list of integers would otherwise be both `list` and `integer` |
| `record` and `ref` are primitives (§4.1) | There is no `record` or `ref` primitive. A property that holds or points at an entity is a field reference. Refer to [Structure](#structure). urn-forge does not have a `record` at this time | Structure is on the reference, as a list is. Refer to [Scope](../reference/scope) |
| A changed primitive needs a new URN (§3) | `oneOf` and `notEqual` changed in place. Each field kept its URN | No consumer of urn-forge exists before version 1.0. A new URN for each field would only add noise |

Sources: the [primitives plan](../project/primitives-plan), "The problem", "The model" and decisions 1 to 3, 5 and 7.

## Structure

The [structure plan](../project/structure-plan) put entities in entities, and references between entities, on the field reference. For the model, refer to [The MECE model of primitives](./primitives-model).

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| `list`, `record` and `ref` are primitives (§4.1) | No structure primitive. `ref: <entity>` on a field reference embeds the entity. `link: <entity>` holds the key of the entity. `many` makes a list of either | A primitive says what one value is. One axis for what a property holds keeps the model MECE, and a list of entities needs no new rule |
| `ref` has `to`, the target entity (§4.1) | `link` names the target entity on the field reference. The property holds the value of the `key` of the target, with the brand of the key field | `tsc` accepts a customer identifier as a link to a customer, and refuses an identifier of a different entity. urn-forge does not make sure that the target exists. The shell does that, with its store |
| `key` on an entity is the key of the SQL table (§4.2) | `key` names one of the required, single fields of the entity. It is the value of a link to the entity, and the value that `unique` compares in a list of the entity | Objects have no equality of their own. The key is the identity of an object, so it also tells what a link holds and what `unique` compares. The Postgres plugin uses it as the primary key of a table, but only for the entities in its `tables` option. Refer to [The Postgres plugin](#the-postgres-plugin) |
| The property name is the identifier of the field (§5) | The property name is `as` on the field reference, or the identifier of the target | Two links to one entity, for example a payer and a holder, need two names. A list of `coverage` reads better as `coverages` |
| Pass 5 finds cycles (§5) | Pass 5 refuses a cycle of embedded entities (`embedding-cycle`). Links can make a cycle. Pass 5 also refuses a link, or a unique list, to an entity with no `key` (`missing-key`) | A link is a value, so a cycle of links is data. An embedded object of a cycle would have a type that never ends. The key check reads a different entity, which can come later in the manifest, so it waits until each atom is built |
| Invariants are on one entity (§4.3) | A rule names only the properties of its own entity. A link compares as the primitive of its key. An embedded entity is only in `is present` and `is absent`. The invariants of an embedded entity run inside it, and an issue has the nested path, for example `coverages.1.limit` | The rule stays on one entity, as the specification says. The invariants of the embedded entity already say what it allows |
| The specification does not say how a table cell holds an object | An object cell is `{ name: value, … }`, and a list of objects is `[{ … }, { … }]`. A link is a plain cell with the key value | The list syntax `[a, b]` reads like a YAML flow list, and the object syntax follows it. Headers with dots could not hold a list of objects |
| The specification does not say how a value in a cell holds a comma | A value in a list or an object cell can be a JSON string literal: `"Smith, Ada"`. A bare value cannot hold a comma, a bracket, a brace or a double quote. A plain cell does not change | Real values hold commas and braces: names, addresses and notes. The rules of JSON strings are known and exact, and a bare value stays short where it is safe |

Sources: the [structure plan](../project/structure-plan), "The model" and decisions 1 to 11.

## Invariants

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| The link between an entity and an invariant is in two places: `on` in the invariant and `invariants:` on the entity (§4.2, §4.3) | The link is only `on`. An `invariants` key on an entity gives `unknown-property` | Two places can disagree, and one place cannot. This is the MECE rule applied to the manifest itself |
| `IREntity` has `invariants`, a list of URNs (§5) | `IREntity` has no such list. The function `invariantsOf(ir, entityUrn)` finds the invariants by `on` | The IR has the same single link as the manifest |
| The example invariant has no `description` (§4.3) | `description` is necessary, as on every other atom | Each atom explains itself in the manifest and in the comments of the generated code |
| The rule language has `is present` (§4.3) | It also has `is absent` | A rule for an optional field usually starts with `x is absent or …`: if there is no value, the rule holds |
| The specification does not say what a rule does with an absent field | A rule can use an optional field only after a guard on the left: `x is present and …` or `x is absent or …`. If not, pass 6 gives `unguarded-field` | Without a guard, `deductible > 0` on an absent deductible has no clear answer. The guard puts the answer in the rule, where a reader sees it |
| The specification does not say if a rule can count days | `date + integer`, `date - integer` and `date - date`, in days only | A day is exact, and Postgres has the same operators. A month or a year has no fixed number of days. Refer to the [date arithmetic plan](../project/date-arithmetic-plan) |
| The specification does not say if a rule can use a list | A list only in `is present` and `is absent` | The language has no functions, so it cannot count or loop. Rules over the items of a list need their own decision |
| `IRInvariant` keeps the parsed rule (§5) | It also keeps `ruleText`, the canonical text, and a `brandIdentifier` | Messages, comments and docs show one form of each rule. The brand identifier names the rule function |
| An issue points at a field path and carries the invariant URN (§7.1) | The path is the first field that the rule names. The issue has `invariantUrn` | The first field is predictable and needs no new key in the manifest |
| The specification does not say how a scenario expects a broken invariant | The step `Then the input is rejected by "<invariant URN>"` | The step names the rule that refused the input, as `fails with` names the error |
| The specification does not ask for a scenario for each invariant (§8) | Gate 3 asks for a scenario that breaks each invariant of an operation input, with `uncovered-invariant` in the coverage mode | A rule that no scenario breaks is a rule that nobody has seen work. This follows the error coverage |

Sources: the [invariants plan](../project/invariants-plan), "The rule language" and decisions 1 to 10.

## Errors and messages

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| A message placeholder names a field of the error (§4.6) | A placeholder must name a property with `required: true` and no `many`: a field or a link, not an embedded entity | An optional field can be absent. Then the message would not be complete. A list and an embedded object have no one value to put in the message |
| The specification does not define the form of a placeholder | A placeholder is `{…}` with no space and no brace inside | Text such as `{ and }` stays text, but a typo such as `{Quantity}` is still checked |
| An error schema has a literal `kind` with the error URN (§7.1) | The same. Also, no property of an error can have the name `kind` (`reserved-property`) | A field with that name would collide with the URN in the payload |
| Only an error schema has a literal `kind` (§7.1) | An event schema also has `kind`, a literal of the event URN. No property of an event can have the name `kind` (`reserved-property`) | The shell and a consumer switch on `kind` in the same way for errors and events |

Sources: the [error kind plan](../project/error-kind-plan), decision 7 and steps 1 and 2; the [events plan](../project/events-plan), decision 2.

## Gherkin and gate 3

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| A table header must be a field of the input entity (§8) | A table header can be a field of the input or of the output | The rule of the specification forbids a column for an expected output, such as `quotient` |
| The specification does not cover tables of expected errors | The table of `Then the operation fails with "<urn>":` must use fields of that error | The fields of an error are not fields of the input or the output |
| The specification has no step for events | `Then the operation emits "<event URN>"`, with an optional table, and `Then the operation emits no event` | A scenario can show each event of the operation, as it shows each declared error |
| The specification does not say how a scenario counts events | The steps do not examine the count or the sequence of the events. One event with the URN, and with the fields of the table, is sufficient | A count rule would be a second language in the steps. A scenario that needs a count can show it in the output |
| The specification does not ask for a scenario for each event (§8) | Gate 3 asks for a scenario that expects each event of an operation, with `uncovered-event` in the coverage mode. A step that names an event of a different operation is `undeclared-event` | An event that no scenario shows is an event that nobody has seen happen. The rule is the same as for declared errors |
| A table with no column for a required field fails (§8: "missing required fields fail") | The table of `When I run the operation with:` must have a column for each required input field. An empty cell sends the payload without that key | A scenario can still test a field that is not there. It keeps the column and leaves the cell empty |
| A Gherkin plugin writes parameter types and `urn-forge.lint.json`, and `verify` reads that file (§7.3) | Nine generic steps convert each cell with the primitive of its field. Gate 3 reads the IR directly | The MVP plan cut the Gherkin plugin. The generic steps do not depend on a domain, so they ship with urn-forge |

Sources: the [MVP plan](../project/mvp-plan), spec gap 2 and build step 8; the [foundations plan](../project/foundations-plan), phase 5; the [error kind plan](../project/error-kind-plan), step 4; the [events plan](../project/events-plan), decisions 7 and 8; `src/verify/gherkin.ts`.

## Boundary coverage

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| A waiver is the tag `@urn-forge:waive(<field URN>, <reason>)` (§8) | A waiver is the comment `# urn-forge:waive <field URN> <reason…>` | A Gherkin tag cannot contain a space. A tag with a real reason makes the parser refuse the file |
| Waivers are listed in the output of `verify` (§8) | Each applied waiver is a `note`, a third severity. A waiver for a field that is not constrained is an error. A waiver that removes no gap is a warning | A note stays visible but does not count as a warning. A stale waiver cannot hide a future gap |
| The specification has no way to send the empty string from a table | A cell of `""` sends the empty string to a `string` or an `enum` field | Without it, `minLength: 1` could never be covered |
| The specification does not say how a table cell holds a list | A list cell is `[a, b, c]`, and `[]` is the empty list. Each item is read with the primitive of the field. An item with a comma is a JSON string literal, for example `"Smith, Ada"` | It reads like the YAML flow list in the manifest |
| `boundaryCoverage` is in the configuration of the `gherkin` plugin (§7.5) | `boundaryCoverage` is at the top level of `urn-forge.config.ts` | urn-forge has no `gherkin` plugin, and gate 3 is not a plugin |
| `@urn-forge:strict` makes a feature strict (§8) | It makes strict every operation that the feature tags. An operation is strict if any of its features is strict | Coverage is counted for each operation across all features. The tag must reach the gaps that it is there to fail |
| The rules do not name `notEqual` or `mustBe` (§8) | `notIn` needs each excluded value. `mustBe` needs both `true` and `false` | An excluded value is the case that the constraint exists for |
| The rules do not name exclusive bounds, `multipleOf`, `date` or `timestamp` (§8) | Each has its cases. Refer to [Verification gates](../reference/verification-gates) | Each constraint brings its own boundary cases |
| The rules give `minItems` and `maxItems` no cases (§8) | The items of a list count as values of the field. The list needs the counts at and past `minItems` and `maxItems`, and a repeated value for `unique`. In a list of an embedded entity, `unique` needs a repeated key | The rules of the field apply to each item, and the rules of the list to the list |
| The rules name the fields of the input entity (§8) | The values in embedded objects count for their fields too, at any depth, for each operation | The rules of a field apply wherever the field is |
| The rules give `integer` and `decimal` bounds (§8) | A `float` bound, and a `decimal` bound with no `scale`, needs the value at the bound and any value past it | A `float` has no step. A `decimal` with no `scale` has no step either |
| Coverage reads "all its scenarios' example values" (§8) | Coverage reads only the input tables of `When I run the operation with:` | A boundary is about what the operation accepts. An output value is a result, not a case |

Sources: the [boundary coverage plan](../project/boundary-coverage-plan), the rules table and decisions 1, 3, 4, 6, 7, 9 and 10; the [primitives plan](../project/primitives-plan), decisions 9 and 10.

## The Postgres plugin

The [Postgres plan](../project/postgres-plan) built the plugin of §7.4. It changed some rules of the specification, so that the SQL and the Valibot schema enforce one rule in the same way.

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| Each entity with a `key` is a table. An entity with no `key` is a compile error when the plugin is enabled (§7.4) | The option `tables` names the entities that become tables. Only these need a `key`. The entities that a table embeds become child tables | Many entities are only the input or the output of an operation, for example a cancellation. A `key` also identifies a coverage in a list, and a coverage is not a table of its own. Storage is a decision of the shell, so it goes in the configuration, not in the manifest |
| Field constraints are named `CHECK` constraints on each table, `ck_<brandIdentifier>` (§7.4) | A field is a domain, `"<context>"."<identifier>_value"`, with one `CHECK` for all its constraints | The rules of a field are the same in each entity, so one place holds them. A domain also works for the items of a list. This is the MECE rule applied to SQL |
| A list is `JSONB` or a child table, by the plugin option `listStorage` (§4.1, §7.5) | A list, and an embedded entity, is always a child table. There is no `listStorage` option | A child table keeps each rule in force: the domains, the links and the invariants of an embedded entity. A `JSONB` column cannot check what is in it. Two options would be two spellings for one thing |
| `required` and `nullable` map to `NOT NULL` (§7.4) | `required` maps to `NOT NULL`. There is no `nullable` | urn-forge does not have `nullable` at this time. Refer to [Scope](../reference/scope) |
| A `string` is `VARCHAR(n)`, `UUID` or `TEXT`, and a `decimal` is `NUMERIC(p, s)` (§4.1) | A `string` is `TEXT`, also with `format: uuid`. A `decimal` is `NUMERIC` with no precision, and `scale(VALUE) <= s` | The `UUID` type writes a value back in lower case, and a string compares exactly. `VARCHAR(n)` would be a second place for `maxLength`. `scale` is the step of the model, and urn-forge has no `precision` |
| The specification does not say how to count the length of a string | `minLength` and `maxLength` count Unicode code points, in Valibot, in gate 3 and in Postgres | Postgres `char_length` counts code points. JavaScript `length` counts UTF-16 code units, so one emoji is 2 in one and 1 in the other. One count in both places is the only way that the two checks agree. A person also counts code points |
| The specification does not say how a `regex` goes into SQL | The plugin translates a pattern only in a subset that means the same thing in both dialects. `\d`, `\w`, `\s` and `.` become explicit ASCII classes, and the `i` flag becomes `~*`. Other patterns are `unenforced-in-sql` | In Postgres, `\w` and `\d` also match letters and digits of other scripts, and `.` matches a line break. A pattern that means something else in SQL is worse than no check. It refuses good values or lets bad values in |
| A plugin must report each rule that it cannot translate as a compile error (§4.3, §7) | The Postgres plugin reports such a rule as `unenforced-in-sql`, a warning, with a comment in the SQL. The option `unenforced: 'error'` makes it an error | The Valibot schema at the boundary still enforces the rule, so a warning is honest. The plugin never drops a rule without a word. The `'error'` option is the same choice as `boundaryCoverage` |
| The specification does not say how a count of a list goes into SQL | A deferred constraint trigger for each count | A count is about many rows, and a `CHECK` sees one row. A deferred trigger lets the shell write a parent and its items in any sequence in one transaction |

Sources: the [Postgres plan](../project/postgres-plan), decisions 1 to 9.

## Gate 2

The [gate 2 plan](../project/gate-2-plan) built boundary discipline of §8. Gate 2 refuses a branded value that no parser made. For the model, refer to [The functional core and brands](./functional-core).

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| Gate 2 is a shipped ESLint profile, `urn-forge/eslint-config`, with typescript-eslint (§8) | Gate 2 is part of `verify`. Four rules of urn-forge run on the TypeScript checker of gate 1, on the same program. There is no ESLint profile | typescript-eslint adds two large dependencies, a second configuration and a second type check of the same files. The checker of gate 1 can answer each question of the gate exactly, and it is already there |
| The profile forbids every `any`, every type assertion and every `@ts-` comment in a core or shell file (§8) | The rules are about brands only. No type assertion to a type that carries a brand (`brand-assertion`). No `any` where a branded type belongs (`brand-from-any`). Every `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck` is refused (`suppressed-check`) | `as const`, or an assertion to a type with no brand, does not forge a value. A rule against all `any` is a style choice, and a team can keep its own linter for it. A `@ts-` comment can hide any forged brand, so the gate refuses each one |
| `no-brand-construction` refuses an import of the `brand` of Valibot or of the generated schemas in the core directory (§8) | `core-parser-import` refuses a value import of the generated schemas module or of `valibot` in a core file. A type import is correct. A shell file can import both | The core needs the branded types to name its values, but it never needs to parse. The shell is where values come in, so it parses |
| The specification does not say if a rule of gate 2 can be turned off for one case | There is no waiver for gate 2. Each problem is an error | The parsers make each branded value, so the core and the shell never need to forge one. A handler that is not there has no waiver either |
| The profile applies to "the configured core and shell paths" (§8) | Core files: the core entry and the files that it imports, directly or through other files, in its directory. Shell files: the new setting `shell`, a list of files and directories, with no default. Generated files, `node_modules`, declaration files and tests are not examined | The core entry is already in the configuration, so the core needs no second setting. A shell has no fixed shape, so the project names it. Tests forge values on purpose, to test the boundary |
| `urn-forge init` writes an ESLint configuration (§9) | `init` writes no ESLint configuration. The starter passes gate 2 | Gate 2 needs no ESLint |

Gate 2 cannot see a forged value in a file outside its two sets. A core that imports helpers from a different directory can add that directory to `shell`, where the three common rules apply.

Sources: the [gate 2 plan](../project/gate-2-plan), "The model", decisions 1 to 10 and "Risks".

## Lifecycle and compatibility

The [lifecycle plan](../project/lifecycle-plan) built pass 8 and gate 5 of §3, §5, §6 and §8. For the model, refer to [Compatibility and the direction of use](./compatibility).

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| A tighter constraint is breaking, and a wider constraint is compatible (§3) | The class depends on the direction of use. A narrower set of values breaks In and Stored. A wider set breaks Out. A change that is neither breaks each use. A change to an unused URN breaks nothing | The rule of the specification is correct for a value that callers send. For a value that callers receive, the opposite change breaks them |
| A removed field reference is breaking, and an optional reference that becomes required is breaking (§3) | Both depend on the direction of use. A removed property is wider, and optional → required is narrower. A removed property whose target was deprecated is a lifecycle change | The same rule as for constraints. The deprecation warned the callers, and they had until the sunset date to move |
| A new declared error is compatible (§3) | A new declared error is breaking: it widens Out. A removed declared error is compatible. A new event in `emits` is breaking in the same way, and a removed event is compatible | A caller that handles each kind of error of an operation has no branch for the new kind |
| Gate 5 fails on a breaking change to a URN that is `active` or `deprecated` (§3) | The same. Also, the removal of a sunset atom is breaking, and a `status` that moves back is breaking | A sunset atom stays as a tombstone, so its URN never gets a second meaning |
| `verify --base <git-ref>` runs gates 1 to 5 (§8, §9) | Gate 5 is the command `urn-forge diff <old> <new>`. CI writes the old manifest to a file, for example with `git show` | `verify` has one manifest and no git history. A command with two files is easy to run anywhere, also without git |
| Each IR node has `lifecycle` (§5) | A node has `lifecycle` only if its `status` is not `active` | The IR and the fingerprint of a manifest with no lifecycle keys do not change. The structure plan kept `{ field }` in its old shape for the same reason |
| `supersededBy` is a full URN (§3) | `supersededBy` is a short key, as every other reference in the manifest | One form for each reference. Pass 4 expands it to a URN in the IR |
| Without a reference date, sunset checks run as warnings (§6) | Without a reference date, pass 8 does not compare sunset dates. `verify` says so, and its JSON result has `"sunsetDatesChecked":false` | A warning for each date on each build would be noise, and a person would learn to ignore it. One clear line says what did not run. A `status: sunset` is still always an error |
| The specification does not say what a sunset atom generates | Nothing. The plugins and the gates see the live IR, with no sunset atoms. The output depends on `status` only, never on a date | A sunset atom is gone for its users. The reference date changes only diagnostics, so the generated bytes do not depend on the day |

Sources: the [lifecycle plan](../project/lifecycle-plan), "The model" and decisions 2, 5, 6, 12, 13 and 15; the [events plan](../project/events-plan), decision 9; `src/diff/classify.ts`.

## The compiler and determinism

| Specification v1.1 | urn-forge | Why |
| --- | --- | --- |
| The fingerprint covers the IR, the resolved configuration, the version and the plugins (§6) | It also covers the registries: the constraint keys of each primitive, and the names of the kinds | A new primitive changed the bytes of the generated runtime, but not the fingerprint |
| The specification shows the header of a TypeScript file only (§6) | The header of a SQL file uses `--` in place of `//`. The engine picks the comment marker from the file extension | A SQL file cannot start with `//` |
| The fingerprint covers "the resolved config" (§6) | It covers the configuration of each plugin, not the paths or `boundaryCoverage` | These settings do not change the generated files |
| `manifestHash` is the hash of the canonical manifest (§5) | The hash leaves out the kind groups that are empty | A new kind in urn-forge does not change the hash of a manifest that does not use it |
| A field reference in the IR has `field`, `required` and `nullable` (§5) | It also has `name`, the property name, and `many` for a list. It is one of three forms: `{ field }`, `{ entity }` or `{ link }` | Every plugin and gate reads the same name from the IR, and none of them derives it again. Refer to [How urn-forge is built](./architecture) |
| The input and output of an operation are an entity or a field (§5) | The input and output are entities | The MVP kept its scope small. No plan records a further reason |
| Events have the shape of an entity in the IR (§5) | `IREvent` is the shape of `IREntity` without `key`. An event in the manifest has no `key`, and an invariant cannot be on an event | urn-forge does not store events, so an event needs no key. An event that needs a rule embeds the entity that has the invariant |
| A brand collision is a compile error (§3) | The same. Also, two atoms whose generated exports have the same name give `export-collision` | Brand identifiers can be unique, while `<A>Input` of one atom is still `<B>` of a different atom |

Sources: the [foundations plan](../project/foundations-plan), acceptance test 1; the [error kind plan](../project/error-kind-plan), step 1 and the findings of step 3; the [events plan](../project/events-plan), decisions 1 and 11; `src/engine.ts`, `src/ir/types.ts`, `src/plugins/valibot.plugin.ts`.

## Related pages

- [Scope](../reference/scope)
- [Specification v1.1](../project/spec-v1-1)
- [The functional core and brands](./functional-core)
- [Boundary coverage and the ratchet](./boundary-coverage)
- [Dogfooding](./dogfooding)
