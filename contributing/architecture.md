# How urn-forge is built

This page is for persons who change urn-forge. It tells how a manifest becomes a model and how urn-forge checks each use of a rule. It also tells how the generated file comes from the model, and how the gates use it. The code is in [`packages/urn-forge/src`](../packages/urn-forge/src).

## The path

`compile`, `verify` and `diff` share one path. Each stage reads only the result of the stage before it:

```
domain.manifest.yaml
   │
   ▼  read the shape            src/manifest.ts      readManifest → ManifestDecl
   │
   ▼  names, types, rules       src/model.ts         buildModel → Model
   │                            src/cel/parse.ts     each rule text → Expr
   │
   ▼  rule uses                 src/rules.ts         checkRules → Application[]
   │                            src/cel/check.ts     the types and the guards of each use
   │                            src/standard.manifest.yaml
   │
   ▼  arguments, deprecation    src/compile.ts       compileManifest → Compiled
   │
   ▼  generated files           src/compile.ts       generate
   │                            src/generate/code.ts      domain.generated.ts
   │                            src/generate/emit-cel.ts  each rule as TypeScript
   │                            src/generate/runtime.ts   the helpers, copied into the file
   │                            src/generate/tables.ts    the tables of a value (with postgres)
   │                            src/generate/postgres.ts  schema.generated.sql (with postgres)
   │                            src/generate/store.ts     domain.store.generated.ts (with postgres)
   │
   ├─▶ compile writes them                src/cli.ts, src/write.ts
   ├─▶ verify gives them to gates 1 to 4  src/verify/
   └─▶ diff compares two models           src/diff/
```

A stage adds diagnostics to one `Diagnostics` list (`src/diagnostics.ts`). Each diagnostic has a code, a severity, a path of keys in the manifest and a message. The CLI finds the line from the path (`lineOf` in `src/cli.ts`). Thus no stage needs the YAML source positions.

`compileManifest` gives the model only if the list has no error. Warnings, such as `deprecated-use`, do not stop the path.

## Read the shape: `manifest.ts`

`readManifest` parses the YAML with `uniqueKeys`, then reads the four sections: `manifest`, `definitions`, `rules` and `operations`. The `Reader` class checks the keys of each map and the type of each value. Each problem is `manifest-shape`, with the path of the key. A YAML error is `yaml-syntax`, with its line.

The result is a `ManifestDecl`: plain parts with names, not yet connected. A rule use is a `RuleUse`: the rule name, the argument if there is one, and the path. The reader accepts `- even` and `- minimum: 1`.

The reader checks shape only. It does not know if a name exists. It reads each part that it can, so that one bad part does not hide the problems of the others.

## The model: `model.ts`

`buildModel` connects the parts:

- It follows the chain of `type` names of each definition to one of the six types of JSON Schema. The end of the chain is the `root`: the definition that declares the structure. The six types give the `base`. A chain that comes back to its start is `type-cycle`.
- It checks each name in `properties`, `items`, `parameters`, `input` and `output` (`unknown-definition`).
- It checks the `required` names, the identifier, and that an input or an output is an object.
- It parses the text of each rule with `parseRule` (`src/cel/parse.ts`). A rule that does not parse is `rule-syntax`, at the line of `rule:`, with the column in the rule.

The model does not type the rules. A rule has a type only where it is applied, because `self`, `input` and `output` change with the place.

## The rule language: `cel/`

urn-forge parses CEL and its extensions itself, for the types of a manifest. A CEL library evaluates a rule, but urn-forge must also type each rule, translate it to SQL, compare it in `diff` and find its guards. Every rule that urn-forge accepts is valid CEL.

| File | Job |
| --- | --- |
| `cel/parse.ts` | The lexer and the parser. The result is an `Expr` tree. A form outside the language is a `CelSyntaxError` that names the form. The comment at the top of the file lists the forms |
| `cel/functions.ts` | The table of functions and methods: the overloads of each name, and the helper of the generated code that runs each. The parser, the type checker and the code generator read it |
| `cel/time.ts` | The milliseconds of a duration literal, and CEL's range of a duration |
| `cel/print.ts` | The canonical text of an `Expr`: one space around each operator, and parentheses only where the precedence needs them. `diff` compares rules by this text |
| `cel/check.ts` | The type of each node, and the guards. `checkRule` takes a `Scope`: the names and their types, and the properties of each object. It gives the type of the rule, its problems (`rule-type`, `rule-guard`, `rule-scope`) and a map from each node to its type |

A guard is `has(x) && …` or `!has(x) || …`. `check.ts` collects the facts that a guard makes true, and refuses a read of an optional property without one.

## Rule uses: `rules.ts`

`checkRules` visits each use of a rule in the model. For each use, it:

1. Finds the rule in the manifest, then in the standard set (`unknown-rule` if it is in neither).
2. Checks the argument against the parameters of the rule (`rule-argument`). A rule with one parameter takes the value. A rule with two or more takes a map.
3. Makes the scope of the place. A definition has `self`. An output has `input` and `output`. An operation has `input`, and also `output` if it has one output only. Each parameter is a name with the type of its definition.
4. Types the rule in that scope with `checkRule`. The rule must give a `bool`.

