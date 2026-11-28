# urn-forge CLI improvement spec

_Research date: 2026-11-28 · Package: `packages/urn-forge` v0.2.2 · Method: four read-only research agents, one per domain, each with its own slice of the codebase. Most findings were reproduced by running the CLI against bad inputs in a scratch directory. No source file was changed._

## Executive summary

| Domain | Score | Verdict |
|---|---|---|
| A. CLI UX, ergonomics, POSIX compliance | **6.5 / 10** | The basics are right: four flat verbs, documented exit codes 0/1/2, a strict `--format json` with a stable `code`/`fix` per problem, EPIPE handled, no TTY dependence, and `init` never overwrites. It is let down by a shared flag table (foreign flags are ignored without a warning), no per-command help, and stdout/stderr routing that varies by command. |
| B. Architecture (FCIS) | **7 / 10** | The core is mostly pure and takes text, not paths. `main(argv, io)` takes injected I/O and never calls `process.exit`. Diagnostics are values. The weak spot is the 527-line `cli.ts`, which holds the presentation layer, a git adapter and verify policy. There are runtime import cycles through `self.ts`. |
| C. Startup latency, I/O, resources | **5 / 10** | I/O hygiene is solid. Startup is the worst-scoring area in the audit: `--help`/`--version` take about 0.74 s and 203 MB because they load all of TypeScript and Cucumber; the same takes 157 ms with both stubbed. `verify` takes 3.1 s, of which about 0.9 s is avoidable. |
| D. Validation, portability, testability | **6.5 / 10** | Strict parsing, config and manifest schemas (duplicate YAML keys rejected, line numbers), CRLF/BOM-stable output, and `pathToFileURL` for config loading. However, a typo in a `shell` or `features` path gives a **false "verify passed"**. There is no `.gitattributes` and no Windows CI, and the real binary is never tested end to end. |
| **Overall** | **6.25 / 10** | A well-built core with a thin, under-engineered shell. Nearly every issue is in the imperative shell (`cli.ts`, `write.ts`, `init.ts`, the gate file discovery) or in the startup import graph. |

### Issues found by more than one agent (merged in the backlog)

| Theme | Findings | Notes |
|---|---|---|
| Unhandled filesystem errors print a stack trace, exit 1 (the same code as a gate failure), and leave stdout empty in `--format json` | A2, B6, D3, A11 | Reproduced independently by three agents (`cli.ts:503-517`, `write.ts:19`). |
| Every subcommand accepts every other subcommand's flags without a warning | A1, D7 | `compile --base main` exits 0 (re-checked during synthesis). |
| No per-command help; `compile --help` exits 2 | A3, D8 | |
| `--help` loads Cucumber through the `STEPS` constant, and the core has import cycles | C1, B9, B1 | Fixing B9 and B1 is what makes the lazy imports in C1 work; the existing lazy `import()` of `diff` currently saves nothing. |
| Writer and drift gate duplicate the plan for generated files, and writes are not atomic | B7, C7 | |

### Open item (not investigated)
`compile --out /proc/nope/x` never exits and keeps the CPU busy (seen by agents A and B). It is probably a Node quirk of `mkdirSync(..., { recursive: true })` under `/proc`, and unlikely in real use. If it turns out to be a general bug, the catch-all from task 1 will not fix it, so it needs its own look.

## Prioritized action backlog

Each task is one PR of 250 lines or fewer. "Risk" means risk to backwards compatibility and stability. The order follows the dependencies: the end-to-end safety net first, then contract and correctness fixes, then the fixes that make startup lazy, then the rest.

### P0: correctness and output contract

| # | Task | Sources | Files | Size | Risk |
|---|---|---|---|---|---|
| 1 | **Add a binary end-to-end test harness.** Spawn `bin/urn-forge.js` and assert the exit code, stdout and stderr separately. Seed it with the happy path of each command, a usage error, `--format json` validity, and the EPIPE case. This is the safety net for tasks 2, 4 and 13–16. | D13 | `tests/bin.e2e.test.ts` (new) | ~150 | Low |
| 2 | **Turn unexpected errors into reports.** Catch everything in `main()`; map `ENOENT`/`EACCES`/`ENOTDIR`/`EISDIR` to a new `Code` with a path and a fix; always emit exactly one JSON object in `--format json`; use a distinct exit code for internal errors (proposed: 3); also handle non-EPIPE stdout errors in the bin. | A2, B6, D3, A11 | `cli.ts:503-517`, `codes.ts`, `bin/urn-forge.js:6-9` | ~120 | Low (adds a code; exit 3 replaces an exit 1 that came with a stack trace) |
| 3 | **Make missing gate inputs fail.** If a `config.shell` entry or `--features` folder does not exist, fail with a coded problem instead of returning `[]`. Follow symlinked folders during discovery. | D1 | `verify/boundary.ts:18-20`, `verify/gherkin.ts`, `verify/completeness.ts` | ~80 | **Medium**: configs that pass today because of a typo will start failing (this is the point of the fix) |
| 4 | **Give each subcommand its own option table.** Reject a foreign flag with exit 2 and the message "`--base` is not an option of `compile`". | A1, D7 | `cli.ts:171-181`, `diff/command.ts` | ~90 | **Medium**: scripts that pass extra flags will start failing. Option: warn for one minor release first. |
| 5 | **Out-dir clash check through `realpath` and case folding.** Compare the domains' output folders after resolving symlinks, and compare case-insensitively on case-insensitive filesystems. | D2 | `cli.ts` (`project()`) | ~50 | Low |
| 6 | **Validate `package.json` in `init` before writing anything.** If it is malformed or not an object, refuse with a coded problem; never report "updated" when nothing changed. | D4, part of B11 | `init.ts:44-70` | ~70 | Low |

### P1: startup latency (the domain C target is 740 ms → about 0.1 s for `--help`, and 3.1 s → about 2.2 s for `verify`)

| # | Task | Sources | Files | Size | Risk |
|---|---|---|---|---|---|
| 7 | Move the `STEPS` regex constant out of `gherkin/steps.ts` into a module that does not import Cucumber. | B9 | `gherkin/steps.ts:20,25`, `verify/gherkin.ts:15`, `self/core.ts:8` | ~20 | Low |
| 8 | Break the runtime import cycles: move `allowsBreaking` and `gatePasses` into a pure `policy.ts`. | B1 | `diff/command.ts:28`, `verify/types.ts`, `verify/contract.ts:83`, `self.ts` | ~70 | Low |
| 9 | Lazy-load each subcommand with `await import()`, so `--help` and `--version` load nothing heavy. Add a test that asserts `--help` does not load `typescript`. | C1 | `cli.ts:9-22`, `self.ts:9` | ~100 | Low–Medium |
| 10 | Load `typescript` through `createRequire` instead of ESM interop under tsx (saves about 360 ms per command). | C2 | `compile.ts:7`, `verify/completeness.ts:8`, `verify/boundary.ts:3` | ~40 | Low |
| 11 | Build gate 2 on a shared caching `CompilerHost` (or reuse the gate 1 program) instead of re-parsing 584 files (saves about 450–550 ms per domain). | C4 | `verify/boundary.ts:51,142`, `verify/completeness.ts:24` | ~40 | Low |
| 12 | Parse the manifest once for `lineOf()` (15 ms saved per diagnostic), and call `module.enableCompileCache()` in the bin (3–13% faster). | C6, C9 | `cli.ts:138-151,400-402`, `bin/urn-forge.js` | ~25 | Low |

### P1: CLI ergonomics

| # | Task | Sources | Files | Size | Risk |
|---|---|---|---|---|---|
| 13 | Per-command help: make `<cmd> --help`, `-h` and `help <cmd>` print that command's usage and exit 0. Add a description, the global flags and the exit codes to the global help. | A3, A8, D8 | `cli.ts:32-51,490-495` | ~120 | Low |
| 14 | One routing rule for every command: the result and its problems go to stdout, progress and diagnostics go to stderr; or, if keeping today's split, document it. Make "passed" and "failed" use the same stream. | A4 | `cli.ts:96,412,424,428`, `diff/command.ts:59,63,80` | ~60 | **Medium**: changes what a pipe or redirect captures |
| 15 | Make the `--format` pre-scan respect `--` and accept the flag before the command. Shorten usage errors to one line plus "run `urn-forge help <cmd>`". A bare `urn-forge` writes usage to stderr. Add `-V` and `version` aliases, and reject extra arguments after `--version`. Report a repeated flag as an error. | A5, A6, A9, D8 | `cli.ts:450-495` | ~80 | Low |
| 16 | Use one JSON report shape: always include `gates`, `warnings` and `files` (empty when not relevant). Add a schema test. | A7 | `cli.ts:26-130` | ~60 | Low (additive) |
| 17 | Fix the path messages: tell "not a directory" and "permission denied" apart from "does not exist", print relative paths only when shorter, and give the right verify verdict. Make `diff` problems carry line numbers and normalized paths, and stop its fix text from mentioning `--manifest`. | A10, D10 | `cli.ts`, `diff/command.ts:39-43` | ~100 | Low |

### P2: architecture (move logic out of the shell)

| # | Task | Sources | Files | Size | Risk |
|---|---|---|---|---|---|
| 18 | Extract `report.ts` (the `Report`/`CliIo` presentation layer) out of `cli.ts`; `diff/command.ts` then imports from it instead of from the entrypoint. Two PRs. | B2 | `cli.ts:26-130,521-525` | 2 × ~200 | Low |
| 19 | Inject a `Git` port (`show(rev, path)`) and guard its calls; test gate 5 with a fake. | B5 | `cli.ts:292-322` | ~130 | Low |
| 20 | Split `project()` into `loadConfig` (I/O) and a pure `resolveProject(config, flags) → Result`, with a single error channel. | B4 | `cli.ts:186-242` | ~120 | Low |
| 21 | Turn `verifyCommand` into three steps: gather → pure `summarizeVerify(results)` → render. Pass the domain explicitly instead of through the mutable `report.domain`. | B3, B8 | `cli.ts:349-430`, `cli.ts:77` | ~180 + ~40 | Low–Medium |
| 22 | Pure `planGeneratedFiles(files, existing) → Plan`, shared by the writer and the drift gate. Write through a temp file and `rename` in the same folder. | B7, C7 | `write.ts:17-36`, `verify/drift.ts:15-30`, `init.ts:60,68` | ~140 | Low |
| 23 | Load package assets once in the shell and pass them into `rules.ts` and `generate/code.ts`. Split `initProject` into a plan and its application. | B10, B11 | `rules.ts:20`, `generate/code.ts:44`, `cli.ts:24`, `init.ts` | ~40 + ~100 | Low |

### P2: portability and remaining hardening

| # | Task | Sources | Files | Size | Risk |
|---|---|---|---|---|---|
| 24 | Add `.gitattributes` (`* text=auto eol=lf`, generated files `-text` or `eol=lf`), and make the gate 4 message point at line endings. | D5 | repo root, `verify/drift.ts` | ~20 | Low |
| 25 | Make `check.mjs` and `test-tarball.mjs` portable (`shell: process.platform === 'win32'` or `npm.cmd`, `fs.mkdir` instead of `mkdir`), surface spawn errors, and clean up temp folders on SIGINT/SIGTERM. | D6, C8 | `scripts/check.mjs`, `packages/urn-forge/scripts/*.mjs` | ~60 | Low |
| 26 | CI matrix: add `windows-latest` and `macos-latest` (tests plus the e2e suite from task 1), and the latest Node LTS. | D6 | `.github/workflows/ci.yml` | ~20 | Low (more CI time) |
| 27 | Sort features and generated files by their POSIX-normalized relative path. | D12 | `verify/gherkin.ts`, `write.ts` | ~20 | Low |
| 28 | Reject a config whose default export is a Promise, and fix the fix text for config load errors. Reject non-JSON YAML (tags, complex keys, `<<`) with one problem, and silence the Node warning. | D9, D11 | `config.ts`, `manifest.ts` | ~90 | Low |
| 29 | Optional: an opt-in incremental `.tsbuildinfo` for gate 1 (about 750 ms saved on repeat runs). | C5 | `verify/completeness.ts` | ~80 | Medium |
| 30 | Optional: let `compile` and `diff` skip the full TypeScript compiler for `transpileModule` (emit JS checks directly, or use a lighter type stripper). | C3 | `compile.ts:26-29` | ~15–150 | Medium |

### Things the agents considered and decided not to recommend
- Streaming or async reads of manifests: inputs are tens of KB, so there is nothing to gain (C).
- Colour and `NO_COLOR` support: the CLI prints no colour, so there is nothing to change (A).
- Signal handlers in the CLI itself: it spawns no long-lived children and creates no temp files (C).

---

## Detailed findings by agent

The four sections below are the agents' full reports, with headings demoted one level. Each finding gives file and line, the anti-pattern with evidence, a remediation sketch, risk and PR size. Line numbers refer to commit `HEAD` of `claude/busy-dirac-rgxprm` on 2026-11-28.

## Agent A: CLI UX, ergonomics and POSIX compliance (`urn-forge` 0.2.2)

Scope: `packages/urn-forge/bin/urn-forge.js`, `src/cli.ts`, `src/diff/command.ts`, `src/write.ts`, `tests/cli.test.ts`, `docs/reference/cli.md`, `AGENTS.md`, `README.md`.
Every behaviour below was checked by running `node bin/urn-forge.js …` (Node v22.23.5) against `self/`, `tests/fixtures/booking` or empty scratch folders. No repository file was changed.

### Domain health score: 6.5 / 10

The core is sound. The command set is small and flat, exit codes are documented (0/1/2), `--format json` gives one self-validated object with stable `code` + `fix`, EPIPE is handled, and nothing is interactive or coloured, so the tool is safe in CI and pipes. Points come off for: one options table shared by all subcommands, so a flag meant for another command is accepted and ignored with no warning (A1); unhandled errors that print a raw stack trace, exit with the same code as a gate failure and break the "one JSON object" promise (A2); no per-command help (A3); and diagnostics that go to different streams depending on the command (A4). These are cheap to fix. Only A1 and A4 carry real compatibility risk.

### What the CLI already does well (do not recommend these)

