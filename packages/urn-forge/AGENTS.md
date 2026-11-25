# urn-forge: the reference for coding agents

This file is the reference of the installed version of urn-forge. Read it from `node_modules/urn-forge/AGENTS.md`. It is complete: each key of the manifest, each standard rule, each function of the rule language, each step and each code is on this page. A test of urn-forge fails when one is missing.

## The loop

1. Edit `domain.manifest.yaml`: the contract. It holds the definitions, the rules and the operations.
2. Run `npx urn-forge compile`. It writes the generated files. If the manifest has an error, it writes nothing.
3. Write the core (`src/core.ts`): one function for each operation, `export const core = { … } satisfies DomainCore`. The generated types tell you what to write.
4. Write scenarios (`features/*.feature`) with the steps below: one for each operation, each output, and each rule of a definition.
5. Run `npx urn-forge verify`, then `npx cucumber-js`. Repeat until both pass.

Use `--format json` on `compile`, `verify` and `diff` to get one JSON object: `{ ok, problems: [{ code, severity, file, line, path, message, fix }], … }`. Act on the `code` and the `fix`.

## Do not

- Edit a file in the generated folder (`*.generated.ts`, `*.generated.sql`). Gate 4 fails. Change the manifest, and run `compile`.
- Add `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`. Gate 2 fails. Correct the type error.
- Call a function of the core directly from the shell (`core.x(…)`, `const { x } = core`). Gate 2 fails. Call `runOperation(core, 'x', input)`.
- Remove or weaken a rule, an output or a scenario to make a check pass. Gate 5 (`verify --base <ref>`) fails. Correct the core or the scenario. A weaker contract needs a new `version`, which a person decides: stop and ask.
- Put business logic in the manifest. The manifest states what is true of a value or an answer. The core decides; the shell stores, sends and calls.

## The manifest

One YAML file with four sections. Only `manifest` is required. A name is lowercase snake_case, `^[a-z][a-z0-9_]{0,62}$`. Each definition, rule and operation has a `description`. `deprecated: true` marks a definition, a rule or an operation; a live use of it gives the warning `deprecated-use`.

```yaml
manifest:
  namespace: acme            # required
  domain: bookings           # required; also the Postgres schema
  version: 0.1.0             # required; semver, read by diff and gate 5
  compatibility:             # optional
    callers: ignore-unknown  # callers ignore a property or an output they do not know

definitions:
  party_size:
    description: The number of guests
    type: integer            # string, number, integer, boolean, object, array, or another definition
    rules:
      - minimum: 1
      - maximum: 12
  booking:
    description: A booking of a table
    type: object
    properties: [reference, party_size, note]   # names of definitions
    identifier: reference                       # a required property with one value
    rules:
      - required: [reference, party_size]       # a property not listed is optional
  tables:
    description: The tables of a booking
    type: array
    items: table_number                         # the definition of each item
    rules:
      - uniqueItems

rules:
  ends_after_start:
    description: The end is after the start
    rule: timestamp(self.ends_at) > timestamp(self.starts_at)
    message: Must end after it starts
  at_most_party:
    description: At most the size of the party
    parameters: [limit]                         # names of definitions: the type of each parameter
    rule: self <= limit
    message: Must be at most {limit}

operations:
  seat_booking:
    description: Seat the party of a booking
    input: seat_request                         # an object definition
    output:                                     # the answers: one or more objects
      - booking: [was_confirmed, is_seated]     # with the rules true of this answer
      - invalid_state: [was_not_confirmed]
    rules: [keeps_the_reference]                # true of each answer
```

| Section | Keys |
| --- | --- |
| `manifest` | `namespace`, `domain`, `version`, `compatibility` |
| `definitions.<name>` | `description`, `type`, `properties`, `items`, `identifier`, `rules`, `deprecated` |
| `rules.<name>` | `description`, `parameters`, `rule`, `message`, `deprecated` |
| `operations.<name>` | `description`, `input`, `output`, `rules`, `deprecated` |

