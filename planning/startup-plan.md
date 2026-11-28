# urn-forge plan: fast commands

This plan builds the startup-latency group of [the CLI improvement spec](../audit/cli-improvement-spec.md): tasks 7 to 12, from findings B1, B9, C1, C2, C4, C6 and C9. A coding agent runs `verify` after each change, and `--help` or `--version` to orient itself, so each second here is spent many times in a session.

Measured on `main` (0.2.4), the median of 5 runs, on the 4-core machine of the cloud session:

| Command | Now | Why |
| --- | --- | --- |
| `--help`, `--version` | 686 ms, 672 ms | They load all of TypeScript and Cucumber, which they never use (C1) |
| `compile --config self/urn-forge.config.ts` | 959 ms | TypeScript through the slow ESM path (C2), only to strip types from the checks (C3) |
| `diff self self` | 1055 ms | The same, and Cucumber |
| `verify --config self/urn-forge.config.ts` | 3069 ms | Gate 2 parses the 584 files of gate 1 again (C4), and TypeScript loads slowly (C2) |

The cause is one import graph. `cli.ts` imports each command statically, and `self.ts` (urn-forge's own harness, which each report runs) imports `self/core.ts`, which reaches `diff/command.ts` (and so `compile.ts` and TypeScript) and `gherkin/steps.ts` (and so Cucumber) for three pure values: `allowsBreaking`, `STEPS` and `GATES`. Those modules import `self.ts` back, a cycle that works today only by the order of evaluation (B1).

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The pure decisions of `self/` | **Move them to modules with no imports: `STEPS` to `gherkin/patterns.ts` (B9), `allowsBreaking` and `allowsWeaker` to `diff/versions.ts`, and `GATES`, `gatePasses` and `uncoveredRules` to `verify/gate-rules.ts` (B1). The old modules re-export them. `self/core.ts` imports only these** | The harness of `self/` then loads no TypeScript and no Cucumber, and the cycles through `self.ts` end. The `// self:` markers move with the functions, so the test of direct calls keeps its cover |
| 2 | What `--help` loads | **`--help`, `-h`, `help`, `--version`, no command and an unknown command load nothing but `cli.ts`, `config.ts` and `package.json`. Each command loads its own module with `await import()` when it runs (C1)** | The usage and the version need no compiler. The floor that the spec measured is about 60 ms |
| 3 | A test of what loads | **A test runs the binary with a resolve hook, and fails if `--help` or `--version` resolves `typescript` or `@cucumber/cucumber`. A second test fails on a runtime import cycle in `src/` and `self/`** | A timing test is flaky on a shared CI machine; what loads is exact. A new static import in `cli.ts` would undo the gain without a word |
| 4 | How TypeScript loads | **Through `createRequire`, once, on first use (C2), in one module `src/ts.ts`. A type position uses `import type`** | It is the same package and version. The spec measured about 250 ms against about 610 ms after tsx |
| 5 | Gate 2's program | **One caching compiler host for each `verify`: gate 2 reuses the source files that gate 1 parsed, with `oldProgram` (C4)** | The spec measured 51 ms against 465–586 ms. It is how TypeScript's own watch mode shares files between programs |
| 6 | `lineOf` | **Parse the manifest once for each domain, and only when a diagnostic has no line (C6)** | The output does not change. `lineOf` keeps its export |
| 7 | The compile cache of V8 | **`module.enableCompileCache?.()` in the bin (C9)** | Two lines, and a no-op where Node does not have it |
| 8 | Plain JS checks (C3) | **Not in this plan. Measure `compile` and `diff` after step 4, and plan C3 then if they are still slow** | It changes the checks that `compile` runs on the arguments of each rule use, which the generated file must match: medium risk, for the two commands that an agent runs least |

Not in this plan: the incremental `.tsbuildinfo` of gate 1 (C5, optional in the spec).

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 1 | The two tests of decision 3, with `it.fails` | They fail: `--help` resolves both packages, and the cycles are found |
| 2 | The pure modules of decision 1 | The cycle test passes; each test of `self/` passes |
| 3 | The commands loaded on demand (decision 2) | The test of what `--help` loads passes. `--help` is under 200 ms here |
| 4 | TypeScript through `createRequire` (decision 4), and the compile cache (decision 7) | `compile`, `diff` and `verify` are each faster by about 300 ms |
| 5 | The caching host of gates 1 and 2 (decision 5), and `lineOf` once (decision 6) | `verify` on `self/` is under 2.4 s here |
| 6 | The times before and after in these notes, the measurement of `compile` and `diff` for decision 8, and the docs that name a moved module | The check passes; the notes give each time |

## Sabotages

1. Import `compile.js` statically in `cli.ts` again → the test of what `--help` loads.
2. Import `diff/command.js` in `self/core.ts` again → the cycle test and the test of what `--help` loads.
3. Build gate 2's program without the shared host → not caught by a test (decision 3 tests what loads, not how fast). Record it as a limit: the notes give the time of `verify`, and a later change can measure it again.

## Risks

- **Moved functions.** `tests/self.test.ts` reads the shell files as text to find a direct call of a declared decision. The new modules must keep the `// self:` markers, and the list of shell files must name any new command module.
- **The public paths stay.** `urn-forge/cucumber` keeps `STEPS`, and the old modules re-export each moved name.
