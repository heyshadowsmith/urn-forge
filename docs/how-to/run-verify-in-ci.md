# Run verify in CI

Make `urn-forge verify` a step of a GitHub Actions job, next to the scenarios.

## Before you start

- `npx urn-forge verify` passes on your computer. Refer to [Fix a failing gate](fix-a-failing-gate).
- Your repository has a `package-lock.json`.
- The generated files are committed. Gate 4 compares them with a new compile.

## Steps

1. Make `.github/workflows/ci.yml` with the job in the example.
2. Install the dependencies in a step with an `id`, for example `install`.
3. Add one step for each check: `verify`, the scenarios, and `tsc` over the whole project.
4. Give each check step the `if:` condition of the workflow below. It runs the step if the install passed, also after a different check failed. Thus one failure does not hide a second failure.
5. If the project is in a subfolder, set `working-directory` on each check step.
6. To check each change to the manifest for breaks, add a step that runs `urn-forge diff`. Refer to [Change the contract](change-the-contract).

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
        with:
          fetch-depth: 0

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

      - name: urn-forge diff
        if: ${{ !cancelled() && steps.install.outcome == 'success' && github.event_name == 'pull_request' }}
        run: |
          git show "origin/${{ github.base_ref }}:domain.manifest.yaml" > base.manifest.yaml
          npx urn-forge diff base.manifest.yaml domain.manifest.yaml
```

`fetch-depth: 0` gets the base branch, so that the `diff` step can read the manifest as it was.

`verify` stops with exit code `0` if each gate passed, `1` if a gate failed, the config is not valid or the manifest has an error, and `2` if the command line is incorrect. Warnings do not change the exit code. `diff` stops with exit code `1` if a breaking change is not allowed by the versions.

## Result

A pull request that breaks the contract fails the job:

- A function that is not in the core fails `urn-forge verify` at gate 1.
- A shell file that calls the core directly fails it at gate 2.
- A step that names an output that is not there fails it at gate 3.
- An edit to a generated file fails it at gate 4.
- A failed scenario fails `cucumber-js`.
- A breaking change within one major version fails `urn-forge diff`.

## Related pages

- [Fix a failing gate](fix-a-failing-gate)
- [The CLI](../reference/cli)
- [Verification gates](../reference/verification-gates)
