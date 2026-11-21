# Scope

This page compares urn-forge 0.1.0 with [specification v1.1](../project/spec-v1-1). For each area of the specification, it gives the parts that urn-forge has and the parts that urn-forge does not have at this time. The section numbers are those of the specification. For the reasons, refer to [Departures from the specification](../explanation/departures-from-the-spec).

## Summary

urn-forge 0.1.0 has the full traceability chain for five kinds of atom: the manifest, the IR, the generated contracts, the Gherkin checks and the drift check. It does not have the kinds, primitives, plugins, gates and commands that only make the product larger.

## URNs and versions (§3)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| URN grammar | Six segments, the segment pattern `^[a-z][a-z0-9_]{0,62}$`, case-sensitive URNs | The kind `event` in a URN |
| Manifest scope | One YAML file with one `namespace` and one `domain`. Short keys that expand to URNs | — |
| Brand identifiers | PascalCase of the context and the identifier. A collision is an error (`duplicate-brand`) | — |
| Compatibility classes | — | `urn-forge diff` and the compatible, breaking and lifecycle classes |
| Experimental stability | `stability: experimental` in the header. urn-forge writes it to the IR | A check that uses `stability` |
| Lifecycle metadata | — | `status`, `supersededBy` and `sunsetDate`, also on invariants |

## Manifest model (§4)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| Kinds | `field`, `entity`, `invariant`, `operation`, `error` | `event` (§4.5) |
| Primitives (§4.1) | `boolean`, `date`, `decimal`, `enum`, `float`, `integer`, `string`, `timestamp`. The specification does not have `date` and `enum` | `list`, `record`, `ref`. A list is `many` on a field reference |
| Constraints (§4.1) | `mustBe`; `values`; `minLength`, `maxLength`, `regex`, `format` (`uuid`, `email`, `uri`); `min`, `max`, `exclusiveMin`, `exclusiveMax`; `multipleOf`; `scale`; `notIn`. `minItems`, `maxItems` and `unique` are in `many` on a field reference | `format: iso-date`, `precision`, `after`, `before`, `of`, `keyType`, `valueType`, `to`. `oneOf` and `notEqual` have replacements: `enum` with `values`, and `notIn` |
| Constraint values | Pass 1 examines the type of each constraint value against its primitive | — |
| Entities (§4.2) | `description`, `fields`, and `required` and `many` on each field reference | `nullable`, `key`. The `invariants` list on an entity: an invariant names its entity with `on`. A list of entities |
| Invariants (§4.3) | `description`, `on` (one entity), `rule`, `message`. The rule language: fields, literals, `< <= = != >= >`, `+ -` on `integer` and `decimal`, `and`, `or`, `not`, `is present`, `is absent`. Guards for optional fields | Invariants across entities. Rules over the items of a list. Functions in a rule |
| Operations (§4.4) | `description`, `input` and `output` (entities), `errors`. Synchronous handlers | A field as `input` or `output`. `emits` |
| Errors (§4.6) | `description`, the five categories, `retryable`, `message` with placeholders, `fields`. The reserved property `kind` | `recordAs` |

For the full schema, refer to [The manifest](./manifest).

## Universal IR (§5)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| Form | Plain objects with URN keys in URN order, `meta` with `manifestHash` and `irSchemaVersion: 1` | — |
| Nodes | `IRField`, `IREntity`, `IRInvariant`, `IROperation`, `IRError`. `IRInvariant` has `ruleText` and `brandIdentifier`, which the specification does not have | Events, `Lifecycle` on each node. `invariants` on `IREntity`: `invariantsOf` finds them by `on` |
| Field references | `field`, `required`, `many`, and `name` (the property name). The specification does not have `name` and `many` | `nullable` |
| Errors | The parsed message template | `recordAs` |

## Compiler passes (§5)

| Pass | Status in urn-forge 0.1.0 |
| --- | --- |
| 1. Meta-schema | Built |
| 2. Expansion | Built |
| 3. Uniqueness | Built. It also examines property names in an entity or an error, and the reserved property `kind` |
| 4. Referential integrity | Built for `ref`, `input`, `output`, `errors` and `on`. urn-forge does not have `of`, `to`, `key`, `emits`, `recordAs` and `supersededBy` at this time |
| 5. Cycle check | Not built |
| 6. Rule and template typing | Built for invariant rules and error message templates. urn-forge does not have `recordAs` at this time |
| 7. Constraint coherence | Built for the range of each ordered primitive, `minLength` and `maxLength`, `multipleOf`, `scale` and `notIn` against the range, `format: uuid` against the length constraints, and `minItems` and `maxItems` of a list. Two constraints for one side of one aspect cause `conflicting-constraints`. Pass 1 examines that `values` is not empty. urn-forge does not have `precision` at this time |
| 8. Lifecycle | Not built |

Refer to [Compiler passes](./compiler-passes).

## Determinism (§6)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| Output rules | No clock, no random values, no environment in the plugins. Sorted output. `\n` line endings, one newline at the end, UTF-8 without BOM | — |
| Generated file header | `// @generated by urn-forge 0.1.0 — do not edit` and `// fingerprint: sha256:<hex>` | — |
| Fingerprint | The canonical IR, the plugin configurations, the urn-forge version, and the plugin names and versions | — |
| Tests | Golden files in `tests/fixtures/*/expected`. A CI job that compiles and verifies again with the Turkish locale and the time zone `Pacific/Chatham` | — |
| Reference date | — | `referenceDate` and `--reference-date` |

