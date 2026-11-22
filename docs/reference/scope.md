# Scope

This page compares urn-forge 0.1.0 with [specification v1.1](../project/spec-v1-1). For each area of the specification, it gives the parts that urn-forge has and the parts that urn-forge does not have at this time. The section numbers are those of the specification. For the reasons, refer to [Departures from the specification](../explanation/departures-from-the-spec).

## Summary

For the promises of a contract that a manifest cannot state at this time, and what to do in their place, refer to [What a contract cannot say yet](../explanation/known-holes).

urn-forge 0.1.0 has the full traceability chain for the six kinds of atom of the specification: the manifest, the IR, the generated contracts, the Gherkin checks and the drift check. It also has the lifecycle of each atom and the compatibility check, `urn-forge diff`. It has the five gates of the specification: gates 1 to 4 in `verify`, and gate 5 as `urn-forge diff`. It does not have the kinds, primitives, plugins and commands that only make the product larger.

## URNs and versions (§3)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| URN grammar | Six segments, the segment pattern `^[a-z][a-z0-9_]{0,62}$`, case-sensitive URNs | — |
| Manifest scope | One YAML file with one `namespace` and one `domain`. Short keys that expand to URNs | — |
| Brand identifiers | PascalCase of the context and the identifier. A collision is an error (`duplicate-brand`) | — |
| Compatibility classes | `urn-forge diff` with the classes `compatible`, `breaking` and `lifecycle`, by the direction of use: In, Out and Stored | A check of the `version` of the header against the class of the changes. A comparison of two regular expressions or two rules: such a change is breaking |
| Experimental stability | `stability: experimental` in the header. While the old manifest is experimental, `diff` gives a breaking change as a warning | — |
| Lifecycle metadata | `status`, `supersededBy` and `sunsetDate` on each kind. `deprecated-ref` and `sunset-ref` in pass 8. `@deprecated` in the TypeScript and `deprecated: …` in the SQL comments. A sunset atom makes no code | — |

## Manifest model (§4)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| Kinds | `field`, `entity`, `invariant`, `operation`, `event`, `error` | — |
| Primitives (§4.1) | `boolean`, `date`, `decimal`, `enum`, `float`, `integer`, `string`, `timestamp`. The specification does not have `date` and `enum` | `list`, `record`, `ref` as primitives. A list is `many` on a field reference. An embedded entity is `ref: <entity>`, and a reference to an entity is `link: <entity>`, on a field reference. A map (`record`) |
| Constraints (§4.1) | `mustBe`; `values`; `minLength`, `maxLength`, `regex`, `format` (`uuid`, `email`, `uri`); `min`, `max`, `exclusiveMin`, `exclusiveMax`; `multipleOf`; `scale`; `notIn`. `minItems`, `maxItems` and `unique` are in `many` on a field reference | `format: iso-date`, `precision`, `after`, `before`, `of`, `keyType`, `valueType`, `to`. `oneOf` and `notEqual` have replacements: `enum` with `values`, and `notIn` |
| Constraint values | Pass 1 examines the type of each constraint value against its primitive | — |
| Entities (§4.2) | `description`, `fields`, `key`. On each field reference: `ref` to a field or an entity, `link` to an entity, `as`, `required` and `many`. Embedded entities and lists of them, with `unique` by the key. Links by the key | `nullable`. The `invariants` list on an entity: an invariant names its entity with `on`. A link to an entity in a different manifest. A check that the linked object exists: the shell does that |
| Invariants (§4.3) | `description`, `on` (one entity), `rule`, `message`. The rule language: fields, literals, `< <= = != >= >`, `+ -` on `integer` and `decimal`, `and`, `or`, `not`, `is present`, `is absent`. Guards for optional fields. A link compares as the value of its key. The invariants of an embedded entity apply inside it | Invariants across entities. Rules over the items of a list, or over the properties of an embedded entity. Functions in a rule |
| Operations (§4.4) | `description`, `input` and `output` (entities), `errors`, `emits`. Synchronous handlers | A field as `input` or `output` |
| Events (§4.5) | `description` and `fields`, with the same field references as an entity. The reserved property `kind`. An event only on success | `key` on an event. An invariant on an event. A count or a sequence of the events of an operation. Events across manifests |
| Errors (§4.6) | `description`, the five categories, `retryable`, `message` with placeholders, `fields`, with the same field references as an entity. The reserved property `kind`. `recordAs`, with an event that the fields of the error can make | A `recordAs` event with a mandatory property that the error does not have |

For the full schema, refer to [The manifest](./manifest).

