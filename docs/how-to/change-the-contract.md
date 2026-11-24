# Change the contract

Change the manifest, check the change with `urn-forge diff`, and give it the correct version. A change can break callers: a caller that sends a value that the new manifest refuses, or a caller that gets an answer that it does not handle.

## Before you start

- You have the manifest as it was before the change, for example from git.

## Steps

1. Keep a copy of the manifest before the change. For example, get it from the main branch:

   ```bash
   git show main:domain.manifest.yaml > old.manifest.yaml
   ```

2. Make the change in `domain.manifest.yaml`.
3. Change `version` in the header. For a breaking change, increase the major version. In `0.x`, any change is allowed.
4. Run `diff` with the old manifest first:

   ```bash
   npx urn-forge diff old.manifest.yaml domain.manifest.yaml
   ```

5. Read each line. `breaking` is a change that can break a caller. `compatible` is a change that cannot.
6. If `diff` fails, do one of these:
   - Make the change compatible. For example, add a new definition in place of a change to the old one.
   - Increase the major version.
7. Run `npx urn-forge compile` and `npx urn-forge verify`.

## Example

The old manifest is tutorial 2 at version `1.0.0`. The new manifest lowers the maximum weight from 30000 to 20000, adds the zone `regional`, and has the version `1.1.0`:

```
breaking    definitions.weight_grams  maximum is now 20000, not 30000: it accepts less
compatible  definitions.zone  enum is now ["domestic","international","regional"], not ["domestic","international"]: it accepts more
diff failed: 2 change(s), 1 breaking, 1.0.0 → 1.1.0: 1.0.0 → 1.1.0 keeps the major version 1; a breaking change needs a new major version
```

A caller can send a parcel of 25000 grams, which the new manifest refuses. Thus the lower maximum is breaking. A new zone accepts more, and `zone` is only in the input, so it is compatible.

With the version `2.0.0`, the same change passes:

```
breaking    definitions.weight_grams  maximum is now 20000, not 30000: it accepts less
compatible  definitions.zone  enum is now ["domestic","international","regional"], not ["domestic","international"]: it accepts more
diff passed: 2 change(s), 1 breaking, 1.0.0 → 2.0.0: allowed, as 2.0.0 is a new major version
```

To see the changes without a failure, add `--report`. `diff` then always stops with exit code `0`:

```bash
npx urn-forge diff --report old.manifest.yaml domain.manifest.yaml
```

## Add an output

A new output can break a caller that does not handle it. From tutorial 1 to tutorial 2, `diff` shows:

```
compatible  definitions.too_heavy_for_express  the definition is new
breaking    operations.quote_shipping  the output too_heavy_for_express is new: callers can get an answer that they do not handle
compatible  operations.quote_shipping.quote  the rule fits_express is new: the answer promises more
compatible  operations.quote_shipping.too_heavy_for_express  the rule over_express_limit is new: the answer promises more
compatible  operations.quote_shipping.too_heavy_for_express  the rule names_the_weight is new: the answer promises more
diff passed: 5 change(s), 1 breaking, 0.1.0 → 0.1.0: allowed, as 0.1.0 is a 0.x version, where anything may change
```

If your callers promise to ignore what they do not know, say so in the header:

```yaml
manifest:
  namespace: demo
  domain: booking
  version: 0.1.0
  compatibility:
    callers: ignore-unknown
```

Then a new output, a new choice of an `enum` in an output, and a new property of an output are compatible.

## Retire a part

1. Add `deprecated: true` to the definition, the rule or the operation. Say in its `description` what to use in its place.
2. Run `npx urn-forge compile`. Each live part that uses it gets the warning `deprecated-use`, and the generated code marks it `@deprecated`.
3. When no caller uses it, remove it, and increase the major version. `diff` reports the removal.

The manifest has no dates and no notice period. How long you keep a deprecated part is a promise of your service, not of the manifest.

## Result

`diff` passes, and the version of the manifest tells callers whether the change can break them.

## Related pages

- [Diff and versions](../reference/diff)
- [Compatibility](../explanation/compatibility)
- [Run verify in CI](run-verify-in-ci)