## Plugins (§7)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| Plugin contract | `name`, `version`, `configSchema`, `emit`. Also `supports` and `requires`, which the specification does not have | — |
| Valibot plugin (§7.1) | A `v.pipe(…)` with `v.brand` for each field, a `v.object` for each entity and error, `v.optional` for `required: false`, `v.array` for `many`, a `kind` literal on each error, input and output types. `v.uuid`, `v.email` and `v.url` for `format`. Exact `decimal` comparison without a library. Invariants as `v.forward(v.check(…), [<field>])` in a `v.pipe` of the entity, with an exported rule function for each invariant | `v.isoDate` (`format: iso-date`), `v.nullable` |
| FCIS plugin (§7.2) | `Result`, `ok` and `fail`, a handler type for each operation, `DomainCoreImplementation`, `DispatchMap`, `executeOperation` with `UnknownOperation`, `InputRejected`, `DomainError` and `ContractViolation`. The invariant URN on each issue of an invariant | Events in `Result`, `EmittedEvent`, the `recordAs` event of an error |
| Gherkin plugin (§7.3) | A generic step library in `urn-forge/cucumber`, in place of generated code | `domain.cucumber.generated.ts`, `defineParameterType` for each field, `urn-forge.lint.json` |
| Postgres plugin (§7.4) | — | `schema.generated.sql`, and `CHECK` constraints for invariants |
| Config (§7.5) | `manifest`, `out`, `plugins`. Also `core`, `features`, `tsconfig` and `boundaryCoverage`. `defineConfig` from `urn-forge` and from `urn-forge/config` | `referenceDate`. `boundaryCoverage` is a top-level setting, not a setting of a `gherkin` plugin |

For the generated code, refer to [The generated schemas](./generated-schemas) and [The generated runtime](./generated-runtime).

## Verification gates (§8)

| Gate | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| 1. Implementation completeness | `tsc` over the core entry, and a check for `satisfies DomainCoreImplementation` | — |
| 2. Boundary discipline | — | The ESLint profile `urn-forge/eslint-config` and the rule `no-brand-construction` |
| 3. Gherkin traceability | Tags, table headers, a column for each mandatory input field, declared errors in steps, error coverage, input invariants in steps and invariant coverage, boundary coverage of each constraint and of the item count of a list, `@urn-forge:strict`, `boundaryCoverage`, the `ratchet-ready` note, waivers, strict and non-strict counts | A waiver as the tag `@urn-forge:waive(<field URN>, <reason>)`: urn-forge uses the comment `# urn-forge:waive <field URN> <reason>` |
| 4. Drift | A byte comparison with a new compile, and generated files with no source (`generated-orphan`) | — |
| 5. Compatibility | — | `urn-forge diff` against the manifest at the merge base |

Refer to [Verification gates](./verification-gates).

## CLI and repository (§9)

| Part | urn-forge 0.1.0 has | urn-forge 0.1.0 does not have at this time |
| --- | --- | --- |
| Commands | `init`, `compile`, `verify` | `diff`, `inspect`, `graph` |
| Options | `--config`, `--manifest`, `--out`, `--core`, `--features`, `--tsconfig`, `--format` | `--reference-date`, `--src`, `--base`, `--force` |
| Diagnostics | `<file>:<line>:<column>  <severity>  <code>  <message>`, with the URN or the key at the start of the message. `--format json` | — |
| Distribution | A tarball that `npm run pack:tarball` makes from a clone, with `bin`, `src` and the starter template. A project installs it with `npm install <file>`. The entry points are TypeScript source | An npm package with compiled JavaScript |
| Repository layout | An npm-workspaces monorepo: `packages/urn-forge` and `docs`. `src/rules/` holds the parser, the type checker and the TypeScript translation of the rule language | `packages/eslint-config`, `src/diff/` |

Refer to [The CLI](./cli) and [The package API](./public-api).

## Differences from specification v1.1

urn-forge 0.1.0 changes these parts of the specification:

| Part | Specification v1.1 | urn-forge 0.1.0 |
| --- | --- | --- |
| Handler output | A handler returns its output with a brand | A handler returns the output without a brand. `executeOperation` adds the brand when it parses the output. The same applies to declared errors |
| Feature table headers | Only fields of the input entity | Fields of the input or of the output of the operation |
| `IRFieldRef` | `field`, `required`, `nullable` | `field`, `name`, `required`, `many` |
| A fixed set of values | `oneOf` on a `string` | The `enum` primitive with `values` |
| An excluded value | `notEqual`, with one value | `notIn`, with a list of values |
| Bounds | `min` and `max` (inclusive). `after` and `before` on a `timestamp` | `min` and `max` on each ordered primitive. Also `exclusiveMin` and `exclusiveMax` on `float`, `decimal` and `timestamp` |
| Decimal size | `precision: [p, s]` | `scale` only. The range limits the size |
| A calendar day | `format: iso-date` on a `string` | The `date` primitive |
| A list | The `list` primitive | `many` on a field reference |
| Waivers | The tag `@urn-forge:waive(<field URN>, <reason>)` | The comment `# urn-forge:waive <field URN> <reason>` |
| `boundaryCoverage` | An option of the `gherkin` plugin | A top-level setting of the configuration file |
| Text diagnostics | `file:line:col  severity  <URN>  message` | `file:line:col  severity  code  message`. The message starts with the URN or the key |
| The link between an entity and its invariants | `on` on the invariant and `invariants:` on the entity | `on` only |
| An invariant | `on`, `rule`, `message` | Also `description`, which is necessary |
| Presence in a rule | `is present` | `is present` and `is absent`. An optional field must have a guard |
| A scenario for an invariant | Not specified | `Then the input is rejected by "<invariant URN>"`, and invariant coverage in gate 3 |

For the reasons, refer to [Departures from the specification](../explanation/departures-from-the-spec).

## Related pages

- [Specification v1.1](../project/spec-v1-1)
- [MVP plan](../project/mvp-plan)
- [Departures from the specification](../explanation/departures-from-the-spec)
- [The manifest](./manifest)
