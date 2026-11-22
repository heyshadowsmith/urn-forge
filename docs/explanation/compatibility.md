# Compatibility and the direction of use

A URN never changes its meaning. `urn-forge diff` makes sure of this rule: it compares two manifests and gives each change a class, `compatible`, `breaking` or `lifecycle`. This page tells why the class of a change depends on how the URN is used. It also tells why some answers are safe and not exact, and why an old URN stays in the manifest. For the commands and the tables of rules, refer to [Verification gates](../reference/verification-gates).

## Why a URN never changes its meaning

A URN is a key in each part of the chain: the IR, the handler registry, the dispatch map and the tags of the features. Other systems also keep it. A caller sends values to an operation, a different caller reads its output, and a database keeps rows from last year. Each of them depends on what the URN accepts and what it returns.

If the meaning changes and the name stays, these consumers break, and the name tells them nothing. Thus the correct change is a new URN, and a deprecation of the old URN. [URNs as permanent names](./urns) gives the rest of the reason.

Before the `diff` command, this rule was a convention. A manifest could make a `maxLength` smaller, and `compile` and `verify` passed. Since the Postgres plugin, the same change can also make old rows in a table incorrect.

## The direction of use

A change is breaking if a consumer that worked before the change can fail after it. Who can fail depends on how the URN is used. `urn-forge diff` thus finds the uses of each URN in the old manifest:

| Use | The values | Who depends on them | A change that breaks them |
| --- | --- | --- | --- |
| In | The values that a caller sends: the input of an operation, the entities that it embeds, and the key fields of its links | Callers | A change that refuses a value that was correct |
| Out | The values that a caller receives: the output of an operation, its declared errors and their fields | Callers | A change that allows a value that was not possible |
| Stored | The values in a table of the `postgres` plugin | The rows in the database | The same as In: each old row must stay correct |
| No use | An atom that no operation and no table uses | No one | None |

The uses come from the old manifest, because the old manifest has the consumers that exist. A URN that is new has no consumers yet, so `diff` uses the uses in the new manifest for it.

Specification v1.1 has one table for all changes. It says that a tighter constraint is breaking and that a wider constraint is compatible. This rule is correct for In and for Stored. For Out, the opposite is true. A caller that receives a value of at most 1000 can keep it in a field of that size. If the output can then be 2000, that caller breaks. The two cases from `tests/diff/` show the two sides:

```
breaking    urn:demo:shop:order:field:qty  max 10 → 5 narrows a value that callers send, which breaks callers that send it
breaking    urn:demo:shop:order:field:total  max 1000 → 2000 widens a value that callers receive, which breaks callers that receive it
```

The same raise of `max` on a field that only callers send is compatible. A URN with two or more uses gets the rules of each use. A field that callers send and receive thus breaks on each change of its values. The insurance field `remark` is in the input, in the output and in a table:

```
breaking    urn:acme:insurance:policy:field:remark  maxLength 40 → 60 widens a value that callers send and callers receive and the database stores, which breaks callers that receive it
```

Storage is a decision of the shell, so it is in the configuration file and not in the manifest. `diff` reads the `tables` of the `postgres` plugin from `--config`. Without it, a stored field can look unused. The insurance field `customer.field.name` is only in the table of the customer. With the insurance configuration, a larger `minLength` is breaking:

```
breaking    urn:acme:insurance:customer:field:name  minLength 1 → 2 narrows a value that the database stores, which breaks rows already stored
```

With a configuration that has no `postgres` plugin, the same change is compatible:

```
compatible  urn:acme:insurance:customer:field:name  minLength 1 → 2 narrows a value that nothing uses
```

## Narrower, wider or neither

`diff` does not compare two schemas as text. For each change, it finds the relation of the new set of correct values to the old set:

| Relation | The new set | Breaks |
| --- | --- | --- |
| Equal | The same values | None |
| Narrower | Fewer values | In and Stored |
| Wider | More values | Out |
| Neither | Some values are new, and some values are gone, or `diff` cannot tell | Each use |

The [MECE model of primitives](./primitives-model) gives each constraint one aspect, so each aspect has one comparison. A bound moves up or down. A list of `values` or of `notIn` values gets larger or smaller. A new `multipleOf` is a multiple of the old step, which is narrower, or a divisor, which is wider. If a change moves two aspects in different directions, the result is "neither".

