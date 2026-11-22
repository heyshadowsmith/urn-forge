# Verification gates

`urn-forge verify` runs gates 1 to 4. `urn-forge diff` checks a change to the manifest. For the options and the output, refer to [The CLI](./cli). For each code, refer to [Diagnostics](./diagnostics).

| Gate | Name | Shows |
| --- | --- | --- |
| 1 | `completeness` | The core has a handler of the correct type for each operation |
| 2 | `boundary` | No core file and no shell file makes a branded value without a parse |
| 3 | `gherkin` | The features use real URNs and field names, and cover the errors, events, input invariants and boundary values |
| 4 | `drift` | The generated files are the same as a new compile |
| `diff` | Compatibility | No change breaks a consumer of a live URN |

- `verify` compiles the manifest in memory. If the configuration or the manifest has an error, no gate runs.
- Each gate runs, also if a gate before it failed.
- A gate fails if one or more of its problems is an `error`. Warnings and notes do not make a gate fail.
- The gates examine the live IR, with no sunset atoms. A sunset operation needs no handler and no scenario.
- `verify` does not run the core or the scenarios. Cucumber runs the scenarios.

## Gate 1: completeness

| Check | Rule | Code |
| --- | --- | --- |
| Read the tsconfig | The `--tsconfig` file can be read. If not, the gate stops | `tsconfig-unreadable` |
| Find the core | The `--core` file exists. If not, the gate stops | `core-not-found` |
| Type check | `tsc` finds no error in the core entry and the files that it imports. The gate adds `noEmit` | `type-error` |
| `satisfies` | One or more exports of the core file use `satisfies DomainCoreImplementation` from the generated runtime file | `missing-satisfies` |

The `satisfies` check accepts these forms:

- `export const <name> = <expression> satisfies DomainCoreImplementation;`
- `export default <expression> satisfies DomainCoreImplementation;`
- A `const` with `satisfies`, then `export { <name> }`, `export { <name> as <other> }` or `export default <name>` in the same file.

It does not accept a `let`.

| Summary | Condition |
| --- | --- |
| ``tsc: <n> error(s) over <core>; `<names>` satisfies DomainCoreImplementation`` | The `satisfies` check found the exports `<names>` |
| `` tsc: <n> error(s) over <core>; no `satisfies DomainCoreImplementation` `` | The `satisfies` check found no export |
| `tsconfig unreadable` | The tsconfig cannot be read |
| `core entry missing` | The core file is not there |

## Gate 2: boundary

The gate examines the syntax tree and the types, with the TypeScript program of gate 1.

| Files | Contents | Checks |
| --- | --- | --- |
| Core files | The core entry, and each file that it imports from its directory and subdirectories | All |
| Shell files | The files of the `shell` setting. For a directory, each `.ts`, `.tsx`, `.mts` and `.cts` file in it | All except `core-parser-import` |

The gate does not examine the `--out` files, `.d.ts` files, `node_modules`, or test and step files that `shell` does not name.

A type carries a brand if it has the Valibot brand, also inside a union, an intersection, an array, a tuple or an object property, to four levels.

| Check | Rule | Code |
| --- | --- | --- |
| Type assertions | No `x as T` or `<T>x` has a target type that carries a brand. `as const` is permitted | `brand-assertion` |
| `any` values | No expression of type `any` goes where a branded type belongs: a typed variable, a return, an argument or a property | `brand-from-any` |
| Suppressed checks | No `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` comment | `suppressed-check` |
| Shell paths | Each item of `shell` matches one or more TypeScript files | `shell-not-found` (warning) |
| Parser imports | The core does not import the generated schemas or `valibot` as a value. `import type` is permitted | `core-parser-import` |

Gate 2 has no waiver.

| Summary | Condition |
| --- | --- |
| `<c> core file(s), <s> shell file(s): <p> problem(s)` | The gate ran |
| `not run: gate 1 could not build the program` | Gate 1 cannot read the tsconfig |

## Gate 3: Gherkin

The gate reads the syntax tree of each `.feature` file in `--features` and its subdirectories. A scenario gets the tags of its feature, its `Rule` block, itself and its `Examples` block. The **owner** of a scenario is the one operation or entity that its tags name.

