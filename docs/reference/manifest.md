# The manifest

The manifest is one YAML file, `domain.manifest.yaml` by default. It states the contract of one domain. This page gives its sections and keys. For the meaning of each part, use the pages that each section links to.

## The file

The top level has four keys. Only `manifest` is required.

| Key | Contents | Reference |
| --- | --- | --- |
| `manifest` | The header | [The header](#the-header) |
| `definitions` | A map of names to definitions: the values, objects and lists | [Definitions and types](./definitions) |
| `rules` | A map of names to rules | [Rules and the standard rules](./rules) |
| `operations` | A map of names to operations | [Operations and outputs](./operations) |

Pieces are grouped by kind. The section gives the kind of a piece, so a name does not.

A key that is not in the tables of these pages stops `compile` with `manifest-shape`. A key that occurs two times in one map stops it with `yaml-syntax`.

## The header

```yaml
manifest:
  namespace: demo
  domain: booking
  version: 0.1.0
  compatibility:
    callers: ignore-unknown
```

| Key | Required | Value |
| --- | --- | --- |
| `namespace` | Yes | A name: the owner of the domain, for example your organisation |
| `domain` | Yes | A name: the domain. The Postgres schema has this name |
| `version` | Yes | A semver version, such as `0.1.0` or `2.0.0-alpha.1`. `urn-forge diff` reads it |
| `compatibility` | No | `callers: ignore-unknown`: callers promise to ignore what they do not recognise in an output. Refer to [Diff and versions](./diff) |

## Names

A name of a namespace, a domain, a definition, a rule or an operation:

- starts with a lowercase letter;
- has only lowercase letters, digits and `_`;
- has 63 characters or fewer.

The regular expression is `^[a-z][a-z0-9_]{0,62}$`. The standard rules also use camelCase names, such as `minLength`. A rule of your manifest cannot have the name of a standard rule.

One name is one piece in its section. A definition and a rule can have the same name, but this makes a manifest hard to read.

## Keys of every piece

| Key | Where | Value |
| --- | --- | --- |
| `description` | Each definition, rule and operation. Required | Text that is not empty: what the piece is, for a reader of the contract. The generated code and the Postgres schema use it as a comment |
| `deprecated` | Each definition, rule and operation. Optional | `true` or `false`. The default is `false`. Refer to [Deprecation](#deprecation) |

## Applying rules

A definition, an output and an operation list rules in `rules`. Each item is one of these:

| Item | Meaning |
| --- | --- |
| `- even` | Apply the rule `even`, which has no parameter |
| `- minimum: 1` | Apply the rule `minimum`, with the argument `1` for its one parameter |
| `- between: { low: 1, high: 9 }` | Apply the rule `between`, with an argument for each of its parameters |

The text of each rule is in the top-level `rules` section, or in the standard set. It is never in a definition or an operation.

## Deprecation

`deprecated: true` tells readers that a piece will go. It does not change what the piece accepts.

- The generated type or function of the piece gets `@deprecated` in its comment.
- Each piece that is not deprecated and uses it gets the warning `deprecated-use` from `compile`.
- `urn-forge diff` reports a new deprecation as compatible.

The manifest has no date and no replacement key. Say in the `description` what to use in place of the piece. To remove the piece, delete it; `diff` reports the removal.

## Example

<<< @/../packages/urn-forge/tests/fixtures/booking/domain.manifest.yaml

## Related pages

- [Definitions and types](./definitions)
- [Rules and the standard rules](./rules)
- [Operations and outputs](./operations)
- [Diagnostics](./diagnostics)
