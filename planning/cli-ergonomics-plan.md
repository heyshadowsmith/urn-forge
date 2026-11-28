# urn-forge plan: a command line that tells an agent what to do

This plan builds the ergonomics group of [the CLI improvement spec](../audit/cli-improvement-spec.md): tasks 13 to 17, from findings A3 to A10, D8 and D10. A coding agent learns a tool by trying it: `compile --help`, a typo, `--format json` in the place where it put the other flags. Each answer must be the right one, in the place where it looks.

Checked on `main` (0.2.4):

| Finding | Today |
| --- | --- |
| A3: help for one command | `compile --help` is exit 2 with "Unknown option '--help'"; `help verify` gives the usage of each command |
| A4: the streams | A problem of the manifest goes to stderr, a problem of a gate to stdout. "verify passed" goes to stdout and "verify failed" to stderr |
| A5, D8: `--format` and repeated flags | `--format json verify` is an unknown command; `--manifest a --manifest b` uses `b` with no word; `--format json --format text` gives text |
| A6: a usage error | One typo prints Node's hint ("place it at the end of the command after '--'"), which is wrong for a command with no argument, and then the usage of each command |
| A7: the JSON report | Its keys depend on the path that ran: `verify` on a usage error has no `gates`, `compile` on a failure has no `files` |
| A9: version | `-V` and `version` are unknown commands; `--version extra` ignores `extra` |
| A10, D10: paths | A folder given as `--manifest` "does not exist"; a path outside the folder shows as `../../../../dev/null`; `diff` gives no line for a problem of a manifest, and its fix names `--manifest`, which `diff` does not take |