| Check | Rule | Code |
| --- | --- | --- |
| Read | The `--features` directory can be read | `features-unreadable` |
| Parse | Each file is valid Gherkin | `feature-parse-error` |
| Tags | Each `@urn:` tag is a URN of the manifest | `unresolved-tag` |
| One owner | A scenario has one owner or none | `ambiguous-tag` |
| Headers | Each table header is a property of the owner, or of the error or event of the step | `unknown-header` |
| Required columns | The table of `I run the operation with:` has a column for each required input field | `missing-column` |
| Steps | The URN in each step is a declared error, an event of `emits`, a `recordAs` event, or an input invariant of the operation | `undeclared-error`, `undeclared-event`, `undeclared-record`, `undeclared-invariant` |
| Tagged operations | Each operation has its URN in one or more tags | `untagged-operation` |
| Callers | Each scenario of an operation with `callers` gives the caller with `Given the caller is:` | `invalid-caller` |
| Timed changes | Each operation with `due` has a scenario with `Then the operation is not due` | `uncovered-due` |
| Time | Each scenario of an operation whose rules read `now` or `today` gives the time with `Given the time is "<timestamp>"`, a UTC timestamp | `invalid-time` |
| Coverage | Each tagged operation has a scenario for each declared error, each event of `emits`, each `recordAs` event and each input invariant. An event with `when` also needs a successful scenario without it | `uncovered-error`, `uncovered-event`, `uncovered-record`, `uncovered-invariant` |
| States | Each scenario of an operation with `changes` gives the record with `Given the current <entity> is:`, of that entity. Each `from` state has a scenario, and one state outside `from` has a scenario that expects `otherwise` | `invalid-current`, `uncovered-state` |
| Waiver form | Each `# urn-forge:waive` comment has a field URN and a reason | `invalid-waiver` |
| Cells | Each list or object cell is correct | `invalid-cell` |
| Boundary coverage | The scenarios send each boundary case of each constrained input property, at any depth | `uncovered-boundary` |
| Waiver result | Each waiver names a constrained input field, and removes a gap | `unknown-waiver`, `waived-boundary`, `unused-waiver` |
| Ratchet | `boundaryCoverage` is `warn`, each feature is strict, and the gate has no error | `ratchet-ready` |

The input invariants are the invariants of the input entity and of each entity that it embeds. An invariant of an output entity needs no scenario. For the step texts, refer to [Gherkin steps](./gherkin-steps).

### Coverage mode

The severity of the five `uncovered-` codes:

| Condition | Severity |
| --- | --- |
| `boundaryCoverage: 'error'` in the configuration file | `error`, for all operations |
| The `Feature` line of a file that tags the operation has `@urn-forge:strict` | `error`, for that operation |
| Other conditions. `boundaryCoverage: 'warn'` is the default | `warning` |

### Values that the scenarios send

- The tables of `I run the operation with:`, in a scenario with one operation tag.
- In a Scenario Outline, each row of each `Examples` block, after Cucumber substitution.
- Each cell is converted with the primitive of its field, as the steps do. An empty cell is not a value.
- A list cell gives one value for each item. An object cell gives values for its properties, at the path `<property>.<property>`.
- A link gives a value of the key field of the linked entity.
- Each operation needs its own values.

### Boundary cases

For the cases of each constraint and their labels, refer to [Primitives and constraints](./primitives). A list (`many`) also needs these cases:

| Property of `many` | Necessary values (labels) |
| --- | --- |
| `minItems` | `list of <n> item(s) (minItems)`, and `list of <n − 1> item(s) (below minItems)` if `n` is more than 0 |
| `maxItems` | `list of <n> item(s) (maxItems)`, `list of <n + 1> item(s) (above maxItems)` |
| `unique: true` | `list with a repeated value (unique)`, or `list with a repeated <key> (unique)` for embedded entities |
| `unique: [a, b]` | `list with a repeated a and b (unique)`: two items with each named property present and equal |

- Numbers compare with `===`. Decimals compare exactly, dates as text, timestamps as instants.
- A text length counts Unicode code points.
- A field with no constraints has no boundary cases.
- A property inside an embedded entity, a link or a property with `as` has `at <path>` in the message.

```
urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at min − 1 (0), no value at max 30000, no value at max + 1 (30001)
```

### Waivers

```gherkin
# urn-forge:waive <field URN> <reason>
```

| Item | Rule |
| --- | --- |
| Position | Any comment line in a feature file |
| Scope | The operations whose URN is in a tag of the same file |
| Effect | Removes all boundary gaps of the field for those operations. A waiver of an embedded entity removes its list cases. It has no effect on the other `uncovered-` codes |
| Result | `waived-boundary` (note), `unused-waiver` (warning) or `unknown-waiver` (error) |

### Summary

```
<F> feature(s), <S> scenario(s), <T>/<O> operations tagged[, <E>/<D> errors expected][, <V>/<M> events expected][, <R>/<Q> records expected][, <B>/<N> invariants broken][, <C>/<X> states covered], strict: <K>/<F> features[ (boundaryCoverage: error)][, <W> waiver(s)]
```

A part in brackets shows only if the manifest has that item. A Scenario Outline counts as one scenario.

## Gate 4: drift

