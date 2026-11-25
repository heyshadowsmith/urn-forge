# Change the contract

A change to the manifest can break callers: one that sends a value the new manifest refuses, or one that gets an answer it does not handle. `urn-forge diff` lists each change as `breaking` or `compatible`, and judges the breaking ones by the versions in the two headers, as semver does.

## Steps

1. Keep the manifest as it was, for example from the main branch:

   ```bash
   git show main:domain.manifest.yaml > old.manifest.yaml
   ```

2. Change `domain.manifest.yaml`, and its `version`.
3. Run `diff`, old manifest first:

   ```bash
   npx urn-forge diff old.manifest.yaml domain.manifest.yaml
   ```

4. If it fails, make the change compatible (for example, add a new definition instead of narrowing the old one), or raise the major version.
5. Run `npx urn-forge compile` and `npx urn-forge verify`.

## Example

The tutorial's manifest, at version `1.0.0`, becomes `1.1.0`: the maximum weight drops from 30000 to 20000, and the zone `regional` is added:

```
breaking    definitions.weight_grams  maximum is now 20000, not 30000: it accepts less
compatible  definitions.zone  enum is now ["domestic","international","regional"], not ["domestic","international"]: it accepts more
diff failed: 2 change(s), 1 breaking, 1.0.0 → 1.1.0: 1.0.0 → 1.1.0 keeps the major version 1; a breaking change needs a new major version
```

A caller may send a parcel of 25000 grams, which is now refused, so the lower maximum is breaking. A new zone accepts more, and `zone` is only sent by callers, so it is compatible. With version `2.0.0`, the same change passes:

```
breaking    definitions.weight_grams  maximum is now 20000, not 30000: it accepts less
compatible  definitions.zone  enum is now ["domestic","international","regional"], not ["domestic","international"]: it accepts more
diff passed: 2 change(s), 1 breaking, 1.0.0 → 2.0.0: allowed, as 2.0.0 is a new major version
```

A breaking change is allowed in a `0.x` version, in a pre-release such as `2.0.0-alpha.1`, and across a major version. `--report` lists the changes and always exits with `0`.

## How diff decides

The side of a value decides. Callers **send** the input and every definition inside it; they **receive** the outputs and every definition inside them.

- A rule that accepts less (a new rule, a larger `minimum`, fewer `enum` choices) breaks what callers send.
- A rule that accepts more breaks what callers receive: they may get a value they do not expect.
- A new output breaks callers, who may not handle it. A new rule of an output is compatible: the answer promises more.
- A definition on both sides takes the stricter verdict. A rule whose text changed is breaking wherever it is used.

The full tables are in [the CLI reference](../reference/cli#diff).

## Promise that callers ignore what they do not know

If your callers tolerate an output, a choice or a property they do not recognise, say so in the header:

```yaml
manifest:
  namespace: demo
  domain: booking
  version: 0.1.0
  compatibility:
    callers: ignore-unknown
```

Then a new output, a new `enum` choice in an output, and a new property of an output are compatible.

## Retire a part

1. Add `deprecated: true` to the definition, rule or operation, and say in its `description` what to use instead.
2. Run `npx urn-forge compile`. The generated code marks it `@deprecated`, and each live part that uses it gets a `deprecated-use` warning.
3. When no caller uses it, remove it and raise the major version. `diff` reports the removal.

How long you keep a deprecated part is a promise of your service; the manifest has no dates.