The JSON report and each code are stated in `self/`, so a change of their shape goes through it.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Help for a command | **`<command> --help`, `<command> -h` and `help <command>` print the help of that command on stdout, with exit 0: its line, what it does, its options with their defaults, and the exit codes. `src/usage.ts` answers them, so they load no command. The usage of all commands ends with "Run urn-forge <command> --help for its options"** | It is what an agent tries first. Asking for help is not an error |
| 2 | Version | **`-V` and `version` are `--version`. An argument after `--version` or `--help` is `usage`** | The common spellings. Ignoring an argument hides a mistake |
| 3 | `--format` | **An option in the table of each command that takes it, as each other option, so that `--` ends the options. `--format` before the command is `usage`: "put --format after the command"** | One way to read options, and `--` works by itself. Accepting it before the command would be a second place for one option |
| 4 | A repeated option | **`usage`: "--manifest is given two times"** | Two values of one option are a mistake, never an intent |
| 5 | A usage error | **One line, `urn-forge <command>: <what is wrong>`, and the next line "Run urn-forge <command> --help for its options". For an unknown option, the nearest option of the command, when one is near: "did you mean --manifest?". No hint of Node, no usage of each command** | The agent reads the one line that names the mistake and the one that names the cure |
| 6 | The streams | **The report of a command goes to stdout: its result lines, its problems, and its verdict. stderr is only for a wrong command line and for a failure of urn-forge (`internal-error`, `internal-contract`, and the output that cannot be written)** | It is the rule of the JSON output, in text. `verify > log` then has the whole report. Medium risk: a script that reads one stream sees lines move |
| 7 | The JSON report | **Each report has each key of its command, empty when it does not apply: `files` for `compile`; `gates`, `domains` and `warnings` for `verify`; `changes` for `diff`. `self/` makes them required. `from`, `to`, `breaking`, `allowed` and `why` of `diff` stay optional: they exist only when both manifests compile** | A consumer can read `report.gates.length` on each path. It adds keys; it removes none |
| 8 | Paths | **A file that cannot be read says why: "does not exist", "is a folder, not a file", or "cannot be read: permission denied". A path outside the folder shows as an absolute path. The verdict of `verify` names the cause that its problems give. `diff` gives the line of each problem of a manifest, as `compile` does, and still reports only errors (part 7 of urn-forge's own contract states it). The fix of `manifest-unreadable` names each way to give a manifest, also the two manifests of `diff`** | The message sends the agent to the right cause |
| 9 | The version | **0.2.5** | Decisions 7 and 8 change `self/`: the report definitions, and a fix |

Not in this plan: short aliases of the options (`-c`, `-o`), which the spec offers as optional: more names for one option, and none that an agent needs.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 1 | The tests of each finding in `tests/bin.test.ts`, with `it.fails` | They fail for the reason of their finding |
| 2 | Help for each command, and the version (decisions 1 and 2) | `compile --help` is exit 0 with the help of `compile` on stdout, and loads no command |
| 3 | `--format` in the tables, repeated options, and the one-line usage errors (decisions 3 to 5) | The tests of A5, A6 and D8 pass |
| 4 | The streams (decision 6) | `verify > log` has the whole report, and stderr is empty on a pass and on a failure of the project |
| 5 | The JSON report (decision 7), with `self/` and 0.2.5 | Each JSON report has each key of its command, on each path |
| 6 | Paths (decision 8) | The tests of A10 and D10 pass |
| 7 | The docs (the CLI reference quotes the help and the outputs), a cold-reader test of `--help` alone, and the plan notes | A reader of the help of `verify` alone gives its options and its exit codes |

## Sabotages

1. Let `compile --help` reach the CLI again → the test of what `--help` loads, and of its exit code.
2. Send the verdict of a failed `verify` to stderr again → the test of the streams.
3. Leave `files` out of a failed `compile` report → `internal-contract`, by the report definition of `self/`.
4. Accept a repeated `--manifest` again → the test of D8.

## Risks

- **Step 4 moves lines between the streams.** A script that greps stderr for the problems of `compile` finds them on stdout. The JSON output does not change.
- **The help text is a copy of the options.** The help of each command and the tables of options of `src/options.ts` must agree: a test checks that the help of each command names each of its options, and no other.

## What was built

| Step | Result |
| --- | --- |
| 1 | The tests of each finding in `tests/bin.test.ts`, each an `it.fails` until its step turned it to `it` |
| 2 | `src/usage.ts` gives the help of each command for `<command> --help`, `<command> -h` and `help <command>`, on stdout with exit 0, and loads no command. `-V` and `version` are `--version`; an argument after `--help` or `--version` is `usage` |
| 3 | `--format` is in the options of `compile`, `verify` and `diff`, so `--` ends it too; before the command it is `usage`. A repeated option is `usage`: "--manifest is given two times". A usage error is one line and the line of its help: "urn-forge compile: unknown option --manfest; did you mean --manifest?" |
| 4 | The report of each command goes to stdout: its result lines, its problems and its verdict. stderr gets only a wrong command line, `internal-error`, `internal-contract` and the line of output that cannot be written |
| 5 | Each JSON report has each key of its command on each path; `self/` makes them required. The package and `self/` are 0.2.5 |
| 6 | A file that cannot be read says why: it does not exist, is a folder, or cannot be read. A path outside the folder shows as absolute. The verdict of `verify` names its cause. `diff` gives the line of each problem of a manifest. The fix of `manifest-unreadable` names each way to give a manifest |
| 7 | The CLI reference quotes the help, the streams and a usage error. A test checks that the Options section of each help names each option of its command and no other |

Changes from the plan:

- **Sabotage 3 found a bug.** A JSON report that breaks its definition gave `internal-contract` with exit 1, not exit 3 as the trust plan says, and without the keys of its command. It now gives exit 3 and the keys, and a test of `tests/cli.test.ts` checks it.
- **The help of `verify` names the gates.** The cold reader of `verify --help` alone answered each of its seven questions correctly: the options and their defaults, a command with `--core`, `--base`, exit 1 against exit 3, exit 0 with warnings, that `verify` writes nothing, and `--format json`. Of the gaps that it listed, three were cheap to close in the help: what each gate checks, why `verify` takes `--out` (gate 4 compares the generated files), and what `--base` takes (a branch, tag or commit). The others (the shape of the JSON report, the config) are in the CLI reference, and the help stays short.
- **The config is read the same way as the manifest.** `config-unreadable` also says why, and both meanings now say "does not exist, or cannot be read".

The sabotages, each caught:

1. `compile --help` reaches the CLI → the test of what `--help` loads, and the test of A3.
2. The verdict of a failed `verify` on stderr → the test of the streams, and 3 tests of `tests/cli.test.ts`.
3. No `files` in a failed `compile` report → `internal-contract`, by `required` of `compile_report`, and 4 tests of `tests/bin.test.ts`.
4. A repeated `--manifest` accepted → the test of D8.
5. (Added) `--tsconfig` left out of the Options section of the help of `verify` → the test of the help. At first the test read the whole help, and the usage line still named the option; it now reads the Options section alone.
