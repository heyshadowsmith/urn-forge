# Run verify in CI

Run `urn-forge verify`, the scenarios and `urn-forge diff` on each pull request. Then a change that breaks the contract cannot merge. Commit the generated files first, because gate 4 compares them with a new compile.

## The workflow

This GitHub Actions job runs each check, also after a different check fails, so that one failure does not hide a second failure:

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

`fetch-depth: 0` fetches the base branch, so that `diff` can read the manifest before the change. If the project is in a subfolder, set `working-directory` on each step.

| A change that | Fails |
| --- | --- |
| Breaks a gate. For example, the core has no function for an operation, or the shell calls the core without the harness. Or a scenario is not there (with `coverage: 'error'`), or a generated file is not current | `verify` |
| Makes the core give a wrong value, or break a rule of an output | `cucumber-js` |
| Adds an output that the shell does not handle | `tsc` |
| Can break a caller without a new major version | `diff` |

## When a gate fails

Read the indented lines below the gate that shows `FAIL`. Each line is one problem. It gives a file, a line if there is one, a code, and the action to do:

```
gate 4  drift         FAIL  1 generated file(s) compared byte for byte against src/generated
    src/generated/domain.generated.ts:424  error  drift  the generated file is not current; run urn-forge compile
```

Correct the first problem first, because this often also corrects other problems. If an error points into a generated file, correct gate 4 first. [The CLI reference](../reference/cli#diagnostics) lists each code with its correction.

Do not disable a gate, because the gates find each attempt to disable them. If you remove `satisfies DomainCore`, gate 1 fails with `core-not-satisfying`. If you put `@ts-ignore` in the core or the shell, gate 2 fails with `suppressed-check`.
