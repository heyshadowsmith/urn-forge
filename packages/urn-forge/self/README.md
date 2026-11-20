# self: urn-forge's own domain

urn-forge declares the pure functions of its own toolchain in a urn-forge manifest, then traces them through the same chain as any other domain:

| Link | File |
| --- | --- |
| Manifest | [`domain.manifest.yaml`](domain.manifest.yaml) (`urn:urn_forge:toolchain:…`) |
| Generated contracts | [`generated/`](generated) (from `npm run compile:self`) |
| Core | [`core.ts`](core.ts). Each handler calls the function the compiler really uses, so the scenarios test the toolchain itself, not a copy |
| Features | [`features/`](features) (run with `npm run test:features:self`) |

`npm run verify:self` runs gates 1, 3 and 4 on this domain, and CI runs it after the math example.

## Rules

- **Declare only pure leaf functions:** functions from strings and numbers to strings and numbers, such as naming, parsing and cell coercion. Do not model the IR, the plugins or `buildIr` here. The compiler would then depend on its own output for its core logic, and the IR's nested shape would pull in `list` and `record` before the simple primitives are solid.
- **Delegate, never reimplement.** A handler calls the exported function from `src/`. If the function is not exported, export it.
- **Write down what you cannot declare.** When a function cannot be declared because the MVP lacks a primitive, constraint or kind, add a row to the backlog below instead of working around it.

## Backlog: what urn-forge cannot yet say about itself

Each row is a declaration this domain needs and the MVP cannot express. Together they set the order of the foundations work.

| Declaration | Blocked on | Notes |
| --- | --- | --- |
| `naming.field.context` and `naming.field.identifier` must be lowercase snake_case | `regex` constraint | Today the manifest enforces only length 1–63, so `to_brand_identifier` accepts `Policy` |
| `naming.field.kind` (`field`, `entity`, `operation`, …) | `oneOf` constraint | Needed for `parse_short_key` and `expand_urn` |
| `naming.operation.parse_short_key` refuses a malformed key | `error` kind and `Result` | Today a handler cannot return a declared rejection |
| `naming.field.required`, `naming.field.nullable` | `boolean` primitive | Field references in the manifest |
| `manifest.version` is semver | `regex` constraint | Also needed by a future version comparison |
| `gherkin.operation.coerce_cell` | `oneOf` (primitive name) and a value of more than one type | `coerceCell` returns a number, a string or nothing |
| `compatibility.operation.classify_constraint_change` (gate 5) | `oneOf` output, `error` kind | The core of `urn-forge diff` |
