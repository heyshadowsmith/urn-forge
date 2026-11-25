# Change the contract

A change to the manifest can break callers: one that sends a value the new manifest refuses, or one that gets an answer it does not handle. `urn-forge diff` lists each change as `breaking` or `compatible`, and allows the breaking ones only where semver does.

## Steps

1. Keep the manifest as it was: `git show main:domain.manifest.yaml > old.manifest.yaml`.
2. Change `domain.manifest.yaml`, and its `version`.
3. Run `npx urn-forge diff old.manifest.yaml domain.manifest.yaml`, old manifest first.
4. If it fails, make the change compatible (for example, add a new definition instead of narrowing the old one), or raise the major version.
5. Run `npx urn-forge compile` and `npx urn-forge verify`.

The tutorial's manifest goes from `1.0.0` to `1.1.0`: the maximum weight drops from 30000 to 20000, and the zone `regional` is added.

```
breaking    definitions.weight_grams  maximum is now 20000, not 30000: it accepts less
compatible  definitions.zone  enum is now ["domestic","international","regional"], not ["domestic","international"]: it accepts more
diff failed: 2 change(s), 1 breaking, 1.0.0 → 1.1.0: 1.0.0 → 1.1.0 keeps the major version 1; a breaking change needs a new major version
```

A caller may send a parcel of 25000 grams, which is now refused. With version `2.0.0`, the same change passes:

```
diff passed: 2 change(s), 1 breaking, 1.0.0 → 2.0.0: allowed, as 2.0.0 is a new major version
```

A breaking change is allowed in a new major version, in a `0.x` version and in a pre-release such as `2.0.0-alpha.1`. `diff` exits with `1` on a breaking change that the versions do not allow; `--report` lists the changes and always exits with `0`.

## How diff decides

The direction of a value decides. Callers **send** the input and every definition inside it; they **receive** the outputs and every definition inside them. A definition on both sides takes the stricter verdict.

| Change of a definition | Sent | Received |
| --- | --- | --- |
| New definition, or `deprecated: true` added | compatible | compatible |
| Removed definition or property; changed `type`, `items` or `identifier` | breaking | breaking |
| New property | compatible | breaking ¹ |
| New rule, or a narrower argument: accepts less | breaking | compatible |
| Removed rule, or a wider argument: accepts more | compatible | breaking ¹ |
| An argument that is neither narrower nor wider | breaking | breaking |

| Change of an operation or the header | Class |
| --- | --- |
| New operation; removed output; new rule of an output or operation; `compatibility` or `deprecated: true` added | compatible |
| New output | breaking ¹ |
| Removed operation; changed `input`; removed or changed rule of an output or operation | breaking |
| Changed `namespace` or `domain`; `compatibility` removed | breaking |

¹ Compatible when the new header promises that callers ignore what they do not recognise, with `compatibility: { callers: ignore-unknown }` under `manifest`.

More `enum` choices or fewer `required` properties is wider. For a rule of the form `self <op> parameter` or `size(self) <op> parameter`, such as `minimum` or `maxLength`, a larger argument is narrower with `>=` or `>`, and wider with `<=` or `<`. When `diff` cannot tell, as with two regular expressions, the change is breaking. A rule whose text changed is breaking wherever it is used. A definition that no input or output uses is compatible for any change, except an argument that is neither narrower nor wider.

## Retire a part

1. Add `deprecated: true` to the definition, rule or operation, and say in its `description` what to use instead.
2. Run `npx urn-forge compile`. The generated code marks it `@deprecated`, and each live part that uses it gets a `deprecated-use` warning.
3. When no caller uses it, remove it and raise the major version.

How long you keep a deprecated part is a promise of your service; the manifest has no dates.
