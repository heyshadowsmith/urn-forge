# Change the contract

A change to the manifest can break callers. A caller can send a value that the new manifest rejects. A caller can also get an answer that it does not handle. `urn-forge diff` lists each change as `breaking` or `compatible`. It allows a breaking change only where semver allows it.

## Steps

1. Save a copy of the manifest before the change: `git show main:domain.manifest.yaml > old.manifest.yaml`.
2. Change `domain.manifest.yaml` and its `version`.
3. Run `npx urn-forge diff old.manifest.yaml domain.manifest.yaml`. Put the old manifest first.
4. If `diff` fails, make the change compatible, or increase the major version. For example, add a new definition, and do not make the old definition narrower.
5. Run `npx urn-forge compile` and `npx urn-forge verify`.

In this example, the manifest of the tutorial changes from `1.0.0` to `1.1.0`. The maximum weight decreases from 30000 to 20000, and the change adds the zone `regional`.

```
breaking    definitions.weight_grams  maximum is now 20000, not 30000: it accepts less
compatible  definitions.zone  enum is now ["domestic","international","regional"], not ["domestic","international"]: it accepts more
diff failed: 2 change(s), 1 breaking, 1.0.0 → 1.1.0: 1.0.0 → 1.1.0 keeps the major version 1; a breaking change needs a new major version
```

A caller can send a parcel of 25000 grams, which the manifest now rejects. With version `2.0.0`, the same change passes:

```
diff passed: 2 change(s), 1 breaking, 1.0.0 → 2.0.0: allowed, as 2.0.0 is a new major version
```

`diff` allows a breaking change in a new major version, in a `0.x` version, and in a pre-release such as `2.0.0-alpha.1`. `diff` exits with `1` on a breaking change that the versions do not allow. `--report` lists the changes and always exits with `0`.

## How diff decides

The direction of a value decides the class. Callers **send** the input and each definition in it. Callers **receive** the outputs and each definition in them. A definition on the two sides gets the stricter class.

| Change of a definition | Sent | Received |
| --- | --- | --- |
| New definition, or `deprecated: true` added | compatible | compatible |
| Removed definition or property; changed `type`, `items` or `identifier` | breaking | breaking |
| New property | compatible | breaking ¹ |
| New rule, or a narrower argument: it accepts less | breaking | compatible |
| Removed rule, or a wider argument: it accepts more | compatible | breaking ¹ |
| An argument that is neither narrower nor wider | breaking | breaking |

| Change of an operation or the header | Class |
| --- | --- |
| New operation; removed output; new rule of an output or operation; `compatibility` or `deprecated: true` added | compatible |
| New output | breaking ¹ |
| Removed operation; changed `input`; removed or changed rule of an output or operation | breaking |
| Changed `namespace` or `domain`; `compatibility` removed | breaking |

¹ Compatible if the new header has `compatibility: { callers: ignore-unknown }` under `manifest`. This tells that callers ignore all data that they do not know.

More `enum` choices, or fewer `required` properties, is wider. Some rules have the form `self <op> parameter` or `size(self) <op> parameter`, such as `minimum` or `maxLength`. For these rules, a larger argument is narrower with `>=` or `>`, and wider with `<=` or `<`.

If `diff` cannot find the direction, the change is breaking. An example is two regular expressions. A change to the text of a rule is breaking at each location that uses the rule. All changes to a definition that no input or output uses are compatible. The exception is an argument that is neither narrower nor wider.

## Retire a part

1. Add `deprecated: true` to the definition, rule or operation.
2. In its `description`, tell what to use in its place.
3. Run `npx urn-forge compile`. The generated code marks the part `@deprecated`. Each live part that uses it gets a `deprecated-use` warning.
4. When no caller uses the part, remove it.
5. Increase the major version.

Your service decides how long it keeps a deprecated part. The manifest has no dates.
