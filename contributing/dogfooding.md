# Dogfooding

urn-forge uses itself. Its own pure functions are a urn-forge domain, and the tutorials are tested code. Each large change to the compiler starts from a target that is written before the code. This page tells how these parts work, and what they found.

## `self/`: urn-forge's own domain

The folder [`packages/urn-forge/self/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/self/) holds a manifest with the namespace `urn_forge` and the domain `toolchain`. It declares three operations of the toolchain:

- `naming.operation.to_brand_identifier` makes the brand identifier of an atom.
- `naming.operation.to_urn` expands an atom address to its URN.
- `naming.operation.parse_short_key` splits a short key, or refuses it with one of three declared errors.

`self/` goes through the same chain as any other domain. It has a manifest, generated contracts, a core and features. CI runs `verify` and Cucumber on it.

### The handlers call the real functions

Each handler in `self/` calls the function that the compiler itself uses. It does not have a copy:

<<< @/../packages/urn-forge/self/core.ts

Thus the scenarios of `self/` test the toolchain. When the first operation was added, a trial removed the filter for empty segments from `toBrandIdentifier`. The scenario with the input `a` and `b_` then failed.

Two tests keep the manifest equal to the code. One test makes sure that the `regex` of each segment field is the pattern of the URN grammar, `SEGMENT_PATTERN`. The other makes sure that the `values` list of `naming.field.kind`, an `enum`, is the list of kinds in the kind registry. When the `error` kind came, this test failed until the manifest also listed `error`.

### What `self/` declares, and what it does not

`self/` declares only pure leaf functions: functions from strings and numbers to strings and numbers. It does not declare the IR, the plugins or `buildIr`. If it did, the compiler would depend on its own output for its core logic. The nested shape of the IR would also need primitives such as `list` and `record` before the simple primitives were solid.

Sometimes `self/` cannot declare a function, because urn-forge does not have a primitive, a constraint or a kind. Then the gap goes into the backlog in `self/README.md`. The backlog set the order of the foundations work: `regex`, `oneOf`, `boolean` and then the `error` kind. Each of these closed a row. Later, the `enum` primitive replaced `oneOf`, and `naming.field.kind` changed with it. Some rows are still open. For example, a function that renders an error message needs the `record` primitive, because its input is a map of values.

### The limit of `self/`

All errors of `self/` are in the category `validation`. The other categories, and `retryable: true`, only meet real use in a business domain. Specification v1.1 thus also asks for one real project that uses urn-forge. That track is not part of this repository.

## The tutorial snapshots

The three tutorials build a shipping domain in three stages. Each stage is a snapshot in [`packages/urn-forge/tutorial/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tutorial/), with its own configuration, generated files, core and features. CI runs `verify` and Cucumber on each snapshot. The tutorial pages import their code from the snapshots, so the code in a tutorial is code that compiles, verifies and passes.

The snapshots found a problem in the use of brands. In the shipping core, `BASE_CENTS[zone]` failed with `TS7053`: a branded value cannot index an object. The field `zone` was a `string` with `oneOf` then, and it is an `enum` now. The problem and the fix are the same. [The functional core and brands](../docs/explanation/core-and-shell.md) tells why, and the tutorial core shows the fix.

## The fixture harness

Each folder in `tests/fixtures/` holds a manifest and an `expected/` folder. `expected/` holds exactly what `compile` makes: the IR and every generated file, byte for byte, or the diagnostics if the manifest is not valid. A test compiles each fixture and compares the result. A file in `expected/` that the compile does not make also fails the test.

The fixtures cover different parts:

| Fixture | Covers |
| --- | --- |
| `math` | The first domain of the MVP |
| `shop` | An optional field, an `enum`, `notIn` and declared errors |
| `primitives` | One field for each primitive and each constraint, and each form of `many`. Tests parse values through its generated schemas |
| `invalid-structure` | Problems that the meta-schema finds (pass 1) |
| `replaced-constraints` | Constraints that pass 1 refuses: `oneOf`, `notEqual`, an exclusive bound on a discrete primitive, bad `values`, and bad `decimal` and `timestamp` bounds |
| `broken-references` | Problems of uniqueness, references, placeholders and coherence |
| `conflicting-constraints` | Problems of pass 7: two constraints for one side of an aspect, and constraints that accept no value |
| `errors-valibot` | Error schemas from the Valibot plugin alone, with its own configuration |

