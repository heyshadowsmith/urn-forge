# The CLI and the config

Run `npx urn-forge <command>` in a project where urn-forge is installed. These are the first lines of `npx urn-forge --help`:

```
urn-forge 0.2.0

Usage:
  urn-forge init    [--namespace <name>] [--domain <name>]
  urn-forge compile [--config <file>] [--manifest <file>] [--out <dir>] [--format text|json]
  urn-forge verify  [--config <file>] [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>] [--base <ref>] [--format text|json]
  urn-forge diff    <old manifest> <new manifest> [--report] [--format text|json]
```

| Command | What it does |
| --- | --- |
| `init` | Writes a starter project that splits a bill. This project passes `verify`. `init` sets `"type": "module"` in `package.json`, and adds the scripts `compile`, `verify` and `test:features`. It also writes `AGENTS.md`, the instructions for coding agents, and the Claude Code skill `.claude/skills/urn-forge/SKILL.md`; it keeps each of these two that is already there. If one of its other files is already there, it writes nothing. The default values of `--namespace` and `--domain` are `app` and `starter` |
| `compile` | Writes the generated files, and shows one line for each file: `wrote`, `unchanged`, or `removed`. If the manifest has an error, it writes nothing |
| `verify` | Compiles in memory and runs the [gates](#the-gates). It writes nothing, and it does not run the scenarios. `cucumber-js` runs them. `--base <ref>` also runs gate 5 against a git ref |
| `diff` | Compares two manifests, the old one first. Refer to [diff](#diff). It does not read the config |

Each command exits with `0` on a pass (also with warnings), `1` on a failure, and `2` on a wrong command line.

## JSON output

With `--format json`, `compile`, `verify` and `diff` write one JSON object to stdout, and nothing else. The exit code does not change.

| Key | In | Value |
| --- | --- | --- |
| `ok` | All | `true` when the exit code is `0` |
| `problems` | All | Each problem: `code`, `severity`, `file`, `line`, `path` (the keys in the manifest or the config), `domain` (the URN of its domain), `message` and `fix`. A key that does not apply is `null` |
| `files` | `compile` | Each generated file: `domain`, `status` and `path` |
| `domains` | `verify` | Each domain: `urn`, and each gate that ran for it: `gate`, `name`, `pass` and `summary` |
| `gates`, `warnings` | `verify` | Each gate of each domain, with its `domain`; the number of warnings |
| `from`, `to`, `breaking`, `changes`, `allowed`, `why` | `diff` | The versions, the number of breaking changes, each change (`class`, `place`, `message`), and the verdict of the versions |

A wrong command line is a problem with the code `usage`:

```json
{"ok":false,"problems":[{"code":"usage","severity":"error","file":null,"line":null,"path":null,"domain":null,"message":"Unknown option '--nope'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- \"--nope\"","fix":"Run urn-forge --help, and call the command with the arguments and options that it shows."}]}
```

## The config

urn-forge reads `urn-forge.config.ts` from the current folder, or from the file that `--config` names. The file exports `defineConfig({ … })` from `urn-forge/config`. A path in the file is relative to the file. A flag of the same name overrides the path.

| Option | Default | Value |
| --- | --- | --- |
| `tsconfig` | `tsconfig.json` | The tsconfig of gate 1, for each domain |
| `shell` | none | Files and folders of the shell. Gate 2 checks them against the core of each domain |
| `domains` | one domain at the default paths | The domains of the project, each with the options below |

| Option of a domain | Default | Value |
| --- | --- | --- |
| `manifest` | `domain.manifest.yaml` | The manifest |
| `out` | `src/generated` | The folder of the generated files |
| `core` | `src/core.ts` | The core file, which exports a value that `satisfies DomainCore` |
| `features` | `features` | The folder of the `.feature` files |
| `postgres` | none | Writes a Postgres schema and a store file. Refer to [Postgres](#postgres) |

A gap in the scenarios is always an error, so there is no option for it. `--manifest`, `--out`, `--core` and `--features` work only when the config has one domain. Two domains with one manifest, one `out`, one `features` or one URN fail with `config-invalid`.

Your core and your shell import only the generated file. The project also uses `urn-forge/config`, `urn-forge/cucumber` (`registerSteps`) and `urn-forge/register-tsx`. `urn-forge/register-tsx` lets `npx cucumber-js` load TypeScript. For your own tools, `urn-forge` exports `loadManifest`, `compileManifest`, `generate` and the rule parser. Because the entry points are TypeScript source, run code that imports them through a loader such as `tsx`.

## Postgres

With `postgres` in a domain of the config, `compile` also writes `schema.generated.sql` and `domain.store.generated.ts`, and gate 4 checks them. Each table is an object definition with an `identifier`, which becomes the primary key. urn-forge writes no migrations, and it never connects to a database: apply the schema with your migration tool, and run the statements of the store file with your driver.

<<< @/../packages/urn-forge/insurance/urn-forge.config.ts{11-14}

| Key | Value |
| --- | --- |
| `tables` | The object definitions that become tables |
| `references` | For a table, a property that holds the identifier of another table. It becomes a `FOREIGN KEY` |
| `unique` | For a table, lists of properties that two rows cannot share, such as `unique: { customer: [['email']] }` |

An embedded object becomes columns of its table, such as `contact_email`. A list becomes a child table, `<table>__<property>`. Each rule that SQL can state becomes a `CHECK` constraint.

The store file has pure functions for each table: `insert<Table>(value)`, `delete<Table>(identifier)`, `replace<Table>(value)` and `select<Table>(identifier)` give the statements, as `{ text, values }`. `<table>FromRows(rows)` builds the value from the rows of `select<Table>`.

## diff

`urn-forge diff <old manifest> <new manifest>` lists each change as `breaking` or `compatible`, at the URN of its part. It fails on a breaking change, unless the new version is a new major version, a `0.x` version or a pre-release such as `2.0.0-alpha.1`. `--report` lists the changes and always exits with `0`.

The direction of a value decides the class. Callers **send** the input and each definition in it. Callers **receive** the outputs and each definition in them. A definition on the two sides gets the stricter class.

| Change of a definition | Sent | Received |
| --- | --- | --- |
| New definition, or `deprecated: true` added | compatible | compatible |
| Removed definition or property; changed `type`, `items` or `identifier` | breaking | breaking |
| New property | compatible | breaking ¹ |
| New rule, or a narrower argument: it accepts less | breaking | compatible |
| Removed rule, or a wider argument: it accepts more | compatible | breaking ¹ |
| An argument that is neither narrower nor wider | breaking | breaking |

| Change of an operation or the header | Class |
| --- | --- |
| New operation; removed output; new rule of an output or operation; `compatibility` or `deprecated: true` added | compatible |
| New output | breaking ¹ |
| Removed operation; changed `input`; removed or changed rule of an output or operation | breaking |
| Changed `namespace` or `domain`; `compatibility` removed | breaking |

¹ Compatible if the new header has `compatibility: { callers: ignore-unknown }` under `manifest`. This tells that callers ignore all data that they do not know.

More `enum` choices, or fewer `required` properties, is wider. Some rules have the form `self <op> parameter` or `size(self) <op> parameter`, such as `minimum` or `maxLength`. For these rules, a larger argument is narrower with `>=` or `>`, and wider with `<=` or `<`.

If `diff` cannot find the direction, the change is breaking. An example is two regular expressions. A change to the text of a rule is breaking at each location that uses the rule. All changes to a definition that no input or output uses are compatible. The exception is an argument that is neither narrower nor wider.

## The gates

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 15 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

Each problem of a gate is an indented line below the gate, with its fix on the next line. The last line is `verify passed …` or `verify failed: gate <numbers>`. If the config or the manifest has an error, no gate runs. Gate 5 runs only with `--base <ref>`. With several domains, the gates of each domain follow its URN, and the last line counts the domains: `verify passed (2 domains, gates 1, 2, 3, 4)`.

| Gate | It fails when | Codes |
| --- | --- | --- |
| 1. Completeness | `tsc` fails over the core with the tsconfig of the project, or no export of the core `satisfies DomainCore` | `type-error`, `core-not-satisfying`, `core-not-found`, `tsconfig-unreadable` |
| 2. Boundary | A shell file calls a function of the core directly, or a core or shell file has `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` | `direct-call`, `suppressed-check` |
| 3. Gherkin (the scenarios) | A step names a part that the manifest does not have. A `.feature` file does not parse. No scenario runs an operation, ends with an output, or breaks a rule of a definition | `unknown-name`, `feature-syntax`, `uncovered-operation`, `uncovered-output`, `uncovered-rule` |
| 4. Drift | A generated file is not the same as the file that `compile` writes now. A generated file is not there. A generated file is there, but `compile` does not write it now | `drift` |
| 5. Contract | Compared with the manifest and the features at the git ref: a rule, an output or a scenario is not there, or a rule accepts more, and the version does not allow it. A new major version, a pre-release or another `0.x` version allows it; then each change is a warning | `removed-rule`, `wider-rule`, `removed-output`, `removed-scenario`, `base-unreadable` |

The `uncovered-` codes are always errors. An `Examples` row counts as one scenario. A `type-error` names the function to correct. `TS1360` is a function that is not there, and `TS2353` is an extra function. `TS2322` is a return that is not `answer('<output>', value)` of the operation. If an error points into a generated file, correct gate 4 first.

## Diagnostics

A problem of the config or the manifest is one line, with the line in the manifest, and a second line with the fix. An `error` stops the command, but a `warning` does not:

```
domain.manifest.yaml:13  error  unknown-rule  positive is not a rule of this manifest or a standard rule
  fix: Add the rule to rules:, or correct the name to a rule of the manifest or a standard rule.
domain.manifest.yaml:75  error  rule-guard  over_express_limit: input.express can be absent: read it after has(input.express) &&, or after !has(input.express) ||
  fix: Read an optional property only after has(): has(self.x) && self.x > 0, or !has(self.x) || self.x > 0.
```

Each code has one fix, which the output shows on the line below the problem. `node_modules/urn-forge/AGENTS.md` lists each code with its fix.

| Code | Cause |
| --- | --- |
| `usage` | The command line is wrong (only with `--format json`; as text, the usage shows) |
| `manifest-unreadable`, `config-unreadable` | The manifest file, or the file that `--config` names, does not exist |
| `config-invalid` | The config does not load, or an option is unknown or of the wrong type |
| `postgres-config` | A table has no identifier, or an entry of `postgres` names a part that is not there |
| `postgres-column` | Two parts give one column name, a name is longer than 63 bytes, or a list contains lists (put the inner list in an object) |
| `yaml-syntax` | The file is not valid YAML, or a map has one key two times |
| `manifest-shape` | A key that is not allowed, a key that is not there, or a value of the wrong shape |
| `unknown-definition`, `unknown-property`, `unknown-rule` | A name that the manifest does not have |
| `type-cycle` | A chain of `type` names goes back to its start |
| `duplicate-property`, `duplicate-output` | A list names a property or an output two times |
| `invalid-identifier` | The identifier is not a required property with one value |
| `not-an-object` | The input or an output is not an object |
| `deprecated-use` (warning) | A live part uses a deprecated part |
| `standard-name` | A rule of the manifest has the name of a standard rule |
| `rule-argument` | An argument does not agree with the parameters of the rule |
| `invalid-message` | A message names `{x}`, but `x` is not a parameter |
| `rule-syntax` | The rule does not parse, or uses a form that is not in [the rule language](./manifest#the-rule-language). urn-forge gives this error at the line of `rule:`, with the column. It gives the other rule errors at the line where you apply the rule |
| `rule-type` | A type in the rule is wrong, the rule does not give a `bool`, or `has()` reads a required property |
| `rule-guard` | The rule reads an optional property without `has()` |
| `rule-scope` | The rule reads a name that is not available where you apply the rule, such as `output` in a rule of a definition |
| `removed-rule`, `wider-rule`, `removed-output`, `removed-scenario` | Gate 5: the contract is weaker than at the base, and the version does not allow it |
| `base-unreadable` | Gate 5: the folder is not in a git repository, or the ref is not a commit. In CI, fetch the base branch |
