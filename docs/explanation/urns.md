# URNs as permanent names

Every atom in a manifest has exactly one URN. The manifest, the generated code, the core and the features all refer to the atom by that URN. This page tells why urn-forge uses URNs, why a URN has six segments, what a URN must never do, and how it retires.

## Why a permanent name

Names in code change often. A person renames a type, moves a function or splits a module. A test can refer to an atom by a name in code. Then a refactor can break the link between the test and the atom without a sign.

A URN is a name outside the code. It does not depend on a file, a type name or a language. As a result, it can be the key in every part of the chain. It is the key in the IR, the handler registry and the dispatch map, and it is the tag of a feature. The generated type names, such as `QuoteQuoteShippingHandler`, come from the URN. The URN does not come from them.

A name can only be a key if it does not change. Thus the rule of [specification v1.1](../project/spec-v1-1) is strict: a URN, once published, never changes its meaning.

## The six segments

```
urn:<namespace>:<domain>:<context>:<kind>:<identifier>
urn:demo:shipping:parcel:field:weight_grams
```

| Segment | Purpose | Example |
| --- | --- | --- |
| `namespace` | The organization or the system | `demo` |
| `domain` | The bounded context or the business area | `shipping` |
| `context` | The aggregate or the sub-domain | `parcel` |
| `kind` | The kind of atom | `field` |
| `identifier` | The name of the atom in its context and kind | `weight_grams` |

The first segment, `urn`, is fixed. Each segment that is not the kind is lowercase snake_case, starts with a letter and has 63 characters at most. The comparison of two URNs is case-sensitive. These rules give each atom one written form, so two people cannot write the same URN in two ways.

The kind is part of the URN, so a reader can see what an atom is without the manifest. The kind does not make the name unique in practice. The brand identifier, which the next section describes, has no kind in it. Thus a field and an entity with the same context and identifier get the diagnostic `duplicate-brand`.

Specification v1.1 names six kinds. urn-forge has `field`, `entity`, `invariant`, `operation` and `error`. It does not have `event` at this time. A key with this kind gets the diagnostic `unsupported-kind`.

## Short keys

You do not write the full URN in the manifest. The header of the manifest gives `namespace` and `domain` once, and each entry has a short key:

```yaml
manifest:
  namespace: demo
  domain: shipping
  version: 0.1.0

parcel.field.weight_grams:
  primitive: integer
```

The compiler expands `parcel.field.weight_grams` to `urn:demo:shipping:parcel:field:weight_grams`. This removes repetition. It also makes it impossible for two entries in one file to disagree about the namespace or the domain.

The short key also gives the brand identifier: the PascalCase of the context and the identifier, for example `ParcelWeightGrams`. The generated code uses it for type names. If two atoms give the same brand identifier, the compiler stops with `duplicate-brand`:

```
domain.manifest.yaml:6:1  error  duplicate-brand  urn:demo:shipping:quote:field:quote: brandIdentifier "QuoteQuote" is already used by urn:demo:shipping:quote:entity:quote; rename one of them
```

The compiler does not add a suffix to one of them. A silent suffix would make a type name depend on the order of the manifest, and a new atom could rename an old type.

## One manifest for each domain

A manifest is one YAML file. It declares one namespace and one domain, and it cannot refer to a different manifest. Specification v1.1 made this decision for these reasons:

- **One source of truth.** The manifest is the only authority for its domain. A reader does not have to follow imports to find an atom.
- **One IR.** The compiler resolves every reference in one file, and every diagnostic points at a line in that file.
- **One fingerprint.** The fingerprint covers one canonical IR, so a change anywhere in the domain changes the header of each generated file. Refer to [Determinism and the fingerprint](./determinism).

The cost is real. A large domain is one large file. Two domains cannot share a field, so a field that both need is declared twice, with two URNs.

## What a URN must never do

A URN must never change its meaning. Consumers of a URN depend on what it accepts and what it returns. If the meaning changes, the old consumers break, but the name tells them nothing. The correct change is a new URN.

Specification v1.1 gives three compatibility classes for a change to a URN that exists:

| Class | Meaning | Allowed on a URN that exists? |
| --- | --- | --- |
| Compatible | No consumer that worked before the change can fail after it | Yes |
| Breaking | A consumer that worked before the change can fail after it | No. Declare a new URN, and deprecate the old URN |
| Lifecycle | `active`, then `deprecated`, then `sunset` | Yes, forward only |

urn-forge applies these classes. Gate 5 is the command `urn-forge diff`. It compares the manifest with the manifest at the merge base, and it fails on a breaking change to a live URN. A manifest header can set `stability: experimental`, which changes these failures to warnings while a domain is new.

The class of a change depends on how the URN is used. A tighter constraint breaks a caller that sends the value, but not a caller that only receives it. For a value that callers receive, a wider constraint breaks them. [Compatibility and the direction of use](./compatibility) tells why.

## How a URN retires

A URN cannot change its meaning, but it can stop. Each atom has a `status`. A deprecated atom still makes all its code, and the generated TypeScript marks it `@deprecated`. A reference to it from an active atom gets the warning `deprecated-ref`. A sunset atom makes no code, and a reference to it from an active or a deprecated atom is the error `sunset-ref`. `supersededBy` names the replacement, and `sunsetDate` names the day after which nothing refers to the atom.

A sunset atom stays in the manifest. Its name is not free again. If a person could declare the same short key later with a new meaning, old logs and old rows would name a URN with two meanings. Thus `urn-forge diff` reports the removal of a sunset atom as a breaking change. For the keys, refer to [The manifest](../reference/manifest).

## Related pages

- [URNs and names](../reference/naming)
- [The manifest](../reference/manifest)
- [Retire a URN](../how-to/retire-a-urn)
- [Compatibility and the direction of use](./compatibility)
