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

- Edit a file in the generated folder (`*.generated.ts`). Gate 4 fails. Change the manifest, and run `compile`.
- Add `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`. Gate 2 fails. Correct the type error.
- Call a function of the core directly from the shell (`core.x(…)`, `const { x } = core`). Gate 2 fails. Call `runOperation(core, 'x', input)`.
- Remove or weaken a rule, an output or a scenario to make a check pass. Gate 5 (`verify --base <ref>`) fails. Correct the core or the scenario. A weaker contract needs a new `version`, which a person decides: stop and ask.
- Put business logic in the manifest. The manifest states what is true of a value or an answer. The core decides; the shell stores, sends and calls.

## The manifest

One YAML file with four sections. Only `manifest` is required. A name is lowercase snake_case, `^[a-z][a-z0-9_]{0,62}$`. Each definition, rule and operation has a `description`. `deprecated: true` marks a definition, a rule or an operation; a live use of it gives the warning `deprecated-use`.

```yaml
manifest:
  namespace: acme            # required; a URN namespace: lowercase letters, digits and hyphens
  domain: bookings           # required
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
    failure_message: Must end after it starts
  at_most_party:
    description: At most the size of the party
    parameters: [limit]                         # names of definitions: the type of each parameter
    rule: self <= limit
    failure_message: Must be at most {limit}

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
| `definitions.<name>` | `description`, `type`, `properties`, `items`, `values`, `keys`, `variants`, `tag`, `identifier`, `rules`, `deprecated` |
| `rules.<name>` | `description`, `parameters`, `rule`, `failure_message`, `deprecated` |
| `operations.<name>` | `description`, `input`, `output`, `rules`, `deprecated` |

A rule's `description` says what it checks and why, for a reader of the manifest. Its `failure_message` is what a failure says when it breaks; `{parameter}` puts in an argument.

- `properties` and `identifier` are only for `type: object`; `properties` is required there. A property is the name of its definition, or a name with its own definition: `- address: street_address`. `items` is only for `type: array`, and required there. `values` is only for `type: map`, and required there; `keys`, a `string` definition, gives the rules of each key. `variants` is only for `type: union`, and required there: a list of definitions of different JSON types, or, with `tag`, each value of the tag to its object variant (`variants: { circle: circle }`, `tag: kind`). A value with another tag breaks `variant`. Each variant needs a scenario (`uncovered-variant`).
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

CEL and its standard extensions, for the types of a manifest. Each rule must give a `bool`.

- **Names:** `self`, `input`, `output`, the parameters of the rule, the variables of a macro, and `cel.bind(name, value, rule)`.
- **Literals:** `5000`, `-1`, `0x1F`, `0.5`, `'text'`, `"text"`, `r'^[0-9]{4}$'`, `'''text'''`, `true`, `false`, `['a', 'b']`, `[]`.
- **Operators**, lowest precedence first: `c ? a : b`; `||`; `&&`; `==` `!=` `<` `<=` `>` `>=` `in`; `+` `-`; `*` `/` `%`; `!` and unary `-`; `a.b` and `l[i]`.
- **Conversions:** `int()`, `double()`, `string()`, `bool()`, `timestamp()`, `duration()`. A property that can be absent: `has(a.b)`.
- **Strings:** `size`, `matches`, `startsWith`, `endsWith`, `contains`, `charAt`, `indexOf`, `lastIndexOf`, `substring`, `split`, `join`, `lowerAscii`, `upperAscii`. A position counts characters, from 0.
- **Numbers:** `math.greatest`, `math.least`, `math.abs`, `math.sign`, `math.ceil`, `math.floor`, `math.trunc`, `math.isNaN`, `math.isInf`, `math.isFinite`.
- **Times:** `getFullYear`, `getMonth` (from 0), `getDate` (from 1), `getDayOfMonth`, `getDayOfWeek`, `getDayOfYear`, `getHours`, `getMinutes`, `getSeconds`, `getMilliseconds`, each with an optional time zone: `timestamp(self.starts_at).getHours('Europe/Paris')`. A timestamp keeps milliseconds.
- **Lists:** `all`, `exists`, `exists_one`, `map`, `filter`, `sum`, `flatten`, and the two-variable `all(i, x, p)`, `exists(i, x, p)`, `existsOne(i, x, p)`, `transformList(i, x, [p,] e)`, where `i` is the position. A count: `size(l.filter(x, p))`.
- **Errors:** a value that a form cannot take breaks the rule: `int('1x')`, an index out of the list, a division by 0, an int larger than 2^53 − 1. `&&`, `||`, `all` and `exists` ignore an error when the other side decides the result, as in CEL.
- **Optional properties:** read one only after a guard: `has(self.deposit) && self.deposit > 0`, or `!has(self.deposit) || self.deposit > 0`.
- **Maps:** `m[k]` (a key that is not there breaks the rule), `k in m`, `size(m)`, and `all`, `exists` and `exists_one` over the keys.
- **Unions:** read the tag of a union with a tag at any time. Read another property only after a test of the tag: `self.shape.kind != 'circle' || self.shape.radius > 0`.
- **Not in the language:** bytes, unsigned ints, `null`, optional values, `type()`, `dyn()`, and lists of items of more than one type. Also these forms of CEL, which a rule is unlikely to need: `format`, `strings.quote`, `trim`, `replace`, `reverse`, `sort`, `sortBy`, `distinct`, `slice`, `lists.range`, `math.round` and the `math.bit` functions.

## The generated file

`compile` writes `<out>/domain.generated.ts` (default `src/generated`). The core and the shell import only this file.

| Export | What it is |
| --- | --- |
| `<Name>` | The TypeScript type of each definition |
| `check(definition, value)` | `{ ok: true, domain, value }` or `{ ok: false, domain, failures }` |
| `answer(output, value)` | What a function of the core returns |
| `DomainCore` | The type of the core: one function for each operation |
| `runOperation(core, operation, input)` | Checks the input, runs the core, checks the answer. Gives `{ ok: true, domain, operation, output, value }`, or `{ ok: false, domain, operation, kind: 'InputRejected' \| 'ContractViolation', failures }` |
| `DOMAIN` | The URN of the domain, such as `urn:acme:bookings` |
| `Definitions`, `Operations` | Each part with its URN, for the steps |

Each part has a URN: `urn:<namespace>:<domain>:<definition|rule|operation>:<name>`, such as `urn:acme:bookings:definition:party_size`. `diff`, gate 5 and the JSON output name parts by URN. The manifest and the scenarios use short names.

A failure is `{ definition, rule, path, failure_message }`, such as `{ definition: 'party_size', rule: 'minimum', path: 'party_size', failure_message: 'Must be at least 1' }`. `InputRejected` is the caller's fault. `ContractViolation` is a bug in the core.


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

`urn-forge.config.ts` exports `defineConfig({ … })` from `urn-forge/config`. Paths are relative to the file. A gap in the scenarios is always an error: there is no option for it.

| Option | Default | Value |
| --- | --- | --- |
| `tsconfig` | `tsconfig.json` | The tsconfig of gate 1, for each domain |
| `shell` | none | Files and folders of the shell. Gate 2 checks them against the core of each domain |
| `domains` | one domain at the default paths | The domains of the project, each with the options below |

| Option of a domain | Default | Value |
| --- | --- | --- |
| `manifest` | `domain.manifest.yaml` | The manifest |
| `out` | `src/generated` | The folder of the generated files |
| `core` | `src/core.ts` | The core |
| `features` | `features` | The folder of the `.feature` files |

With several domains, `compile` and `verify` handle each one in one run, and start each with its URN. Each domain has its own `features` folder, and its own Cucumber profile, because the steps use short names. Two domains with one manifest, one `out`, one `features` or one URN fail with `config-invalid`.

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
| 3. gherkin | A step names an unknown part, or an operation, an output, a variant or a rule has no scenario |
| 4. drift | A generated file is not what `compile` writes now |
| 5. contract | Only with `--base <ref>`: the ref cannot be read, or a rule, an output or a scenario of the ref is gone, or a rule accepts more, and the version does not allow it |

`diff` allows a breaking change in `0.x`, in a pre-release, or across a new major version. Gate 5 allows a weaker contract only when the version also changes: to another `0.x` version, a pre-release, or a new major version. Then each change is a warning. A scenario is known by its name: a renamed scenario counts as removed.

## The codes

Each problem has one of these codes. The fix is the same as the `fix` of `--format json`.

| Code | Meaning | Severity | Commands | Fix |
| --- | --- | --- | --- | --- |
| `usage` | The command line is wrong | error | compile, verify, diff | Run urn-forge --help, and call the command with the arguments and options that it shows. |
| `config-unreadable` | The manifest file, or the file that `--config` names, does not exist | error | compile, verify | Give --config the path of a config file that exists, or remove --config to use urn-forge.config.ts. |
| `config-invalid` | The config does not load, or an option is unknown or of the wrong type | error | compile, verify | Change the config to use only the options of defineConfig, with the types that the message names. |
| `manifest-unreadable` | The manifest file, or the file that `--config` names, does not exist | error | compile, verify, diff | Give --manifest, or manifest in the config, the path of a manifest that exists. |
| `yaml-syntax` | The file is not valid YAML, or a map has one key two times | error | compile, verify, diff | Correct the YAML at the line that the problem gives. |
| `manifest-shape` | A key that is not allowed, a key that is not there, or a value of the wrong shape | error | compile, verify, diff | Use only the keys that the message lists, with values of the type that it names; the definition manifest in self/domain.manifest.yaml of the package states each key. |
| `unknown-definition` | A name that the manifest does not have | error | compile, verify, diff | Add the definition to definitions:, or correct the name to one that is in definitions:. |
| `type-cycle` | A chain of `type` names goes back to its start | error | compile, verify, diff | Give one definition of the cycle a base type (string, number, integer, boolean, object, array, map or union) in place of the name of another definition. |
| `duplicate-property` | A list names a property or an output two times | error | compile, verify, diff | Remove the second copy of the name from properties:. |
| `unknown-property` | A name that the manifest does not have | error | compile, verify, diff | Add the name to properties: of the object, or remove it from the rule. |
| `not-an-object` | The input or an output is not an object | error | compile, verify, diff | Make the input or the output of the operation a definition of type: object. |
| `duplicate-output` | A list names a property or an output two times | error | compile, verify, diff | Remove the second copy of the object from output:. |
| `invalid-identifier` | The identifier is not a required property with one value | error | compile, verify, diff | Make the identifier a property of the object, list it in the required rule of the object, and give it one value: not an object or a list. |
| `deprecated-use` | A live part uses a deprecated part | warning | compile, verify | Use a definition or a rule that is not deprecated, or remove deprecated: true if it is still the right one. |
| `standard-name` | A rule of the manifest has the name of a standard rule | error | compile, verify, diff | Give the rule of the manifest a name that is not the name of a standard rule. |
| `unknown-rule` | A name that the manifest does not have | error | compile, verify, diff | Add the rule to rules:, or correct the name to a rule of the manifest or a standard rule. |
| `rule-argument` | An argument does not agree with the parameters of the rule | error | compile, verify, diff | Give the rule an argument that its parameters accept, or no argument when the rule has no parameters. |
| `rule-syntax` | The rule does not parse, or uses a form that is not in the rule language | error | compile, verify, diff | Write the rule in the rule language of urn-forge: the names, operators, functions and macros of the reference. |
| `rule-type` | A type in the rule is wrong, the rule does not give a `bool`, or `has()` reads a required property | error | compile, verify, diff | Change the rule so that each part has the type that the message names, and the rule gives a bool. |
| `rule-guard` | The rule reads an optional property without `has()` | error | compile, verify, diff | Read an optional property only after has(): has(self.x) && self.x > 0, or !has(self.x) \|\| self.x > 0. |
| `rule-scope` | The rule reads a name that is not available where you apply the rule, such as `output` in a rule of a definition | error | compile, verify, diff | Use only the names that the message lists: self, input, output, the parameters of the rule, and the variable of a macro. |
| `invalid-message` | A message names `{x}`, but `x` is not a parameter | error | compile, verify, diff | Use in {braces} only the names of the parameters of the rule. |
| `tsconfig-unreadable` | Gate 1 or gate 2: the tsconfig does not exist, or does not parse | error | verify | Give --tsconfig, or tsconfig in the config, the path of a tsconfig that TypeScript can read. |
| `core-not-found` | Gate 1: the file of the core does not exist | error | verify | Create the core file, or give --core, or core in the config, its path. |
| `type-error` | Gate 1: `tsc` finds a type error in the core, with the tsconfig of the project | error | verify | Correct the type error at the line that the problem gives; do not suppress it. |
| `core-not-satisfying` | Gate 1: no export of the core `satisfies DomainCore` | error | verify | Export the core as export const core = { … } satisfies DomainCore, with one function for each operation. |
| `direct-call` | Gate 2: a shell file calls a function of the core directly, without `runOperation` | error | verify | Call the core through runOperation(core, operation, input), which checks the input and the answer. |
| `suppressed-check` | Gate 2: a core or shell file has `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` | error | verify | Remove the @ts- comment and correct the type error that it hides. |
| `feature-syntax` | Gate 3: a `.feature` file does not parse | error | verify | Correct the Gherkin of the feature file at the line that the message gives. |
| `unknown-name` | Gate 3: a step names a part that the manifest does not have | error | verify | Use in the step the name of an operation, a definition, an output or a rule of the manifest, as the message says. |
| `uncovered-operation` | Gate 3: no scenario runs an operation | error | verify | Add a scenario with When I run "<operation>" with:. |
| `uncovered-output` | Gate 3: no scenario of an operation ends with one of its outputs | error | verify | Add a scenario of the operation that ends with Then the output is "<output>". |
| `uncovered-variant` | Gate 3: no scenario reaches a variant of a union | error | verify | Add a scenario whose table has a value of the variant: for a union with a tag, a value with that value of the tag. |
| `uncovered-rule` | Gate 3: no scenario breaks a rule of a definition | error | verify | Add a scenario that breaks the rule and ends with Then the input is rejected by "<rule>" of "<definition>", or Then the value is rejected by "<rule>" of "<definition>". |
| `drift` | Gate 4: a generated file is not what `compile` writes now, or it is missing, or `compile` no longer writes it | error | verify | Run urn-forge compile, and do not edit a generated file by hand. |
| `base-unreadable` | Gate 5: the folder is not in a git repository, or the ref is not a commit | error | verify | Fetch the base ref (git fetch origin <branch>, with enough depth), or give --base a ref that exists. |
| `removed-rule` | Gate 5: a rule of the base is gone | by-version | verify | Put the rule back; if the change is on purpose, stop and ask a person, because only a person decides a new manifest.version. |
| `wider-rule` | Gate 5: a rule accepts more than at the base | by-version | verify | Put the argument or the text of the rule back; if the change is on purpose, stop and ask a person, because only a person decides a new manifest.version. |
| `removed-output` | Gate 5: an output of the base is gone | by-version | verify | Put the output back; if the change is on purpose, stop and ask a person, because only a person decides a new manifest.version. |
| `removed-scenario` | Gate 5: a scenario of the base is gone | by-version | verify | Put the scenario back; if the change is on purpose, stop and ask a person, because only a person decides a new manifest.version. |
| `internal-contract` | urn-forge broke its own contract: an answer of urn-forge does not keep a rule of `self/domain.manifest.yaml`, which is a bug of urn-forge | error | compile, verify, diff | Report it in an issue of urn-forge, with the message: urn-forge broke its own contract, and your project did not cause it. |