- **Exit codes are distinct and documented**: 0 pass (also with warnings), 1 check failure, 2 usage error (`cli.ts:467`, `docs/reference/cli.md`, `AGENTS.md`). Unknown command → stderr + exit 2. Bad `--format` value → exit 2.
- **Strict parsing of unknown options**: `parseArgs({ strict: true })`, so `verify --nope` is an error (exit 2). No silent typos *for flags that are unknown everywhere* (but see A1).
- **The machine-readable mode works well**: `--format json` / `--format=json` on compile/verify/diff writes nothing until the end, then one object. A usage error also becomes a JSON `usage` problem with exit 2. Each object is checked against `self/` (`Report.end`, `cli.ts:106-129`). Every problem has a stable `code` and a `fix`.
- **EPIPE-safe**: `bin/urn-forge.js:5-10` swallows EPIPE/ERR_STREAM_DESTROYED. `verify | head -1` exits cleanly with the real exit code (1) and no stack trace. With stdout closed (`--version >&-`), it exits 0 quietly.
- **No colour and no TTY-dependent behaviour** (grep finds no `isTTY`, ANSI escapes, `NO_COLOR` or prompts). Output is identical in a terminal and a pipe. `NO_COLOR` support is moot. Do not add colour without also adding `NO_COLOR`/`--no-color`/`isTTY` handling.
- **Non-interactive, safe `init`**: it never prompts, refuses to overwrite and lists the files that already exist (exit 1), and validates `--namespace`/`--domain` as usage errors (exit 2).
- **`--` works for positionals** of `diff` (`diff -- a b`), and `--version` prints the bare version (script-friendly).
- **Clear diagnostic lines**: `file:line  severity  code  message` plus an indented `fix:` line. This is grep-able and stable.
- **Tests inject IO** (`main(argv, { cwd, stdout, stderr })`), so stream routing and exit codes can be unit-tested cheaply.

---

### Findings

#### A1. Every subcommand accepts every other subcommand's flags and ignores them without a warning
- **Where**: `src/cli.ts:171-181` (`OPTIONS`, one shared table), used by `compileCommand` `:325`, `verifyCommand` `:350`, `initCommand` `:433`.
- **Friction**: `strict: true` does not help, because every flag is "known" to every command:
  ```
  $ urn-forge verify --config self/urn-forge.config.ts --namespace zz --domain qq   → exit 0
  $ urn-forge compile --manifest … --out … --namespace zz --base main --core x     → exit 0 ("wrote …")
  $ urn-forge init --config whatever --base x                                       → exit 0 (writes starter project)
  ```
  `compile --base main` is the dangerous case. A user (or agent) who thinks compile checks the contract gets a silent success. `init --config foo` also silently ignores the config. The usage text itself scopes these flags ("init:", "verify:"), but the parser does not enforce that scope.
- **Remediation**: give each command its own options table and keep the shared parts as spreads:
  ```ts
  const PROJECT = { config: S, manifest: S, out: S } as const;
  const COMMAND_OPTIONS = {
    init:    { namespace: S, domain: S },
    compile: { ...PROJECT },
    verify:  { ...PROJECT, core: S, features: S, tsconfig: S, base: S },
  } as const;
  parseArgs({ args, options: COMMAND_OPTIONS.verify, strict: true, allowPositionals: true });
  ```
  `project()` reads `values['core']` etc. with `?.`, so compile simply passes `undefined`. Add one test per command for a foreign flag → exit 2. Optionally soften the change with one release of a stderr warning ("--base is not an option of compile; it is ignored") before making it an error.
- **Compat risk: Medium.** Scripts that currently pass ignored flags (for example a shared `FLAGS` variable for compile and verify that includes `--core`) start failing with exit 2.
- **PR size**: ~40 lines (+ ~25 test lines).

#### A2. Unhandled errors print a raw Node stack trace, exit 1 like a gate failure, and break the `--format json` contract
- **Where**: `src/cli.ts:503-517` (`catch` rethrows anything that is not a `UsageError`/`InternalContractError`), `src/write.ts:19-37` (unguarded `mkdir`/`writeFile`/`rm`), `bin/urn-forge.js:13-14`.
- **Friction**:
  ```
  $ urn-forge compile --manifest self/domain.manifest.yaml --out <a-file>/x --format json
  (stdout: empty)
  stderr: node:internal/fs/promises:858 … Error: ENOTDIR: not a directory, mkdir '…/afile/x'
          at async writeGenerated (…/src/write.ts:19:3) … Node.js v22.23.5
  exit=1
  ```
  `docs/reference/cli.md` says that with `--format json` the command writes "one JSON object to stdout, and nothing else", and the help says the same (`cli.ts:51`). Here a JSON consumer gets empty stdout and exit 1, which reads as "check failed". Text users see a 15-line internal stack. EACCES, EROFS and ENOSPC on `--out` behave the same way. `InternalContractError` (`:504-507`) also exits 1, so a bug in urn-forge cannot be told apart from a user's failing gate by exit code.
- **Remediation**:
  1. In `main`'s `catch`, turn Node system errors (`error.code` matching `/^E[A-Z]+$/`) into a problem: a new code `io-error` (or reuse `config-unreadable`/`manifest-unreadable` where it applies) with `file: display(io, error.path)` and `message: error.message`, so `report.end(...)` still writes one JSON object.
  2. Reserve a distinct exit code for "urn-forge itself failed" (`3`, or `70`/EX_SOFTWARE). Use it for `InternalContractError` and for any other unexpected throw, which prints `urn-forge: internal error: <message>` plus "set URN_FORGE_DEBUG=1 for the stack".
  3. Document 3 (or 70) in `cli.md`/`AGENTS.md` next to 0/1/2.
  ```ts
  } catch (error) {
    if (isSystemError(error)) { report.problem({ code: 'io-error', severity: 'error', file: …, message: error.message }); return report.end(1); }
    …
    report.problem({ code: 'internal-contract', severity: 'error', message: String(error) }); return report.end(3);
  }
  ```
- **Compat risk: Low.** It only changes paths that crash today. The new exit code applies only to bug or crash cases, but it needs a docs and `self/` contract update (the `code` enum and the report definitions).
- **PR size**: ~40 lines + new code in `codes.ts`/`self/` + ~30 test lines.

#### A3. No per-subcommand help: `urn-forge <cmd> --help` is a usage error, and `help <cmd>` ignores `<cmd>`
- **Where**: `src/cli.ts:490-495` (top-level only), `:325/:350/:433` and `diff/command.ts:38` (`help` is not an option, so parseArgs rejects it).
- **Friction**:
  ```
  $ urn-forge compile --help
  Unknown option '--help'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- "--help"
  <full usage>                                                   exit=2
  $ urn-forge help verify         → prints the global usage, exit 0
  $ urn-forge verify -h           → Unknown option '-h' …         exit=2
  ```
  `<cmd> --help` is the most common reflex (and what coding agents try first). Today it is "wrong", exit 2, and the hint suggests passing `--help` as a positional.
- **Remediation**: define a `help` record per command (synopsis, one-line description, the options that apply to it with defaults, one or two examples, exit codes). Before calling `parseArgs` in each command, check `args.includes('--help') || args.includes('-h')` (only before a `--`) and print that block to stdout with exit 0. Make `help <cmd>` print the same block, and `help <unknown>` → stderr, exit 2. The global usage keeps the 4-line synopsis plus "Run `urn-forge <command> --help` for its options".
- **Compat risk: Low.** It turns an exit-2 path into exit 0, and nobody depends on `compile --help` failing.
- **PR size**: ~80-100 lines (mostly help text) + ~20 test lines.

#### A4. The same kind of output goes to different streams depending on the command
- **Where**: `src/cli.ts:96` (`problem(..., stream = 'stderr')`), `:412` (verify passes `'stdout'`), `:424` vs `:428` (failed summary → stderr, passed summary → stdout), `diff/command.ts:59/63/80`.
- **Friction** (observed, text mode):
  | Output | compile | verify | diff |
  |---|---|---|---|
  | manifest/config problems | stderr | stderr | stderr |
  | gate problems | – | **stdout** | – |
  | result lines (files / gates / changes) | stdout | stdout | stdout |
  | "passed" summary | – | stdout | stdout |
  | "failed" summary | – | **stderr** | **stderr** |

  `urn-forge verify > log.txt` gives 304 lines in the file and one line, `verify failed: gate 1, 3, 4`, on the terminal. `urn-forge compile 2>/dev/null` hides every manifest error, but `verify 2>/dev/null` still shows gate errors. The final verdict line ends up on a different stream from the lines it summarises, so piping either stream alone gives an incomplete picture.
- **Remediation**: pick one rule and apply it everywhere. The one most consistent with the current JSON design: **everything that is the command's report (result lines, problems, the final verdict) goes to stdout; stderr is reserved for usage errors and internal/crash messages.** In code: change `Report.problem`'s default stream to `'stdout'`, make `report.err(...)` for the verdict lines `report.out(...)`, and delete the `stream` parameter. The opposite rule (all problems on stderr, results on stdout) is also defensible, as long as it is the same for all three commands and the verdict goes with the problems. State the rule in `docs/reference/cli.md`.
- **Compat risk: Medium.** CI scripts or editors that grep one stream (for example a problem matcher on stderr for compile) see lines move. The JSON mode is unaffected.
- **PR size**: ~15 lines + test assertions updated (`tests/cli.test.ts:146` asserts `err` for the diff verdict).

#### A5. The `--format` pre-scan ignores the `--` end-of-options marker and works only after the subcommand
- **Where**: `src/cli.ts:450-465` (`takeFormat`), `:475-478`.
- **Friction**:
  ```
  $ urn-forge diff a.yaml b.yaml -- --format json   → JSON output (the "--" did not stop option parsing)
  $ urn-forge diff a.yaml -- --format json          → "diff takes two manifests" (the token was eaten, not passed as a positional)
  $ urn-forge --format json verify                  → unknown command "--format", exit 2, text not JSON
  ```
  POSIX Utility Syntax Guideline 10: after `--`, every argument is an operand. A file literally named `--format` cannot be diffed. A wrapper that puts `--format json` before the subcommand (a common way to set global options) gets a text error.
- **Remediation**: stop scanning at the first `--` in `takeFormat` (`if (arg === '--') { rest.push(...args.slice(i)); break; }`). Simpler and more robust: declare `format: { type: 'string' }` in each command's own options table (see A1) and validate after `parseArgs`, so `--` handling comes for free. Optionally accept global options before the command, or reject them with "put --format after the command".
- **Compat risk: Low.** It only affects arguments after `--`, which nobody relies on for options.
- **PR size**: ~10 lines + 2 tests.

