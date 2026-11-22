# Change the contract

A URN never changes its meaning. Callers and stored rows depend on it. This guide shows which changes break callers, makes `urn-forge diff` find them in CI, and shows how to retire or rename an atom without a break.

The examples come from [`packages/urn-forge/insurance/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/insurance/). The commands ran from `packages/urn-forge`. In your project, run them from the folder of `urn-forge.config.ts`, and leave out `--config`.

## Before you start

- The manifest compiles. `diff` compiles the two manifests, and stops if one of them does not compile.
- The old manifest is in git, for example on the branch `main`.

## 1. Know what breaks callers

`diff` finds three uses of each URN. A change breaks a use if it makes a value that worked before fail:

| Use | Where the value goes | A change that breaks |
| --- | --- | --- |
| In | The input of an operation: callers send it | A narrower set of values: a tighter constraint, a new required property, a new invariant |
| Out | The output of an operation, an event, or the payload of a declared error: callers receive it | A wider set of values: a looser constraint, a property that becomes optional, a new enum value, a new declared error, a new event |
| Stored | A table of the `postgres` plugin: the database stores it | A narrower set of values. The rows in the database must stay valid |

A URN that has two uses obeys the rules of both. These changes are also breaking:

- A removed atom, also a sunset atom.
- A status that moves back, for example `sunset` to `active`.
- A change of `regex`, `format` or an invariant `rule`. `diff` cannot compare two patterns or two rules.

The rule of thumb: do not change the meaning of a URN that callers use. Declare a new atom, and retire the old one (steps 4 to 7). For the reasons, refer to [Compatibility and the direction of use](../explanation/compatibility).

## 2. Run diff

1. Write the old manifest to a file:

   ```bash
   git show origin/main:./insurance/domain.manifest.yaml > old.manifest.yaml
   ```

2. Give the old manifest first, then the new manifest:

   ```bash
   npx urn-forge diff old.manifest.yaml insurance/domain.manifest.yaml --config insurance/urn-forge.config.ts
   ```

3. If the project uses the `postgres` plugin, give the config. Without it, `diff` does not know which values the database stores. If the current folder has `urn-forge.config.ts`, `diff` reads it without the option.

| Exit code | Meaning |
| --- | --- |
| `0` | No breaking change, or the old manifest is experimental |
| `1` | A breaking change, or a manifest does not compile |
| `2` | The command line is incorrect, for example only one manifest |

To run `diff` in CI on each pull request, add this job to your workflow:

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

- GitHub checks out a pull request as a merge commit. `HEAD^1` is the tip of the base branch. `fetch-depth: 2` puts it in the clone.
- Change the paths of the manifest and the config for your project. If the project is in a subfolder, set `working-directory` on the step.
- If the base branch has no manifest yet, `git show` fails. Add the job after the first manifest is on the base branch.

## 3. Read the result

`diff` writes one line for each change, in URN order, then a summary. Each line has the class, the URN, and what changed:

| Class | Meaning | What to do |
| --- | --- | --- |
| `compatible` | No caller and no stored row can fail because of the change | Nothing |
| `lifecycle` | The status of an atom moved forward, or its `supersededBy` or `sunsetDate` changed | Tell the callers |
| `breaking` | A caller or a stored row that worked before can fail now | Undo the change. Declare a new atom in its place |

The insurance coverage is in the input and the output of `issue_policy`, and in a table. Thus a tighter `maxLength` on `remark` breaks callers and rows:

```
breaking    urn:acme:insurance:policy:field:remark  maxLength 40 → 30 narrows a value that callers send and callers receive and the database stores, which breaks callers that send it and rows already stored
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

A new declared error is a result that a caller does not know. Thus it is breaking, also if the error itself is new:

```
compatible  urn:acme:insurance:policy:error:policy_already_cancelled  is new
breaking    urn:acme:insurance:policy:operation:cancel_policy  the new declared error urn:acme:insurance:policy:error:policy_already_cancelled widens a value that callers receive, which breaks callers that receive it
diff failed: 1 breaking, 1 compatible, 0 lifecycle change(s)
```

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

A compatible change to a stored atom can need a change to a table, for example a new column. `diff` then adds `; the database needs a migration for it`. urn-forge writes only `CREATE` statements, so you write the migration.

For JSON output (`--format json`), refer to [The CLI](../reference/cli).

### Use an experimental manifest

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

To publish the manifest, remove `stability: experimental`. From the next change, each breaking change fails. To add `stability: experimental` back is a breaking change.

## 4. Declare the replacement and deprecate the old atom

The insurance domain retires `policy.field.note`, which has no length limit, for `policy.field.remark`.

1. Add the new atom with a new short key, so it gets a new URN.
2. Add `status`, `supersededBy` and `sunsetDate` to the old atom:

   ```yaml
   policy.field.note:
     primitive: string
     description: Free text about a coverage
     status: deprecated
     supersededBy: policy.field.remark
     sunsetDate: 2027-06-30
   policy.field.remark:
     primitive: string
     maxLength: 40
     description: Free text about a coverage, at most 40 characters
   ```

   | Key | Value |
   | --- | --- |
   | `status` | `active` (the default), `deprecated` or `sunset`. A status moves forward only |
   | `supersededBy` | The short key of the replacement. It must be an atom of the same kind |
   | `sunsetDate` | The first day on which a reference to the atom is an error, as `YYYY-MM-DD` |

   Each kind accepts these keys. If they are not correct, `compile` stops with `invalid-lifecycle`, `wrong-ref-kind` or `unresolved-ref`. Refer to [Diagnostics](../reference/diagnostics).

3. Keep the old atom in each entity that uses it. Add the replacement beside it:

   ```yaml
   policy.entity.coverage:
     description: One peril that a policy covers, up to a limit
     key: policy.field.peril
     fields:
       - ref: policy.field.peril
       - ref: policy.field.limit
       - ref: policy.field.note
         required: false
       - ref: policy.field.remark
         required: false
   ```

   With both properties, a caller can move to `remark` at any time before the sunset date.

4. Run `diff`. It shows no breaking change:

```
compatible  urn:acme:insurance:policy:entity:coverage  adds the optional property "remark"; the database needs a migration for it
lifecycle   urn:acme:insurance:policy:field:note  status active → deprecated
compatible  urn:acme:insurance:policy:field:remark  is new
diff passed: 0 breaking, 2 compatible, 1 lifecycle change(s)
```

## 5. Read the deprecation warning

Run `compile`. It warns about each active atom that refers to the deprecated atom:

```
insurance/domain.manifest.yaml:79:12  warning  deprecated-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, which is deprecated (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30)
unchanged  insurance/generated/domain.runtime.generated.ts
unchanged  insurance/generated/domain.schemas.generated.ts
unchanged  insurance/generated/domain.store.generated.ts
unchanged  insurance/generated/schema.generated.sql
fingerprint sha256:cdd7f3a5a0f84f5f5d6d2f874a7e15be48b16ddf85506fbf72fc053a65322dd2
```

- The location is the reference, not the deprecated atom.
- A warning does not stop `compile` or `verify`.
- The deprecated atom still makes all of its code. The TypeScript marks it with `@deprecated`, so an editor shows the name crossed out.

## 6. Set the reference date

urn-forge never reads the clock. It compares each `sunsetDate` with a reference date that you give:

- On the command line: `--reference-date 2026-11-21` on `compile` or `verify`.
- In the config: `referenceDate: '2026-11-21'`. The command line option overrides it.

In CI, use the date of the commit, so one commit always gives one result. Refer to [Run verify in CI](run-verify-in-ci). On or after the sunset date, a reference to the atom is an error:

```
insurance/domain.manifest.yaml:79:12  error  sunset-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, whose sunset date 2027-06-30 is on or before the reference date 2027-07-01 (superseded by urn:acme:insurance:policy:field:remark); refer to its replacement
verify failed: the manifest does not compile
```

Before the sunset date, move each use of the old atom to the replacement:

1. Change the scenarios that send or expect the old property.
2. Change the core and the shell, if they read or write the old property.
3. Tell the callers outside your repository to move.

## 7. Sunset the old atom, and keep it

1. Remove the last references to the old atom from the entities of the manifest.
2. In the same change, set `status: sunset`. Keep `supersededBy` and `sunsetDate`, so a reader can find the replacement.
3. Run `diff`. The deprecation announced the removal, so `diff` reports lifecycle changes:

```
lifecycle   urn:acme:insurance:policy:entity:coverage  removes the property "note", whose target urn:acme:insurance:policy:field:note was deprecated
lifecycle   urn:acme:insurance:policy:field:note  status deprecated → sunset
diff passed: 0 breaking, 0 compatible, 2 lifecycle change(s)
```

A sunset atom makes no code: no schema, no type, no SQL, and no handler. If an active atom still refers to it, `compile` stops with `sunset-ref`.

Do not delete the sunset atom. It keeps its URN in use, so no new atom can get that URN with a different meaning. `diff` reports a deletion as a breaking change:

```
breaking    urn:acme:insurance:policy:field:note  is removed; keep a sunset atom in the manifest, so its URN is never used again
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

## 8. Rename a required input field without a break

Callers must send a required input field, so they cannot move to a replacement. A new required property is breaking, and so is the changed rule of an invariant that names the field. Thus do not rename it in place. Declare a new operation, and retire the old one:

1. Declare the new field, `policy.field.stop_date`.
2. Declare a new input entity with the new field, `policy.entity.stop_request`, and its invariants, here `policy.invariant.stop_within_term`.
3. Declare a new operation, `policy.operation.stop_policy`. Give it the same output, errors and events as the old operation.
4. Deprecate the old operation:

   ```yaml
   policy.operation.cancel_policy:
     description: Stop a policy and calculate the refund for the days it does not cover
     status: deprecated
     supersededBy: policy.operation.stop_policy
     sunsetDate: 2027-12-31
     # …
   policy.operation.stop_policy:
     description: Stop a policy and calculate the refund for the days it does not cover
     input: policy.entity.stop_request
     output: policy.entity.refund_quote
     errors:
       - policy.error.refund_below_minimum
     emits: [policy.event.policy_cancelled]
   ```

5. Write the handler and the scenarios of the new operation. The old operation keeps its handler until its sunset.

`diff` shows no breaking change. An invariant on a new entity is compatible, because no caller sent that entity before:

```
compatible  urn:acme:insurance:policy:entity:stop_request  is new
compatible  urn:acme:insurance:policy:field:stop_date  is new
compatible  urn:acme:insurance:policy:invariant:stop_within_term  is new, on the new entity urn:acme:insurance:policy:entity:stop_request
lifecycle   urn:acme:insurance:policy:operation:cancel_policy  status active → deprecated
compatible  urn:acme:insurance:policy:operation:stop_policy  is new
diff passed: 0 breaking, 4 compatible, 1 lifecycle change(s)
```

At the sunset date, sunset the old operation as in step 7. Also sunset the old entity and field if nothing else uses them.

## Result

- A pull request that changes the meaning of a live URN fails the `compatibility` job.
- The new atom has its own URN, and callers use it.
- The old atom has `status: sunset`, and it stays in the manifest.

## Related pages

- [Compatibility and the direction of use](../explanation/compatibility)
- [The CLI](../reference/cli)
- [The manifest](../reference/manifest)