Each use that checks becomes an `Application`: the use, the rule, the model that owns the rule, the `Place`, the arguments by parameter, and the types of the nodes. The generated code, the Postgres schema, gate 3 and `diff` all read the applications, not the rule uses.

`checkRules` also refuses a manifest rule with the name of a standard rule (`standard-name`), and a `{name}` in a message that is not a parameter (`invalid-message`).

### The standard set

The standard set is a manifest in the package: [`src/standard.manifest.yaml`](../packages/urn-forge/src/standard.manifest.yaml). It declares the keywords of JSON Schema as rules, in the namespace `urn_forge`. Its definitions are the types of the parameters, such as `count` and `bound`. `loadStandard` reads it with the same reader and model as a user manifest, and checks its own rule uses against itself. A problem in it throws: it is a bug in urn-forge, not a problem of the user.

### Arguments

`compileManifest` checks each argument against the rules of its parameter's definition. For example, `count` has `minimum: 0`, so `minLength: -1` is `rule-argument`. The compiler does not have its own code for this. `checksOf` in `src/compile.ts` transpiles the schemas and the checks of the generated file (`checksModule` in `code.ts`), and runs them with Valibot passed in as `v`. Thus an argument and a value obey the same code.

## The generated file: `generate/`

`generate` writes one TypeScript file, `domain.generated.ts`. If the config has `postgres`, it also writes a Postgres schema and the store file. `domain.generated.ts` imports one package, `valibot`, as `v`. `valibot` is a dependency of `urn-forge`.

| Part | Made by | Content |
| --- | --- | --- |
| The header | `header` in `code.ts` | The comment, the fingerprint and `import * as v from 'valibot'` |
| The helpers | `runtimeSource` in `code.ts` | The functions of `runtime.ts`, copied without `export` and without its import of `valibot`: `$eq`, `$in`, `$size`, `$timestamp`, `$holds`, `$rule`, `$validate` and the others. The type `Failure` stays exported |
| The types | `types` in `code.ts` | A TypeScript type for each definition. `typeName` gives the name: `seat_booking` → `SeatBooking` |
| The schemas | `schemasCode` in `code.ts` | A Valibot schema for each definition, `<Name>Schema`: `v.string()`, `v.number()`, `v.array()`, `v.strictObject()` with `v.optional()` for a property outside `required`. Each other rule is a `$rule`: a `v.check` whose requirement keeps the definition and the rule's name |
| The checks | `checkFunctions` in `code.ts` | A `check_<definition>` function for each definition. It runs `$validate`, which parses with the schema and makes a `Failure` from each Valibot issue: a check by its rule's name, a wrong type as `type`, an unknown key as `properties`, and absent required keys as one `required` |
| `Definitions` and `check` | `definitionsCode` in `code.ts` | The base, the items and the properties of each definition, for the Gherkin steps. `check(definition, value)` runs one check |
| The harness | `operationsCode` in `code.ts` | `DomainCore`, `Operations`, `answer` and `runOperation` |

`emitRule` in `emit-cel.ts` writes each rule as TypeScript. The types of the checker choose the code where CEL and JavaScript differ: `/` of two ints goes toward 0, `+` of two lists joins them, `==` compares lists and objects item by item. A timestamp and a duration are numbers of milliseconds. Each rule runs in `$holds`, so a rule that throws a `RuleError` breaks.

`runOperation` checks the input. If the input breaks a rule, the result is `InputRejected` and the core does not run. Then it calls the core, and checks the answer: the output must be one of the outputs, its value must pass its check, and the rules of that output and of the operation must hold. Else the result is `ContractViolation`. A failure names the definition (or the operation), the rule, the path of the value and the message, with the arguments in the message.

The header of a file has a fingerprint: the SHA-256 of its body. The same manifest gives the same bytes on each computer, in each locale and in each time zone. The determinism job of CI makes sure of this. Do not read the clock, the environment or the locale in `src/generate/`.

### The Postgres schema: `tables.ts` and `postgres.ts`

`buildTables` in `tables.ts` gives the tables of each object of `postgres.tables`. The schema and the store file both use it, so they cannot disagree:

- a value is a column, named by its path, such as `contact_email`;
- an embedded object is the columns of its parts, at any depth;
- a list is a child table, `<table>__<path>`, keyed by the parent's key and `position`. A list of values has the column `value`. A list of objects has the columns of the item. A list inside an item is a grandchild table, with `<parent path>_position`;
- an optional list adds `has_<path>`, a `BOOLEAN`, to its parent.

`buildTables` gives a `TableProblem` for two parts with one column name, a name longer than 63 bytes, or a list of lists. `postgresProblems` reports them as `postgres-column`, after the checks of the config (`postgres-config`).

