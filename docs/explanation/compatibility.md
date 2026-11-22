# Compatibility and the direction of use

A URN never changes its meaning. `urn-forge diff` makes sure of this rule: it compares two manifests and gives each change a class, `compatible`, `breaking` or `lifecycle`. This page tells why the class of a change depends on how the URN is used, why some answers are safe and not exact, and why an old URN stays in the manifest.

## The direction of use

A change is breaking if a consumer that worked before the change can fail after it. Who can fail depends on how the URN is used:

| Use | The values | A change that breaks them |
| --- | --- | --- |
| In | The values that a caller sends: the input of an operation | A change that refuses a value that was correct |
| Out | The values that a caller receives: the output, the declared errors and the events | A change that allows a value that was not possible |
| Stored | The values in a table of the `postgres` plugin | The same as In: each old row must stay correct |

A tighter constraint breaks a caller that sends the value. A wider constraint breaks a caller that receives it. A caller that receives a value of at most 1000 can keep it in a field of that size. If the output can then be 2000, that caller breaks:

```
breaking    urn:demo:shop:order:field:qty  max 10 → 5 narrows a value that callers send, which breaks callers that send it
breaking    urn:demo:shop:order:field:total  max 1000 → 2000 widens a value that callers receive, which breaks callers that receive it
```

A URN with two uses gets the rules of each use, so a field that callers send and receive breaks on each change of its values. For the same reason, a new declared error or a new event is breaking: it widens what callers receive.

The uses come from the old manifest, because the old manifest has the consumers that exist. Storage is a decision of the shell, so `diff` reads the tables from the configuration file. Without `--config`, a stored field can look unused.

## Safe, not exact

For each change, `diff` finds the relation of the new set of correct values to the old set: equal, narrower, wider or neither. Some changes have no simple comparison. Two regular expressions can describe sets that overlap, and two invariant rules have the same problem. `diff` calls each such change "neither", which is breaking for each use:

```
breaking    urn:demo:shop:order:field:code  regex [A-Z]+ → [A-Z]* changes a value that callers send, which breaks callers that send it
```

The new pattern only accepts one more value, the empty string, so this change is really compatible. `diff` does not know that. A false "breaking" costs a new URN or a review. A false "compatible" costs a broken consumer in production. When `diff` cannot tell, it gives the answer that cannot hide a break.

## The lifecycle and tombstones

Each atom moves from `active` to `deprecated` to `sunset`. A deprecated atom still makes its code, with a `@deprecated` mark and a warning at each reference. A sunset atom makes no code.

A sunset atom stays in the manifest as a tombstone. If a person removed it, a different person could later declare the same short key with a new meaning. Old logs and old rows would then name a URN with two meanings. Thus `diff` reports the removal of an atom as breaking.

The lifecycle only moves forward. A step forward is the class `lifecycle`, which needs no action. A step back, for example from `sunset` to `active`, is breaking, because consumers already moved away.

The deprecation buys the right to remove. The removal of a property from an output breaks callers, unless the target of the property was deprecated in the old manifest. Then the callers had a warning, a replacement and time to move, so `diff` reports a lifecycle change. Thus the deprecation and the removal go in two separate commits.

A new domain changes often, and nobody depends on it yet. The header `stability: experimental` makes each breaking change a warning. The removal of the flag is one-way.

## The limits

- `diff` sees values, not meaning. If a field of cents becomes a field of euros with the same constraints, `diff` finds no change.
- `diff` does not compare the `version` of the header with the class of the changes.
- urn-forge does not write migrations at this time. A breaking change to a stored field needs a migration of the old rows.

## Related pages

- [Change the contract](../how-to/change-the-contract)
- [The CLI](../reference/cli)
- [The contract](./the-contract)