## Universal IR (§5)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| Form | Plain objects with URN keys in URN order, `meta` with `manifestHash` and `irSchemaVersion: 1` | — |
| Nodes | `IRField`, `IREntity` (with `key`), `IRInvariant`, `IROperation` (with `emits`), `IREvent`, `IRError`. `IREvent` is an `IREntity` without `key`. `IRInvariant` has `ruleText` and `brandIdentifier`, which the specification does not have. `lifecycle` on a node whose `status` is not `active` | `lifecycle` on an active node. `invariants` on `IREntity`: `invariantsOf` finds them by `on` |
| Field references | `IRPropertyRef`, one of three forms: `IRFieldRef` (`field`), `IREmbedRef` (`entity`) and `IRLinkRef` (`link`). Each has `name` (the property name), `required` and `many`. The specification does not have `name`, `many` and the two other forms | `nullable` |
| Errors | The parsed message template. `recordAs` | — |

## Compiler passes (§5)

| Pass | Status in urn-forge 0.1.0 |
| --- | --- |
| 1. Meta-schema | Built |
| 2. Expansion | Built |
| 3. Uniqueness | Built. It also examines property names in an entity, an event or an error, the reserved property `kind`, and the `key` of each entity (`invalid-entity-key`) |
| 4. Referential integrity | Built for `ref`, `link`, `key`, `input`, `output`, `errors`, `emits`, `recordAs`, `on` and `supersededBy`. urn-forge does not have `of` and `to` at this time |
| 5. Cycle check | Built for embedded entities (`embedding-cycle`). Links can make a cycle. Pass 5 also examines that each linked entity, and each entity in a unique list, has a `key` (`missing-key`) |
| 6. Rule and template typing | Built for invariant rules, error message templates and `recordAs` events (`invalid-record-as`) |
| 7. Constraint coherence | Built for the range of each ordered primitive, `minLength` and `maxLength`, `multipleOf`, `scale` and `notIn` against the range, `format: uuid` against the length constraints, and `minItems` and `maxItems` of a list. Two constraints for one side of one aspect cause `conflicting-constraints`. Pass 1 examines that `values` is not empty. urn-forge does not have `precision` at this time |
| 8. Lifecycle | Built. `deprecated-ref` (a warning) and `sunset-ref` (an error), with the reference date from `--reference-date` or `referenceDate`. Without a reference date, sunset dates are not compared |

Refer to [Compiler passes](./compiler-passes).

## Determinism (§6)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| Output rules | No clock, no random values, no environment in the plugins. Sorted output. `\n` line endings, one newline at the end, UTF-8 without BOM | — |
| Generated file header | `// @generated by urn-forge 0.1.0 — do not edit` and `// fingerprint: sha256:<hex>`. The SQL file uses `--` in place of `//` | — |
| Fingerprint | The canonical IR, the plugin configurations, the urn-forge version, and the plugin names and versions | — |
| Tests | Golden files in `tests/fixtures/*/expected`. A CI job that compiles and verifies again with the Turkish locale and the time zone `Pacific/Chatham` | — |
| Reference date | `--reference-date` and `referenceDate`, never the clock. The generated files depend on `status` only, never on a date | — |

## Plugins (§7)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| Plugin contract | `name`, `version`, `configSchema`, `emit`. Also `supports` and `requires`, which the specification does not have | — |
| Valibot plugin (§7.1) | A `v.pipe(…)` with `v.brand` for each field, a `v.object` for each entity, event and error, `v.optional` for `required: false`, `v.array` for `many`, the entity schema for an embedded entity, the key field schema for a link, a `kind` literal on each event and error, input and output types. `v.uuid`, `v.email` and `v.url` for `format`. Exact `decimal` comparison without a library. Invariants as `v.forward(v.check(…), [<field>])` in a `v.pipe` of the entity, with an exported rule function for each invariant | `v.isoDate` (`format: iso-date`), `v.nullable` |
| FCIS plugin (§7.2) | `Result` with events, `ok`, `emit` and `fail`, a handler type for each operation that accepts only its events, `DomainCoreImplementation`, `DispatchMap`, `executeOperation` with `UnknownOperation`, `InputRejected`, `DomainError` and `ContractViolation`. The parsed events of a success, and the `recordAs` event of a declared error as `record`. The invariant URN on each issue of an invariant | — |
| Gherkin plugin (§7.3) | A generic step library in `urn-forge/cucumber`, in place of generated code | `domain.cucumber.generated.ts`, `defineParameterType` for each field, `urn-forge.lint.json` |
| Postgres plugin (§7.4) | `schema.generated.sql` with `CREATE` statements for Postgres 14 or later. Nothing for an operation, an event or an error. The plugin is not in the default list. Its option `tables` names the entities that become tables, and `unenforced` sets the severity of `unenforced-in-sql`. A schema for each context. A domain for each stored field, with one `CHECK` for all its constraints. A root table for each entity in `tables`, with its `key` as the primary key. A child table for each list and each embedded entity. A foreign key for each link to a root table. `UNIQUE` for a unique list. A deferred constraint trigger for each count. A named `CHECK` for each invariant. `COMMENT ON` with the URNs. The codes `unenforced-in-sql` and `invalid-sql-name` | A table for each entity with a `key`. `ck_<brand>` checks on each table. The option `listStorage` and `JSONB` lists. `nullable`. `VARCHAR(n)`, `UUID` and `NUMERIC(p, s)` columns. Migrations, code that reads and writes rows, indexes other than keys and `UNIQUE`, and databases other than Postgres. An event store, an outbox table or a publisher of events |
| Config (§7.5) | `manifest`, `out`, `plugins`, `referenceDate`. Also `core`, `features`, `tsconfig`, `shell` and `boundaryCoverage`. `defineConfig` from `urn-forge` and from `urn-forge/config` | `boundaryCoverage` is a top-level setting, not a setting of a `gherkin` plugin. `listStorage` in the configuration of `postgres` |

