# CLI

```
urn-forge <command> [options]
```

| Command | Does |
| --- | --- |
| [`compile`](#compile) | Validates the manifest and writes the generated files |
| [`verify`](#verify) | Runs gates 1, 3 and 4 |
| `--help`, `-h`, `help` | Prints usage and exits `0` |
| `--version` | Prints the urn-forge version and exits `0` |

With no command, urn-forge prints usage and exits `2`. Relative paths in options resolve against the current directory.

## `compile`

```
urn-forge compile [--manifest <file>] [--out <dir>]
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--manifest <file>` | `domain.manifest.yaml` | The manifest to compile |
| `--out <dir>` | `src/generated` | Where the generated files are written |

`compile` runs the manifest through the meta-schema, the IR builder and both plugins. It then writes `domain.schemas.generated.ts` and `domain.runtime.generated.ts` into `--out`, creating the directory if needed.

- A file whose content is already identical isn't rewritten, so its modification time doesn't change.
- If there is any error diagnostic, nothing is written.
- `compile` doesn't delete files it no longer produces. Gate 4 reports those.

```
wrote      src/generated/domain.runtime.generated.ts
unchanged  src/generated/domain.schemas.generated.ts
fingerprint sha256:<64 hex digits>
```

## `verify`

```
urn-forge verify [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>]
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--manifest <file>` | `domain.manifest.yaml` | The manifest to compile |
| `--out <dir>` | `src/generated` | Where the committed generated files are (gates 1 and 4) |
| `--core <file>` | `src/core.ts` | The core entry that must `satisfies DomainCoreImplementation` (gate 1) |
| `--features <dir>` | `features` | Searched recursively for `.feature` files (gate 3) |
| `--tsconfig <file>` | `tsconfig.json` | Compiler options gate 1 type-checks with |

The output has one line per gate, with its problems indented beneath it, then a final verdict. See [Verification gates](../guide/verify).

## Output and exit codes

Manifest diagnostics print to stderr, one per line:

```
<manifest>  <severity>  <message>
tests/fixtures/math.manifest.yaml  error  geometry.field.radius.primitive: unknown primitive "decimal" (MVP primitives: float, integer, string)
```

Messages start with the manifest key or URN they are about. Paths print relative to the current directory with forward slashes, so output is the same on every machine.

| Exit code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | An error diagnostic, an unreadable manifest, or a failed gate |
| `2` | A usage error: unknown command or unknown option |

## Scripts in this repository

From the repository root:

| Script | Runs |
| --- | --- |
| `npm test` | The CLI's Vitest suite |
| `npm run typecheck` | `tsc --noEmit` over the CLI package |
| `npm run verify:example` | `urn-forge verify` on the math example |
| `npm run test:features` | `cucumber-js` on the math example |
| `npm run docs:dev` | This documentation site, with live reload |
| `npm run docs:build` | A static build of this site |

Inside `packages/urn-forge`, `npm run compile:example` regenerates `example/generated/`.