The same rules apply one layer up, to the properties of an entity. A new required property is narrower: a caller that does not send it breaks. A new optional property is compatible. A property that is not there any more is wider, because a consumer that reads it does not find it. If the target of the property was deprecated, the removal is a lifecycle change. Refer to [Tombstones and the forward-only lifecycle](#tombstones-and-the-forward-only-lifecycle). A change of the target, or from one value to a list, is "neither".

## "Neither" is safe, not exact

Some changes have no simple comparison. Two regular expressions can describe sets that overlap, and only a full analysis of the two patterns can say how. Two invariant rules have the same problem. `diff` calls each such change "neither", which is breaking for each use:

```
breaking    urn:demo:shop:order:field:code  regex [A-Z]+ → [A-Z]* changes a value that callers send, which breaks callers that send it
```

In this case, the new pattern only accepts one more value, the empty string. Thus the change is wider, and compatible for callers that send it. `diff` does not know that. A false "breaking" costs a new URN or a review. A false "compatible" costs a broken consumer in production. When `diff` cannot tell, it gives the answer that cannot hide a break.

A new invariant is narrower, because it can only refuse more values. On a new entity, it refuses nothing that a caller sent before, so it is compatible. A changed rule, or a changed `on`, is "neither". A change of a message is compatible, because a message is text for a person.

## Tombstones and the forward-only lifecycle

Each atom has a lifecycle: `active`, then `deprecated`, then `sunset`. A deprecated atom still makes all its code, with a mark. TypeScript editors cross out its name, and `compile` warns at each reference from an active atom. A sunset atom makes no code. No plugin writes a schema, a type or a table for it, and no gate asks for its handler or scenarios.

A sunset atom still stays in the manifest. It is a tombstone. If a person removes its entry, a different person can later declare the same short key with a new meaning. Old logs, old rows and old tags would then name a URN with two meanings. Thus `diff` reports a removed atom as breaking, also a sunset atom:

```
breaking    urn:acme:insurance:policy:field:note  is removed; keep a sunset atom in the manifest, so its URN is never used again
```

The lifecycle only moves forward. A step forward is the class `lifecycle`, which needs no action. A step back, for example from `sunset` to `active`, is breaking. A sunset URN that comes back would return to consumers that already moved away. `diff` does not report a change to an atom that was sunset before and after the change. No consumer uses it, so no change to it can break one.

The lifecycle is what makes the last step possible. At the sunset, the insurance domain removes `note` from the coverage. Callers receive a coverage, so the removal of a property would break them. But the target of the property was deprecated in the old manifest. Its callers got the warning `deprecated-ref`, the `@deprecated` mark and a replacement, and they had until the sunset date to move. Thus `diff` reports the announced removal as a lifecycle change:

```
lifecycle   urn:acme:insurance:policy:entity:coverage  removes the property "note", whose target urn:acme:insurance:policy:field:note was deprecated
lifecycle   urn:acme:insurance:policy:field:note  status deprecated → sunset
diff passed: 0 breaking, 0 compatible, 2 lifecycle change(s)
```

That is what the deprecation buys. The rule needs the deprecation in the old manifest, so the removal must come in a later commit than the deprecation. The removal of a property whose target was not deprecated is still breaking, and so is the removal of an atom.

## Experimental manifests

A domain that is new changes often, and no consumer depends on it yet. The header `stability: experimental` tells `diff` this. While the old manifest is experimental, each breaking change is a warning, and `diff` exits with code `0`. The removal of the flag is compatible and one-way. From that commit on, a breaking change fails. A change back to `experimental` is breaking, because a published domain cannot take back its promise.

## The one departure from the specification

Specification v1.1 calls a new declared error compatible. `diff` calls it breaking. A caller that handles each kind of error of an operation has no branch for the new kind. The set of results that the caller receives gets wider, and that is the rule for Out:

```
breaking    urn:demo:shop:order:operation:place  the new declared error urn:demo:shop:order:error:closed widens a value that callers receive, which breaks callers that receive it
```

The opposite change, the removal of a declared error, is compatible. The other differences from the specification table follow from the direction of use. A wider constraint, a property that is not there any more, and an optional property that becomes required each depend on the use. [Departures from the specification](./departures-from-the-spec) lists them.

## One commit, one verdict

A sunset date is a promise: after this day, nothing refers to the atom. Pass 8 compares the date with a reference date, and never with the clock. If the clock decided, the same commit could pass on Monday and fail on Tuesday. A build that passed would then say nothing about the code.

The reference date comes from `--reference-date` or from `referenceDate` in the configuration file. CI sets it, for example to the date of the commit. A new run of an old commit thus gives the same result. A test domain, such as the insurance domain of this repository, sets a fixed `referenceDate` in its configuration instead. Thus the sunset date of a test atom can never fail the CI of urn-forge on a day in the future. Without a reference date, `compile` and `verify` do not compare sunset dates. If the manifest has a sunset date, `verify` says so on its own line. A `status: sunset` is not a date, so a reference to a sunset atom is always an error.

`diff` runs pass 8 with no reference date. A sunset date that comes nearer is not a change to the manifest. Also, the generated code depends on `status` only, never on a date. The day of the build thus cannot change a single generated byte.

## The limits

- **The version is not checked.** `diff` does not compare the `version` of the header with the class of the change.
- **No migrations.** A breaking change to a stored field needs a migration of the old rows. urn-forge does not write migrations at this time. Refer to [Scope](../reference/scope).
- **One manifest at a time.** `diff` compiles both manifests. If the old manifest does not compile with the current urn-forge, `diff` shows its diagnostics and stops.
- **Not a gate of `verify`.** `verify` has one manifest and no git history. Gate 5 is thus its own command, and CI gives it the manifest of the base branch.

## Related pages

- [Verification gates](../reference/verification-gates)
- [The CLI](../reference/cli)
- [Retire a URN](../how-to/retire-a-urn)
- [Check compatibility in CI](../how-to/check-compatibility)
- [URNs as permanent names](./urns)