For the generated code, refer to [The generated schemas](./generated-schemas), [The generated runtime](./generated-runtime) and [The Postgres schema](./postgres-schema).

## Verification gates (§8)

| Gate | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| 1. Implementation completeness | `tsc` over the core entry, and a check for `satisfies DomainCoreImplementation` | — |
| 2. Boundary discipline | The gate `boundary` in `verify`, on the TypeScript program of gate 1. Four rules about brands: `brand-assertion`, `brand-from-any`, `suppressed-check`, and `core-parser-import` for core files only. The core files: the core entry and the files that it imports in its directory. The shell files: the `shell` setting | The ESLint profile `urn-forge/eslint-config`, typescript-eslint and the rule `no-brand-construction`. Rules about `any` and type assertions that do not touch a brand. A waiver for gate 2. An ESLint configuration from `urn-forge init` |
| 3. Gherkin traceability | Tags, table headers, a column for each mandatory input field, list and object cells (`invalid-cell`), declared errors in steps, error coverage, events in steps and event coverage, input invariants in steps and invariant coverage (also of embedded entities), boundary coverage of each constraint at any depth and of the item count and `unique` of a list, `@urn-forge:strict`, `boundaryCoverage`, the `ratchet-ready` note, waivers, strict and non-strict counts | A waiver as the tag `@urn-forge:waive(<field URN>, <reason>)`: urn-forge uses the comment `# urn-forge:waive <field URN> <reason>` |
| 4. Drift | A byte comparison with a new compile, and generated files with no source (`generated-orphan`) | — |
| 5. Compatibility | The command `urn-forge diff <old> <new>`, apart from `verify`. The CI job `compatibility` of this repository runs it against the base branch | Gate 5 inside `verify`, with `--base` |

Refer to [Verification gates](./verification-gates).

## CLI and repository (§9)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| Commands | `init`, `compile`, `verify`, `diff` | `inspect`, `graph` |
| Options | `--config`, `--manifest`, `--out`, `--core`, `--features`, `--tsconfig`, `--reference-date`, `--format` | `--src`, `--base`, `--force` |
| Diagnostics | `<file>:<line>:<column>  <severity>  <code>  <message>`, with the URN or the key at the start of the message. `--format json` | — |
| Distribution | A tarball that `npm run pack:tarball` makes from a clone, with `bin`, `src` and the starter template. A project installs it with `npm install <file>`. The entry points are TypeScript source | An npm package with compiled JavaScript |
| Repository layout | An npm-workspaces monorepo: `packages/urn-forge` and `docs`. `src/rules/` holds the parser, the type checker and the TypeScript translation of the rule language. `src/diff/` holds the classifier of `urn-forge diff` | `packages/eslint-config` |

Refer to [The CLI](./cli) and [The package API](./public-api).

## Differences from specification v1.1

urn-forge 0.1.0 changes these parts of the specification:

