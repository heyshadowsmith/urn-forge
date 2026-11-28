# urn-forge plan: output that an agent can trust

This plan builds the P0 group of [the CLI improvement spec](../audit/cli-improvement-spec.md): tasks 1 to 6. Each one is about one question that a coding agent asks after each command: can it believe the exit code and the output? Today it cannot always:

| Finding | Reproduced on main (0.2.3) |
| --- | --- |
| D1: a missing `shell` path | `verify passed`, exit 0: gate 2 checks no file, and says so only in its summary ("0 shell file(s)") |
| A1, D7: a flag of another command | `compile --base main` exits 0 and ignores `--base` |
| A2, B6, D3: a filesystem error | `compile --format json --out /dev/null/x`: a Node stack trace, exit 1 (the code of a failed gate), and no JSON |
| D2: two domains, one out folder through a symlink or a case-only difference | both write; one domain's generated file is lost |
| D4: `init` with a `package.json` that is not a JSON object | `init` writes the starter files, then crashes, and refuses to run again |
| D13: the real binary | no test runs `bin/urn-forge.js` and checks its exit code, stdout and stderr apart |

The spec was written against 0.2.2. Since then, each code has its meaning, severity, commands and fix in `src/codes.ts` and in `self/` (parts 5 and 7 of [urn-forge's own contract](./self-as-documentation-plan.md)), and the CLI checks each problem against them. So each new code of this plan goes through `self/` too.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The order | **The binary test harness first (task 1), with a test of each finding that fails today (`it.fails`). Each later step turns its tests to `it`** | The harness is where the crash lives (D13), and a test written first shows that each step fixes what it says |
| 2 | A filesystem error | **A new code `io-error` (error; `compile`, `verify`, `diff`): the operation, the path and the system code, such as "mkdir failed: ENOTDIR". Exit 1, and with `--format json` one JSON object, as for each other problem** | It is a problem of the user's machine or paths, which the user fixes, so it is exit 1 like any other problem. The JSON contract then holds on each path |
| 3 | An error that urn-forge does not expect | **A new code `internal-error` (error; each command): urn-forge itself failed, with the message and no stack, and "set URN_FORGE_DEBUG=1 for the stack". Exit 3, and also exit 3 for `internal-contract`** | An agent must tell "my project failed" (1) from "urn-forge failed" (3): only the second calls for an issue, not a change to the project. Exit 3 is new to the contract: `AGENTS.md`, the CLI reference and the usage list it |
| 4 | Write errors on stdout (A11) | **One line on stderr, "urn-forge: cannot write the output: …", and exit 1. EPIPE stays quiet** | It is the machine, not urn-forge: exit 1, as for `io-error`. No new exit code |
| 5 | A missing input of a gate | **A new code `missing-input` (error; `verify`): a `shell` path, or a `--features` folder or `features` of the config that was named, does not exist. A path given as a file must end in `.feature` to be read as one. Symlinked folders are followed, once each** | A typo must never switch a gate off. One code covers each path that the config or a flag names for a gate |
| 6 | A flag of another command | **Each command has its own table of options. A flag of another command is `usage`, exit 2: "--base is not an option of compile". No release of warnings first** | 0.2.x is not on npm, so no script depends on the old behaviour. An agent learns at once that the flag did nothing |
| 7 | Two domains with one out folder | **Compare the out folders after `realpath` (of the nearest folder that exists), and without case on macOS and Windows. A clash is `config-invalid`, as today** | It closes the hole with the code that already names it |
| 8 | `init` and `package.json` | **Read and check `package.json` before `init` writes anything. Not valid JSON, or not an object: "init writes no file: package.json …", exit 1, and no file written** | `init` promises to write no file when it cannot finish. It gives text, as today: it has no `--format json` |
| 9 | The contract | **The three new codes in `src/codes.ts` and `self/`, with their meaning, severity, commands and fix; exit 3 in the docs; and 0.2.4** | Part 5 and part 7: a new code is stated and checked like the others. A new code changes the enum of `code`, which gate 5 refuses at the same version |

Not in this plan: the hang of `compile --out /proc/nope/x` (the spec's open item), which needs its own look, and tasks 7 to 30 of the spec.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 1 | `tests/bin.test.ts`: it spawns `bin/urn-forge.js` and checks the exit code, stdout and stderr apart. The happy path of each command, a usage error, `--format json`, EPIPE; and with `it.fails`, each finding of the table above | The suite passes; each `it.fails` fails for the reason of its finding |
| 2 | `io-error`, `internal-error`, exit 3, the write errors of the bin, and 0.2.4 | The tests of A2, D3 and A11 pass. Each JSON run gives exactly one object |
| 3 | `missing-input`, and symlinked folders | The test of D1 passes: a missing `shell` path fails `verify` |
| 4 | An options table for each command | The test of A1 passes: `compile --base main` exits 2 |
| 5 | The out folders by `realpath` and case | The test of D2 passes |
| 6 | `init` checks `package.json` first | The test of D4 passes: no file is written |
| 7 | The docs (`AGENTS.md`, the CLI reference, the usage), the plan notes, and a cold-reader question on the exit codes | The docs build; a reader of `AGENTS.md` alone tells exit 1 from exit 3 |

## Sabotages

1. Remove the catch of `io-error` → the test of D3 in `tests/bin.test.ts`: a stack trace, and stdout with no JSON.
2. Let `sourcesUnder` return `[]` for a missing path again → the test of D1.
3. Put `base` back in the options of `compile` → the test of A1.
4. Report `missing-input` from `compile` → `internal-contract`, by `reported_by_its_command` of `self/`.

## Risks

- **Step 3 fails configs that pass today.** A project with a stale `shell` entry stops passing `verify`. This is the point of the step; the message names the path.
- **Step 4 fails command lines that pass today.** A script that passes a flag that its command ignores gets exit 2. The message names the flag and the command.

## What was built

| Step | Result |
| --- | --- |
| 1 | `tests/bin.test.ts` spawns the real binary and checks its exit code, stdout and stderr apart: `--version`, `--help`, an unknown command and option, `compile`, `verify` and `diff` on the fixture, `--format json`, and a reader that stops early. Each finding was an `it.fails` test, which its step turned to `it` |
| 2 | `io-error` (exit 1, one JSON object), `internal-error` (exit 3, no stack unless `URN_FORGE_DEBUG=1`), exit 3 for `internal-contract`, and one line on stderr when the output cannot be written. The package and `self/` are 0.2.4 |
| 3 | `missing-input` of gate 2 for a shell path that does not exist, and of gate 3 for a features path that does not exist or is not a `.feature` file. The walk of both folders follows symlinked folders, each folder once |
| 4 | `src/options.ts`: each command has its own options, and an option of another command is `usage`, exit 2, with its command: "--base is not an option of compile; it is an option of verify" |
| 5 | The out folders, manifests and features of the domains are compared by their real paths, and without case on macOS and Windows |
| 6 | `init` reads and checks `package.json` before it writes a file |
| 7 | The usage and the docs list exit 3. A cold reader of `AGENTS.md` alone answered four questions correctly in three calls; it found two gaps, which are fixed: `config-unreadable` and `manifest-unreadable` shared one meaning, and the table of commands did not give each option or say that an option of another command is refused |

Changes from the plan:

- **The fixture warns.** The booking fixture uses a deprecated definition, so `compile` and `verify` write a warning on stderr. The tests of the binary expect it; the routing of the streams is task 14 of the spec, not this plan.
- **Gate 2 reads files by their real path.** TypeScript gives the files of a program by their real paths, so a shell file under a symlinked folder was not found by its linked path. Gate 3 keeps the linked path, so that a features path shows as the user wrote it.

The sabotages, each caught:

1. No catch of `io-error` → the test of D3: a stack trace, and stdout with no JSON.
2. A missing shell path that checks nothing again → the test of D1.
3. `base` back in the options of `compile` → the test of A1.
4. `missing-input` reported by `compile` → a real `compile` stopped with `internal-contract`, by `reported_by_its_command`, with exit 3.
