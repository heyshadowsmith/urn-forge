# Run verify in CI

Make `urn-forge verify` a step of a GitHub Actions job, next to the scenarios.

## Before you start

- `npx urn-forge verify` passes on your computer. Refer to [Fix a gate that fails](fix-a-failing-gate).
- Your repository has a `package-lock.json`.
- The generated files are committed. Gate 4 compares them with a fresh compile.

## Steps

1. Make `.github/workflows/ci.yml` with the job in the example.
2. Install the dependencies in a step with an `id`, for example `install`.
3. Add one step for each check: `verify`, the scenarios, and `tsc` over the whole project.
4. Give each check step the `if:` condition of the workflow below: it runs the step if the install passed, also after a different check failed. Thus one failure does not hide a second failure.
5. If the project is in a subfolder, set `working-directory` on each check step.
6. If the manifest has a `sunsetDate`, give `verify` the date of the commit: `--reference-date "$(git log -1 --format=%cs)"`. Refer to [Change the contract](change-the-contract).

## Example

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm

      - name: npm ci
        id: install
        run: npm ci

      - name: urn-forge verify
        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
        run: npx urn-forge verify

      - name: cucumber-js
        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
        run: npx cucumber-js

      - name: typecheck
        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
        run: npx tsc --noEmit -p .
```

`verify` stops with exit code `0` if each gate passed, `1` if a gate failed or the manifest has an error, and `2` if the command line is incorrect. Warnings do not change the exit code.

To show each problem as an annotation on its file and line, run `verify` with `--format json`. It writes one JSON object on each line. Each problem is a line with `"type":"diagnostic"`:

```
{"type":"diagnostic","gate":3,"severity":"error","code":"undeclared-error","file":"tutorial/3-strict-coverage/features/quote_shipping.feature","line":30,"column":5,"urn":"urn:demo:shipping:quote:operation:quote_shipping","message":"\"urn:demo:shipping:quote:error:too_heavy\" is not a declared error of urn:demo:shipping:quote:operation:quote_shipping (errors: urn:demo:shipping:quote:error:too_heavy_for_express)"}
```

Turn each line into a `::error file=…,line=…::…` workflow command, for example with `jq`. For each property, refer to [The CLI](../reference/cli).

## Result

A pull request that breaks the contract fails the job:

- A handler that is not there fails `urn-forge verify` at gate 1.
- A type assertion to a branded type fails it at gate 2.
- A table header that is not a field fails it at gate 3.
- An edit to a generated file fails it at gate 4.
- A failed scenario fails `cucumber-js`.

## Related pages

- [Fix a gate that fails](fix-a-failing-gate)
- [The CLI](../reference/cli)
- [Verification gates](../reference/verification-gates)
