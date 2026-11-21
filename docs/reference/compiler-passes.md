# Compiler passes

The `compile` and `verify` commands send the manifest through a sequence of passes. The passes make the IR. Then the plugins make the generated files from the IR. The pass numbers come from specification v1.1.

## Sequence

| Step | Name | Examines | Codes | If there is an error |
| --- | --- | --- | --- | --- |
| Read | Read the file | The manifest file can be read | `manifest-unreadable` | Stop |
| YAML | Parse the YAML | The file is valid YAML with no key two times in one mapping | `yaml-syntax`, `duplicate-key` | Stop after this step |
| 1 | [Meta-schema](#pass-1-meta-schema) | The structure of the header and of each entry | `not-a-mapping`, `missing-header`, `invalid-key`, `unknown-kind`, `unknown-primitive`, `constraint-not-allowed`, `unknown-property`, `missing-property`, `invalid-value`, `invalid-lifecycle` | Stop after this step |
| 2 | [Expansion](#pass-2-expansion) | None. It makes the URNs and the brand identifiers | None | — |
| 3 | [Uniqueness](#pass-3-uniqueness) | Brand identifiers and property names are unique. The `key` of each entity is one of its own fields | `duplicate-brand`, `duplicate-property`, `duplicate-ref`, `invalid-entity-key`, `reserved-property` | Stop after pass 7 |
| 4 | [References](#pass-4-references) | Each reference names an atom of the correct kind. `supersededBy` does not name the atom itself | `unresolved-ref`, `wrong-ref-kind`, `invalid-lifecycle` | Stop after pass 7 |
| 5 | [Structure](#pass-5-structure) | Each linked entity has a `key`, and each entity in a unique list has a `key`. No entity embeds itself | `missing-key`, `embedding-cycle` | Stop |
| 6 | [Rule and template typing](#pass-6-rule-and-template-typing) | Each invariant rule is valid and agrees with the types of its entity. Each placeholder in an error message names a mandatory field of the error. The fields of each error can make its `recordAs` event | `rule-syntax`, `unknown-rule-field`, `rule-type`, `unguarded-field`, `unknown-placeholder`, `invalid-record-as` | Stop after pass 7 |
| 7 | [Constraint coherence](#pass-7-constraint-coherence) | A field has one constraint for each side of each aspect. The constraints of each field accept one or more values. The `many` of each field reference accepts one or more lists | `conflicting-constraints`, `incoherent-constraints` | Stop after pass 7 |
| 8 | [Lifecycle](#pass-8-lifecycle) | No active atom refers to a sunset atom or to an atom after its sunset date. A reference from an active atom to a deprecated atom is a warning | `deprecated-ref`, `sunset-ref` | Stop. A warning does not stop |
| Plugins | [Plugin checks](#plugin-checks) | The plugins and their configurations agree with the IR | `plugin-config`, `missing-plugin`, `unsupported-construct`, `export-collision`, `output-conflict`. From `postgres`: `wrong-ref-kind`, `unresolved-ref`, `missing-key`, `plugin-config`, `invalid-sql-name`, `unenforced-in-sql` | No files |

- Each step reports all the problems that it finds, not only the first problem.
- Passes 2, 3, 4, 6 and 7 run together, and urn-forge reports their diagnostics together. Pass 5 runs after them, only if they find no error. Pass 8 runs after pass 5, only if pass 5 finds no error.
- Each diagnostic has a position in the manifest, except `manifest-unreadable`, `not-a-mapping`, `missing-header`, `plugin-config`, `missing-plugin` and `output-conflict`. A diagnostic of the `postgres` configuration that names no URN also has no position.
- For the message, the cause and the correction of each code, refer to [Diagnostics](./diagnostics).

## Pass 1: meta-schema

Pass 1 examines the parsed YAML with Valibot schemas. It examines these items, in this sequence:

1. The top level is a mapping (`not-a-mapping`).
2. The `manifest` header is there (`missing-header`) and agrees with its schema.
3. Each other top-level key, in the sequence of the file:
   1. The key is a short key (`invalid-key`) of a known kind (`unknown-kind`). The known kinds are `field`, `entity`, `invariant`, `operation`, `event` and `error`.
   2. The entry agrees with the schema of its kind. For a field, the schema comes from its primitive.
   3. The lifecycle keys `status`, `supersededBy` and `sunsetDate` agree with their schema. Pass 1 examines them apart from the keys of the kind, because each kind accepts them.

| Problem in an entry | Code | Position |
| --- | --- | --- |
| A `primitive` that is not `boolean`, `date`, `decimal`, `enum`, `float`, `integer`, `string` or `timestamp`, or no `primitive` | `unknown-primitive` | The value, or the entry key if there is no `primitive` |
| A key on a field that is a constraint of a different primitive | `constraint-not-allowed` | The key |
| A key on the header, an atom or a field reference that it does not accept, and on a field a key that is a constraint of no primitive. On a field, `oneOf` and `notEqual` get a hint in the message | `unknown-property` | The key |
| A value of the wrong type or form. Examples: an empty `values` list, a `decimal` bound that is a YAML number, a `timestamp` bound with an offset, a `many` that is not `true` or a mapping, or an `as` that is not a URN segment | `invalid-value` | The value |
| A field reference with both `ref` and `link`, or with neither. The message is `must have either ref or link` | `invalid-value` | The field reference |
| A necessary property that is not there, for example the `values` of an `enum` | `missing-property` | The entry key |
| A `status` that is not `active`, `deprecated` or `sunset`, a `supersededBy` that is not a short key, or a `sunsetDate` that is not a date `YYYY-MM-DD` | `invalid-value` | The value |
| A `supersededBy` or a `sunsetDate` on an atom whose `status` is `active`, or that has no `status` | `invalid-lifecycle` | The key |

The schema of each kind is on [The manifest](./manifest). The rules for constraint values are on [Primitives and constraints](./primitives).

## Pass 2: expansion

Pass 2 changes each short key to a URN with the `namespace` and `domain` of the header. It also makes the brand identifier of each atom. It reports no diagnostics. Refer to [URNs and names](./naming).

## Pass 3: uniqueness

Each URN is unique without a check. A URN comes from its short key with one rule, and a YAML mapping cannot have the same key two times (`duplicate-key`).

| Check | Code | Where |
| --- | --- | --- |
| Two atoms have the same brand identifier | `duplicate-brand` | All atoms, also of different kinds |
| One `fields` list has two properties with the same name, from two different targets | `duplicate-property` | Entities, events and errors |
| One `fields` list refers to the same target two times with the same name | `duplicate-ref` | Entities, events and errors |
| One `errors` list refers to the same error two times | `duplicate-ref` | Operations |
| One `emits` list refers to the same event two times | `duplicate-ref` | Operations |
| The `key` of an entity is not a field of its `fields` list with `ref`, or the reference has `required: false` or `many` | `invalid-entity-key` | Entities |
| A property of an error or an event has the name `kind` | `reserved-property` | Errors and events |

The name of a property is its `as`, or the identifier of its target if there is no `as`. The messages of `duplicate-property` and `duplicate-ref` tell you to use `as`, for example `both become property "sku"; rename one with as`.

Pass 3 examines URNs and brand identifiers over all atoms first. The other checks run for each atom, after pass 4 for that atom. A reference that does not resolve is not part of the `duplicate-property` and `duplicate-ref` checks.

## Pass 4: references

| Kind | Reference | Must name |
| --- | --- | --- |
| `entity` | `fields[<i>].ref` | A field or an entity |
| `entity` | `fields[<i>].link` | An entity |
| `entity` | `key` | A field |
| `error` | `fields[<i>].ref` | A field or an entity |
| `error` | `fields[<i>].link` | An entity |
| `error` | `recordAs` | An event |
| `event` | `fields[<i>].ref` | A field or an entity |
| `event` | `fields[<i>].link` | An entity |
| `invariant` | `on` | An entity |
| `operation` | `input` | An entity |
| `operation` | `output` | An entity |
| `operation` | `errors[<i>]` | An error |
| `operation` | `emits[<i>]` | An event |
| Each kind | `supersededBy` | An atom of the same kind that is not the atom itself |

| Problem | Code |
| --- | --- |
| The manifest does not declare the atom | `unresolved-ref` |
| The atom is of a kind that the reference does not accept | `wrong-ref-kind` |
| `supersededBy` names the atom itself | `invalid-lifecycle` |

The message names the reference with its path, for example `fields[1].ref`, `errors[2]`, `emits[1]` or `on`. Example: `on "policy.field.premium" must name an entity, but urn:acme:rules:policy:field:premium is a field`.

## Pass 5: structure

Pass 5 runs after the IR builder builds each atom, because each check reads a different entity. Pass 5 runs only if passes 2, 3, 4, 6 and 7 find no error.

| Check | Code | Position |
| --- | --- | --- |
| The entity that a `link` names has a `key` | `missing-key` | The `link` |
| The embedded entity of a `ref` with `many: { unique: true }` has a `key` | `missing-key` | The `many` |
| No entity embeds itself, directly or through other entities. Links can make a cycle | `embedding-cycle` | The `fields` of the first entity of the cycle in URN order |

Pass 5 reports one `embedding-cycle` for each cycle. It examines the entities and the errors in URN order, and reports `missing-key` first.

These diagnostics come from a copy of the insurance manifest with two changes. The `customer` entity has no `key`, and `coverage` embeds `policy`:

```
insurance/domain.manifest.yaml:91:13  error  missing-key  urn:acme:insurance:policy:entity:policy: fields[1].link urn:acme:insurance:customer:entity:customer has no key, so a link to it holds nothing; set key on it
insurance/domain.manifest.yaml:76:5  error  embedding-cycle  urn:acme:insurance:policy:entity:coverage: urn:acme:insurance:policy:entity:coverage embeds urn:acme:insurance:policy:entity:policy embeds urn:acme:insurance:policy:entity:coverage, so its type would never end; use a link for one of them
```

## Pass 6: rule and template typing

Pass 6 examines the text of invariant rules and error messages, and the `recordAs` event of each error.

### Invariant rules

For each invariant, pass 6 does these steps:

1. It parses the `rule` with the grammar of the [rule language](./rule-language). If the parse fails, it reports `rule-syntax` and stops for this invariant.
2. If `on` resolves to an entity, it examines the rule against the property names of the entity. It gives each property the primitive of its field, `required` and `many`. A link gets the primitive of the key field of the linked entity. An embedded entity has no primitive: a rule can use it only in `is present` or `is absent`.
3. It reports each problem that it finds: `unknown-rule-field`, `rule-type` or `unguarded-field`.

| Check | Code |
| --- | --- |
| The rule agrees with the grammar | `rule-syntax` |
| Each field name is a property of the `on` entity | `unknown-rule-field` |
| The two sides of each operator have one primitive. Each literal fits the primitive of the other side. An order operator is on an ordered primitive. `+` and `-` are on `integer` or `decimal`. `and`, `or`, `not` and the rule itself have conditions. A list or an embedded entity is only in `is present` or `is absent`. `is present` and `is absent` are not on a required field | `rule-type` |
| Each optional field is used only after a guard | `unguarded-field` |

The position of each diagnostic is the `rule` value. The message gives the column in the rule, for example `(at column 14 of the rule)`. If pass 6 finds no problem, the IR keeps the parsed rule and its canonical text. For each check and its messages, refer to [The rule language](./rule-language).

### Message templates

Pass 6 parses the `message` of each error into text and placeholders. Each placeholder must name a property of the error with `required: true` and no `many`. The property cannot be an embedded entity. If not, pass 6 reports `unknown-placeholder` at the `message`, one time for each placeholder. For the form of a placeholder, refer to [The manifest](./manifest).

### `recordAs` events

`executeOperation` makes the `recordAs` event of an error from the fields of the error. Thus pass 6 compares the properties of the error and of its event by property name. The event must have each property of the error, with the same target, `required` and `many`. Each other property of the event must have `required: false`. If not, pass 6 reports `invalid-record-as` at `recordAs`, one time for each error. The message gives the first problem.

From a copy of the insurance domain, with `required: false` removed from `cancellation_date` in `refund_refused`:

```
insurance/domain.manifest.yaml:162:13  error  invalid-record-as  urn:acme:insurance:policy:error:refund_below_minimum: recordAs urn:acme:insurance:policy:event:refund_refused has the required property "cancellation_date", which the error does not have; make it optional, so the error's fields can build the event
```

Pass 6 does not examine `recordAs` if pass 4 did not resolve it to an event.

## Pass 7: constraint coherence

Pass 7 examines the constraints of each field together, in two steps:

1. Each constraint restricts one aspect of a value, for example the range or the shape. A field can set only one constraint for each side of an aspect. If a field sets `min` and `exclusiveMin`, `max` and `exclusiveMax`, or `regex` and `format`, pass 7 reports `conflicting-constraints` at the second key. Then it does not do step 2 for the field.
2. The constraints together must accept one or more values. If they do not, pass 7 reports `incoherent-constraints` at the constraint to correct.

Pass 7 also examines the `many` of each field reference in an entity, an event or an error, also of a link and of an embedded entity. If `minItems` is greater than `maxItems`, pass 7 reports `incoherent-constraints` at `many`, with the URN of the atom.

Pass 1, not pass 7, examines that a `values` list is not empty and has no value two times. For the rules of each primitive, refer to [Primitives and constraints](./primitives). For the aspects, refer to [The MECE model of primitives](../explanation/primitives-model).

This fixture has problems from pass 7 only:

<<< @/../packages/urn-forge/tests/fixtures/conflicting-constraints/domain.manifest.yaml

`urn-forge compile --manifest tests/fixtures/conflicting-constraints/domain.manifest.yaml` writes these diagnostics:

```
tests/fixtures/conflicting-constraints/domain.manifest.yaml:11:72  error  incoherent-constraints  urn:demo:conflicts:value:field:all_excluded: notIn lists every value that min, max allow, so no value is valid
tests/fixtures/conflicting-constraints/domain.manifest.yaml:18:85  error  incoherent-constraints  urn:demo:conflicts:value:field:at_order: min (2026-01-02T00:00:00Z) is after max (2026-01-01T00:00:00Z), so no value is valid
tests/fixtures/conflicting-constraints/domain.manifest.yaml:8:69  error  conflicting-constraints  urn:demo:conflicts:value:field:both_lower: min and exclusiveMin both set a lower bound; keep one
tests/fixtures/conflicting-constraints/domain.manifest.yaml:10:73  error  conflicting-constraints  urn:demo:conflicts:value:field:both_shapes: regex and format both set the shape; keep one
tests/fixtures/conflicting-constraints/domain.manifest.yaml:9:69  error  conflicting-constraints  urn:demo:conflicts:value:field:both_upper: max and exclusiveMax both set an upper bound; keep one
tests/fixtures/conflicting-constraints/domain.manifest.yaml:17:68  error  incoherent-constraints  urn:demo:conflicts:value:field:day_order: min (2026-02-01) is after max (2026-01-31), so no value is valid
tests/fixtures/conflicting-constraints/domain.manifest.yaml:13:69  error  incoherent-constraints  urn:demo:conflicts:value:field:empty_open: exclusiveMin and max are both 1, and one of them excludes it, so no value is valid
tests/fixtures/conflicting-constraints/domain.manifest.yaml:12:77  error  incoherent-constraints  urn:demo:conflicts:value:field:no_multiple: no multiple of 5 is between min (1) and max (4), so no value is valid
tests/fixtures/conflicting-constraints/domain.manifest.yaml:15:73  error  conflicting-constraints  urn:demo:conflicts:value:field:price_both: min and exclusiveMin both set a lower bound; keep one
tests/fixtures/conflicting-constraints/domain.manifest.yaml:16:84  error  incoherent-constraints  urn:demo:conflicts:value:field:price_scale: no value with at most 2 digit(s) after the point is between min (0.001) and max (0.009), so no value is valid
tests/fixtures/conflicting-constraints/domain.manifest.yaml:14:56  error  incoherent-constraints  urn:demo:conflicts:value:field:short_uuid: a uuid has 36 characters, which the length constraints exclude, so no value is valid
```

## Pass 8: lifecycle

Pass 8 examines each reference that pass 4 resolved, also `key`, `on`, `recordAs`, and the `errors` and `emits` of an operation. It does not examine `supersededBy`. For each reference, it compares the `status` of the atom that refers with the `status` and `sunsetDate` of the atom that it names:

| The atom that refers | The atom that it names | Code | Severity |
| --- | --- | --- | --- |
| `active` or `deprecated` | `status: sunset` | `sunset-ref` | `error` |
| `active` or `deprecated` | A `sunsetDate` on or before the reference date | `sunset-ref` | `error` |
| `active` | `status: deprecated`, and no `sunsetDate` on or before the reference date | `deprecated-ref` | `warning` |
| `deprecated` | `status: deprecated` | None | — |
| `sunset` | Any atom | None | — |

- The position is the reference, for example the `ref` of a field reference.
- The message names the reference with its path, for example `fields[2].ref`. It gives the `supersededBy` and the `sunsetDate` of the named atom, if it has them.
- If pass 8 finds an error, it reports all its diagnostics, and the compile stops. If it finds only warnings, `compile` reports them before the diagnostics of the plugins, and continues.

### The reference date

Pass 8 compares a `sunsetDate` with the reference date, never with the clock. Thus one commit always gives one result. The reference date comes from the first of these sources that has a value:

1. The option `--reference-date <YYYY-MM-DD>` of `compile` or `verify`.
2. The setting `referenceDate` in the configuration file.

If neither has a value, pass 8 does not compare sunset dates. It still examines `status`. If the manifest has a `sunsetDate`, `verify` then writes the line `note: sunset dates are not checked: set --reference-date or referenceDate in the config`. With `--format json`, its `result` line has `"sunsetDatesChecked":false`. `urn-forge diff` runs pass 8 with no reference date.

The insurance domain deprecates `policy.field.note`, with `sunsetDate: 2027-06-30`. The coverage still refers to it. `npm run compile:insurance` writes this warning:

```
insurance/domain.manifest.yaml:79:12  warning  deprecated-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, which is deprecated (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30)
```

On the sunset date, the same reference is an error. `urn-forge compile --config insurance/urn-forge.config.ts --reference-date 2027-06-30` writes this diagnostic, and no files:

```
insurance/domain.manifest.yaml:79:12  error  sunset-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, whose sunset date 2027-06-30 is on or before the reference date 2027-06-30 (superseded by urn:acme:insurance:policy:field:remark); refer to its replacement
```

With `status: sunset` on the note, the message is `… refers to urn:acme:insurance:policy:field:note, which is sunset (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30); refer to its replacement`, with or without a reference date.

## Sequence of the diagnostics

The IR builder builds the atoms in two stages. A kind that reads the nodes of other kinds builds after them. An invariant reads its entity and the fields of that entity. An error reads its `recordAs` event. Thus the invariants and the errors build last.

| Stage | Kinds |
| --- | --- |
| 1 | `field`, `entity`, `operation`, `event` |
| 2 | `invariant`, `error` |

urn-forge reports the diagnostics of passes 3, 4, 6 and 7 in this sequence:

1. `duplicate-brand`, for all atoms in URN order.
2. For each atom of stage 1 in URN order, and then for each atom of stage 2 in URN order:
   1. Pass 4, for each reference in the sequence of the entry. Then pass 4 for `supersededBy`.
   2. The checks of the kind of the atom:

| Kind | Checks, in sequence |
| --- | --- |
| `field` | Pass 7: `conflicting-constraints`, then `incoherent-constraints` |
| `entity` | `duplicate-property` and `duplicate-ref`, then the `many` check of pass 7, for each item of `fields`. Then `invalid-entity-key` |
| `invariant` | Pass 6: `rule-syntax`. Then, if `on` resolves, `unknown-rule-field`, `rule-type` and `unguarded-field` in the sequence that the type check finds them |
| `operation` | `duplicate-ref`, for each item of `errors`, then for each item of `emits` |
| `event` | `duplicate-property` and `duplicate-ref`, then the `many` check of pass 7, for each item of `fields`. Then `reserved-property` |
| `error` | `duplicate-property` and `duplicate-ref`, then the `many` check of pass 7, for each item of `fields`. Then `reserved-property`, then pass 6: `unknown-placeholder`, then `invalid-record-as` |

URN order compares the UTF-16 code units. It does not use the locale.

This fixture has problems from passes 3, 4, 6 and 7:

<<< @/../packages/urn-forge/tests/fixtures/broken-references/domain.manifest.yaml

`urn-forge compile --manifest tests/fixtures/broken-references/domain.manifest.yaml` writes these diagnostics:

```
tests/fixtures/broken-references/domain.manifest.yaml:7:1  error  duplicate-brand  urn:demo:broken:geo_metry:field:radius: brandIdentifier "GeoMetryRadius" is already used by urn:demo:broken:geo:field:metry_radius; rename one of them
tests/fixtures/broken-references/domain.manifest.yaml:17:12  error  unresolved-ref  urn:demo:broken:order:entity:line: fields[1].ref "order.field.missing" does not resolve (no atom urn:demo:broken:order:field:missing in this manifest)
tests/fixtures/broken-references/domain.manifest.yaml:10:71  error  incoherent-constraints  urn:demo:broken:order:field:code: minLength (3) is greater than maxLength (2), so no value is valid
tests/fixtures/broken-references/domain.manifest.yaml:9:61  error  incoherent-constraints  urn:demo:broken:order:field:quantity: min (10) is greater than max (1), so no value is valid
tests/fixtures/broken-references/domain.manifest.yaml:11:70  error  incoherent-constraints  urn:demo:broken:order:field:size: notIn lists every value that min, max allow, so no value is valid
tests/fixtures/broken-references/domain.manifest.yaml:39:10  error  wrong-ref-kind  urn:demo:broken:order:operation:place: input "order.field.quantity" must name an entity, but urn:demo:broken:order:field:quantity is a field
tests/fixtures/broken-references/domain.manifest.yaml:45:40  error  wrong-ref-kind  urn:demo:broken:order:operation:reprice: errors[1] "order.entity.line" must name an error, but urn:demo:broken:order:entity:line is an entity
tests/fixtures/broken-references/domain.manifest.yaml:45:59  error  duplicate-ref  urn:demo:broken:order:operation:reprice: errors[2] lists urn:demo:broken:order:error:limit_exceeded more than once
tests/fixtures/broken-references/domain.manifest.yaml:32:12  error  unknown-placeholder  urn:demo:broken:order:error:limit: message placeholder {code} names an optional field; placeholders must name required fields (required fields: none)
tests/fixtures/broken-references/domain.manifest.yaml:23:12  error  unknown-placeholder  urn:demo:broken:order:error:limit_exceeded: message placeholder {quantiy} names no field of the error (required fields: quantity)
tests/fixtures/broken-references/domain.manifest.yaml:23:12  error  unknown-placeholder  urn:demo:broken:order:error:limit_exceeded: message placeholder {limit} names no field of the error (required fields: quantity)
tests/fixtures/broken-references/domain.manifest.yaml:52:19  error  reserved-property  urn:demo:broken:order:error:wrong_kind: fields[0] becomes property "kind", which an error reserves for its URN; give it another name with as
```

The errors are in stage 2, so their diagnostics come after those of the operations.

## The IR

If passes 1 to 7 find no error, urn-forge makes the IR. The IR has these parts:

| Part | Contents |
| --- | --- |
| `meta` | `namespace`, `domain`, `manifestVersion` (the `version` of the header), `stability` (default `stable`), `manifestHash` (SHA-256 of the canonical JSON of the manifest) and `irSchemaVersion` (`1`) |
| `fields`, `entities`, `invariants`, `operations`, `events`, `errors` | One node for each atom, with the URN as the key, in URN order. A group with no atoms is `{}`. Sunset atoms are in the IR too |

A node has `lifecycle` only if its `status` is not `active`: `{ status, supersededBy?, sunsetDate? }`. `supersededBy` is the URN of the replacement. Thus the IR of a manifest with no lifecycle keys does not change.

The `fields` of an `IREntity`, an `IREvent` and an `IRError` is a list of `IRPropertyRef`. Each item has one of three forms. Each form has `name`, `required` and, for a list, `many`:

| Form in the manifest | IR type | Target key |
| --- | --- | --- |
| `ref: <field>` | `IRFieldRef` | `field`: the URN of the field |
| `ref: <entity>` | `IREmbedRef` | `entity`: the URN of the embedded entity |
| `link: <entity>` | `IRLinkRef` | `link`: the URN of the linked entity |

An `IREntity` has `key`, the URN of its key field, only if the manifest sets `key`. The function `valueField(ir, ref)` gives the field whose values a property holds: the field of an `IRFieldRef`, or the key field of the linked entity. For an `IREmbedRef`, it gives `undefined`.

These nodes refer to events:

| Node | Property | Contents |
| --- | --- | --- |
| `IREvent` | — | `urn`, `brandIdentifier`, `description` and `fields`. It has the shape of an `IREntity` without `key` |
| `IROperation` | `emits` | The URNs of its events, in the sequence of the manifest. Each operation has `emits`, also with no events: then it is `[]` |
| `IRError` | `recordAs` | The URN of its `recordAs` event. The property is there only if the manifest sets `recordAs` |

Because each operation has `emits`, the IR and the fingerprint of each manifest changed one time when urn-forge added events.

An `IREntity` does not list its invariants. The function `invariantsOf(ir, entityUrn)` finds them by their `on`, in URN order. An `IRInvariant` has `urn`, `brandIdentifier`, `description`, `on`, `rule` (the parsed rule), `ruleText` (the canonical text) and `message`. Refer to [The rule language](./rule-language).

The plugins read only the IR. They get the live IR: the IR with no sunset atoms. The function `liveIr(ir)` makes it. The gates of `verify` also read the live IR. `CompileResult.ir` is the full IR. The IR types are exports of the [package API](./public-api).

## Plugin checks

After the passes, the engine examines the plugins in this sequence:

1. The configuration of each plugin agrees with its schema (`plugin-config`).
2. Each plugin in the `requires` list of a plugin is also in the plugin list (`missing-plugin`).
3. Each plugin can use each kind, primitive and constraint in the live IR (`unsupported-construct`). A plugin declares these in its `supports` property.
4. Each plugin makes its files. The Valibot plugin reports `export-collision`. The Postgres plugin reports the problems of its configuration and of its SQL. Two plugins that make a file with the same path cause `output-conflict`.

If step 1 or step 2 finds an error, steps 3 and 4 do not run. If step 3 finds an error, step 4 does not run. The `valibot`, `fcis` and `postgres` plugins can use all the kinds, primitives and constraints of urn-forge 0.1.0. The `postgres` plugin writes nothing for an operation, an event or an error. Thus the CLI cannot cause `unsupported-construct` and `output-conflict` at this time.

The Postgres plugin examines its configuration in step 4. Only the IR can tell if a short key in `tables` names an entity with a `key`. If it finds an error there, it writes no SQL. These checks are in sequence:

| Check | Code | Position |
| --- | --- | --- |
| An item of `tables` names a different kind | `wrong-ref-kind` | The manifest, with no position |
| An item of `tables` names no atom | `unresolved-ref` | The manifest, with no position |
| An entity in `tables` has no `key` | `missing-key` | The entity |
| An item occurs two times in `tables` | `plugin-config` | The configuration file |
| A name is longer than 63 bytes, or two parts have one name | `invalid-sql-name` | The atom |
| A rule has no exact SQL form | `unenforced-in-sql`, a warning or an error | The field, the entity or the invariant |

For each check, refer to [The Postgres schema](./postgres-schema).

| `unsupported-construct` message after `<URN>: the <plugin> plugin ` | Cause |
| --- | --- |
| `does not handle kind "<kind>"` | The plugin does not list the kind of the atom |
| `does not handle primitive "<primitive>"` | The plugin does not list the primitive of the field |
| `cannot translate constraint "<constraint>"` | The plugin does not list the constraint for the primitive of the field |

## Related pages

- [Diagnostics](./diagnostics)
- [The manifest](./manifest)
- [The Postgres schema](./postgres-schema)
- [How urn-forge is built](../explanation/architecture)
- [Departures from the specification](../explanation/departures-from-the-spec)