- `properties` and `identifier` are only for `type: object`; `properties` is required there. `items` is only for `type: array`, and required there.
- `type: <definition>` gives the structure and the rules of that definition, plus its own rules.
- Apply a rule with no parameter by name (`- uniqueItems`), with one parameter as `- minimum: 1`, with more as `- between: { low: 1, high: 9 }`.
- A rule of a definition reads `self`. A rule of an output reads `input` and `output`. A rule of an operation reads `input`, and `output` when the operation has one output.
- There is no key for errors, events, callers or stored records. A refusal is an output. A stored record, the caller and the time are properties of the input. An event is a property of an output.
- There is no date or decimal type. A date is a `string` with `format: date`; a time is a `string` with `format: date-time`; money is an `integer` of cents.

The JSON Schema of the manifest is `node_modules/urn-forge/manifest.schema.json`. It checks the keys and the shape of each value before `compile`; `compile` also checks the names between the parts, the rules and their arguments.

## The standard rules

| Rule | For | Argument |
| --- | --- | --- |
| `enum` | `string` | A list of strings |
| `const` | `string` | A string |
| `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` | `integer`, `number` | A number |
| `multipleOf` | `integer` | An integer of 1 or more |
| `minLength`, `maxLength` | `string` | An integer of 0 or more (code points) |
| `pattern` | `string` | A regular expression; it matches part of the text, so anchor it with `^…$` |
| `format` | `string` | `date` or `date-time` |
| `minItems`, `maxItems` | `array` | An integer of 0 or more |
| `uniqueItems` | `array` | none |
| `required` | `object` | A list of property names |

The structure of a value gives two more rule names in a failure: `type` (a value of the wrong type) and `properties` (a property that the object does not have).

## The rule language

A subset of CEL. Each rule must give a `bool`.

- **Names:** `self`, `input`, `output`, the parameters of the rule, and the variable of a macro.
- **Literals:** `5000`, `-1`, `0.5`, `'text'`, `"text"`, `r'^[0-9]{4}$'`, `true`, `false`, `['a', 'b']` (not empty).
- **Operators**, lowest precedence first: `||`; `&&`; `==` `!=` `<` `<=` `>` `>=` `in`; `+` `-`; `*` `/` `%`; `!` and unary `-`; `a.b`.
- **Functions:** `has(a.b)`, `size(x)` or `x.size()`, `s.matches(re)`, `timestamp(s)`, `duration('1h30m')` (units `h`, `m`, `s`, `ms`, `us`, `ns`), `l.sum()`.
- **Macros:** `l.all(x, p)`, `l.exists(x, p)`, `l.exists_one(x, p)`, `l.map(x, e)`.
- **Optional properties:** read one only after a guard: `has(self.deposit) && self.deposit > 0`, or `!has(self.deposit) || self.deposit > 0`.
- **Times:** compare with `timestamp()`: `timestamp(self.ends_at) > timestamp(self.starts_at) + duration('30m')`. A day is `'24h'`; there are no months and no time zones.
- **Not in the subset:** `a ? b : c`, `null`, `a[0]`, maps, `filter`, `min()`, `max()`, `startsWith()`, `int()`, and other functions.

## The generated file

`compile` writes `<out>/domain.generated.ts` (default `src/generated`). The core and the shell import only this file.

| Export | What it is |
| --- | --- |
| `<Name>` | The TypeScript type of each definition |
| `<Name>Schema` | A Valibot schema of each definition, with each rule; a Standard Schema |
| `check(definition, value)` | `{ ok: true, value }` or `{ ok: false, failures }` |
| `answer(output, value)` | What a function of the core returns |
| `DomainCore` | The type of the core: one function for each operation |
| `runOperation(core, operation, input)` | Checks the input, runs the core, checks the answer. Gives `{ ok: true, output, value }`, or `{ ok: false, kind: 'InputRejected' \| 'ContractViolation', failures }` |
| `Definitions`, `Operations` | The names, for the steps |

