# Diff and versions

`urn-forge diff <old manifest> <new manifest>` lists the changes between two manifests. It classifies each change as `breaking` or `compatible` for callers, and it judges the breaking changes by the versions in the headers.

## The output

```
breaking    definitions.weight_grams  maximum is now 20000, not 30000: it accepts less
compatible  definitions.zone  enum is now ["domestic","international","regional"], not ["domestic","international"]: it accepts more
diff failed: 2 change(s), 1 breaking, 1.0.0 → 1.1.0: 1.0.0 → 1.1.0 keeps the major version 1; a breaking change needs a new major version
```

Each change is a line: its class, its place, and a message. The place is `manifest`, `rules.<rule>`, `definitions.<definition>`, `operations.<operation>` or `operations.<operation>.<output>`. The lines are in the order of their place.

| Last line | Exit code |
| --- | --- |
| `diff passed: <n> change(s), 0 breaking, <old> → <new>` | `0` |
| `diff passed: …: allowed, as <why>` | `0` |
| `diff passed: …: not allowed, as <why> (reported only)` | `0`, with `--report` |
| `diff failed: …: <why>` | `1` |
| `diff failed: a manifest does not compile` | `1` |

## Sides

A change breaks a caller, or not, by the side of the value:

- Callers **send** the values of an input, and of each definition inside it.
- Callers **receive** the values of an output, and of each definition inside it.

A rule that accepts less can refuse a value that a caller sends. A rule that accepts more can give a caller a value that it does not expect. A definition on both sides takes the stricter verdict.

## Changes of definitions

| Change | Sent only | Received only | Both | Not used |
| --- | --- | --- | --- | --- |
| A new definition | compatible | compatible | compatible | compatible |
| A removed definition | breaking | breaking | breaking | compatible |
| A changed `type`, `items` or `identifier` | breaking | breaking | breaking | compatible |
| A new property | compatible | breaking ¹ | breaking ¹ | compatible |
| A removed property | breaking | breaking | breaking | compatible |
| A new rule: it accepts less | breaking | compatible | breaking | compatible |
| A removed rule: it accepts more | compatible | breaking ¹ | breaking ¹ | compatible |
| A narrower argument | breaking | compatible | breaking | compatible |
| A wider argument | compatible | breaking ¹ | breaking ¹ | compatible |
| An argument that is neither narrower nor wider | breaking | breaking | breaking | breaking |
| `deprecated: true` added | compatible | compatible | compatible | compatible |

¹ Compatible with `compatibility: { callers: ignore-unknown }` in the header of the new manifest.

A new property that is required is also a change of the argument of `required`, which is narrower.

## The direction of an argument

A rule is compared by its name and its argument.

- For `enum`, fewer choices is narrower, and more choices is wider.
- For `required`, more properties is narrower, and fewer is wider.
- For a rule of the form `self <op> parameter`, or `size(self) <op> parameter`, the operator gives the direction. With `>=` or `>`, a larger argument is narrower. With `<=` or `<`, a larger argument is wider. This holds for `minimum`, `maximum`, `minLength` and the other bounds, and for a rule of your own of the same form.
- Any other change of an argument accepts other values. It is breaking on each side.

## Changes of rules

A rule of the manifest whose text changed is breaking wherever it is used, and compatible if no piece uses it. The text is compared after a parse, so a change of spaces or of redundant parentheses is not a change.

## Changes of operations

| Change | Class |
| --- | --- |
| A new operation | compatible |
| A removed operation | breaking |
| A changed `input` | breaking |
| A new output | breaking, or compatible with `callers: ignore-unknown` |
| A removed output | compatible |
| A new rule of an output or of the operation: the answer promises more | compatible |
| A removed rule of an output or of the operation: the answer promises less | breaking |
| A changed argument of a rule of an output or of the operation | breaking |
| `deprecated: true` added | compatible |

## Changes of the header

| Change | Class |
| --- | --- |
| A changed `namespace` or `domain` | breaking |
| `compatibility: { callers: ignore-unknown }` added | compatible |
| `compatibility` removed | breaking |

## Versions

`diff` reads `version` of both headers. A breaking change is allowed in these cases:

| Case | Example | Why |
| --- | --- | --- |
| The new version is `0.x` | `0.1.0` → `0.2.0` | `0.x is a 0.x version, where anything may change` |
| The new version is a pre-release | `1.4.0` → `2.0.0-alpha.1` | `is a pre-release` |
| The new major version is larger | `1.4.0` → `2.0.0` | `is a new major version` |

Otherwise, a breaking change fails `diff`: `1.4.0 → 1.5.0 keeps the major version 1; a breaking change needs a new major version`.

The manifest has no stability level and no dates. The version is the only signal.

## Related pages

- [Change the contract](../how-to/change-the-contract)
- [Compatibility](../explanation/compatibility)
- [The CLI](./cli)
