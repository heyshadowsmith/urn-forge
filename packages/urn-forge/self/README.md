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
| ~~`naming.field.context` and `naming.field.identifier` must be lowercase snake_case~~ | ~~`regex` constraint~~ | Done: every segment field uses the grammar's pattern (a test keeps them equal), so `Policy` is rejected. `brand_identifier` and `urn` outputs are checked too |
| ~~`naming.field.kind`~~ | ~~`oneOf` constraint~~ | Done: `naming.operation.to_urn` uses it. A test keeps its list equal to the kind registry. `parse_short_key` still needs the `error` kind |
| `naming.operation.parse_short_key` refuses a malformed key | `error` kind and `Result` | Today a handler cannot return a declared rejection |
| `naming.field.required`, `naming.field.nullable` | ~~`boolean` primitive~~ available; no operation needs them yet | Field references in the manifest |
| `manifest.version` is semver | No operation needs it yet (`regex` is available) | Also needed by a future version comparison |
| `gherkin.operation.coerce_cell` | A value of more than one type (`oneOf` is available for the primitive name) | `coerceCell` returns a number, a string, a boolean or nothing |
| `errors.operation.render_message` (fills an error's `{placeholders}`) | `record` primitive (its input is a map of field values) | Part of the error kind work; see `docs/project/error-kind-plan.md` |
| `compatibility.operation.classify_constraint_change` (gate 5) | `error` kind (`oneOf` is available for the output class) | The core of `urn-forge diff` |
