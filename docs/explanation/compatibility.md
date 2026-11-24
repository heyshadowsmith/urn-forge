# Compatibility

A caller relies on the contract. A change to the manifest can break a caller that worked before. `urn-forge diff` compares two manifests and gives each change a class, `compatible` or `breaking`. Then it reads the versions, and fails if a breaking change has no new major version. This page tells why the class of a change depends on the side of the value, why some answers are safe and not exact, and why the version is the only signal.

## The side of a value

A change is breaking if a caller that worked before the change can fail after it. Who can fail depends on the side of the value:

| Side | The values | A change that breaks callers |
| --- | --- | --- |
| Sent | The input of an operation, and each definition inside it | A change that refuses a value that was correct: a rule that accepts less |
| Received | Each output of an operation, and each definition inside it | A change that allows a value that was not possible: a rule that accepts more |

A lower maximum breaks a caller that sends the value. A higher maximum breaks a caller that receives it: a caller that keeps a received value in a column of at most 1000 breaks if the output can be 2000. A definition on both sides breaks on each change of its values.

For the same reason, a new output is breaking: a caller can get an answer that it does not handle. A contract can say that its callers ignore what they do not know, with `compatibility: { callers: ignore-unknown }` in the header. Then a new output, a new choice of an output value, or a new property of an output cannot make a caller fail, and `diff` reports it as compatible.

## The rules of an answer

A rule of an output or of an operation is a promise about the answer. A new rule promises more, so it is compatible. A removed rule promises less, so it is breaking: a caller may rely on it.

## Safe, not exact

`diff` compares each rule by its name and its argument. For `enum` and `required`, it compares the sets. For a rule of the form `self >= bound`, it reads the operator to know whether a larger bound accepts more or less. This works for the standard bounds and for a rule of your own of the same form.

For any other change, `diff` cannot tell whether the new rule accepts more or less. Two regular expressions can describe sets that overlap, and two rules of your own have the same problem. `diff` calls each such change breaking for each side. Also, a rule whose text changed is breaking wherever it is used.

A false "breaking" costs a new major version or a review. A false "compatible" costs a broken caller in production. When `diff` cannot tell, it gives the answer that cannot hide a break.

## The version is the signal

`diff` judges a breaking change by semver:

- In `0.x`, anything may change. A new domain changes often, and nobody depends on it yet.
- A pre-release, such as `2.0.0-alpha.1`, may break.
- A new major version may break.
- Within one major version, such as `1.4.0` to `1.5.0`, a breaking change fails `diff`.

The manifest has no stability level, no dates and no notice period. Callers read the version, as they do for any package. How long you run an old major version is a promise of your service, not of the manifest.

## Deprecation, then removal

`deprecated: true` marks a piece that will go. The piece still works, and each use of it gets a warning. The description says what to use in its place. When no caller uses it, remove it in a new major version. `diff` reports the removal as breaking, and the version allows it.

The name of a removed piece can come back later with another meaning. The version makes this visible: it is a new major version, and callers check their use of it.

## The limits

- `diff` sees values, not meaning. If a definition of cents becomes a definition of euros with the same rules, `diff` finds no change.
- `diff` does not read the Postgres config. A breaking change to a stored definition needs a migration of the old rows, which urn-forge does not write.

## Related pages

- [Change the contract](../how-to/change-the-contract)
- [Diff and versions](../reference/diff)
- [The contract](./the-contract)
