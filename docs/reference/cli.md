# CLI

```
urn-forge <command> [options]
```

| Command | Function |
| --- | --- |
| [`compile`](#compile) | Validates the manifest and writes the generated files |
| [`verify`](#verify) | Runs gates 1, 3 and 4 |
| `--help`, `-h`, `help` | Shows the usage text and stops with exit code `0` |
| `--version` | Shows the urn-forge version and stops with exit code `0` |

If you do not give a command, urn-forge shows the usage text. Then it stops with exit code `2`. urn-forge resolves relative paths in options from the current directory.

## `compile`

```
urn-forge compile [--manifest <file>] [--out <dir>]
```

| Option | Default | Description |
| --- | --- | --- |
| `--manifest <file>` | `domain.manifest.yaml` | The manifest to compile |
| `--out <dir>` | `src/generated` | The directory for the generated files |

The `compile` command sends the manifest through the meta-schema, the IR builder and the two plugins. Then it writes `domain.schemas.generated.ts` and `domain.runtime.generated.ts` in the `--out` directory. If this directory does not exist, the command makes it.

- If a file has the same content as the new output, the command does not write it again. The modification time of the file does not change.
- If there is an error diagnostic, the command writes no files.
- The command does not delete old files that it does not make now. Gate 4 shows these files.

```
wrote      src/generated/domain.runtime.generated.ts
unchanged  src/generated/domain.schemas.generated.ts
fingerprint sha256:<64 hex digits>
```

## `verify`

```
urn-forge verify [--manifest <file>] [--out <dir>] [--core <file>] [--features <dir>] [--tsconfig <file>]
```

| Option | Default | Description |
| --- | --- | --- |
| `--manifest <file>` | `domain.manifest.yaml` | The manifest to compile |
| `--out <dir>` | `src/generated` | The directory of the generated files in the repository (gates 1 and 4) |
| `--core <file>` | `src/core.ts` | The core entry. It must use `satisfies DomainCoreImplementation` (gate 1) |
| `--features <dir>` | `features` | The directory that contains the `.feature` files. The command also reads its subdirectories (gate 3) |
| `--tsconfig <file>` | `tsconfig.json` | The compiler options for the type check of gate 1 |

The output has one line for each gate. Below each line, the output shows the problems of that gate with an indent. The last line gives the result. For more data, refer to [Verification gates](../guide/verify).

## Output and exit codes

urn-forge writes the manifest diagnostics to stderr, one diagnostic on each line:

```
<manifest>  <severity>  <message>
tests/fixtures/math.manifest.yaml  error  geometry.field.radius.primitive: unknown primitive "decimal" (MVP primitives: float, integer, string)
```

Each message starts with its manifest key or its URN. urn-forge shows paths relative to the current directory, with forward slashes. As a result, the output is the same on all computers.

| Exit code | Description |
| --- | --- |
| `0` | The command is correct |
| `1` | An error diagnostic, a manifest that urn-forge cannot read, or a gate that fails |
| `2` | A usage error: an unknown command or an unknown option |

## Scripts in this repository

Run these scripts from the root of the repository:

| Script | Function |
| --- | --- |
| `npm test` | Runs the Vitest tests of the CLI |
| `npm run typecheck` | Runs `tsc --noEmit` on the CLI package |
| `npm run verify:example` | Runs `urn-forge verify` on the math example |
| `npm run test:features` | Runs `cucumber-js` on the math example |
| `npm run verify:self` | Runs `urn-forge verify` on the domain of urn-forge (`packages/urn-forge/self`) |
| `npm run test:features:self` | Runs `cucumber-js` on the domain of urn-forge |
| `npm run docs:dev` | Starts this documentation site, with live reload |
| `npm run docs:build` | Builds this site as static files |

In `packages/urn-forge`, `npm run compile:example` makes the files in `example/generated/` again. `npm run compile:self` makes the files in `self/generated/` again.