A failure is `{ definition, rule, path, message }`, such as `{ definition: 'party_size', rule: 'minimum', path: 'party_size', message: 'Must be at least 1' }`. `InputRejected` is the caller's fault. `ContractViolation` is a bug in the core.

With `postgres: { tables: [...] }` in the config, `compile` also writes `schema.generated.sql` and `domain.store.generated.ts` (`insert<Table>`, `delete<Table>`, `replace<Table>`, `select<Table>`, `<table>FromRows`: pure functions that give statements for your driver).

## The steps

| Step | What it does |
| --- | --- |
| `When I run "<operation>" with:` | Runs the operation through the harness with the table as input |
| `When I check a "<definition>" with:` | Checks the table as a value of the definition (also `an`) |
| `Then the output is "<object>"` | The operation answered this output |
| `Then the output is "<object>":` | The same, and the answer has the values of the table |
| `Then the input is rejected by "<rule>" of "<definition>"` | The harness rejected the input with this rule |
| `Then the value is rejected by "<rule>" of "<definition>"` | The check rejected the value with this rule |
| `Then the value is accepted` | The check accepted the value |

A table has a header row of properties and one row of values. `contact.email` is a property of an embedded object. An empty cell gives no value; `""` is the empty string. A list is `[Ada, Grace]` or JSON; an object is JSON. `<definition>` is the definition that applies the rule: `minLength` of `person`, the item of `people`. To break a rule of an output, check a value directly with `When I check a`.

## The config

`urn-forge.config.ts` exports `defineConfig({ … })` from `urn-forge/config`. Paths are relative to the file.

| Option | Default | Value |
| --- | --- | --- |
| `manifest` | `domain.manifest.yaml` | The manifest |
| `out` | `src/generated` | The folder of the generated files |
| `core` | `src/core.ts` | The core |
| `features` | `features` | The folder of the `.feature` files |
| `tsconfig` | `tsconfig.json` | The tsconfig of gate 1 |
| `shell` | none | Files and folders of the shell, for gate 2 |
| `coverage` | `'warn'` | `'error'` makes a gap in the scenarios fail gate 3 |
| `postgres` | none | `{ tables, references?, unique? }`: a Postgres schema and a store file |

## The commands

| Command | What it does |
| --- | --- |
| `urn-forge init [--namespace <n>] [--domain <n>]` | Writes a starter project that passes `verify`, with `AGENTS.md` and a Claude Code skill for coding agents |
| `urn-forge compile [--format json]` | Writes the generated files |
| `urn-forge verify [--base <ref>] [--format json]` | Compiles in memory and runs the gates; writes nothing |
| `urn-forge diff <old> <new> [--report] [--format json]` | Classifies the changes between two manifests as breaking or compatible |

Exit codes: `0` pass (also with warnings), `1` failure, `2` wrong command line.

| Gate | It fails when |
| --- | --- |
| 1. completeness | `tsc` fails over the core, or no export `satisfies DomainCore` |
| 2. boundary | The shell calls the core without `runOperation`, or a file suppresses a type check |
| 3. gherkin | A step names an unknown part, or (with `coverage: 'error'`) an operation, an output or a rule has no scenario |
| 4. drift | A generated file is not what `compile` writes now |
| 5. contract | Only with `--base <ref>`: a rule, an output or a scenario of the ref is gone, or a rule accepts more, and the version does not allow it |

`diff` allows a breaking change in `0.x`, in a pre-release, or across a new major version. Gate 5 allows a weaker contract only when the version also changes: to another `0.x` version, a pre-release, or a new major version. Then each change is a warning. A scenario is known by its name: a renamed scenario counts as removed.

## The codes

Each problem has one of these codes. The fix is the same as the `fix` of `--format json`.

