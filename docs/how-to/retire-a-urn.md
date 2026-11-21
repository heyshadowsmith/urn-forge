# Retire a URN

A URN never changes its meaning. To change the meaning of an atom, declare a new atom with a new URN, and retire the old one. This guide deprecates an atom, gives callers time to move to its replacement, and then sets it to `sunset`.

The examples come from [`packages/urn-forge/insurance/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/insurance/), which CI tests. The free text `policy.field.note` has no length limit. The insurance domain retires it for `policy.field.remark`, which has at most 40 characters.

The commands on this page ran in a clone of the urn-forge repository, from `packages/urn-forge`. In your project, run them from the folder of `urn-forge.config.ts`, and leave out `--config`.

## Before you start

- Callers already use the atom, so a change to its meaning breaks them.
- You know the date after which callers must not use the atom.
- Your CI runs `urn-forge diff`. Refer to [Check compatibility in CI](check-compatibility).

::: warning
Do not change the constraints of an atom that callers use, to give it a new meaning. `urn-forge diff` reports a breaking change. Declare a new atom, and retire the old one.
:::

## 1. Declare the replacement

Add the new atom. Use a new short key, so the atom gets a new URN:

```yaml
policy.field.remark:
  primitive: string
  maxLength: 40
  description: Free text about a coverage, at most 40 characters
```

## 2. Deprecate the old atom

Add three keys to the old atom:

```yaml
policy.field.note:
  primitive: string
  description: Free text about a coverage
  # Retired for remark, which is limited in length (lifecycle plan). Callers receive both until the sunset.
  status: deprecated
  supersededBy: policy.field.remark
  sunsetDate: 2027-06-30
```

| Key | Value |
| --- | --- |
| `status` | `active` (the default), `deprecated` or `sunset` |
| `supersededBy` | The short key of the replacement. It must be an atom of the same kind |
| `sunsetDate` | The first day on which a reference to the atom is an error, as `YYYY-MM-DD` |

Each kind accepts these keys: a field, an entity, an invariant, an operation and an error.

If the keys are not correct, `compile` stops. Here `supersededBy` and `sunsetDate` are on an atom without `status`:

```
insurance/domain.manifest.yaml:36:3  error  invalid-lifecycle  policy.field.note.supersededBy: an active atom has no supersededBy; set status: deprecated or status: sunset, or remove supersededBy
insurance/domain.manifest.yaml:37:3  error  invalid-lifecycle  policy.field.note.sunsetDate: an active atom has no sunsetDate; set status: deprecated or status: sunset, or remove sunsetDate
```

Here `supersededBy` names an entity for a field:

```
insurance/domain.manifest.yaml:37:17  error  wrong-ref-kind  urn:acme:insurance:policy:field:note: supersededBy "policy.entity.coverage" must name a field, but urn:acme:insurance:policy:entity:coverage is an entity
```

A short key that is not in the manifest gives `unresolved-ref`. For each code, refer to [Diagnostics](../reference/diagnostics).

## 3. Keep the old property while callers move

Do not remove the old atom from the entities that use it. Add the replacement beside it:

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

The output of `issue_policy` holds the coverages. If you remove `note` now, each caller that reads `note` breaks. With both properties, a caller can move to `remark` at any time before the sunset date.

Compare the manifest with the version on `main`:

```bash
git show origin/main:./insurance/domain.manifest.yaml > old.manifest.yaml
npx urn-forge diff old.manifest.yaml insurance/domain.manifest.yaml --config insurance/urn-forge.config.ts
```

```
compatible  urn:acme:insurance:policy:entity:coverage  adds the optional property "remark"
lifecycle   urn:acme:insurance:policy:field:note  status active → deprecated
compatible  urn:acme:insurance:policy:field:remark  is new
diff passed: 0 breaking, 2 compatible, 1 lifecycle change(s)
```

## 4. Compile and read the warning

Run this command:

```bash
npx urn-forge compile --config insurance/urn-forge.config.ts
```

`compile` writes the files, and warns about each active atom that refers to the deprecated atom:

```
insurance/domain.manifest.yaml:79:12  warning  deprecated-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, which is deprecated (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30)
unchanged  insurance/generated/domain.runtime.generated.ts
unchanged  insurance/generated/domain.schemas.generated.ts
unchanged  insurance/generated/schema.generated.sql
fingerprint sha256:04b8be134285c63b71d20830b972a6ce13674939834448d2ee98a85c4d3f6764
```

- The location is the reference, not the deprecated atom. Here it is the `ref` of `note` in the coverage.
- A warning does not stop `compile` or `verify`.
- A deprecated atom that refers to a different deprecated atom gets no warning. The two atoms retire together.

The deprecated atom still makes all of its code. The TypeScript marks it with `@deprecated`, so an editor shows the name crossed out. `tsc` does not fail:

```ts
/**
 * urn:acme:insurance:policy:field:note — Free text about a coverage
 * @deprecated Superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30.
 */
export const PolicyNoteSchema = v.pipe(
```

The SQL comment of the `postgres` plugin also gives the status:

```sql
COMMENT ON DOMAIN "policy"."note_value" IS 'urn:acme:insurance:policy:field:note — Free text about a coverage (deprecated: superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30)';
```

## 5. Set the reference date

urn-forge never reads the clock. It compares each `sunsetDate` with a reference date that you give. Without a reference date, `verify` does not check the sunset dates. If the manifest has a `sunsetDate`, `verify` shows this note:

```
note: sunset dates are not checked: set --reference-date or referenceDate in the config
```

Give the date in one of two ways:

- On the command line: `--reference-date 2026-11-21` on `compile` or `verify`.
- In the config: `referenceDate: '2026-11-21'`. The command line option overrides it.

In CI, use the date of the commit. Then one commit always gives one result. Refer to [Run verify in CI](run-verify-in-ci).

On or after the sunset date, a reference to the atom is an error, `sunset-ref`:

```bash
npx urn-forge verify --config insurance/urn-forge.config.ts --reference-date 2027-07-01
```

```
insurance/domain.manifest.yaml:79:12  error  sunset-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, whose sunset date 2027-06-30 is on or before the reference date 2027-07-01 (superseded by urn:acme:insurance:policy:field:remark); refer to its replacement
verify failed: the manifest does not compile
```

The sunset date itself already gives the error. Thus `sunsetDate: 2027-06-30` makes 2027-06-29 the last day of `deprecated-ref`.

## 6. Move the references

Before the sunset date, move each use of the old atom to the replacement:

1. Change the scenarios that send or expect the old property. Line 19 of `issue_policy.feature` sends a `note`. Send a `remark` in its place.
2. Change the core and the shell, if they read or write the old property.
3. Tell the callers outside your repository to move to the replacement.

The last references are in the manifest: the entities that refer to the old atom. Here the coverage refers to `note`. Remove that reference in the same change as step 7, on or after the sunset date. The deprecation and the sunset date announced the removal, so `urn-forge diff` reports it as a lifecycle change, not a breaking change. A removed property whose target was not deprecated is a breaking change.

## 7. Set the status to sunset

Change `status: deprecated` to `status: sunset`. Keep `supersededBy` and `sunsetDate`, so a reader can find the replacement.

If an active atom still refers to the sunset atom, `compile` stops, whatever the reference date:

```
insurance/domain.manifest.yaml:79:12  error  sunset-ref  urn:acme:insurance:policy:entity:coverage: fields[2].ref refers to urn:acme:insurance:policy:field:note, which is sunset (superseded by urn:acme:insurance:policy:field:remark; sunset on 2027-06-30); refer to its replacement
```

When no reference remains, `compile` writes the files with no warning. A sunset atom makes nothing:

- No schema, no type and no brand in the TypeScript.
- No domain, no column and no table in the SQL.
- No gate asks for its handler or its scenarios. A sunset operation needs no handler.

`urn-forge diff` against the deprecated version shows the change of status, and the removed property of step 6:

```
lifecycle   urn:acme:insurance:policy:entity:coverage  removes the property "note", whose target urn:acme:insurance:policy:field:note was deprecated
lifecycle   urn:acme:insurance:policy:field:note  status deprecated → sunset
diff passed: 0 breaking, 0 compatible, 2 lifecycle change(s)
```

A status moves forward only: `active`, `deprecated`, `sunset`. A change back, for example `sunset` to `active`, is a breaking change. To use the old meaning again, declare a new URN.

## 8. Keep the sunset atom in the manifest

Do not delete the sunset atom. It is a tombstone: it keeps its URN in use, so no new atom can get that URN with a different meaning. If you delete it, `urn-forge diff` reports a breaking change:

```
breaking    urn:acme:insurance:policy:field:note  is removed; keep a sunset atom in the manifest, so its URN is never used again
diff failed: 1 breaking, 0 compatible, 0 lifecycle change(s)
```

## Result

- The new atom has its own URN, and callers use it.
- The old atom has `status: sunset`, and it stays in the manifest.
- `compile` and `verify` pass with the reference date of the commit, and the generated files have no code for the old atom.

## Related pages

- [Check compatibility in CI](check-compatibility)
- [The manifest](../reference/manifest)
- [Diagnostics](../reference/diagnostics)
- [URNs as permanent names](../explanation/urns)
- [Compatibility and the direction of use](../explanation/compatibility)
