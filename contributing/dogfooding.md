# Dogfooding

urn-forge uses itself. Some of its own functions are a urn-forge domain, and the tutorials are tested code. Each large change starts from a target that is written before the code. This page tells how these parts work, and what they found in the redesign of 0.2.

## `self/`: urn-forge's own domain

The folder [`packages/urn-forge/self/`](../packages/urn-forge/self) holds a manifest with the namespace `urn-forge` and the domain `toolchain`. It declares six operations of the toolchain:

- `to_type_name` gives the TypeScript type name of a definition, as the generated file does: `seat_booking` → `SeatBooking`. A name that the generated file declares itself, such as `failure`, gets `Value` after it.
- `name_part` gives the URN of a part: `urn:demo:booking:definition:party_size`.
- `check_namespace` tells if a text is a URN namespace, as the manifest reader takes it.
- `judge_version_change` tells if two versions of a manifest allow a breaking change, as `diff` judges it by semver. It answers `breaking_allowed` or `breaking_refused`, each with the reason.
- `judge_weaker_contract` tells if two versions allow a weaker contract, as gate 5 judges it: only with a new version, and only to one that `diff` would allow.
- `judge_bound_change` tells if a new bound of a standard rule, such as `minimum: 1` to `minimum: 2`, accepts fewer values, more, or the same, as `diff` and gate 5 judge it.

`self/` goes through the same chain as any other domain. It has a manifest, a generated file, a core and features. A gap in its scenarios is an error, as in each domain. CI runs `verify` and Cucumber on it, and diffs its manifest against the base branch.

### The core calls the real functions

Each function of the core in [`self/core.ts`](../packages/urn-forge/self/core.ts) calls the function that urn-forge itself uses. It does not have a copy:

- `to_type_name` calls `typeName` from `src/generate/code.ts`.
- `name_part` calls `partUrn` from `src/urn.ts`.
- `check_namespace` calls the `NAMESPACE` test from `src/manifest.ts`.
- `judge_version_change` calls `allowsBreaking` from `src/diff/command.ts`.
- `judge_weaker_contract` calls `allowsWeaker` from `src/verify/contract.ts`, which gate 5 also uses.
- `judge_bound_change` calls `argumentDirection` from `src/diff/classify.ts`, with the rule of the standard set.

Thus the scenarios of `self/` test the toolchain. If a change to `typeName` or `allowsBreaking` changes a result, a scenario of `self/` fails. The rules of the outputs also hold the functions to the contract. For example, `stable_and_final` makes sure that `breaking_refused` never comes back for a `0.x` version or a pre-release.

### What `self/` declares, and what it does not

`self/` declares only pure leaf functions: from strings to strings. It does not declare the reader, the model, the rule uses or the generated code. If it did, the compiler would depend on its own output for its core logic.

Some pure functions of urn-forge give a result that a user can see, such as a name in the generated file or a verdict of `diff`. If you add one, think about an operation for it in `self/`. To add one:

1. Add the definitions, the rules and the operation to `self/domain.manifest.yaml`.
2. Compile `self/` with `npm run compile:self`.
3. Add the function to `self/core.ts`. It must call the real function of `src/`.
4. Add scenarios to `self/features/`. Coverage is `error`, so each output and each rule of a definition needs one.
5. Run `npm run verify:self` and `npm run test:features:self` from the root folder.

### The limit of `self/`

`self/` has strings and numbers only, and six small operations. It cannot show how urn-forge serves a business domain.

The rule language cannot state every rule of `self/`. The rule of `to_type_name` says only that the type name is not much longer than the definition name: the language has no function for upper or lower case, and cannot count the underscores of a name. Its scenarios give the exact names.

`self/` does not declare these pure functions yet: the failure message of a rule (`fillMessage`), the fix of a code (`fixOf`), the names of the Postgres schema, and the direction of a new argument of `enum` and `required`. Each can be one more operation. The `insurance` domain and the six contracts of the corpus do that. Refer to [Add a domain](./add-a-domain.md).

## The tutorial snapshots

The three tutorials build a shipping domain in three stages. Each stage is a snapshot in [`packages/urn-forge/tutorial/`](../packages/urn-forge/tutorial), with its own configuration, generated file, core and features. CI runs `verify` and Cucumber on each snapshot. The tutorial pages import their code from the snapshots, so the code in a tutorial is code that compiles, verifies and passes.

If a change to urn-forge changes the generated file of a snapshot, compile the snapshot again. Then build the docs, and read the tutorial pages that import the file.

## The target, written first

Each large change starts with step 0: write the expected result before the code. Then each later step changes that result, in a diff that a reviewer can read.

For the redesign, step 0 was the booking fixture, [`tests/fixtures/booking/`](../packages/urn-forge/tests/fixtures/booking). It is a manifest that uses each construct of the [redesign notes](../planning/manifest-redesign-notes.md). `tests/target.test.ts` expected it to load with no diagnostic, and each kind of mistake to stop it with its code at its place. At step 0, each test was `it.fails`, and `loadManifest` was a stub. Each step of phase 1 turned its tests to `it`. Phases 2 and 3 then added the generated file, the core, the features and the Postgres schema of the same fixture.

Then step 10 wrote `example`, `self`, `insurance` and the tutorials again in the new manifest, next to the old ones, before the switch. Each had to compile, verify with no warning and pass its scenarios with the new compiler.

### What the targets found

A target that is written first meets the real code early. These are some of the problems that the redesign targets found:

- **The standard set needs more of CEL.** The notes gave the CEL core and the list macros. When the standard set was written as rules, `uniqueItems` needed `exists_one`, `pattern` and `format` needed `matches()`, and `minLength` and `maxLength` needed `size()` of a string. CEL has `%` only for integers, so `multipleOf` applies to integers only. The notes changed to match.
- **A step with no table.** `Then the output is "<output>"` with no table failed. Cucumber gave its callback as the table. It is now two steps, one with a colon and a table, and one without.
- **`+` of two strings in SQL.** A rule such as `timestamp(self.day + 'T00:00:00Z')` gave `+` in SQL, which does not join text. It is now `||`.
- **The line of a YAML error.** A YAML error was reported at the line of the root of the manifest. It is now at its own line.
- **The order of keys.** `Then the output is "<output>":` compared an embedded object as JSON, so the order of its keys mattered. It now compares the keys in order.
- **The rules of a JSONB column.** The schema comment named only the rules of the column's own definition. It now names the rules of each value inside it, such as `minimum` of a table number in a list of tables.

## Related pages

- [Add a test fixture](./add-a-fixture.md)
- [Add a domain](./add-a-domain.md)
- [How urn-forge is built](./architecture.md)
- [Tutorial: build the shipping domain](../docs/index.md)
