# Check compatibility in CI

`urn-forge diff` compares two versions of a manifest. It classifies each change to a URN as compatible, breaking or lifecycle. This guide runs `diff` on your computer and in CI, reads the result, and fixes a breaking change. `diff` is gate 5. It is a separate command, not a part of `verify`.

The examples come from [`packages/urn-forge/insurance/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/insurance/), which CI tests, and from the `compatibility` job of [`.github/workflows/ci.yml`](https://github.com/heyshadowsmith/urn-forge/tree/main/.github/workflows/ci.yml).

The commands on this page ran in a clone of the urn-forge repository, from `packages/urn-forge`. In your project, run them from the folder of `urn-forge.config.ts`, and leave out `--config`.

## Before you start

- The manifest compiles. `diff` compiles the two manifests, and stops if one of them does not compile.
- The old manifest is in git, for example on the branch `main`.
- If the project uses the `postgres` plugin, you know the path of the config.

## 1. Run diff on your computer

1. Write the old manifest to a file:

   ```bash
   git show origin/main:./insurance/domain.manifest.yaml > old.manifest.yaml
   ```

   `./` makes the path relative to the current folder.

2. Give the old manifest first, then the new manifest:

   ```bash
   npx urn-forge diff old.manifest.yaml insurance/domain.manifest.yaml --config insurance/urn-forge.config.ts
   ```

In this example, the change of the branch deprecates `policy.field.note` for `policy.field.remark`. The old manifest has `note` with `status: active`, and no `remark`. The new manifest is the insurance manifest of today. `diff` writes one line for each change, then a summary:

```
compatible  urn:acme:insurance:policy:entity:coverage  adds the optional property "remark"
lifecycle   urn:acme:insurance:policy:field:note  status active → deprecated
compatible  urn:acme:insurance:policy:field:remark  is new
diff passed: 0 breaking, 2 compatible, 1 lifecycle change(s)
```

Each line has the class, the URN that changed, and what changed. The lines are in URN order.

| Exit code | Meaning |
| --- | --- |
| `0` | No breaking change, or the old manifest is experimental |
| `1` | A breaking change, or a manifest does not compile |
| `2` | The command line is incorrect, for example only one manifest |

## 2. Read each class

| Class | Meaning | What to do |
| --- | --- | --- |
| `compatible` | No caller and no stored row can fail because of the change | Nothing |
| `lifecycle` | The status of an atom moved forward, or its `supersededBy` or `sunsetDate` changed | Tell the callers. Refer to [Retire a URN](retire-a-urn) |
| `breaking` | A caller or a stored row that worked before can fail now | Do not make the change. Refer to step 4 |

Who can fail depends on how the manifest uses the URN. `diff` finds three uses:

| Use | Where the value goes | A change that breaks |
| --- | --- | --- |
| In | The input of an operation: callers send it | A narrower set of values: a tighter constraint, a new required property, a new invariant |
| Out | The output of an operation, or the payload of a declared error: callers receive it | A wider set of values: a looser constraint, a property that becomes optional, a new declared error |
| Stored | A table of the `postgres` plugin: the database stores it | A narrower set of values. The rows that are already in the database must stay valid. A new required list that can be empty does not break them: a row with no items holds the empty list |

A URN that has two uses obeys the rules of both. The insurance coverage is in the input and the output of `issue_policy`, and in a table. Thus a tighter `maxLength` on `remark` breaks callers and rows:

```
breaking    urn:acme:insurance:policy:field:remark  maxLength 40 → 30 narrows a value that callers send and callers receive and the database stores, which breaks callers that send it and rows already stored
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

A looser `maxLength` breaks the callers that receive it:

```
breaking    urn:acme:insurance:policy:field:remark  maxLength 40 → 50 widens a value that callers send and callers receive and the database stores, which breaks callers that receive it
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

A new declared error is a new result that a caller does not know. Thus it is breaking, also if the error itself is new. Here the new manifest adds the error `policy.error.policy_already_cancelled` and lists it in the `errors` of `cancel_policy`:

```
compatible  urn:acme:insurance:policy:error:policy_already_cancelled  is new
breaking    urn:acme:insurance:policy:operation:cancel_policy  the new declared error urn:acme:insurance:policy:error:policy_already_cancelled widens a value that callers receive, which breaks callers that receive it
diff failed: 1 breaking, 1 compatible, 0 lifecycle change(s)
```

These changes are breaking too:

- A removed atom, also a sunset atom.
- A status that moves back, for example `sunset` to `active`.
- A change of `regex`, `format` or an invariant `rule`. `diff` cannot compare two patterns or two rules, so it treats each change as breaking for each use.

For the reasons, refer to [Compatibility and the direction of use](../explanation/compatibility).

Each output on this page and on the pages [Retire a URN](retire-a-urn) and [Emit an event](emit-an-event) comes from one change to the current insurance manifest. `tests/docs-diff.test.ts` makes each pair of manifests, runs `diff`, and makes sure that the page shows the same output.

## 3. Give the config for the Stored use

`diff` reads the `tables` of the `postgres` plugin from the config. It reads nothing else from the config. Without the config, `diff` does not know which values the database stores.

`customer.field.name` is in the `customer` table, but no operation sends or receives it. With the config, a tighter `minLength` is breaking:

```
breaking    urn:acme:insurance:customer:field:name  minLength 1 → 2 narrows a value that the database stores, which breaks rows already stored
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

Without `--config`, the same change is compatible:

```
compatible  urn:acme:insurance:customer:field:name  minLength 1 → 2 narrows a value that nothing uses
diff passed: 0 breaking, 1 compatible, 0 lifecycle change(s)
```

If the project uses the `postgres` plugin, always give `--config`. If the current folder has `urn-forge.config.ts`, `diff` reads it without the option.

## 4. Fix a breaking change

Do not change the meaning of a URN that callers use. Declare a new atom, and deprecate the old one:

1. Undo the change to the old atom.
2. Add a new atom with the new meaning, for example `policy.field.short_remark` with `maxLength: 30`.
3. Add the new atom beside the old one in each entity that uses the old one.
4. Give the old atom `status: deprecated`, `supersededBy` and `sunsetDate`.

```yaml
policy.field.remark:
  primitive: string
  maxLength: 40
  description: Free text about a coverage, at most 40 characters
  status: deprecated
  supersededBy: policy.field.short_remark
  sunsetDate: 2027-12-31
policy.field.short_remark:
  primitive: string
  maxLength: 30
  description: Free text about a coverage, at most 30 characters
```

`diff` then shows no breaking change:

```
compatible  urn:acme:insurance:policy:entity:coverage  adds the optional property "short_remark"
lifecycle   urn:acme:insurance:policy:field:remark  status active → deprecated
compatible  urn:acme:insurance:policy:field:short_remark  is new
diff passed: 0 breaking, 2 compatible, 1 lifecycle change(s)
```

For the steps after the deprecation, refer to [Retire a URN](retire-a-urn).


### Add a value to an enum

A new value in `values` widens the field. If only callers that send the field use it, or only the database, the change is compatible. If a caller receives the field, the change is breaking: a caller that switches on the values does not know the new one. The insurance `peril` is in the output of `issue_policy`, so a new peril `hail` is breaking:

```
breaking    urn:acme:insurance:policy:field:peril  values ["fire","flood","theft"] → ["fire","flood","theft","hail"] widens a value that callers send and callers receive and the database stores, which breaks callers that receive it
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

Select one of these:

- **Tell the callers, and accept the break.** If you know each caller, ask each one to accept the new value first. Then make the change, and give the manifest a new major `version`. `diff` still reports the change as breaking: it does not know your callers.
- **Declare a new field** with all the values, add it beside the old one, and deprecate the old one, as above. Use this if you cannot reach each caller.
- **Use `stability: experimental`** while the manifest is new and its callers expect changes. Refer to step 6.

urn-forge has no "open" enum that callers must read as "any value". A caller that can get any value needs a `string` field.
## 5. Run diff in CI

The `compatibility` job of urn-forge runs `diff` for each domain of the repository on each pull request (highlighted):

<<< @/../.github/workflows/ci.yml{133-157}

- `if` runs the job on pull requests only.
- GitHub checks out a pull request as a merge commit. `HEAD^1` is the tip of the base branch, so the diff shows only the changes of the pull request.
- `fetch-depth: 2` gets the merge commit and its parents. Without it, `HEAD^1` is not in the clone.

The script `scripts/diff-base.mjs` writes the manifest of each domain at the git ref to a temporary file. Then it runs `diff` with the config of the domain. A domain that is not at the ref is new, and the script does not compare it. To run it on your computer, give a ref:

```bash
npm run diff:base -- origin/main
```

If one domain has a breaking change, the script stops with exit code 1:

```
insurance/domain.manifest.yaml
breaking    urn:acme:insurance:policy:field:remark  maxLength 40 → 30 narrows a value that callers send and callers receive and the database stores, which breaks callers that send it and rows already stored
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)