| Code | Fix |
| --- | --- |
| `usage` | Run urn-forge --help, and call the command with the arguments and options that it shows. |
| `config-unreadable` | Give --config the path of a config file that exists, or remove --config to use urn-forge.config.ts. |
| `config-invalid` | Change the config to use only the options of defineConfig, with the types that the message names. |
| `manifest-unreadable` | Give --manifest, or manifest in the config, the path of a manifest that exists. |
| `yaml-syntax` | Correct the YAML at the line that the problem gives. |
| `manifest-shape` | Use only the keys that the message lists, with values of the type that it names; manifest.schema.json has the full shape. |
| `unknown-definition` | Add the definition to definitions:, or correct the name to one that is in definitions:. |
| `type-cycle` | Give one definition of the cycle a base type (string, number, integer, boolean, object or array) in place of the name of another definition. |
| `duplicate-property` | Remove the second copy of the name from properties:. |
| `unknown-property` | Add the name to properties: of the object, or remove it from the rule. |
| `not-an-object` | Make the input or the output of the operation a definition of type: object. |
| `duplicate-output` | Remove the second copy of the object from output:. |
| `invalid-identifier` | Make the identifier a property of the object, list it in the required rule of the object, and give it one value: not an object or a list. |
| `deprecated-use` | Use a definition or a rule that is not deprecated, or remove deprecated: true if it is still the right one. |
| `standard-name` | Give the rule of the manifest a name that is not the name of a standard rule. |
| `unknown-rule` | Add the rule to rules:, or correct the name to a rule of the manifest or a standard rule. |
| `rule-argument` | Give the rule an argument that its parameters accept, or no argument when the rule has no parameters. |
| `rule-syntax` | Write the rule in the rule language of urn-forge: the names, operators, functions and macros of the reference. |
| `rule-type` | Change the rule so that each part has the type that the message names, and the rule gives a bool. |
| `rule-guard` | Read an optional property only after has(): has(self.x) && self.x > 0, or !has(self.x) \|\| self.x > 0. |
| `rule-scope` | Use only the names that the message lists: self, input, output, the parameters of the rule, and the variable of a macro. |
| `invalid-message` | Use in {braces} only the names of the parameters of the rule. |
| `postgres-config` | Name in postgres: only object definitions that have an identifier, and their properties. |
| `postgres-column` | Give the definitions shorter names, or rename a property so that no two parts give one column name. |
| `tsconfig-unreadable` | Give --tsconfig, or tsconfig in the config, the path of a tsconfig that TypeScript can read. |
| `core-not-found` | Create the core file, or give --core, or core in the config, its path. |
| `type-error` | Correct the type error at the line that the problem gives; do not suppress it. |
| `core-not-satisfying` | Export the core as export const core = { … } satisfies DomainCore, with one function for each operation. |
| `direct-call` | Call the core through runOperation(core, operation, input), which checks the input and the answer. |
| `suppressed-check` | Remove the @ts- comment and correct the type error that it hides. |
| `feature-syntax` | Correct the Gherkin of the feature file at the line that the message gives. |
| `unknown-name` | Use in the step the name of an operation, a definition, an output or a rule of the manifest, as the message says. |
| `uncovered-operation` | Add a scenario with When I run "<operation>" with:. |
| `uncovered-output` | Add a scenario of the operation that ends with Then the output is "<output>". |
| `uncovered-rule` | Add a scenario that breaks the rule and ends with Then the input is rejected by "<rule>" of "<definition>", or Then the value is rejected by "<rule>" of "<definition>". |
| `drift` | Run urn-forge compile, and do not edit a generated file by hand. |
| `base-unreadable` | Fetch the base ref (git fetch origin <branch>, with enough depth), or give --base a ref that exists. |
| `removed-rule` | Put the rule back. If the change is on purpose, stop and ask a person: only a person decides a new manifest.version. |
| `wider-rule` | Put the argument or the text of the rule back. If the change is on purpose, stop and ask a person: only a person decides a new manifest.version. |
| `removed-output` | Put the output back. If the change is on purpose, stop and ask a person: only a person decides a new manifest.version. |
| `removed-scenario` | Put the scenario back. If the change is on purpose, stop and ask a person: only a person decides a new manifest.version. |
