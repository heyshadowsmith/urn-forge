# Run verify in CI

This guide makes `urn-forge verify` a step of a GitHub Actions job, next to the tests and the scenarios. It also turns the problems into annotations on the pull request, and adds a job that makes sure that the output does not depend on the time zone or the locale.

The example is the workflow of the urn-forge repository, `.github/workflows/ci.yml`.

## Before you start

- `urn-forge verify` passes on your computer. Refer to [Fix a gate that fails](fix-a-failing-gate).
- Your repository has a `package-lock.json`, so `npm ci` can install the dependencies.
- The generated files are committed. Gate 4 compares the committed files with a new compile.

## Add the job

The `traceability` job of urn-forge runs each check in its own step:

<<< @/../.github/workflows/ci.yml{32-34,39,46,49-52,54-57}

1. Install the dependencies in a step that has an `id`, for example `install`.
2. Add one step for each check:
   - `npm test`, for the unit tests.
   - `npm run typecheck`, for `tsc` over all of the code. Vitest does not type-check.
   - `npx urn-forge verify`, for gates 1, 3 and 4.
   - `npx cucumber-js`, for the scenarios.
3. Give each check step this condition:

   ```yaml
   if: ${{ !cancelled() && steps.install.outcome == 'success' }}
   ```

   Each check then runs after a different check fails. Thus one failure does not hide a second failure, and each failure shows under its own step.

4. If the project is in a subfolder, set `working-directory` on the steps that run urn-forge and Cucumber.
5. Give `verify` the config of the project with `--config`. Refer to [The CLI](../reference/cli).

## Use the exit code

`verify` stops with one of three exit codes:

| Exit code | Meaning |
| --- | --- |
| `0` | Each gate passed. Warnings and notes do not change the exit code |
| `1` | The config or the manifest has an error, or a gate failed |
| `2` | The command line is incorrect, for example an unknown option or `--format jsn` |

A step fails when its command stops with a code that is not `0`. You do not have to do more.

## Show the problems as annotations

With `--format json`, `verify` writes one JSON object on each line to stdout. The result line comes last:

```bash
npx urn-forge verify --config example/urn-forge.config.ts --format json
```

```
{"type":"gate","gate":1,"name":"completeness","ok":true,"summary":"tsc: 0 error(s) over example/core.ts; `core` satisfies DomainCoreImplementation"}
{"type":"gate","gate":3,"name":"gherkin","ok":true,"summary":"2 feature(s), 4 scenario(s), 2/2 operations tagged, strict: 2/2 features (boundaryCoverage: error)"}
{"type":"gate","gate":4,"name":"drift","ok":true,"summary":"2 generated file(s) compared byte for byte against example/generated"}
{"type":"result","ok":true,"failedGates":[],"warnings":0}
```

Each problem is a line with `"type":"diagnostic"`, before the gate lines:

```
{"type":"diagnostic","gate":3,"severity":"error","code":"undeclared-error","file":"tutorial/3-strict-coverage/features/quote_shipping.feature","line":30,"column":5,"urn":"urn:demo:shipping:quote:operation:quote_shipping","message":"\"urn:demo:shipping:quote:error:too_heavy\" is not a declared error of urn:demo:shipping:quote:operation:quote_shipping (errors: urn:demo:shipping:quote:error:too_heavy_for_express)"}
```

[JSON output](../reference/json-output) gives each property.

To make annotations:

1. Replace the `verify` step with this step. `jq` is installed on the GitHub runners.

   ```yaml
         - name: urn-forge verify
           if: ${{ !cancelled() && steps.install.outcome == 'success' }}
           working-directory: packages/urn-forge
           run: |
             status=0
             npx urn-forge verify --config example/urn-forge.config.ts --format json > verify.jsonl || status=$?
             jq -r 'select(.type == "gate") | "gate \(.gate) \(.name) \(if .ok then "PASS" else "FAIL" end)  \(.summary)"' verify.jsonl
             jq -r --arg dir packages/urn-forge/ 'select(.type == "diagnostic")
               | "::\(if .severity == "note" then "notice" else .severity end) file=\($dir)\(.file)\(if .line then ",line=\(.line),col=\(.column)" else "" end),title=\(.code)::\(.message | gsub("%"; "%25") | gsub("\r"; "%0D") | gsub("\n"; "%0A"))"' verify.jsonl
             exit "$status"
   ```

   - `|| status=$?` keeps the exit code of `verify`. Without it, the shell stops the step before `jq` runs.
   - The first `jq` line writes the gate summaries to the log.
   - The second `jq` line writes one workflow command for each problem: `error`, `warning`, or `notice` for a note.
   - `--arg dir` gives the path from the root of the repository to the working directory. `verify` writes paths relative to the folder where it runs, and an annotation needs a path from the root.
   - `gsub` changes `%`, carriage returns and line feeds into the form that a workflow command accepts. A `type-error` message can have more than one line.
   - `exit "$status"` fails the step when `verify` failed.

2. Change the config path and `dir` for your project.

When a scenario expects an error that the operation does not declare, the step writes these lines to the log. GitHub shows the first one on line 30 of the feature file:

```
gate 1 completeness PASS  tsc: 0 error(s) over tutorial/3-strict-coverage/core.ts; `core` satisfies DomainCoreImplementation
gate 3 gherkin FAIL  1 feature(s), 6 scenario(s), 1/1 operations tagged, 0/1 errors expected, strict: 1/1 features (boundaryCoverage: error)
gate 4 drift PASS  2 generated file(s) compared byte for byte against tutorial/3-strict-coverage/generated
::error file=packages/urn-forge/tutorial/3-strict-coverage/features/quote_shipping.feature,line=30,col=5,title=undeclared-error::"urn:demo:shipping:quote:error:too_heavy" is not a declared error of urn:demo:shipping:quote:operation:quote_shipping (errors: urn:demo:shipping:quote:error:too_heavy_for_express)
::error file=packages/urn-forge/tutorial/3-strict-coverage/features,title=uncovered-error::error urn:demo:shipping:quote:error:too_heavy_for_express of urn:demo:shipping:quote:operation:quote_shipping has no scenario that expects it; add one with Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express"
```

A problem without a line, such as `uncovered-error`, has the features folder as its file. GitHub shows it in the summary of the run.

## Add the determinism job

urn-forge must give the same bytes and the same result in each time zone and locale. The `determinism` job of urn-forge runs the checks again with a Turkish locale and the time zone of the Chatham Islands (UTC+12:45):

<<< @/../.github/workflows/ci.yml{85-116}

1. Add a job that sets `TZ`, `LANG` and `LC_ALL` in `env`.
2. Run `compile` for each domain, then `git diff --exit-code`. If `compile` writes a different byte, `git diff` fails the step.
3. Run `verify` for each domain.

The Turkish locale changes how letters change case and how strings sort. A generator that uses the locale gives different files there. [Determinism and the fingerprint](../explanation/determinism) tells why urn-forge must not.

## Result

A pull request that breaks the chain fails the job:

- A handler that is not there fails the `urn-forge verify` step at gate 1.
- A table header that is not a field fails it at gate 3.
- An edit to a generated file fails it at gate 4.
- A failed scenario fails the `cucumber-js` step.

Each problem of `verify` shows as an annotation on its file and line.

## Related pages

- [Fix a gate that fails](fix-a-failing-gate)
- [The CLI](../reference/cli)
- [JSON output](../reference/json-output)
- [Verification gates](../reference/verification-gates)
- [Determinism and the fingerprint](../explanation/determinism)