The gate writes a new compile to a temporary directory. It compares each file, byte for byte, with the file in `--out`.

| Check | Code |
| --- | --- |
| Each file of the new compile is in `--out` | `generated-missing` |
| Each file has the same bytes. The position is the first line that differs | `generated-differs` |
| Each `*.generated.*` file in `--out` and its subdirectories is a file of the new compile | `generated-orphan` |

A change to the manifest, the plugin list or the urn-forge version changes the fingerprint, and thus each file.

Summary: `<n> generated file(s) compared byte for byte against <out>`.

## `diff`: compatibility

`diff` gives each change one class:

| Class | Meaning | Effect |
| --- | --- | --- |
| `compatible` | No consumer that worked before can fail after it | None |
| `lifecycle` | A `status` that moves forward, a changed `supersededBy` or `sunsetDate`, or a removed property whose target was deprecated | None |
| `breaking` | A consumer that worked before can fail after it | `breaking-change`: an `error`, or a `warning` if the old manifest is experimental |

### Uses

| Use | The atoms | Message text |
| --- | --- | --- |
| In | The input entity of each operation, what it embeds, and the key fields of its links | `callers send` |
| Out | The output entity, the declared errors, the events of `emits` and the `recordAs` events, with their parts | `callers receive` |
| Stored | Each entity in the `tables` of the `postgres` plugin of `--config`, with its parts | `the database stores` |

An invariant has the uses of its entity. A change to an atom with no use is compatible.

| Relation | Verb | In | Out | Stored |
| --- | --- | --- | --- | --- |
| Narrower | `narrows` | `breaking` | `compatible` | `breaking` |
| Wider | `widens` | `compatible` | `breaking` | `compatible` |
| Neither | `changes` | `breaking` | `breaking` | `breaking` |

### Changes to a field

A changed `primitive` is "neither".

| Aspect | Narrower | Wider | Neither |
| --- | --- | --- | --- |
| `min`, `exclusiveMin`, `minLength` | A new or higher bound, or inclusive to exclusive | No bound, a lower bound, or exclusive to inclusive | — |
| `max`, `exclusiveMax`, `maxLength` | A new or lower bound, or inclusive to exclusive | No bound, a higher bound, or exclusive to inclusive | — |
| `multipleOf` | The new step is a multiple of the old step | The new step divides the old step | Other changes |
| `scale` | A new or smaller `scale` | No or a larger `scale` | — |
| `notIn` | More values | Fewer values | Other changes |
| `values` of an `enum` | Fewer values | More values | Other changes |
| `regex`, `format`, `mustBe` | A new constraint | No constraint | A changed value |

If the changed aspects have different relations, the field has "neither".

### Changes to an entity, an event or an error

| Change | Relation |
| --- | --- |
| A new required property | Narrower |
| A new required list with no `minItems`, on an atom that is only stored | `compatible` |
| A new optional property | `compatible`. If the atom is stored, the message adds `; the database needs a migration for it` |
| A removed property | Wider |
| A removed property whose target was deprecated | `lifecycle` |
| `required: false` to `required: true` | Narrower |
| `required: true` to `required: false` | Wider |
| `minItems`, `maxItems` of `many` | As bounds. `unique: true` added is narrower, removed is wider. In `unique: [ … ]`, fewer names are narrower, more names are wider; `true` and a list of names do not compare |
| A different target, or one value to a list | Neither |
| A different `key` | Neither |

### Other changes

| Change | Class |
| --- | --- |
| A new invariant | Narrower, on the uses of its entity. On a new entity, `compatible` |
| A changed `rule` or `on` | Neither |
| A changed `message`, `description` or `reportOn` | `compatible` |
| A changed `category` or `retryable` of an error | Neither |
| A new `recordAs` | `compatible` |
| A removed `recordAs` | Wider |
| A changed `recordAs` | Neither |
| A changed `input` or `output` of an operation | `breaking` |
| A new declared error or event of an operation | Wider, on Out: `breaking` |
| A removed declared error or event of an operation | Narrower, on Out: `compatible` |
| A new atom | `compatible` |
| A removed atom, also a sunset atom | `breaking` |
| `status` moves forward | `lifecycle` |
| `status` moves back | `breaking` |
| A change to an atom that is sunset in both manifests | Not reported |
| A different `namespace` or `domain` | `breaking`, one line only |
| `stability: experimental` to `stable` | `compatible` |
| `stability: stable` to `experimental` | `breaking` |

`diff` does not compare the `version` of the header.

## Related pages

- [Diagnostics](./diagnostics)
- [Fix a gate that fails](../how-to/fix-a-failing-gate)
- [How urn-forge proves it](../explanation/how-urn-forge-proves-it)