The determinism test uses the same fixtures. Refer to [Determinism and the fingerprint](../docs/explanation/how-urn-forge-proves-it.md).

## The target, written first

Each large change starts with step 0: write the expected result before the code. Then each later step changes that result, in a difference that a reviewer can read.

- **The MVP.** The math fixture came first: a manifest, a core and a feature. The MVP was done when these files compiled, type-checked and passed.
- **The `error` kind.** Step 0 wrote `parse_short_key` as it would look at the end of the work. It wrote a slice of the `self/` manifest as a fixture, the handler and nine scenarios. The handler and the scenarios waited outside `tsc`, `verify` and Cucumber. The fixture recorded where the work was. At first, the compiler refused the three errors with `unsupported-kind`. Then both plugins refused them with `unsupported-construct`. Then only the FCIS plugin did. Then the fixture compiled, and its files moved into `self/`.
- **Boundary coverage.** Before any code, the plan applied the rules by hand to the repository. The result was exactly six gaps in `self/` and none in the math example. The check was correct when it reported exactly these six. It did so on its first run.
- **The primitives.** Step 0 wrote the boundary cases of each new constraint by hand, and gave each constraint its aspect in the registry. A test makes sure that one constraint name has one aspect on each primitive. The fixtures came with the steps that made their constraints. Pass 1 errors stop a compile before pass 7, so the conflicts need two fixtures, not one: `replaced-constraints` and `conflicting-constraints`.

### What the target found

A target that is written first meets the real code early. These are some of the problems that it found:

- **Three errors, not two.** The plan named two errors for `parse_short_key`. But `parseShortKey` has three ways to fail:

  - The key breaks the grammar.
  - The kind is in the specification, but urn-forge does not support it.
  - The word is not a kind.

  The target had three errors, and the plan changed to match. The example in the plan also used the placeholder `{key}`, which named no field. Under the rule of the plan itself, that is an `unknown-placeholder` error.
- **The `NamingShortKeyInput` collision.** The target named its input entity `short_key_input`. Its brand identifier was `NamingShortKeyInput`. The field `short_key` also exports a type `NamingShortKeyInput`, its plain input type. Step 0 could not show this, because no plugin wrote code for errors yet. When the fixture first compiled, the Valibot plugin reported it:

  ```
  domain.manifest.yaml:78:1  error  export-collision  urn:urn_forge:toolchain:naming:entity:short_key_input: generated export "NamingShortKeyInput" collides with an export of urn:urn_forge:toolchain:naming:field:short_key; rename one of them
  ```

  The entity is now `short_key_request`.
- **The empty-string cell.** The hand count of the boundary target found that `short_key` has `minLength: 1`, so its case below the bound is the empty string. An empty cell means "absent", so no table could send that value. The plan added the `""` cell before the check existed.
- **The waiver tag.** The plan for boundary coverage tried the waiver tag of the specification against the Gherkin parser. A tag cannot contain a space, so the waiver became a comment.
- **The registries in the fingerprint.** The `boolean` primitive was a planned test of the primitive registry. It changed the bytes of the generated runtime without a change to the fingerprint. The registries are now a fingerprint input.
- **A property that is not there.** `values` is the first constraint that a field must have. Until step 0, a property that an entry must have got `invalid-value` with a Valibot message. Such a property now has its own code, `missing-property`.
- **A check that could not exist.** The `broken-references` fixture tested a `oneOf` value against the length and `regex` constraints. With `enum`, no field can have both, so that incoherence is gone. The fixture now tests other incoherent fields.
- **An undeclared error at compile time.** The plan expected a handler that fails with an undeclared error to give a `ContractViolation` at run time. `tsc` refused it first, at gate 1.

## Related pages

- [Contributor: add a test fixture](./add-a-fixture.md)
- [How urn-forge is built](./architecture.md)
- [Tutorial: build the shipping domain](../docs/tutorials/first-domain.md)
- [Departures from the specification](../planning/departures-from-the-spec.md)