`postgresSchema` writes each table, with its key as its primary key. `toSql` translates a rule to a `CHECK` constraint in the table that holds its values. A required part of an optional embedded object is a `CHECK` that applies only when the object is present. `uniqueItems` is `UNIQUE NULLS NOT DISTINCT`. `minItems`, `maxItems` and the `has_` flag are in a deferred constraint trigger (`countTrigger`), which counts at the end of the transaction. A form that SQL cannot say throws `Untranslatable`, and a comment of the schema names the rule. The harness checks that rule.

### The store file: `store.ts`

`storeFile` writes `domain.store.generated.ts`. For each table, it writes `insert<Table>`, `delete<Table>`, `replace<Table>`, `select<Table>` and `<table>FromRows`. They describe the tree of `buildTables` as data, and give statements as `{ text, values }`. They make no call: the shell runs the statements with its own driver, in its own transaction. The file imports only the types of `domain.generated.ts`.

## The CLI: `cli.ts`, `config.ts`, `init.ts`

- `cli.ts` reads the flags and the config, compiles, and writes or verifies. `write.ts` writes only a file that changed, and removes a generated file that `compile` no longer makes.
- `config.ts` loads `urn-forge.config.ts` and checks its options (`config-invalid`). A path in the config is relative to the config file.
- `init.ts` copies `templates/starter` into a new project. `tests/starter.test.ts` makes sure that the starter compiles, verifies with no warning, and passes its scenarios.

## The gates: `verify/`

`verify` compiles in memory. Then it runs four gates on the project. Each gate gives a `GateOutcome` (`verify/types.ts`): a pass or a fail, a summary and its problems.

| Gate | File | It checks |
| --- | --- | --- |
| 1 completeness | `verify/completeness.ts` | `tsc` type-checks the core with the project's tsconfig, and the core exports a value that `satisfies DomainCore` |
| 2 boundary | `verify/boundary.ts` | No shell file calls a function of the core directly (`direct-call`), and no file of the core or the shell has `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` (`suppressed-check`). It reads the program of gate 1 |
| 3 Gherkin | `verify/gherkin.ts` | Each step names a part that exists. The scenarios run each operation, give each output, and break each rule that a definition applies. A gap is a warning, or an error with `coverage: 'error'` |
| 4 drift | `verify/drift.ts` | The generated files are the files that `compile` gives now, byte for byte |

Gate 3 reads the step texts from `STEPS` in `src/gherkin/steps.ts`. Thus the gate and the steps cannot disagree.

## The Gherkin steps: `gherkin/`

`registerSteps` in `gherkin/steps.ts` registers the steps of urn-forge with Cucumber. It gets the generated `Definitions`, `Operations` and `check`, and a `run` function that calls `runOperation` with the core. Thus one set of steps works for each manifest. `gherkin/cells.ts` reads the cells of a table by the type of each definition. `register-tsx.mjs` lets Cucumber load TypeScript support files.

## diff: `diff/`

`diff/command.ts` compiles two manifests and judges the version change by semver (`allowsBreaking`). `diff/classify.ts` compares the two models and their applications. A change is `breaking` or `compatible` by the side of the value: callers send the input, and receive the outputs. A rule that accepts less breaks the senders. A rule that accepts more breaks the receivers, unless the manifest has `compatibility: { callers: ignore-unknown }`. For a rule of the form `self >= bound` or `size(self) <= count`, the form gives the direction of a new argument. `enum` and `required` compare their lists. Any other change of an argument, or of the text of a rule, breaks both sides.

## The public API: `index.ts`

`src/index.ts` exports the functions and types that [The package API](../packages/urn-forge/AGENTS.md) describes. The package also exports `urn-forge/cucumber`, `urn-forge/config` and `urn-forge/register-tsx` (`package.json`). If you change an export, change that page too.

## The tests

The tests are in `packages/urn-forge/tests`:

| File | Tests |
| --- | --- |
| `target.test.ts` | The booking fixture loads, and each kind of mistake stops it with its code at its place |
| `model.test.ts` | The reader and the model: shape and names |
| `cel.test.ts` | Parse, print, types and guards of the rule language |
| `rule-forms.test.ts` | The forms that the plans added, and the agreement of their SQL with the generated check, on PGlite |
| `rules.test.ts` | The standard set, arguments, and the names of each place |
| `generated.test.ts` | The committed generated file of the fixture is current, and its checks and its harness keep the contract |
| `features.test.ts` | Cucumber runs the features of the fixture |
| `gherkin-gate.test.ts` | Gate 3 |
| `cli.test.ts` | `compile` and `verify` on copies of the fixture, with each gate broken in turn |
| `postgres.test.ts` | The schema of the fixture runs on PGlite, and its `CHECK` constraints refuse what the rules refuse |
| `diff.test.ts` | Each change of `diff`, and the version rule |
| `starter.test.ts` | The starter of `init` |

Most tests read [the booking fixture](../packages/urn-forge/tests/fixtures/booking). Tests of mistakes write small manifests inline.

## Related pages

- [Dogfooding](./dogfooding.md)
- [Add a standard rule](./add-a-standard-rule.md)
- [Change the rule language](./add-a-cel-form.md)
- [The rule syntax](../docs/reference/syntax.md)
- [How urn-forge proves it](../docs/methodology.md)