1 domain(s) have a breaking change: declare a new URN and deprecate the old one
```

The CI of urn-forge adds `--report`. The domains of the urn-forge repository are test domains, which change to test new features. With `--report`, the script prints each breaking change, adds one line, and stops with exit code 0:

```
1 domain(s) have a breaking change: declare a new URN and deprecate the old one
(--report: printed, not a failure)
```

Do not use `--report` for a domain that other people use. The tests of urn-forge make sure that `diff` fails on each breaking change.

For a project with one manifest, a script is not necessary. Add this job to your workflow:

```yaml
  compatibility:
    if: ${{ github.event_name == 'pull_request' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 2

      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm

      - run: npm ci

      - name: urn-forge diff
        run: |
          git show HEAD^1:./domain.manifest.yaml > "$RUNNER_TEMP/old.manifest.yaml"
          npx urn-forge diff "$RUNNER_TEMP/old.manifest.yaml" domain.manifest.yaml --config urn-forge.config.ts
```

1. Change the paths of the manifest and the config for your project.
2. If the project is in a subfolder, set `working-directory` on the step.
3. If the base branch has no manifest yet, `git show` fails. Add the job after the first manifest is on the base branch.

## 6. Use an experimental manifest

While a manifest is new, its callers expect changes. Add `stability: experimental` to the header:

```yaml
manifest:
  namespace: acme
  domain: insurance
  version: 0.1.0
  stability: experimental
```

If the old manifest is experimental, each breaking change is a warning, and `diff` stops with exit code 0:

```
breaking    urn:acme:insurance:policy:field:remark  maxLength 40 → 30 narrows a value that callers send and callers receive and the database stores, which breaks callers that send it and rows already stored
diff passed: 1 breaking, 0 compatible, 0 lifecycle change(s); the breaking changes are warnings, because old.manifest.yaml is experimental
```

To publish the manifest, remove `stability: experimental`. `diff` reports this as compatible:

```
compatible  urn:acme:insurance  stability experimental → stable: from now on, a breaking change fails
```

From the next change, each breaking change fails. To add `stability: experimental` back is a breaking change.

## 7. Get JSON output

With `--format json`, `diff` writes one JSON object on each line to stdout. A compatible change and a lifecycle change are `"type":"change"` lines. The result line comes last:

```
{"type":"change","class":"compatible","urn":"urn:acme:insurance:policy:entity:coverage","message":"adds the optional property \"remark\""}
{"type":"change","class":"lifecycle","urn":"urn:acme:insurance:policy:field:note","message":"status active → deprecated"}
{"type":"change","class":"compatible","urn":"urn:acme:insurance:policy:field:remark","message":"is new"}
{"type":"result","ok":true,"breaking":0,"compatible":2,"lifecycle":1}
```

A breaking change is a `"type":"diagnostic"` line with the code `breaking-change`. Its `file` is the new manifest, and it has no line. Its `severity` is `error`, or `warning` if the old manifest is experimental:

```
{"type":"diagnostic","severity":"error","code":"breaking-change","file":"insurance/domain.manifest.yaml","urn":"urn:acme:insurance:policy:field:remark","message":"urn:acme:insurance:policy:field:remark: maxLength 40 → 30 narrows a value that callers send and callers receive and the database stores, which breaks callers that send it and rows already stored"}
{"type":"result","ok":false,"breaking":1,"compatible":0,"lifecycle":0}
```

To make annotations from the diagnostic lines, use the `jq` step of [Run verify in CI](run-verify-in-ci). For each property, refer to [JSON output](../reference/json-output).

## Result

A pull request that changes the meaning of a live URN fails the `compatibility` job. The log names each URN, the use that the change breaks, and the callers or rows that it breaks.

## Related pages

- [Retire a URN](retire-a-urn)
- [The CLI](../reference/cli)
- [JSON output](../reference/json-output)
- [Compatibility and the direction of use](../explanation/compatibility)
- [Run verify in CI](run-verify-in-ci)
