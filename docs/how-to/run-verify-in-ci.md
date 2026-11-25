# Run verify in CI

Run `urn-forge verify`, the scenarios and `urn-forge diff` on every pull request, so that a change that breaks the contract cannot merge.

## Before you start

- `npx urn-forge verify` passes on your computer.
- The generated files are committed. Gate 4 compares them with a fresh compile.

## The workflow

This GitHub Actions job runs each check, even after another has failed, so one failure does not hide a second one:

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

`fetch-depth: 0` fetches the base branch, so the `diff` step can read the manifest as it was. If the project is in a subfolder, set `working-directory` on each step.

`verify` and `diff` exit with `0` on a pass (warnings included), `1` on a failure and `2` on a wrong command line.

## What fails the job

| A change that | Fails |
| --- | --- |
| Leaves an operation without a function in the core, or gives one the wrong type | `verify`, gate 1 |
| Calls the core from the shell without `runOperation` | `verify`, gate 2 |
| Adds an operation, output or rule with no scenario, with `coverage: 'error'` | `verify`, gate 3 |
| Edits a generated file, or forgets to run `compile` | `verify`, gate 4 |
| Makes the core give a wrong value, or break a rule of an output | `cucumber-js` |
| Can break a caller without a new major version | `diff` |

## When a gate fails

Read the indented lines under the gate that shows `FAIL`. Each is one problem, with a file, a line when there is one, a code and a message that says what to do:

```
gate 4  drift         FAIL  1 generated file(s) compared byte for byte against src/generated
    src/generated/domain.generated.ts:246  error  drift  the generated file is not current; run urn-forge compile
verify failed: gate 4
```

Fix the first problem first; others often go with it. If the manifest does not compile, `verify` runs no gate: correct the manifest at the line it gives. [Diagnostics](../reference/diagnostics) lists every code with its fix.

Do not silence a gate. Removing `satisfies DomainCore` fails gate 1 with `core-not-satisfying`, and `@ts-ignore` in the core or the shell fails gate 2 with `suppressed-check`.
