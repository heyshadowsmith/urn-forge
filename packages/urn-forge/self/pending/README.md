# self/pending

Code for `self/` that the compiler cannot check yet. It is the target of
[the error kind plan](../../../../docs/project/error-kind-plan.md), written first (step 0):

| File | Moves into | When |
| --- | --- | --- |
| `../../tests/fixtures/self-errors/domain.manifest.yaml` | `self/domain.manifest.yaml` | Step 3, when the manifest compiles |
| `core.ts` | `self/core.ts` | Step 3, when `ok` and `fail` exist |
| `features/parse_short_key.feature` | `self/features/` | Step 4, when the step `the operation fails with` exists |

This directory is excluded from `tsc` (tsconfig.json), and neither `verify:self` nor the `self`
Cucumber profile reads it. When it is empty, remove it.