| Part | Specification v1.1 | urn-forge 0.1.0 |
| --- | --- | --- |
| Handler output | A handler returns its output with a brand | A handler returns the output without a brand. `executeOperation` adds the brand when it parses the output. The same applies to declared errors |
| Feature table headers | Only fields of the input entity | Fields of the input or of the output of the operation |
| `IRFieldRef` | `field`, `required`, `nullable` | `IRPropertyRef`: `IRFieldRef` (`field`), `IREmbedRef` (`entity`) or `IRLinkRef` (`link`), each with `name`, `required` and `many` |
| A fixed set of values | `oneOf` on a `string` | The `enum` primitive with `values` |
| An excluded value | `notEqual`, with one value | `notIn`, with a list of values |
| Bounds | `min` and `max` (inclusive). `after` and `before` on a `timestamp` | `min` and `max` on each ordered primitive. Also `exclusiveMin` and `exclusiveMax` on `float`, `decimal` and `timestamp` |
| Decimal size | `precision: [p, s]` | `scale` only. The range limits the size |
| A calendar day | `format: iso-date` on a `string` | The `date` primitive |
| A list | The `list` primitive | `many` on a field reference |
| A reference to an entity | The `ref` primitive, with `to` | `link: <entity>` on a field reference. The property holds the value of the `key` of the entity |
| An entity in an entity | Not specified | `ref: <entity>` on a field reference. The property holds an embedded object |
| `key` on an entity | The key of the SQL table | The field that a link holds, and that `unique` compares in a list of the entity. Also the primary key of the table of the entity, if the entity is in `tables` of the `postgres` plugin |
| A property name | The identifier of the field | The identifier of the target, or `as` |
| Waivers | The tag `@urn-forge:waive(<field URN>, <reason>)` | The comment `# urn-forge:waive <field URN> <reason>` |
| `boundaryCoverage` | An option of the `gherkin` plugin | A top-level setting of the configuration file |
| Text diagnostics | `file:line:col  severity  <URN>  message` | `file:line:col  severity  code  message`. The message starts with the URN or the key |
| The link between an entity and its invariants | `on` on the invariant and `invariants:` on the entity | `on` only |
| An invariant | `on`, `rule`, `message` | Also `description`, which is necessary |
| Presence in a rule | `is present` | `is present` and `is absent`. An optional field must have a guard |
| A scenario for an invariant | Not specified | `Then the input is rejected by "<invariant URN>"`, and invariant coverage in gate 3 |
| The tables of the Postgres plugin | A table for each entity with a `key`. An entity with no `key` is a compile error | A table for each entity in the `tables` option. Only these entities need a `key` (`missing-key`) |
| Field constraints in SQL | Named `CHECK` constraints on each table, `ck_<brandIdentifier>` | A domain for each field, `"<context>"."<identifier>_value"`, with one `CHECK` named `<identifier>` |
| A list in SQL | `JSONB` or a child table, with the plugin option `listStorage` | A child table. There is no `listStorage` option |
| A rule that SQL cannot express | A compile error | `unenforced-in-sql`, a warning. The option `unenforced: 'error'` makes it an error |
| SQL types | `VARCHAR(n)`, `UUID` or `TEXT` for a `string`. `NUMERIC(p, s)` for a `decimal` | `TEXT` for each `string`, also for `format: uuid`. `NUMERIC` with no precision, and a `scale` check |
| The length of a string | Not specified | The number of Unicode code points, in Valibot, in gate 3 and in Postgres |
| The class of a change | A tighter constraint, a removed field reference and an optional reference that becomes required are breaking. A wider constraint is compatible | The class depends on the direction of use: In, Out or Stored. A removed property whose target was deprecated is a lifecycle change |
| A new declared error | Compatible | Breaking, because it widens what callers receive |
| A new event in `emits` | Not specified | Breaking, because it widens what callers receive |
| The events of a successful `Result` | `events` is always in `Success`, and `Result<T, E>` has two type arguments | `Result<T, E, V = never>`. `events` holds only the events of the operation |
| `recordAs` | The fields of the event are a superset of the fields of the error | The event has each property of the error, with the same target, `required` and `many`. Each other property is optional |
| `IREvent` | The shape of `IREntity` | The shape of `IREntity` without `key` |
| The removal of a sunset atom | Not specified | Breaking: a sunset atom stays as a tombstone |
| Gate 5 | `verify --base <git-ref>` | The separate command `urn-forge diff <old> <new>` |
| Gate 2: the tool | The ESLint profile `urn-forge/eslint-config`, with typescript-eslint and the rule `no-brand-construction` | Four rules of urn-forge on the TypeScript checker of gate 1, in `verify`. No ESLint |
| Gate 2: the rules | No `any`, no type assertion and no `@ts-` comment in a core or shell file. No import of the `brand` of Valibot or of the generated schemas in the core directory | No `any` where a branded type belongs (`brand-from-any`). No type assertion to a branded type (`brand-assertion`). No `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` (`suppressed-check`). No value import of the generated schemas or of `valibot` in a core file (`core-parser-import`) |
| Gate 2: the files | The configured core and shell paths | The core entry and the files that it imports in its directory, and the `shell` setting |
| `urn-forge init` | Writes an ESLint configuration | Writes no ESLint configuration |
| `Lifecycle` in the IR | On each node | Only on a node whose `status` is not `active` |
| `supersededBy` | A URN | A short key |
| No reference date | Sunset checks are warnings | Sunset dates are not compared, and `verify` says so |

For the reasons, refer to [Departures from the specification](../explanation/departures-from-the-spec).

## Related pages

- [Specification v1.1](../project/spec-v1-1)
- [MVP plan](../project/mvp-plan)
- [Departures from the specification](../explanation/departures-from-the-spec)
- [The manifest](./manifest)