#### A6. Usage errors print the whole 20-line usage, the parseArgs hint is misleading, and bare `urn-forge` writes usage to stdout with exit 2
- **Where**: `src/cli.ts:500`, `:513` (`${message}\n\n${USAGE}`), `:490-495`.
- **Friction**: a one-character typo (`compile -c x`) gives `Unknown option '-c'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- "-c"` followed by the full usage of every command. The hint comes from Node's `parseArgs`. It is wrong for compile/verify/init, which take no positionals at all, and it makes the real cause (a typo, or a flag that belongs to another command) harder to see. Running `urn-forge` with no arguments prints usage on **stdout** with exit 2. A non-zero exit together with output on stdout is unconventional (`urn-forge > out.txt` stores the help text and fails).
- **Remediation**: catch `ERR_PARSE_ARGS_UNKNOWN_OPTION` and rewrite the message as `urn-forge compile: unknown option '-c'` (plus a did-you-mean from that command's own option names via a small edit-distance check, and "`--core` is an option of verify" when it belongs to another command). Follow it with `Run 'urn-forge compile --help' for its options.` instead of the full usage. For bare `urn-forge`, write usage to stderr (keep exit 2) or treat it as `--help` (exit 0). Choose one and document it.
- **Compat risk: Low.** It only changes the text on error paths.
- **PR size**: ~30 lines.

#### A7. The JSON report shape depends on which error path ran
- **Where**: `src/cli.ts:508-512` (usage → `report.end(2)` with no extras), `:328/:330` (compile failure → no `files`), `:355/:360` (verify failure → `gates`, `domains`, no `warnings`).
- **Friction** (key sets observed):
  ```
  verify --format json --nope         → ok,problems
  verify --format json --config nope  → ok,gates,domains,problems
  verify --format json (pass/fail)    → ok,gates,domains,warnings,problems
  compile --format json --nope / fail → ok,problems            (no files)
  diff --format json x y              → ok,changes,problems    (no from/to/breaking)
  ```
  `docs/reference/cli.md` lists `gates`, `warnings`, `domains` and `files` as keys of the report. A consumer doing `report.gates.length` or `report.warnings` gets a TypeError on some failures. diff already always sends `changes: []`, but compile and verify are not consistent with it.
- **Remediation**: give each command a constant "empty extras" object and spread it in every `report.end` call. Do this both in `main`'s usage catch (`EMPTY[command]`) and in the early returns: compile `{ files: [] }`, verify `{ gates: [], domains: [], warnings: 0 }`, diff `{ changes: [] }`. The `self/` report definitions can then make those keys required.
- **Compat risk: Low.** The change only adds keys.
- **PR size**: ~15 lines.

#### A8. Help text gaps: no description, no global flags or exit codes, inconsistent scope labels
- **Where**: `src/cli.ts:32-51`.
- **Friction**: the help starts with `urn-forge 0.2.2` and goes straight into `Usage:`. It has no one-line statement of what the tool does, and no line for `-h, --help` or `--version`. It also omits the exit codes, even though the documented 0/1/2 contract is the main thing a CI author needs, and a pointer to the docs or `AGENTS.md`. Scope labels are uneven: `--namespace`, `--core`, `--tsconfig` and `--report` say which command they belong to, but `--config`, `--manifest` and `--out` do not. They read as global, yet they do not apply to `init` or `diff` (diff "does not read the config", per the docs). `--format`'s value placeholder is `<format>`, while the synopsis says `text|json`.
- **Remediation**: add a description line under the header. Add a "Global options" block (`-h, --help`, `-V, --version`), an "Exit codes" block (`0 pass, 1 check failed, 2 usage error[, 3 internal error]`) and a "Docs:" line. Prefix the scope (`compile, verify:`) on `--config`/`--manifest`/`--out`. If A3 lands, most of this moves into per-command help and the global usage shrinks. `docs/reference/cli.md` quotes "the first lines of --help", so update that block in the same PR.
- **Compat risk: Low.** The change is help text only. (`docs/reference/cli.md` embeds it, and a doc test may compare it.)
- **PR size**: ~15 lines.

#### A9. Version and help flags: no `-V`/`-v`/`version`, and extra arguments are silently ignored
- **Where**: `src/cli.ts:490-498`.
- **Friction**: `urn-forge -V`, `-v` and `version` all give `unknown command …` + full usage, exit 2. `urn-forge --version extra` → `0.2.2`, exit 0, and `--help anything` → exit 0 (trailing args ignored). There are no short aliases for any option (`-c` for `--config`, `-f` for `--format`), which is unusual for a tool people type every few minutes. No short option exists at all.
- **Remediation**: accept `-V` (and `version` as a command) as aliases of `--version`. Reject extra arguments after `--version`. Consider a small, documented set of short aliases on the per-command tables (`-c/--config`, `-m/--manifest`, `-o/--out`, `-f/--format`). parseArgs supports `short:` directly.
- **Compat risk: Low.** The change only adds aliases. Rejecting `--version extra` is a theoretical break only.
- **PR size**: ~10 lines.

#### A10. Misleading path messages: "does not exist" for files that exist, a wrong verdict, and relative paths that climb to `/`
- **Where**: `src/cli.ts:256-260` and `diff/command.ts:47-51` (any read error → "the manifest does not exist"), `:358-359` (missing manifest → "verify failed: the manifest does not compile"), `:133-135` (`display` always uses `relative`).
- **Friction**:
  ```
  $ urn-forge compile --manifest self          (a directory)  → "self  error  manifest-unreadable  the manifest does not exist"
  $ urn-forge verify   (empty dir)                            → "…the manifest does not exist" then "verify failed: the manifest does not compile"
  $ urn-forge verify --core /dev/null                         → "../../../../../dev/null  error  core-not-found …"
  ```
  EISDIR and EACCES are reported as "does not exist", which sends the user looking for a missing file. The verify verdict states the wrong cause. A path outside the cwd is shown as a long `../` chain instead of the absolute path.
- **Remediation**: switch on `error.code` (`ENOENT` → "does not exist", `EISDIR` → "is a folder, not a file", `EACCES` → "cannot be read: permission denied", otherwise `error.message`). In `verifyCommand`, say "verify failed: the manifest cannot be read or does not compile", or derive the cause from the problems. In `display`, return the absolute path when `relative()` starts with `..` past the repo or cwd root (for example when it has more than 2 leading `..` segments, or simply whenever it starts with `..`).
- **Compat risk: Low.** Messages change, codes do not.
- **PR size**: ~25 lines.

#### A11. Write errors on stdout other than EPIPE crash with a stack trace from the bin's own handler
- **Where**: `bin/urn-forge.js:6-9`.
- **Friction**: `urn-forge --help > /dev/full` →
  ```
  file:///…/bin/urn-forge.js:8
      if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_DESTROYED') throw error;
  Error: ENOSPC: no space left on device, write … (stack) …   exit=1
  ```
  A full disk or a broken redirect target (ENOSPC, EIO) shows a stack trace that points at urn-forge's own code.
- **Remediation**: replace `throw error` with `process.stderr.write(\`urn-forge: cannot write output: ${error.message}\n\`); process.exit(error.code === 'EPIPE' ? process.exitCode ?? 0 : 74 /* EX_IOERR */)`. Keep the EPIPE branch silent as today.
- **Compat risk: Low.** It only affects crash paths.
- **PR size**: ~6 lines.

---

### Doc and behaviour mismatches (covered by the findings above)
- `docs/reference/cli.md` and `--help` say `--format json` gives "one JSON object to stdout, and nothing else". This breaks on any I/O error (A2), and when `--format` comes before the command (A5).
- `docs/reference/cli.md`: "`usage` comes as a problem only with `--format json`; as text, the usage shows". `diff a.yaml` in text mode prints only a one-line message, with no usage (`diff/command.ts:39-44`). That behaviour is arguably the better one, so update the doc or make all usage errors short (A6).
- The JSON key table in `cli.md` implies `gates`/`warnings`/`files` are always present. They are not (A7).
- The exit-code contract (0/1/2) is silent about crashes, which exit 1 (A2).

### Considered and not recommended
- **`--quiet`**: verify prints about 300 lines on a broad failure, but `--format json` already serves tools, and the output is one problem per two lines. It is a nice-to-have only.
- **Colour / `NO_COLOR` / TTY detection**: none exists, and none is needed. The plain output is pipe-safe. If colour is ever added, it must honour `NO_COLOR`, `FORCE_COLOR` and `isTTY`.
- **Command hierarchy**: four flat verbs is the right shape. Do not add nesting.

### Summary table
| ID | Title | Risk | PR lines |
|---|---|---|---|
| A1 | Foreign subcommand flags accepted and silently ignored (shared `OPTIONS`) | Medium | ~65 |
| A2 | Unhandled errors: raw stack, exit 1 = gate failure, no JSON object | Low | ~70 |
| A3 | No per-subcommand help (`<cmd> --help` is exit 2; `help <cmd>` ignores cmd) | Low | ~100 |
| A4 | Same kind of output split across stdout and stderr per command | Medium | ~15 + tests |
| A5 | `--format` pre-scan ignores `--`, and is not accepted before the command | Low | ~12 |
| A6 | Usage errors dump full usage with a misleading parseArgs hint; bare `urn-forge` → stdout + exit 2 | Low | ~30 |
| A7 | JSON report keys vary by error path | Low | ~15 |
| A8 | Help text lacks description, global flags, exit codes; uneven scope labels | Low | ~15 |
| A9 | No `-V`/`version` alias; trailing args after `--version` ignored; no short options | Low | ~10 |
| A10 | Path messages: "does not exist" for dirs/EACCES, wrong verify verdict, `../../../..` paths | Low | ~25 |
| A11 | Stdout write errors other than EPIPE crash with a stack trace from the bin | Low | ~6 |

Side note for the fleet (not in my domain): `compile --out /proc/nope/x` spun at about 80% CPU for over 2 minutes and never exited. It looks like `mkdir(…, { recursive: true })` under `/proc` (`src/write.ts:19`), probably a Node quirk, and it is unlikely in real use. Another agent's identical run was also stuck at the time.

---

## Agent B: architectural integrity and Functional Core / Imperative Shell

Scope: `packages/urn-forge/src` (plus `bin/`, `self/core.ts` where it closes import loops, and `tests/` for testability). Nothing in the repository was modified. Line numbers are taken from the current working tree.

**Domain health score: 7 / 10**

### 1. Module map

Method: I grepped `src/` for `process.*`, `console.*`, `Date.now`, `new Date`, `node:fs`, `node:child_process`, dynamic `import()` and `throw`. I also ran a static import-graph cycle scan over `src/` and `self/` (script at `scratchpad/cycles.py`).

| Class | Modules | Evidence |
|---|---|---|
| **Pure core** | `model.ts`, `manifest.ts`, `compile.ts`, `diagnostics.ts`, `codes.ts`, `urn.ts`, `cel/*` (parse, check, print, functions, time), `generate/emit-cel.ts`, `generate/runtime.ts`, `diff/classify.ts`, `gherkin/cells.ts`, `verify/gherkin.ts`, `verify/contract.ts`, `config.ts` (`configProblems`, `defineConfig`) | None of these import fs or child_process, and none use process or console. `compileManifest(text)` takes text, not a path. Gates 3 and 5 take `{ path, text }` feature files. The `new Date(...)` calls in `runtime.ts` are deterministic arithmetic, not clock reads. Nothing in `src/` calls `Date.now()`. |
| **Core with hidden asset I/O** | `rules.ts` (`readFileSync` of `standard.manifest.yaml`, line 20, cached), `generate/code.ts` (`readFileSync` of `runtime.ts`, line 44, not cached) | These are reads of package assets, not of user paths. See B10. |
| **Core that calls the self-harness** | `verify/types.ts` (`gateOutcome` → `decide`), `verify/gherkin.ts`, `verify/contract.ts`, `diff/command.ts` → `self.ts` | This is a deliberate dogfooding design: `decide()` can throw `InternalContractError`. It causes the import cycles in B1. |
| **Shell (adapters)** | `cli.ts`, `write.ts`, `config.ts` (`loadConfig`: dynamic import), `verify/completeness.ts` and `verify/boundary.ts` (tsc `Program` over real paths; `boundary.ts` walks fs), `self.ts` (bridge to the `self/` harness) | Gates 1 and 2 need real paths because tsc does. That is justified. |
| **Mixed** | `diff/command.ts` (argv parsing + fs + pure `allowsBreaking`), `verify/drift.ts` (fs reads + pure comparison), `init.ts` (planning interleaved with writes), `gherkin/steps.ts` (cucumber adapter + the pure `STEPS` constant), `cli.ts` (`project()`, `verifyCommand`, `baseContract` and `lineOf` hold domain logic) | See the findings. |

Side-effect census:
- `process.*` / `console.*` appear only in `bin/urn-forge.js` (lines 6, 14) and in the default `CliIo` of `cli.ts:468`.
- Nothing calls `process.exit`. The bin sets `process.exitCode`.
- `child_process` appears only in `cli.ts:294`.
- Nothing reads `process.env`.

### 2. What is already done well

- **Injectable I/O seam at the entrypoint.** `main(argv, io: CliIo)` (`cli.ts:468`) returns an exit code and never calls `process.exit`. `bin/urn-forge.js` is 14 lines. Every CLI test drives `main` in-process with captured stdout and stderr (`tests/cli.test.ts:24-29`, `domains.test.ts:27`, `agents.test.ts:39`, `starter.test.ts:20`). No test spawns the CLI.
- **Text-in compiler.** `compileManifest(text)`, `generate(compiled, source)` (which returns `GeneratedFile[]` and does not write them), `classify(old, next)`, `gherkinGate({ features: [{path,text}] })` and `contractGate({ old, next, at })` are pure. The test suite mostly targets them directly through `src/index.ts`, `compile.ts` and `diff/classify.ts` (14 of 19 test files never touch `cli.ts`).
- **Diagnostics are values.** Manifest problems are collected in `Diagnostics` and returned as data, not thrown. `loadConfig` and `initProject` return `{ ok, ... }` unions. `configProblems` is a pure validator split from the importer.
- **The JSON report is checked against its own contract** before it is written (`Report.end`, `cli.ts:121`).
- **The public API (`src/index.ts`) exports only pure functions and types.** `cli.ts` is not reachable through `package.json#exports`, so refactors inside the shell carry little public-API risk. The public subpaths are `.`, `./config`, `./cucumber` and `./register-tsx`.
- **Lazy loading of the diff command** (`cli.ts:487`).
- **Graceful EPIPE handling** in the bin.

### 3. Findings

#### B1: Runtime import cycles through `self.ts` because pure decisions live in shell modules
- **Where:** `src/self.ts:7` imports `../self/core.js`. `self/core.ts:6` imports `allowsBreaking` from `src/diff/command.ts` (a shell command module). `self/core.ts` also imports `src/verify/contract.ts` (`allowsWeaker`) and `src/verify/types.ts` (`gatePasses`, `GATES`, `uncoveredRules`). Those modules import `../self.js` back (`diff/command.ts:11`, `verify/contract.ts:23`, `verify/types.ts:2`).
- **Evidence (runtime-only edges, type imports excluded):**
  ```
  src/self.ts -> self/core.ts -> src/diff/command.ts -> src/self.ts
  src/self.ts -> self/core.ts -> src/verify/types.ts -> src/self.ts
  src/self.ts -> self/core.ts -> src/verify/contract.ts -> src/self.ts
  ```
  When type imports are included, `cli.ts` also joins the loop through `diff/command.ts` → `import type { CliIo, Report } from '../cli.js'` (see B2). The `cel/*` loop (check ↔ functions ↔ parse ↔ print) is type-only and harmless.
- **Anti-pattern:** a pure function (`allowsBreaking`, `diff/command.ts:28`) sits in the module that parses argv and reads files. Pure helpers (`gatePasses`, `uncoveredRules`) share a module with `gateOutcome`, which calls `decide()`. ESM makes this work today only because each binding is read after module evaluation finishes. Any future top-level use, such as `const X = decide(...)` at module scope, would hit a TDZ `ReferenceError`.
- **Remediation:**
  - New `src/diff/version.ts` (pure, no imports):
    ```ts
    export interface Version { major: number; minor: number; patch: number; prerelease: boolean }
    export function parseVersion(text: string): Version
    export function allowsBreaking(from: string, to: string): { allowed: boolean; why: string } // self: the implementation of judge_version_change
    export function allowsWeaker(from: string, to: string): { allowed: boolean; why: string }   // self: the implementation of judge_weaker_contract
    ```
  - New `src/verify/gate-rules.ts` (pure): `GATES`, `gatePasses`, `uncoveredRules`. `verify/types.ts` keeps `GateProblem`, `GateOutcome` and `gateOutcome` (which calls `decide`).
  - `self/core.ts` imports only the pure modules. `diff/command.ts` and `verify/contract.ts` re-export the moved names for one release.
  - Keep the `// self: the implementation of …` markers, because `tests/self.test.ts:92-107` scans for direct calls of declared functions.
  - Add a cycle check to CI, for example `madge --circular --extensions ts src self`, or a small vitest test that walks the imports.
- **Risk: Low.** None of the moved names is exported from `src/index.ts`. Deep imports are blocked by `exports`. Tests import `allowsBreaking` from `diff/command.js`, and the re-export covers them.
- **PR size:** about 70 lines.

#### B2: Layering inversion: `diff/command.ts` depends on `cli.ts`; the presentation layer lives in the entrypoint
- **Where:** `src/diff/command.ts:9` (`import type { CliIo, Report } from '../cli.js'`). `cli.ts:26-130` (`CliIo`, `Problem`, `Format`, `Report`) and `cli.ts:521-525` (`fixFor`).
- **Anti-pattern:** a feature module under `diff/`, next to the pure `classify.ts`, imports from the top-level entrypoint. `cli.ts` (527 lines) holds five concerns:
  - the I/O port
  - report rendering and the JSON-contract self-check
  - project resolution
  - a git adapter
  - three command handlers
- **Remediation:**
  - `src/shell/report.ts`: `CliIo`, `Problem`, `Format`, `Report`, `fixFor`, `display(cwd, path)`, `showDiagnostics`.
  - `src/shell/commands/{compile,verify,init,diff}.ts`: each `(io: CliIo, report: Report, argv: readonly string[]) => Promise<number>`. Move `diff/command.ts` here, minus `allowsBreaking` (moved in B1).
  - `src/cli.ts` shrinks to `USAGE`, `takeFormat`, `main` (dispatch plus catch), about 120 lines. It re-exports `Report`, `lineOf` and `UsageError` so tests keep working.
- **Risk: Low.** This is internal only, and `tests/*.test.ts` import `main` and `lineOf` from `cli.js`, which the re-exports keep. Split it into two PRs: (a) move `Report` and `CliIo`; (b) move the command handlers.
- **PR size:** about 200 lines each. Mostly moves.

#### B3: `verifyCommand` embeds verification policy in the handler
- **Where:** `src/cli.ts:349-430`.
- **Anti-pattern:** the handler interleaves file reads, tsc program construction, git, gate execution and printing with domain decisions:
  - deduplicating shell problems across domains: `const key = \`${problem.code} ${problem.file} ...\`; if (shellProblems.has(key)) return false;` (lines 383-388)
  - counting warnings, including manifest warnings (lines 367 and 411)
  - building the failure summary: `failures.push(several ? \`${result.urn} gate ...\` : ...)` (line 417)
  - deciding pass or fail (line 423)

  None of this can be unit-tested without a project on disk, a tsconfig and real tsc.
- **Remediation:** split it into gather → decide → render.
  ```ts
  // src/verify/run.ts (pure)
  export interface DomainOutcomes { urn: string; manifestWarnings: number; outcomes: GateOutcome[] }
  export interface VerifyResult { passed: boolean; warnings: number; failures: string[]; domains: {...}[]; gates: {...}[]; ran: string }
  export function summarizeVerify(domains: readonly DomainOutcomes[]): VerifyResult   // dedupes shell problems, counts, summarizes

  // src/shell/commands/verify.ts (shell)
  async function gatherDomain(io, project, compiled, base?): Promise<DomainOutcomes>   // fs, tsc, git, drift reads
  function renderVerify(report: Report, result: VerifyResult): number                  // the only place that prints
  ```
- **Risk: Low to Medium.** The text and JSON output must stay byte-identical. `verify_report` is validated against `self/` at runtime, and `cli.test.ts`, `domains.test.ts` and `agents.test.ts` pin the lines, so regressions would be caught.
- **PR size:** about 180 lines.

#### B4: `project()` mixes config I/O, pure path resolution and two error channels
- **Where:** `src/cli.ts:186-242`.
- **Anti-pattern:** `existsSync` and `loadConfig` (I/O) sit next to path-resolution rules ("a path of the config is relative to the config; a path of a flag to the working directory") and domain-clash validation. The function both emits `report.problem(...)` and `throw new UsageError(...)` (line 204). So one validation step reports through two channels, and the exit code of the thrown one depends on the catch in `main`.
- **Remediation:**
  ```ts
  // src/project.ts (pure)
  export type Flags = Partial<Record<'manifest'|'out'|'core'|'features'|'tsconfig', string>>;
  export function resolveProject(config: UrnForgeConfig, flags: Flags, at: { cwd: string; configPath: string }):
    | { ok: true; project: Project }
    | { ok: false; usage: string }                    // replaces the throw at line 204
    | { ok: false; problems: { message: string; path?: string }[] };  // clash messages
  // shell keeps: locate config (existsSync) + loadConfig, then calls resolveProject and maps the result to Report / UsageError.
  ```
  Unit tests can then cover flag-versus-config precedence and clashes without temp directories. Today this needs `domains.test.ts` to write a config file and run tsx.
- **Risk: Low.** Internal. Messages stay unchanged.
- **PR size:** about 120 lines including tests.

#### B5: Git adapter hard-wired into `cli.ts`; gate 5 testable only with a real git repository
- **Where:** `src/cli.ts:292-322` (`baseContract`).
- **Anti-pattern:** `execFileSync('git', args, { cwd: dirname(d.manifestPath), ... })` is mixed with path mapping, `compileManifest` and display. There is no port, so `tests/agents.test.ts:187-201` must `git init` and `git commit` in a temp directory. The `git ls-tree` and `git show` calls at lines 317 and 320 are **outside any try**: a `maxBuffer` overflow or a racing tree crashes the command (see B6).
- **Remediation:**
  ```ts
  // src/shell/git.ts
  export interface TreeReader {
    root(): string | undefined;
    hasCommit(ref: string): boolean;
    show(ref: string, treePath: string): string | undefined;
    list(ref: string, treeDir: string): string[];
  }
  export function gitTreeReader(cwd: string): TreeReader   // execFileSync lives only here, every call try-wrapped

  // src/verify/base.ts (pure given the reader)
  export function baseContract(reader: TreeReader, paths: { manifest: string; features: string }, ref: string, show: (p: string) => string): ContractGateInput['old']
  ```
  Tests can then pass an in-memory `TreeReader`, and the existing git-backed test stays as one integration test.
- **Risk: Low.** Internal. Messages stay unchanged.
- **PR size:** about 130 lines.

#### B6: Unexpected I/O errors escape as stack traces, which breaks the `--format json` contract and exit-code semantics
- **Where:**
  - `src/cli.ts:503-517`: the `main` catch rethrows anything that is not `InternalContractError` or `UsageError` (`throw error;`).
  - `bin/urn-forge.js:14`: a top-level-await rejection.
  - Throw sites with no handling: `write.ts:19` (`mkdir`), `write.ts:26` (`writeFile`), `write.ts:149` (`rm`), `cli.ts:377` (`readFileSync` of each feature), `cli.ts:317` and `cli.ts:320` (git), and `rules.ts:23`/`:26` (`throw new Error('the standard set has problems')`).
- **Evidence (reproduced in the scratchpad; the repo was not touched):**
  ```
  $ urn-forge compile --manifest <fixture> --out afile/gen --format json   # afile is a regular file
  exit=1, stdout: (empty)
  stderr: Error: ENOTDIR: not a directory, mkdir '.../afile/gen'
      at async writeGenerated (src/write.ts:19:3) at async compileCommand ...
  ```
  An agent or CI consumer that asked for JSON gets no object, and gets an exit code it cannot tell apart from an ordinary failure (1). The documented codes are 0, 1 and 2.
- **Remediation:**
  1. Catch at the I/O sites and turn failures into problems: `writeGenerated` returns `{ status: 'failed', path, message }` entries, and the compile handler reports them under a new code, for example `output-unwritable`. Wrap the feature reads into `features-unreadable`.
  2. Add a last-resort branch in `main`:
     ```ts
     report.problem({ code: 'internal-error', severity: 'error', message: (error as Error).message });
     return report.end(1);   // JSON consumers always get one object
     ```
- **Risk: Medium.** New `Code` values touch `codes.ts`, the `self/` contract (`fix_of`) and the documented code list, which are consumer-visible stable contracts. Ship (2) first with a single new code, then (1).
- **PR size:** about 60 lines for (2); about 100 lines for (1).

#### B7: Drift gate and writer duplicate the generated-file plan, and both take a directory path instead of contents
- **Where:** `src/write.ts:17-36` and `src/verify/drift.ts:15-30`. Both loop over `files`, read `join(dir, file.path)`, compare, then run `listGenerated(dir)` to find stale files.
- **Anti-pattern:** the comparison policy (unchanged, differs, missing, stale) is written twice, and each copy is welded to `fs/promises`. `driftGate(outDir, files, show)` cannot be tested without a directory.
- **Remediation:**
  ```ts
  // src/generate/plan.ts (pure)
  export type PlanEntry =
    | { name: string; status: 'unchanged' }
    | { name: string; status: 'write'; firstDifferentLine?: number; existed: boolean }
    | { name: string; status: 'remove' };
  export function planGenerated(existing: ReadonlyMap<string, string>, files: readonly GeneratedFile[]): PlanEntry[]

  // shell: readGeneratedDir(dir): Promise<Map<string,string>>   (listGenerated + reads)
  // writeGenerated(dir, files) = apply(planGenerated(await readGeneratedDir(dir), files))
  // driftGate({ outDir, plan, show }): GateOutcome   (pure: maps plan entries to drift problems)
  ```
- **Risk: Low.** Internal. `driftGate` is not public.
- **PR size:** about 120 lines.

#### B8: Ambient mutable `report.domain` creates temporal coupling
- **Where:** `src/cli.ts:77` (field), with writes at lines 254, 263, 276, 373 and 420.
- **Anti-pattern:** `report.domain = result.urn;` makes `problem()` attach a domain implicitly (line 97). Whether a problem carries a domain depends on call order: `compileDomain` resets it, then sets it only after compiling. That is hidden state in what should be a pure accumulator.
- **Remediation:** remove the field and add `report.scoped(urn?: string): { problem(p: Problem, stream?, indent?): void }`, or pass `domain` explicitly in each `Problem` literal. The gathered `DomainOutcomes` from B3 already carry `urn`.
- **Risk: Low.** JSON `domain` fields must stay identical, and existing tests in `domains.test.ts` would catch a change.
- **PR size:** about 40 lines.

#### B9: The core pulls in the Cucumber runtime through a constant
- **Where:**
  - `src/gherkin/steps.ts:20`: `import { Before, Then, When, type DataTable } from '@cucumber/cucumber';`
  - `steps.ts:25`: the pure `STEPS` regex table, defined in the same file.
  - `STEPS` is imported by `src/verify/gherkin.ts:15` (gate 3, otherwise pure) and by `self/core.ts:8`. `src/self.ts` loads `self/core.ts` statically from `cli.ts`, so every CLI invocation loads `@cucumber/cucumber`, including `--version`. Loading `@cucumber/cucumber` alone took about 72 ms in a measurement here.
- **Anti-pattern:** a test-runner adapter is a dependency of the compiler core and of the self-harness.
- **Remediation:** move `STEPS` to `src/gherkin/patterns.ts`, which has no imports. `steps.ts` re-exports it (`export { STEPS } from './patterns.js'`) so the public `urn-forge/cucumber` subpath is unchanged. `verify/gherkin.ts` and `self/core.ts` import from `patterns.ts`.
- **Risk: Low.** The public subpath keeps the same export.
- **PR size:** about 20 lines.

#### B10: Hidden package-asset reads inside core modules
- **Where:**
  - `src/rules.ts:20`: `readFileSync(new URL('./standard.manifest.yaml', import.meta.url))`, lazily cached.
  - `src/generate/code.ts:44`: `readFileSync(new URL('./runtime.ts', import.meta.url))`, re-read and re-chunked on every `generate`.
  - `src/cli.ts:24`: `VERSION` read from `package.json` at module evaluation (an import-time side effect).
- **Anti-pattern:** `compileManifest(text)` is presented as pure, but it depends on the on-disk layout of `src/`. This would break under bundling or a compiled `dist/` without copying the assets. Failures surface as raw `Error`s (see B6).
- **Remediation:** add a single choke point, `src/assets.ts`, with `export function asset(name: 'standard.manifest.yaml' | 'runtime.ts'): string`, memoized, so all package-relative reads live in one shell-ish file. Cache `runtimeDeclarations()` in `generate/code.ts`. Read `VERSION` lazily inside `main`, as `version()`. Inlining the assets as TS string modules is optional and only worth it if a build step is ever introduced.
- **Risk: Low.** `standard` is public through `index.ts`, but its signature does not change.
- **PR size:** about 40 lines.

#### B11: `initProject` interleaves planning with writes
- **Where:** `src/init.ts:44-70`.
- **Anti-pattern:** template discovery, existence checks, placeholder substitution, the `package.json` merge policy (`pkg['type'] = 'module'; pkg['scripts'] = {...}`), the output-line wording and the writes all run in one loop. The merge and substitution policy can only be tested by running `init` in a real directory (`starter.test.ts`, `agents.test.ts:167-175`).
- **Remediation:**
  ```ts
  export function planInit(input: { templates: ReadonlyMap<string,string>; existing: ReadonlySet<string>; packageJson?: string; cwdName: string; namespace: string; domain: string }):
    | { ok: false; message: string }
    | { ok: true; writes: { path: string; text: string }[]; lines: string[] }
  export async function initProject(options): Promise<...>   // gather → planInit → apply writes
  ```
- **Risk: Low.** Internal. The output lines stay identical.
- **PR size:** about 100 lines.

### 4. Cross-cutting observations (no separate finding)

- **`CliIo` is a partial port.** It abstracts `cwd`, `stdout` and `stderr` only. Filesystem, git, config import and tsc stay ambient, so the in-process CLI tests still need real fixture copies under `tests/fixtures/.cli-*`. B5 and B7 cover the highest-value seams. Do not try to abstract tsc for gates 1 and 2: they need real paths by nature.
- **Thrown versus returned errors.**
  - Domain problems are returned values (good).
  - `CelSyntaxError` is thrown inside the parser and caught locally, which is fine.
  - `InternalContractError` is thrown from deep in the core (`decide`) and mapped in `main`. That is acceptable because it means "bug in urn-forge".
  - `UsageError` is thrown from `project()` (B4).
  - `diffCommand` handles its own usage error by returning `report.end(2)` instead of throwing `UsageError` (`diff/command.ts:39-43`). That makes a third convention, and in text mode it prints no `USAGE`. Fold this into B2 when diff moves to `shell/commands/diff.ts`.
- **`compile.ts:290-293`** evaluates transpiled generated code with `new Function(...)` inside the compiler, so rule arguments are checked by the same code that ships. It is pure in effect and intentional, so it is not an FC/IS defect. Record it for the security agent.

### 5. Suggested PR order

B9 (20) → B1 (70) → B6-part-2 (60) → B2a (200) → B2b (200) → B7 (120) → B5 (130) → B4 (120) → B3 (180) → B8 (40) → B10 (40) → B6-part-1 (100) → B11 (100). Every PR is under 250 lines.

### 6. Score justification: 7/10

**Strong:**
- The compiler, CEL, model, diff classification and gates 3 and 5 are a genuinely pure, text-in core.
- `main` is injectable and returns an exit code.
- Nothing calls `process.exit`, and no clock or env reads are scattered through the code.
- The public API exposes only pure functions.
- Tests exercise the CLI in-process, never by spawning it.

**Weak:**
- `cli.ts` is a 527-line mixed module holding real policy (verify aggregation, project resolution, git).
- The presentation layer sits in the entrypoint, and a feature module depends on it.
- There are real runtime import cycles through the self-harness, caused by pure helpers living in shell modules.
- Unhandled I/O exceptions break the JSON output contract (reproduced).
- Write and drift duplicate a plan that should be one pure function.

None of these is a public-API problem, and all are fixable in small PRs. That is why the score is 7 and not lower.

---

## Agent C: startup latency, I/O and resource efficiency of `urn-forge`

Scope: `packages/urn-forge` (bin/urn-forge.js -> src/cli.ts), urn-forge 0.2.2, Node v22.23.5, 4 vCPU Linux container.
No repository file was modified. The only change outside the scratchpad is `node_modules/` at the repo root, created by `npm ci` as the brief asked. All profiles, scripts and measurements are in this scratchpad directory (`prof/`, `bench.sh`, `trace.mjs`, `stub.mjs`, `gates.mts`, `host.cjs`, `incr.cjs`, `lineof.mts`).

### Domain health score: 5 / 10

I/O hygiene is good: no temp files in the CLI, unchanged files are not rewritten, output is flushed correctly, EPIPE is handled, and git is spawned safely and only on request. Startup latency is poor. `--help` and `--version` take about 0.74 s and about 200 MB RSS, because the module graph loads the whole TypeScript compiler and `@cucumber/cucumber` before any argument is read. If the 2 heavy packages are replaced with empty stubs, `--help` drops to 157 ms and 72 MB. `verify` takes about 3.1 s. The TypeScript type check accounts for most of that time and is needed. Around 0.9 s of it is avoidable: one program is rebuilt from scratch, and TypeScript is imported through the slow ESM-to-CJS path. Most fixes are small and low risk.

### Measurements

Wall clock is the median of 7 runs (5 or 3 where noted), from `bench.sh`. The numbers come from the quietest run of the session. Earlier runs, while the machine was under load, were 10-30% slower, for example `verify` at 4.15 s.

| Command | Median | Min-max | Max RSS |
|---|---|---|---|
| `node -e 0` (baseline) | 22 ms | 18-28 | |
| `node -e "print version from package.json"` | 25 ms | 23-32 | |
| `urn-forge --help` | **738 ms** | 713-794 | 203 MB |
| `urn-forge --version` | **724 ms** | 700-765 | |
| `urn-forge compile --config self/urn-forge.config.ts` (all unchanged) | **1034 ms** | 1003-1123 | 221 MB |
| `urn-forge diff self/domain.manifest.yaml self/domain.manifest.yaml` | **1132 ms** | 1104-1178 | |
| `urn-forge verify --config self/urn-forge.config.ts` | **3110 ms** | 3065-3297 | 415 MB |
| `urn-forge verify ... --base HEAD` (3 runs) | 3584 ms | 3525-3835 | |
| `--help` with `typescript` and `@cucumber/cucumber` stubbed (`stub.mjs`, experiment only) | **157 ms** | 153-173 | 72 MB |
| tsx `register()` plus `codes.ts` and `config.ts` only (floor for a lazy CLI) | 61 ms | 58-65 | |

Module counts (`trace.mjs`, a `registerHooks` load hook): `--help` loads **345 modules**. These include `typescript` (one 9 MB CJS file), 78 `@cucumber/cucumber` files, 44 `regexp-tree`, 20 `@cucumber/cucumber-expressions`, 16 `@cucumber/gherkin`, 72 `yaml`, `luxon`, `cli-table3` and others. `verify` loads 346, so `--help` loads almost exactly the module graph that `verify` needs.

Cost of each package when imported alone (median of 7):

| Import | Plain node | After tsx `register()` |
|---|---|---|
| `typescript` via ESM `import` | 336 ms | **605-622 ms** |
| `typescript` via `createRequire()` | 184 ms | **248-258 ms** |
| `@cucumber/cucumber` | 94 ms | 340 ms |
| `@cucumber/gherkin` + `@cucumber/messages` | 44 ms | |
| `yaml` | 43 ms | |
| `src/self.ts` (the self/ harness) after `register()` | | 834-842 ms, because it pulls in TS and cucumber (see C1) |

The CPU profile of `--help` (`prof/help`) covers 991 ms of samples. Of that, 589 ms is in Node's ESM loader and 269 ms in tsx's hooks. The main costs are `cjsPreparseModuleExports`/`parseCJS` (cjs-module-lexer over typescript.js) at 169 ms, `detectModuleFormat` at 133 ms and `maybeCacheSourceMap` at 77 ms. Only about 1 ms is urn-forge code.

The CPU profile of `verify` (`prof/verify`) covers 7.2 s of samples with the profiler on. `typescript` accounts for 5283 ms, GC for 685 ms, tsx for 219 ms and yaml for 99 ms. urn-forge's own code is under 60 ms.

Time per phase of `verify` on self/ (`gates.mts`, 3 runs):

| Phase | Time |
|---|---|
| `import('typescript')` under tsx | 671-790 ms |
| `coreProgram()` (`ts.createProgram`, 584 source files) | 537-827 ms |
| `completenessGate()` (`getPreEmitDiagnostics`) | 1057-1159 ms |
| `boundaryGate()`, which builds a second program from scratch | 465-586 ms |
| The same second program with `oldProgram` | 423-468 ms |
| The same second program with a caching `CompilerHost` (`host.cjs`) | **51-52 ms** (default host: 596-605 ms) |
| Gate 1 with `createIncrementalProgram` and a warm `.tsbuildinfo` (`incr.cjs`) | **766-792 ms** (full: 1531-1551 ms) |

Other measurements:
- **compile** (`prof/compile`, 1205 ms of samples): `checksOf` takes 236 ms, of which `ts.transpileModule` is 221 ms. Real manifest work (`readManifest`, model, rules, generate) is about 90 ms.
- **`lineOf()`** (`lineof.mts`, 68 KB self manifest): 15.5 ms per call. `compileManifest` takes 128 ms per call.
- **tsx transform cache** (`/tmp/tsx-0`, 137 entries, 2.2 MB) works. With `TSX_DISABLE_CACHE=1`, `--help` takes 909 ms instead of about 740 ms.
- **`NODE_COMPILE_CACHE`** (V8 code cache, 6 MB): `--help` dropped from 729 to 634 ms, `verify` from 3150 to 3042 ms and `compile` from about 1034-1062 to 917 ms.

### Findings

#### C1: `--help` and `--version` load the TypeScript compiler and Cucumber, through eager imports and the self/ harness
- **Where:**
  - `src/cli.ts:9-22`: static imports of `compile.js` (which imports `typescript` at `compile.ts:7`), `verify/completeness.js` and `verify/boundary.js` (`typescript`), `verify/gherkin.js` and `verify/contract.js` (`@cucumber/gherkin`), and `self.js`.
  - `src/self.ts:9`: imports `../self/core.js`.
  - `self/core.ts:6,8,12`: imports `src/diff/command.js` (which imports `compile.js` and so `typescript`), `src/gherkin/steps.js` and `src/verify/contract.js`.
  - `src/gherkin/steps.ts:20`: `import { Before, Then, When } from '@cucumber/cucumber'`. `src/verify/gherkin.ts:15` and `self/core.ts:8` import this module only for the `STEPS` regex constant.
  - `src/cli.ts:487`: the lazy `await import('./diff/command.js')` does nothing, because `self/core.ts` has already loaded that module eagerly.
- **Anti-pattern and evidence:** `--help` loads 345 modules, including all of `typescript` and 78 `@cucumber/cucumber` files plus their dependencies. Neither package is used. It takes 738 ms and 203 MB RSS. With those 2 packages replaced by empty modules (`stub.mjs`), `--help` takes 157 ms and 72 MB. `--version` (724 ms) and usage errors behave the same way. `init` loads the same graph without needing it.
- **Remediation:**
  1. Move the step texts into a module that does not import Cucumber:
     ```ts
     // src/gherkin/step-texts.ts  (no imports)
     export const STEPS = { run: /^I run "([^"]+)" with:$/, /* … */ } as const;
     // src/gherkin/steps.ts
     export { STEPS } from './step-texts.js';
     ```
     Then point `verify/gherkin.ts` and `self/core.ts` at `step-texts.js`. Do the same for `allowsBreaking`: move it from `diff/command.ts` into `src/diff/versions.ts`, and keep a re-export so the public import path still works. `self/core.ts` then no longer reaches `compile.ts` or `typescript`.
  2. In `cli.ts`, handle `--help`, `-h`, `help`, `--version`, a missing command and an unknown command before importing anything heavy. Load each command's module only when that command runs:
     ```ts
     case 'compile': { const { compileCommand } = await import('./commands/compile.js'); return compileCommand(io, report, rest); }
     case 'verify':  { const { verifyCommand }  = await import('./commands/verify.js');  return verifyCommand(io, report, rest); }
     ```
     `Report`, `fixFor` and `InternalContractError` need `self.js`. Move `InternalContractError` into a module with no dependencies (for example `src/errors.ts`). Keep `self.js` as an import of the command modules only, so `--help` and `--version` never evaluate the 274 KB `self/generated/domain.generated.ts`. `VERSION` and `USAGE` can stay in `cli.ts`, because they depend only on `config.ts` (`CONFIG_FILE`) and `package.json`.
- **Risk:** Low to Medium. No behaviour changes. `tests/self.test.ts:94` reads `src/cli.ts`, `src/diff/command.ts` and `src/verify/*` as text. If command code moves to `src/commands/*`, add those files to `SHELL` there, otherwise the test that enforces calls through the harness silently stops covering them. Keep the `urn-forge/cucumber` export unchanged.
- **PR size:** about 60-120 lines, mostly moves.
- **Expected gain:** `--help`, `--version` and usage errors drop from about 740 ms to about 60-160 ms (measured floors: 61 ms with no self harness, 157 ms with it), and RSS drops from 203 MB to about 72 MB. `diff` and `compile` stop loading Cucumber, which saves about 100-250 ms.

#### C2: `import ts from 'typescript'` goes through the ESM-to-CJS path under tsx, which costs about 360 ms every time
- **Where:** `src/compile.ts:7`, `src/verify/completeness.ts:8`, `src/verify/boundary.ts:3`.
- **Anti-pattern and evidence:** TypeScript is one 9 MB CommonJS file. Importing it from ESM makes Node run `detectModuleFormat` and `cjs-module-lexer` over the whole file (133 ms and 169 ms in `prof/help`), and tsx's load hook and source-map caching add more. Measured after tsx `register()`, ESM `import('typescript')` takes 605-622 ms and `createRequire(import.meta.url)('typescript')` takes 248-258 ms.
- **Remediation:**
  ```ts
  import { createRequire } from 'node:module';
  import type * as TS from 'typescript';
  let tsModule: typeof TS | undefined;
  /** TypeScript, loaded on first use, through require: a CJS package loads much faster this way than through ESM import. */
  export const typescript = (): typeof TS => (tsModule ??= createRequire(import.meta.url)('typescript') as typeof TS);
  ```
  Put this in `src/ts.ts` and call `typescript()` inside `checksOf`, `coreProgram`, `completenessGate` and `boundaryGate`. `ts.X` type positions become `TS.X`. Because the load is lazy, it also covers the `compile.ts` part of C1.
- **Risk:** Low. It is the same module instance and version. `createRequire` resolves from the same package, so `node_modules` resolution does not change. `verbatimModuleSyntax` accepts `import type * as`.
- **PR size:** about 30-40 lines.
- **Expected gain:** about 350 ms off every `compile`, `verify` and `diff` that needs TS (about 11% of `verify`, about 35% of `compile`).

#### C3: `compile` and `diff` load the full TypeScript compiler only to strip types from the generated checks
- **Where:** `src/compile.ts:26-29` (`checksOf` -> `ts.transpileModule`), called from `checkArguments` (`compile.ts:37,40`) whenever a manifest uses a rule with parameters. The self/ manifest does.
- **Anti-pattern and evidence:** In `prof/compile`, `checksOf` takes 236 ms, of which `transpileModule` is 221 ms, against about 90 ms of real compile work. With TS stubbed, `compile` and `diff` on self/ throw, which confirms TS is reached on this path. Loading TS takes another 250-620 ms (C2). Together they are about half of `compile`'s 1034 ms and `diff`'s 1132 ms. `standardChecks` is memoized in-process (`compile.ts:31,37`), which is good, but it is rebuilt in every process.
- **Remediation:** pick one of the following.
  - **(a), preferred:** generate the in-compiler checks as plain JS. `checksModule` (`generate/code.ts:310`) already builds this source itself, so it can leave out type annotations. `runtime.ts` helpers would need a JS view, for example JSDoc types or a small `runtimeJs` variant kept in step by the existing `generated.test.ts`.
  - **(b):** use `esbuild.transformSync(src, { loader: 'ts' })`. esbuild is already installed as tsx's dependency, but would have to become a direct dependency.
  - **Avoid:** `module.stripTypeScriptTypes` from `node:module`. It prints `ExperimentalWarning` to stderr on Node 22 (verified), which would break clean `--format json` stderr expectations. It also does not exist before Node 22.13, while `engines` says `>=22`.
  - With C2's lazy loader in place, compile and diff no longer load TypeScript at all.
- **Risk:** Medium. The checks must stay identical to the generated file's checks, which is the point of `checksOf`. The generated-file tests and the self/ harness would catch any divergence.
- **PR size:** (a) about 80-150 lines; (b) about 15 lines plus a dependency.
- **Expected gain:** `compile` and `diff` drop from about 1.0-1.1 s to about 0.3-0.4 s when combined with C1 and C2.

#### C4: Gate 2 rebuilds a full TypeScript program from scratch, re-parsing all 584 files
- **Where:** `src/verify/boundary.ts:142`, `ts.createProgram({ rootNames: [...coreFiles, ...shellFiles], options })` with no host or `oldProgram`. It runs whenever `shell` is configured, which is the case for self/. `src/verify/completeness.ts:24` (`coreProgram`) also has no shared host, so each domain in a multi-domain config re-parses `lib.*.d.ts`, `@types/node` and every shared file again.
- **Anti-pattern and evidence:** `boundaryGate` takes 465-586 ms. Building the same second program with a caching `CompilerHost` that shares `SourceFile`s with gate 1 takes **51-52 ms** (`host.cjs`; the default host takes 596-605 ms). Passing only `oldProgram` saves about 60-130 ms (`gates.mts`), because the root names differ.
- **Remediation:** create one caching host per `verify` run and pass it to every `createProgram` call:
  ```ts
  export function cachingHost(options: TS.CompilerOptions): TS.CompilerHost {
    const ts = typescript(); const base = ts.createCompilerHost(options); const cache = new Map<string, TS.SourceFile | undefined>();
    return { ...base, getSourceFile(file, lv, onError, shouldCreate) {
      const key = `${file}\0${typeof lv === 'object' ? JSON.stringify(lv) : lv}`;
      if (shouldCreate || !cache.has(key)) cache.set(key, base.getSourceFile(file, lv, onError, shouldCreate));
      return cache.get(key); } };
  }
  ```
  Thread it through `coreProgram(options, host)` and `boundaryGate(..., host)`, and pass `oldProgram: coreProgram` as well. Key the cache by options if domains could use different tsconfigs; today one tsconfig is shared (`cli.ts:238`).
- **Risk:** Low. TypeScript's own watch mode and language service share `SourceFile`s between programs in the same way. Files are only read during one run.
- **PR size:** about 25-40 lines.
- **Expected gain:** about 450-550 ms per domain on `verify` (about 15%). With N domains, the shared lib and `@types/node` parse is also saved for domains 2 to N.

#### C5: Gate 1 re-checks the whole program on every run (no incremental cache), Optional
- **Where:** `src/verify/completeness.ts:20-25,72-73`.
- **Anti-pattern and evidence:** `getPreEmitDiagnostics` over 584 files takes 1531-1551 ms on every run. With `ts.createIncrementalProgram` and a warm `.tsbuildinfo` (`incr.cjs`, 127 KB file), the same diagnostics take 766-792 ms. The cache was correct here (0 errors both ways); invalidation uses TypeScript's own file hashes.
- **Remediation:** enable it behind an opt-in such as a `--cache` flag or a config `cache: true`, with the build info under `node_modules/.cache/urn-forge/<hash of tsconfig + core path>.tsbuildinfo`:
  ```ts
  const options = { ...parsed.options, noEmit: true, incremental: true, tsBuildInfoFile };
  const builder = ts.createIncrementalProgram({ rootNames: [corePath], options, host });
  // diagnostics from builder.getSemanticDiagnostics() etc.; builder.emit() writes only the build info
  ```
  `satisfyingExports` and `boundaryGate` keep using `builder.getProgram()`.
- **Risk:** Medium. It writes a file into the user's project, a stale or corrupt cache needs a fallback (delete it and rerun), and it interacts with C4's host (use `createIncrementalCompilerHost` wrapped the same way). Off by default keeps today's behaviour.
- **PR size:** about 50-80 lines plus a flag, docs and a test.
- **Expected gain:** about 750 ms on repeated `verify` runs (about 25%), the usual edit-verify loop.

#### C6: `lineOf()` re-parses the whole YAML manifest for every diagnostic without a line
- **Where:** `src/cli.ts:138-146` (`parseDocument` per call), called in a loop at `cli.ts:149-151` (`showDiagnostics`) and for each change at `cli.ts:400-402` (gate 5 `at` callback).
- **Anti-pattern and evidence:** One call takes 15.5 ms on the 68 KB self/ manifest (`lineof.mts`), 12% of a full `compileManifest`. A manifest with 50 `deprecated-use` warnings or 50 gate-5 changes spends about 0.8 s re-parsing the same text. The cost is O(diagnostics x manifest size).
- **Remediation:** parse once per text:
  ```ts
  export function lineFinder(text: string): (path: Path) => number | undefined {
    const counter = new LineCounter();
    const document = parseDocument(text, { lineCounter: counter, keepSourceTokens: true });
    return (path) => { for (let n = path.length; n >= 0; n--) { const node = document.getIn(path.slice(0, n), true); if (isNode(node) && node.range) return counter.linePos(node.range[0]).line; } return undefined; };
  }
  export const lineOf = (text: string, path: Path) => lineFinder(text)(path); // keep the export
  ```
  Build it lazily, only once a diagnostic without a line appears, in `showDiagnostics` and once per domain in `verifyCommand`.
- **Risk:** Low. The output is identical, the exported `lineOf` signature stays, and it is pure.
- **PR size:** about 15-20 lines.
- **Expected gain:** O(n) parses become 1. Clean manifests see no difference. With many warnings or contract changes, it saves 15 ms for each diagnostic after the first.

#### C7: Generated files are written in place, not written to a temporary file and renamed
- **Where:** `src/write.ts:26` (`await writeFile(path, file.content)`), also `src/init.ts:60,68`.
- **Anti-pattern and evidence:** `writeFile` truncates and then writes. `self/generated/domain.generated.ts` is 274 KB. A Ctrl-C, OOM or full disk during the write leaves a truncated file that the user's build and the tests import. Gate 4 (drift) would report it, and the next `compile` repairs it, so this is a robustness gap and not data loss. It is still the one non-atomic write in the CLI, and it affects watch-mode tools such as vitest or tsc that read half-written files.
- **Remediation:**
  ```ts
  const temp = `${path}.${process.pid}.tmp`; // does not match isGenerated (/\.generated\.(ts|sql)$/)
  try { await writeFile(temp, file.content); await rename(temp, path); }
  catch (error) { await rm(temp, { force: true }); throw error; }
  ```
  For `init`, the same applies to `package.json` (`init.ts:68`), because it rewrites an existing user file.
- **Risk:** Low. Same-directory `rename` is atomic on POSIX. On Windows, `rename` over an open file can fail with EPERM, so retry once or fall back to `writeFile`. The `.tmp` suffix stays outside `listGenerated`'s pattern.
- **PR size:** about 15-25 lines.
- **Expected gain:** no truncated generated file after an interrupt. No speed change.

#### C8: The dev scripts leak their temp directories on SIGINT or SIGTERM (dev-only, low priority)
- **Where:** `scripts/diff-base.mjs:30-53` (`mkdtempSync` ... `finally { rmSync }`) and `scripts/test-tarball.mjs:15,71`.
- **Anti-pattern and evidence:** Cleanup runs in `finally`, but Node has no default SIGINT or SIGTERM handler. A signal kills the process without unwinding, and `spawnSync` blocks the event loop while the child runs. A Ctrl-C during `npm run diff:base` or `test:tarball` leaves `/tmp/urn-forge-diff-*` or `/tmp/urn-forge-tarball-*` behind (the tarball one includes an `npm install`). The shipped CLI itself creates no temp files and spawns only short `git` processes with `execFileSync` (`cli.ts:293-294`). Those share the terminal's process group, so they get the same Ctrl-C, and no orphans remain.
- **Remediation:**
  ```js
  const cleanup = () => rmSync(temp, { recursive: true, force: true });
  for (const s of ['SIGINT', 'SIGTERM']) process.once(s, () => { cleanup(); process.exit(128 + (s === 'SIGINT' ? 2 : 15)); });
  ```
  Keep the existing `finally`.
- **Risk:** Low. These are dev scripts and are not in the published `files`.
- **PR size:** about 8 lines per script.
- **Expected gain:** no leftover temp directories. These are not user-facing.

#### C9: No V8 compile cache for a CLI that loads about 10 MB of JS every run (optional, Node >= 22.1)
- **Where:** `bin/urn-forge.js:12` (before `register()`).
- **Evidence:** With `NODE_COMPILE_CACHE` set, `--help` went from 729 to 634 ms, `verify` from 3150 to 3042 ms and `compile` from about 1034-1062 to 917 ms, using a 6 MB cache. The gain is smaller once C1 and C2 land, because less JS loads, but it still helps every TS-using command.
- **Remediation:**
  ```js
  import module from 'node:module';
  module.enableCompileCache?.(); // Node >= 22.1; a no-op elsewhere; honours NODE_DISABLE_COMPILE_CACHE
  ```
- **Risk:** Low. Node manages the cache in the OS temp directory, and a mismatched cache is ignored. `engines >=22` includes 22.0, hence the optional call.
- **PR size:** 2-3 lines.
- **Expected gain:** about 3-13% on every command.

### Already done well
- **Output:** `bin/urn-forge.js` sets `process.exitCode` and does not call `process.exit()`, so piped stdout is fully flushed. EPIPE and `ERR_STREAM_DESTROYED` are swallowed for `urn-forge verify | head` (`bin/urn-forge.js:6-10`). `--format json` builds one object and writes it once (`cli.ts:106-127`). Text mode writes one `console.log` per line, which is fine at this output size.
- **Writes:** `writeGenerated` reads first and skips unchanged content (`write.ts:23-24`), so no mtime churn or watcher rebuilds. Every command run in this audit left `git status` clean.
- **Memoization:** the standard set is parsed once per process (`rules.ts:15-29`), and so are its compiled checks (`compile.ts:31,37`). Gate 1 and gate 2 share one `ts.Program` when no shell is configured (`boundary.ts:142`). The manifest is read once per domain, and its text is reused for `lineOf` and gate 5.
- **Child processes:** only `git`, only with `--base`, through `execFileSync` with an argument array (no shell), `stdin: 'ignore'` and an explicit `maxBuffer` (`cli.ts:293-294`). Measured overhead is negligible: 3.58 s for `verify --base HEAD` against 3.1-4.1 s for plain `verify` on this machine. There are no long-lived children, no detached processes and no temp files in the CLI.
- **Lazy loading attempt:** `diff` is already loaded lazily (`cli.ts:487`). C1 explains why it has no effect at the moment.
- **tsx cache:** the tsx transform cache works. A cold cache adds about 170 ms once.

### Considered and dismissed (proportionality)
- **Streaming or incremental reads:** not worth it. Manifests are tens of KB (self/ is 68 KB), feature files are small and output is a few KB. Whole-file `readFileSync` and `readFile` are the right choice for a run-once CLI. Mixing sync and async fs (`cli.ts` sync, `write.ts` and `drift.ts` async) has no measurable cost.
- **Repeated reads of small files:** `runtime.ts` (552 lines) is read and split on each `runtimeSource()` call, up to 3 times per compile (`generate/code.ts:44,75`). This costs well under 1 ms and is not worth a cache. The generated file is read by both the drift gate and the TS program, which is also negligible.
- **`git show` once per feature file** in `baseContract` (`cli.ts:320`): 16 spawns at a few ms each. `git cat-file --batch` would save milliseconds at the cost of complexity, so it is not worth doing.
- **Removing tsx at run time** by shipping prebuilt JS would save about 100-250 ms more (tsx hooks plus source maps). It conflicts with the deliberate "no build step" design (`bin/urn-forge.js:2`), and tsx is still needed to load a user's `urn-forge.config.ts`. Not recommended for now.
- **Gate 1's TypeScript time for self/** is partly self-inflicted, because `self/core.ts` imports `src/*`, which pulls `src/compile.ts` and `typescript.d.ts` into the checked program. That is a property of the self/ project and not of the CLI, so it is not counted as a finding.

### Expected combined effect

These are estimates, built from the measured parts above:

| Command | Now | After C1 + C2 + C4 (+C3) | With C5 warm and C9 |
|---|---|---|---|
| `--help` / `--version` | 0.74 s | 0.06-0.16 s | about the same |
| `compile` (self/) | 1.03 s | about 0.65 s (C3: about 0.3-0.4 s) | |
| `diff` (self/) | 1.13 s | about 0.7 s (C3: about 0.35-0.45 s) | |
| `verify` (self/) | 3.1 s | about 2.2 s | about 1.4 s |

---

## Agent D: input validation, cross-platform resilience and testability

Scope: `packages/urn-forge` (urn-forge 0.2.2), repo-root `scripts/check.mjs`, `.github/workflows/*`.
Method: read every boundary (argv, env, config, manifest, file paths, spawn), then ran `node bin/urn-forge.js` against about 60 bad inputs. The fixtures were copies of `tests/fixtures/booking` in the scratchpad, plus a `node_modules` symlink so that gate 1 resolves. I also ran `npx vitest run tests/cli.test.ts tests/agents.test.ts tests/domains.test.ts tests/starter.test.ts` (4 files, 42 tests, all pass, 9.8 s). No repository file was modified (`git status` is clean).

**Domain health score: 6.5 / 10**

Validation at the boundaries is better than in most CLIs:
- Argument parsing is strict.
- Config and manifest validation reject unknown keys and give each problem a stable code and a fix.
- Duplicate YAML keys are an error.
- CRLF and BOM manifests compile to identical output.
- Line numbers come from the YAML AST.

The score loses points for four things:
- Two silent-pass paths. A wrong `shell` path, or a symlinked folder, quietly empties gate 2 or 3. Overlapping out dirs silently overwrite each other.
- Unhandled filesystem errors escape as stack traces. In `--format json` mode they break the "one JSON object on stdout" contract.
- `init` can crash halfway through, or say it updated a `package.json` that it did not change.
- Nothing stops a CRLF checkout on Windows. No `.gitattributes` and an ubuntu-only CI mean gate 4, the test suite and `npm run check` all break there.

Every CLI test calls `main()` in-process, so the bin shim, real exit codes and the real stream split are never asserted.

---

### What is already done well

- **Strict argv.** `parseArgs({ strict: true })` is used for every subcommand (`src/cli.ts:325,350,433`, `src/diff/command.ts:38`). Unknown flags, a flag with no value, and stray positionals all give exit 2 with a message and the usage on stderr. Observed: `compile --bogus`, `compile --manifest`, `compile extra` and `init --namespace X`.
- **Usage errors in JSON mode.** These come back as a structured `usage` problem with exit 2 and an empty stderr (`cli.ts:508-511`). Observed: `verify --format json --bogus`.
- **Config validation** (`src/config.ts:57-81`):
  - It rejects unknown keys, and points removed keys to their replacement (`coverage`, and the old top-level `manifest`).
  - It checks types per field, checks nested `domains[i]`, and rejects an empty `domains` list.
  - It catches a config that throws, has a syntax error, or has no default export.
  - It reports every problem, not just the first.
  - It loads the config through `pathToFileURL` (`config.ts:87`), which is correct on Windows.
- **Manifest validation** (`src/manifest.ts`):
  - `uniqueKeys: true`, so a duplicate key is a `yaml-syntax` error with its line.
  - It rejects multi-document files, tabs and an empty file ("the manifest must be a map").
  - Every map checks for unknown keys, and every scalar has a type check: name regex, semver, boolean, non-empty text.
  - There is a migration hint for `message` → `failure_message`.
  - Line numbers come from the YAML AST (`lineOf`).
- **CRLF and BOM input.**
  - A manifest converted to CRLF compiles to a byte-identical generated file. Observed with `cmp`.
  - CRLF `.feature` files pass gate 3.
  - A UTF-8 BOM manifest compiles to the same body.
- **Path display.** Displayed paths are normalised to `/` (`display()`, `cli.ts:133`). So are git tree paths (`cli.ts:308`) and starter paths (`init.ts:40,48`). `init` builds paths with `join(cwd, ...path.split('/'))`.
- **No shell interpolation in the CLI.** Git runs through `execFileSync('git', args)` with an argv array. The ref is validated with `rev-parse --verify` before it reaches `show` or `ls-tree`.
- **Environment.** `src/` reads no environment variables. The only one in the repo is `GITHUB_ACTIONS` in `scripts/check.mjs:25`.
- **Locale independence.** Sorting uses code-unit `.sort()` with no `localeCompare`, and the Determinism workflow really does switch the ICU locale. I checked that `LANG=tr_TR.UTF-8` gives the `tr-TR` locale in Node.
- **EPIPE.** The bin handles EPIPE (`bin/urn-forge.js:6-10`).

---

### Findings

#### D1. A missing `shell` path or `--features` dir silently empties a gate; symlinked subfolders are skipped
- **Files:**
  - `src/verify/boundary.ts:17-28`: `sourcesUnder` returns `[]` when the path does not exist, and `entry.isDirectory()` is false for a symlink.
  - `src/cli.ts:343-347`: `features()` has the same two problems.
- **Evidence** (scratchpad copy of the booking fixture, with a shell file that calls `core.seat_booking` directly):
  ```
  shell: ['shel.ts']   (typo)          -> gate 2  boundary  PASS  1 core file(s), 0 shell file(s)   verify passed
  shell: ['shell.ts']                  -> gate 2  boundary  FAIL  1 core file(s), 1 shell file(s): 1 problem(s)
  shell: ['outer'] (outer/inner -> ../realshell symlink) -> gate 2 PASS 0 shell file(s)   verify passed
  features/sub -> symlink to real feature dir           -> gate 3 FAIL 0 feature(s)
  verify --features nope-dir           -> gate 3 FAIL, 30 "uncovered-*" errors filed against "features", no hint that the dir is missing
  verify --features core.ts            -> parses core.ts as Gherkin (any non-directory is accepted, whatever its extension)
  ```
  A typo in `config.shell` switches off the boundary gate, and verify still reports "verify passed". This is the most serious validation gap: it is a false green.
- **Remediation:**
  ```ts
  // boundary.ts
  export function shellProblems(shell: readonly string[], show): GateProblem[] {
    return shell.filter((p) => !existsSync(p)).map((p) => ({ code: 'shell-not-found', severity: 'error', file: show(p), message: 'the shell path does not exist' }));
  }
  // follow symlinks, guard against cycles:
  const seen = new Set<string>();
  function sourcesUnder(path) { const real = realpathSync(path); if (seen.has(real)) return []; seen.add(real);
    ... const isDir = entry.isDirectory() || (entry.isSymbolicLink() && statSync(join(path, entry.name)).isDirectory()); ... }
  ```
  Do the same in `features()`:
  - Follow symlinks.
  - When `--features` or `config.features` was given explicitly and does not exist, report `features-not-found`.
  - When the path is a file, require the `.feature` extension.

  Add the new codes to `codes.ts`, `self/` and AGENTS.md.
- **Tests:** add a `cli.test.ts` case "gate 2 fails a shell path that does not exist" asserting exit 1, the stdout line and the stderr `verify failed: gate 2`. Add a symlinked-subdir case for both gates, behind `it.skipIf(process.platform==='win32')`.
- **Risk: Medium.** Projects that today pass with a stale `shell` entry will start failing. That is the point of the change, but call it out in the changelog. It could ship as a warning first for one minor release.
- **Size:** about 60 lines of source and 50 of tests.

#### D2. Two domains can share an out dir through a symlink or a case-only difference, and silently overwrite each other
- **File:** `src/cli.ts:217-233`. The clash check compares `resolve()`d strings in a `Set`, so neither symlinks (no `realpath`) nor case-insensitive filesystems (macOS, Windows) are handled.
- **Evidence:** config `domains: [{manifest:'a.yaml', out:'gen'}, {manifest:'b.yaml', out:'genlink'}]` with `genlink -> gen`:
  ```
  urn:demo:booking      wrote gen/domain.generated.ts
  urn:demo:booking_two  wrote genlink/domain.generated.ts
  exit=0   ; gen/domain.generated.ts now contains booking_two (25 matches) — domain 1's harness is gone
  ```
  `out: 'gen'` together with `out: 'GEN'` is accepted on every OS (observed, config `c7.ts`). On macOS and Windows those are the same folder.
- **Remediation:**
  ```ts
  const key = (p: string) => { let r = p; try { r = realpathSync.native(p); } catch { /* not created yet: realpath the nearest existing parent + rest */ }
    return process.platform === 'win32' || process.platform === 'darwin' ? r.toLowerCase() : r; };
  // use seen.has(key(value)) instead of seen.has(value)
  ```
  For an out dir that does not exist yet, realpath its nearest existing ancestor and join the rest.
- **Tests:** a domains.test case that symlinks one out dir to the other and expects `config-invalid two domains write to …` with exit 1. A pure-function test of `key()` with mixed case under a mocked platform.
- **Risk: Low.** It only rejects configs that already corrupt their own output.
- **Size:** about 25 lines of source and 30 of tests.

#### D3. Filesystem errors escape as raw stack traces; in `--format json` stdout is empty
- **Files:**
  - `src/cli.ts:516` (`throw error;` for anything that is not a usage or contract error).
  - Unguarded I/O at `src/write.ts:19-36` (mkdir, writeFile, rm) and `src/cli.ts:363` (`readFileSync` of every feature file).
  - `bin/urn-forge.js:14`.
- **Evidence:**
  ```
  $ urn-forge compile --out <file>/x --format json
  exit=1
  --stdout: (empty)
  --stderr: node:internal/fs/promises:858 ... Error: ENOTDIR: not a directory, mkdir '.../afile/x'
            at async writeGenerated (.../src/write.ts:19:3) ... Node.js v22.23.5
  ```
  The help text promises that `--format json` gives "one JSON object on stdout, and nothing else". A coding agent parsing stdout gets nothing. EACCES on the out dir, EISDIR on a feature path, and a read-only checkout all fail the same way.

  The related message mapping is also wrong. Every read error of a manifest is reported as "the manifest does not exist" (`cli.ts:259`, `diff/command.ts:50`), even for a directory: `compile --manifest generated` gives `generated error manifest-unreadable the manifest does not exist`.
- **Remediation:**
  ```ts
  // cli.ts main(): before `throw error`
  if (isFsError(error)) {            // error.code in ENOENT/EACCES/EPERM/ENOTDIR/EISDIR/EROFS/EBUSY
    report.problem({ code: 'io-error', severity: 'error', file: display(io, error.path ?? ''), message: `${error.syscall} failed: ${error.code}` });
    return report.end(1);
  }
  // last resort: JSON mode always emits an object
  if (report.format === 'json') { report.problem({ code: 'internal-error', severity: 'error', message: String(error) }); return report.end(1); }
  ```
  Make the `manifest-unreadable` message come from `error.code`: "does not exist" for ENOENT, "is a directory" for EISDIR, "cannot be read (EACCES)" for EACCES.
- **Tests:**
  - `run(dir, ['compile','--out', fileAsDir, '--format','json'])`: expect exit 1, one JSON line on stdout with `code: 'io-error'`, and an empty stderr.
  - A text-mode variant that asserts there is no `at async` in stderr.
- **Risk: Low.** Only crash paths change. The new codes need entries in `self/` and AGENTS.md.
- **Size:** about 40 lines of source and 40 of tests.

#### D4. `init` with a malformed or non-object `package.json` crashes halfway, or says "updated" without changing it
- **File:** `src/init.ts:64-69`.
  ```ts
  const existing = await readFile(packagePath, 'utf8').then((t) => JSON.parse(t) as Record<string, unknown>, () => undefined);
  ```
  The rejection handler is the second argument of the same `.then`, so it does not catch a `JSON.parse` throw. Nothing checks that the parsed value is an object.
- **Evidence:**
  ```
  package.json = '{ "name": "x", }'  ->  exit=1, stderr "SyntaxError: Expected double-quoted property name…" (raw stack),
                                         but .claude/, AGENTS.md, domain.manifest.yaml, src/, features/… were ALL written first.
                                         Re-running init now refuses: "init writes no file: these exist already".
  package.json = '[1,2]'              ->  exit=0, prints "updated    package.json", file is still [1,2] (no "type":"module", no scripts).
  ```
  The `init` docstring says it "writes no file when a starter file exists already". Here it writes them and then fails, which leaves the user half-initialised and unable to retry.
- **Remediation:** read and validate `package.json` before writing anything.
  ```ts
  let existing: Record<string, unknown> | undefined;
  const raw = await readFile(packagePath, 'utf8').catch(() => undefined);
  if (raw !== undefined) {
    let parsed: unknown; try { parsed = JSON.parse(raw); } catch (e) { return { ok: false, message: `init writes no file: package.json is not valid JSON: ${(e as Error).message}` }; }
    if (!isRecord(parsed)) return { ok: false, message: 'init writes no file: package.json must be a JSON object' };
    existing = parsed;
  }
  // …then the present-files check, then the writes
  ```
- **Tests:** two agents.test cases, one with an invalid `package.json` and one with an array. Expect exit 1, stderr `init writes no file: package.json …`, empty stdout, and that `domain.manifest.yaml` does not exist afterwards.
- **Risk: Low.**
- **Size:** about 15 lines of source and 25 of tests.

#### D5. No `.gitattributes`, and gate 4 compares bytes: a Windows CRLF checkout fails verify, the test suite and `check`
- **Files:**
  - The repository root has no `.gitattributes` (`find . -name .gitattributes` finds none outside node_modules). `git ls-files --eol` shows all 188 files as `i/lf w/lf`, so nothing pins them.
  - The starter in `templates/starter/` also has no `.gitattributes`.
  - `src/verify/drift.ts:22-26`.
- **Evidence:** I converted the committed `generated/domain.generated.ts` to CRLF, which is what `core.autocrlf=true` does on Windows:
  ```
  gate 4  drift  FAIL  1 generated file(s) compared byte for byte against generated
      generated/domain.generated.ts:1  error  drift  the generated file is not current; run urn-forge compile
  ```
  The message points at line 1 and says "not current", which does not help someone whose only difference is line endings. `compile` then rewrites the file with LF, and git shows it as modified or unmodified depending on settings, so the user goes round in a loop.

  The same CRLF checkout breaks these tests silently, because their `String.replace` patterns contain `\n` and become no-ops:
  - `tests/cli.test.ts:43,52,102,116,124`
  - `tests/agents.test.ts:205`
  - `tests/skill.test.ts:44` (`/^---\n…/`)

  The self domain's `git diff --exit-code` in Determinism has the same exposure.
- **Remediation:**
  1. Add a root `.gitattributes`:
     ```
     * text=auto eol=lf
     *.generated.ts text eol=lf
     *.generated.sql text eol=lf
     ```
  2. Have `init` write the same lines to the starter's `.gitattributes`. Keep an existing file, as `init` already does for AGENTS.md.
  3. In `driftGate`, when `committed.replaceAll('\r\n','\n') === file.content`, report `drift` with the message "the generated file has CRLF line endings; add `*.generated.ts text eol=lf` to .gitattributes, then run urn-forge compile".
- **Tests:** a drift unit test that writes a CRLF copy of the generated file and expects the specific line-ending message. A starter test that expects `.gitattributes` to be written.
- **Risk: Low.** `.gitattributes` with `eol=lf` is a no-op on LF checkouts. The init change adds one file to the starter, so `starter.test` and `test-tarball` need their expected file lists updated.
- **Size:** about 20 lines of source, 5 of config and 25 of tests.

#### D6. The CI matrix is ubuntu and Node 22 only; the repo's own scripts cannot run on Windows
- **Files:**
  - `.github/workflows/ci.yml:26` (`runs-on: ubuntu-latest`, and `.nvmrc` = `22`, while `engines` is `>=22`).
  - `.github/workflows/determinism.yml:15`. It is only scheduled weekly or run by hand, never on a pull request.
  - `scripts/check.mjs:42`: `spawnSync(command, …)` with `'npm'` and `'npx'`, no `shell`.
  - `packages/urn-forge/scripts/test-tarball.mjs:23,43`: `execFileSync('npm' | 'npx' | 'mkdir', …)`.
  - `packages/urn-forge/tests/starter.test.ts:31`: `symlinkSync(PACKAGE, …, 'dir')`.
- **Evidence:**
  - On Windows, `npm` and `npx` are `.cmd` shims. `spawnSync('npm')` without a shell gives ENOENT, and since the Node CVE-2024-27980 fix `.cmd` needs `shell: true` (EINVAL otherwise).
  - `check.mjs` does not print `run.error`. Observed shape: `spawnSync('npm.cmd')` gives `status null error ENOENT`. The script prints only `--- tests failed`, with no reason.
  - `mkdir` is not an executable on Windows.
  - `symlinkSync(..., 'dir')` needs admin or Developer Mode on Windows; `'junction'` does not.
  - Because only Linux is exercised, D2 (case), D5 (CRLF) and D11 (sort order) are invisible to CI.
- **Remediation:**
  ```yaml
  # ci.yml
  strategy: { fail-fast: false, matrix: { os: [ubuntu-latest, windows-latest, macos-latest], node: [22, 24] } }
  runs-on: ${{ matrix.os }}
  # run `npm run check -- --quick` on non-ubuntu cells to keep cost down
  ```
  In `check.mjs`, use `spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })` and print `run.error?.message` when status is null. In `test-tarball.mjs`, use `mkdirSync(project)` and the same `shell` flag for npm and npx. In `starter.test.ts`, pass `process.platform === 'win32' ? 'junction' : 'dir'`. Run Determinism on `pull_request` with a `paths` filter on `packages/urn-forge/src/**`.
- **Risk: Low** for the product. **Medium** for CI cost and time, and the first Windows run will surface D5.
- **Size:** about 30 lines of YAML and 15 of script changes.

#### D7. Every subcommand accepts every other subcommand's flags and silently ignores them
- **File:** `src/cli.ts:171-181`. A single `OPTIONS` object is shared by `init`, `compile` and `verify` (lines 325, 350, 433).
- **Evidence:**
  ```
  compile --namespace foo --base main --core x   -> exit 0, "unchanged generated/domain.generated.ts"
  init --manifest x --out y --config z           -> accepted (fails only because files exist), flags ignored
  ```
  A user who runs `urn-forge compile --base origin/main` or `init --out gen` gets no feedback that the flag did nothing. The usage text lists flags per command, so the parser is looser than the documented contract.
- **Remediation:**
  ```ts
  const COMMON = { config, manifest, out } as const;
  const COMPILE = COMMON; const VERIFY = { ...COMMON, core, features, tsconfig, base } as const; const INIT = { namespace, domain } as const;
  ```
  Pass the per-command set to `parseArgs`. strict mode then rejects the rest with `ERR_PARSE_ARGS_UNKNOWN_OPTION`, which gives exit 2.
- **Tests:** `run(dir, ['compile','--base','x'])` expects exit 2, a stderr that starts with `Unknown option '--base'`, and an empty stdout. Do the same for `init --out`.
- **Risk: Medium.** Scripts that pass harmless extra flags will start getting exit 2. Ship it in a minor release with a release note.
- **Size:** about 15 lines of source and 20 of tests.

#### D8. A repeated flag silently uses its last value; there is no per-command `--help` and no `-v`
- **Files:**
  - `src/cli.ts:450-465`. `takeFormat` overwrites `format` on every occurrence.
  - The `parseArgs` options have no `multiple`, and Node keeps the last value.
  - `cli.ts:490-498` handles help and version only as the first argument.
- **Evidence:**
  ```
  compile --manifest a.yaml --manifest domain.manifest.yaml  -> exit 0 (a.yaml ignored, no warning)
  compile --format json --format text                         -> text output, exit 0
  compile --help   -> exit 2, "Unknown option '--help'…" + full usage on stderr
  -v               -> exit 2, unknown command "-v"
  ```
  Asking for help is not an error, and it should not exit 2 or write to stderr. A repeated `--manifest` in a multi-domain migration is a likely mistake.
- **Remediation:**
  - Use `tokens: true` in `parseArgs` and throw `UsageError('--manifest is given twice')` when an option token repeats.
  - Do the same in `takeFormat`.
  - Before dispatching, map `args.includes('--help') || args.includes('-h')` to the usage on stdout with exit 0, and accept `-v` as an alias of `--version`.
- **Tests:**
  - `compile --help`: exit 0, usage on stdout, empty stderr.
  - `--manifest a --manifest b`: exit 2 with the "given twice" message.
- **Risk: Low.** A repeated flag that works by accident today would start failing.
- **Size:** about 25 lines of source and 25 of tests.

#### D9. A config whose default export is a Promise passes validation as an empty config; load failures get the wrong fix
- **File:** `src/config.ts:49-51,58,84-93`. `isRecord` accepts any non-array object, so a Promise has no own keys and passes. Load and syntax errors are reported as `config-invalid`, whose fix is "use only the options of defineConfig".
- **Evidence:**
  ```
  export default Promise.resolve({ shell: 1 })  ->  config accepted; then "domain.manifest.yaml error manifest-unreadable"
                                                    (the real problem, and shell: 1, never reported)
  throw new Error('boom')                        ->  "config-invalid cannot load the config: boom"
                                                    fix: "Change the config to use only the options of defineConfig…"
  ```
- **Remediation:**
  - Either `const value = await module.default` (supporting async configs is common in Vite and Vitest), or reject anything whose prototype is not `Object.prototype` or `null`, with "the config must be a plain object".
  - Split out a `config-unloadable` code whose fix reads "Fix the error in the config file so that Node can import it".
- **Tests:** two config fixtures in the scratchpad style, each asserting the code and message in stderr and exit 1.
- **Risk: Low.**
- **Size:** about 15 lines of source and 25 of tests.

#### D10. `diff` reports manifest problems with no line numbers, raw paths, drops warnings, and gives a fix that mentions `--manifest`
- **File:** `src/diff/command.ts:45-56`.
  ```ts
  for (const d of compiled.diagnostics.filter((x) => x.severity === 'error')) report.problem({ code: d.code, severity: 'error', file: path, path: d.path, message: d.message });
  ```
  It does not call `lineOf` or `display()`, and it filters out warnings.
- **Evidence:** the same bad manifest:
  ```
  compile: types.yaml:10  error  manifest-shape  definitions.a.colour is not a key here …
  diff:    types.yaml     error  manifest-shape  definitions.a.colour is not a key here …
  diff nope1 nope2: "fix: Give --manifest, or manifest in the config, the path of a manifest that exists."  (diff has no --manifest)
  ```
  On Windows, `file` shows whatever separator the user typed, while compile and verify normalise to `/`.
- **Remediation:**
  - Reuse `showDiagnostics(report, display(io, abs), text, compiled.diagnostics)` from cli.ts. Export it.
  - Make the `manifest-unreadable` fix generic ("Give the path of a manifest that exists"), or add a `diff-manifest-unreadable` code.
- **Tests:** `diff bad.yaml good.yaml` expects stderr to match `/^bad\.yaml:\d+  error  manifest-shape/` and exit 1.
- **Risk: Low.** Text output gains `:line`. JSON consumers gain a `line` field, which is additive.
- **Size:** about 10 lines of source and 15 of tests.

#### D11. Non-JSON YAML values (`!!binary`, complex keys, merge `<<`) give cascades of confusing errors and a Node process warning
- **File:** `src/manifest.ts:193-202`. `parseDocument` uses the default schema, then `toJS()`.
- **Evidence:**
  ```
  a: !!binary aGVsbG8=   -> "definitions.a.0 is not a key here …", "definitions.a.1 …", … (one per byte)
  ? [a, b] : {...}       -> stderr: "(node:3388) Warning: Keys with collection values will be stringified due to JS Object restrictions"
  a: { <<: *b }          -> 5 errors (<< not a key, needs description, needs type, …) — no hint that YAML merge keys are unsupported
  ```
- **Remediation:**
  - Parse with `{ uniqueKeys: true, schema: 'core', customTags: [], merge: false }`.
  - Before `toJS`, walk the document with `visit()`. Report one `manifest-shape` problem with its line for any node with a non-core tag, any non-scalar key, or a `<<` key: "YAML merge keys (<<) are not supported in a manifest; write the keys out".
  - Call `toJS({ mapAsMap: false })` only after that check, so the Node warning cannot fire.
- **Tests:** model.test cases, one per construct, each expecting exactly one diagnostic with the right line.
- **Risk: Low.**
- **Size:** about 30 lines of source and 30 of tests.

#### D12. Feature discovery sorts full native paths, so order (and output) differs between Windows and POSIX
- **File:** `src/cli.ts:346`. It calls `.sort()` on `join(dir, name)` results, and `src/write.ts:11` does the same. The separator is `/` (0x2F) on POSIX and `\` (0x5C) on Windows, and that changes the order relative to `0-9 : ; < = > ? @ A-Z [`. For example, `features/sub/x.feature` sorts before `features/subA.feature` on Linux and after it on Windows.
- **Evidence:** analysis of the code. Gate 3 problems and JSON `problems[]` follow feature order. The Determinism workflow ("same inputs give the same bytes … in any locale") only covers Linux.
- **Remediation:** sort by the displayed POSIX-relative path:
  ```ts
  .sort((a, b) => cmp(toPosix(relative(root, a)), toPosix(relative(root, b))))
  ```
  Or collect relative segments and compare them segment by segment.
- **Tests:** a unit test of `features()` on a temp tree containing `sub/x.feature` and `subA.feature`, asserting the POSIX order. It becomes meaningful once the Windows CI cell from D6 exists.
- **Risk: Low.** Output order may change on Windows only.
- **Size:** about 8 lines of source and 15 of tests.

#### D13. Testability: the bin, real exit codes and the stdout/stderr split are never asserted end to end
- **Files:**
  - `tests/cli.test.ts:24-29`, `tests/agents.test.ts:36-40`, `tests/domains.test.ts:24-28` and `tests/starter.test.ts:17-21` all call `main()` in-process with a fake `CliIo`.
  - The only subprocess runs of the bin are `tests/agents.test.ts:208,220` (setup only, no assertions; their stderr leaks into the vitest log) and `scripts/test-tarball.mjs:27`, which merges stdout and stderr into one string.
- **Evidence:** none of the following is covered by any test:
  - `process.exitCode` propagation (`bin/urn-forge.js:14`).
  - `register()` of tsx.
  - The EPIPE handler.
  - The behaviour on an uncaught error (D3).
  - Whether `console.log` and `console.error` really separate JSON from diagnostics.

  The in-process tests are good and fast, but the shim layer is exactly where D3 lives. Many tests also assert only one of code, stdout or stderr; see the matrix below. `tests/cli.test.ts:18` and `tests/starter.test.ts:14` create temp projects inside the source tree (needed for `../../../src` imports). Parallel runs on a read-only checkout fail, and a crash leaves `.cli-*` debris.
- **Remediation:** add `tests/bin.test.ts`:
  ```ts
  const bin = (cwd: string, args: string[]) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  it.each([
    [['--version'], 0, /^0\.\d+\.\d+\n$/, ''],
    [[], 2, /^urn-forge /, ''],
    [['build'], 2, '', /^unknown command "build"/],
    [['compile', '--bogus'], 2, '', /Unknown option '--bogus'/],
    [['compile', '--format', 'json', '--out', FILE_AS_DIR], 1, /^\{"ok":false/, ''],   // D3
    [['verify', '--format', 'json'], 0, /^\{"ok":true.*\}\n$/s, ''],
  ])('%j', (args, code, out, err) => { const r = bin(copy(), args); expect(r.status).toBe(code); expect(r.stdout).toMatch(out); expect(r.stderr).toMatch(err); });
  it('stops quietly on EPIPE', () => { const r = spawnSync('sh', ['-c', `node ${BIN} --help | head -1`]); expect(r.stderr.toString()).toBe(''); });
  ```
  Use `{ stdio: 'pipe' }` for the existing `execFileSync` calls in agents.test, so warnings stop leaking. Write the remaining matrix gaps as in-process `run()` cases that assert all three channels.
- **Risk: Low.** Tests only.
- **Size:** about 120 lines of tests.

---

### Coverage matrix

The columns record whether the exit code, stdout and stderr are each asserted. "Mostly" means a partial assertion such as `toContain`, `.at(-1)` or `err[0]`. "e2e" means the bin is run as a real subprocess. "Observed" is the behaviour I saw when I ran the path by hand.

| Subcommand / path | Test | Exit | Stdout | Stderr | e2e | Observed |
|---|---|---|---|---|---|---|
| (no args) → usage, exit 2 | none | no | no | no | no | stdout usage, exit 2 |
| `--help` / `-h` / `help` | skill.test.ts:65 (`--help` stdout only) | no | yes | no | no | exit 0 |
| `--version` | none | no | no | no | no (tarball does not call it) | `0.2.2`, exit 0 |
| unknown command | cli.test:162 | yes | no | mostly (`err[0]`) | no | exit 2 |
| `init` success | starter.test:24; agents.test:169-179 | yes | mostly (agents `toContain`) | yes (`[]`) | tarball (merged) | ok |
| `init`, files exist | starter.test:44 | no | no | mostly | no | exit 1 |
| `init --namespace BAD` / `--domain BAD` | none | no | no | no | no | exit 2 |
| `init` positional / unknown flag | none | no | no | no | no | exit 2 |
| `init` with bad package.json (D4) | none | no | no | no | no | crash after writing files |
| `compile` success | cli.test:34 | yes | yes (exact) | no | agents (setup only) | ok |
| `compile` manifest diagnostic | cli.test:41 | yes | yes (`[]`) | mostly (`toContain`) | no | ok |
| `compile` YAML syntax error | cli.test:50 | no | no | mostly | no | exit 1 |
| `compile` removes a stale file | cli.test:58 | no | yes | no | no | ok |
| `compile` manifest missing (`manifest-unreadable`) | none | no | no | no | no | exit 1 |
| `compile` config unknown or removed option | cli.test:153; domains.test:62 | domains only | no | yes | no | exit 1 |
| `compile` config missing (`--config nope`) | none | no | no | no | no | exit 1 `config-unreadable` |
| `compile` config throws, has a syntax error, or has no default | none | no | no | no | no | exit 1 |
| `compile` two domains share a path or URN | domains.test:146,91 | yes | no | mostly | no | exit 1 |
| `compile` unknown flag, missing value, positional | none | no | no | no | no | exit 2 |
| `compile --format json` ok | agents.test:86 | no | yes | no | no | ok |
| `compile --format xml` / no value | none | no | no | no | no | exit 2 |
| `compile` fs error (D3) | none | no | no | no | no | stack trace |
| `verify` pass | cli.test:69; starter.test | yes | mostly (`.at(-1)`) | starter only | tarball (merged) | ok |
| `verify` gate 1 fail | cli.test:75 | yes | mostly | yes (`.at(-1)`) | no | ok |
| `verify` gate 2 direct-call / destructure / suppressed | cli.test:84,93,108 | first only | mostly | no | no | ok |
| `verify` gate 2 with missing shell path (D1) | none | no | no | no | no | **false PASS** |
| `verify` gate 3 gap | cli.test:114 | no | mostly | yes | no | ok |
| `verify` gate 4 drift | cli.test:122 | no | mostly | yes | tarball (merged) | ok |
| `verify --base` gate 5 | agents.test:212-245 | first only | mostly | no | no | ok |
| `verify --base` with a bad ref / not a git repo | none | no | no | no | no | exit 1 `base-unreadable` |
| `verify --core` / `--tsconfig` missing | none | no | no | no | no | exit 1, problems on stdout |
| `verify --features` missing | none | no | no | no | no | 30 misleading gap errors |
| `verify` config invalid / manifest does not compile | domains.test:62 (via compile) | partly | no | no | no | exit 1 |
| `verify --format json` | agents.test:72; domains.test:117-139 | yes | yes | yes (`[]`, agents only) | no | ok |
| `diff` pass | cli.test:132; agents.test:89 | no | yes | no | no | ok |
| `diff` breaking, fail | cli.test:137 | yes | yes | yes | no | **all three asserted** |
| `diff` breaking across a major | cli.test:148 | no | mostly | no | no | ok |
| `diff --report` | none (only through `check.mjs --base`) | no | no | no | no | |
| `diff` wrong arity | none | no | no | no | no | exit 2 |
| `diff` missing or bad manifest | none | no | no | no | no | exit 1, no line numbers (D10) |
| bin: exitCode propagation, EPIPE, tsx register | none | no | no | no | no | |

Of about 41 paths, 17 have no test at all and 2 have no assertion on their own outcome (`diff --report` is covered only by `check.mjs`). Only 1 path (`diff` breaking) asserts exit code, stdout and stderr exactly, and 0 paths assert them through the real binary.

---

### Summary table

| ID | Title | Risk | Size (lines) |
|---|---|---|---|
| D1 | Missing `shell` path or `--features` dir silently empties a gate; symlinked subfolders skipped | Medium | ~110 |
| D2 | Out-dir clash check misses symlinks and case-insensitive filesystems: silent overwrite | Low | ~55 |
| D3 | fs errors escape as stack traces; JSON mode emits nothing on stdout | Low | ~80 |
| D4 | `init` with a malformed or non-object package.json crashes halfway or falsely reports "updated" | Low | ~40 |
| D5 | No `.gitattributes`; gate 4 byte compare fails on a CRLF checkout with a misleading message; tests break | Low | ~50 |
| D6 | CI is ubuntu and Node 22 only; check.mjs, test-tarball and starter.test cannot run on Windows | Low (CI cost Medium) | ~45 |
| D7 | Every subcommand silently accepts and ignores the other subcommands' flags | Medium | ~35 |
| D8 | A repeated flag uses its last value; no per-command `--help` (exits 2); no `-v` | Low | ~50 |
| D9 | A Promise default export passes config validation; load errors get the wrong fix text | Low | ~40 |
| D10 | `diff` diagnostics have no line numbers or normalised paths, drop warnings, and give a `--manifest` fix | Low | ~25 |
| D11 | Non-JSON YAML (`!!binary`, complex keys, `<<`) gives error cascades and a Node warning | Low | ~60 |
| D12 | Feature and generated-file order uses native-separator sort, so it differs on Windows | Low | ~23 |
| D13 | The bin, exit codes and the stdout/stderr split are never asserted end to end; matrix gaps | Low | ~120 |

---

