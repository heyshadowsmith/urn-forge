# Add a diagnostic

This guide is for contributors who change urn-forge itself. A diagnostic is a problem that urn-forge finds in the config, the manifest or the project. Each has a code, a severity and a message. A user reads the code in [Diagnostics](../docs/reference/cli.md) to find the cause and the correction. Thus a code is part of the interface of urn-forge.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You read [How urn-forge is built](./architecture.md).

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Find the stage

A problem belongs to the first stage that can see it. Put the check there:

| The problem is in | Stage | File | How it reports |
| --- | --- | --- | --- |
| The YAML, or the keys and the types of values | Shape | `src/manifest.ts` | `read.shape(path, message)`, always `manifest-shape` |
| A name between two parts, a chain of types, an identifier, the text of a rule | Model | `src/model.ts` | `diagnostics.error(code, path, message)` |
| A use of a rule: its name, its argument, its message | Rule uses | `src/rules.ts` | `diagnostics.error(code, path, message)` |
| The type or the names of a rule where it is applied | Rule language | `src/cel/check.ts` | A `RuleProblem`: `rule-type`, `rule-guard` or `rule-scope` |
| An argument against the rules of its parameter, or a use of a deprecated part | Compile | `src/compile.ts` | `diagnostics.error` or `diagnostics.warning` |
| The config | Config | `src/config.ts`, `src/generate/postgres.ts` | A message of `config-invalid`, or a `postgres-config` problem |
| The core, the shell, the features or the generated files | A gate | `src/verify/` | A `GateProblem` with a file and an optional line |

Do not check a problem in a later stage if an earlier stage can find it. For example, the model does not check the keys of a definition, because the shape stage reported them.

## Choose the code

1. Look in [Diagnostics](../docs/reference/cli.md) for a code with the same cause and the same correction. If there is one, use it. For example, each problem of shape is `manifest-shape`, because the correction is always "use the keys of The manifest".
2. If no code fits, make a new one. The code is in kebab-case and names the cause, not the place: `type-cycle`, `invalid-identifier`, `duplicate-output`.
3. Choose the severity:
   - `error` if urn-forge cannot make correct files or a correct verdict. An error stops `compile`.
   - `warning` if the manifest works now, but a user must change it later. `deprecated-use` is the only warning of the manifest at this time.
   - A gap of gate 3 is a warning, or an error with `coverage: 'error'`.

## Write the check

1. Give the most exact path: the keys and the list indexes of the part, such as `['definitions', 'booking', 'rules', 1]`. The CLI finds the line of the path with `lineOf` in `src/cli.ts`. If a key does not exist, it uses the nearest part that exists.
2. Write the message in the style of the other messages:
   - Start with a lowercase letter, and name the part near the start. Do not put a period at the end.
   - Tell what is wrong, then what to write, after a semicolon: `the identifier weight_grams is optional; list it in the required rule of quote`.
   - Use the words of the manifest and of [the glossary](../docs/reference/manifest.md). Follow the English rules of the [documentation style guide](./docs-style.md).
3. Report each problem one time. If a part has an error, a later check must skip that part. For example, a rule that does not parse is `rule-syntax` where it is declared, and its uses are not typed.
4. Report all the problems that a stage can find, not only the first. A user then corrects them in one pass.

## Test the diagnostic

1. Add a test with a small manifest inline, next to the tests of the same stage:
   - the shape and the names: `tests/model.test.ts`, with the helper `codes`, which gives `<code> <path>`;
   - the rule uses and the arguments: `tests/rules.test.ts`;
   - the rule language: `tests/cel.test.ts`;
   - a mistake in the booking fixture: `tests/target.test.ts`, with the helper `changed`;
   - a gate: `tests/gherkin-gate.test.ts` or `tests/cli.test.ts`.
2. Assert the code, the path and the message. The message is part of the interface.
3. If the line is not the line of the last key of the path, add a test of the line in `tests/cli.test.ts`.
4. Run `npm test` and `npm run typecheck` from the root folder.

## Get a real output

The docs show only real outputs. Write a manifest with the problem in a temporary folder, outside the repository. Then run `compile` on it:

```bash
node /path/to/urn-forge/packages/urn-forge/bin/urn-forge.js compile --out gen
```

For a manifest that applies a rule that does not exist, the output is:

```
domain.manifest.yaml:11  error  unknown-rule  positive is not a rule of this manifest or a standard rule
```

## Update the docs

1. Add the code to [Diagnostics](../docs/reference/cli.md), in the table of its stage: the code, the cause and the correction. Add the real output to the block below the table.
2. For a code of a gate, also add the cause and the correction to [Fix a failing gate](../docs/reference/cli.md).
3. Run `npm run docs:build` from the root folder.

## Result

The diagnostic has a code, a test and a row in the reference. A user who gets it can find the cause and the correction.

## Related pages

- [How urn-forge is built](./architecture.md)
- [Add a Gherkin step](./add-a-gherkin-step.md)
- [Diagnostics](../docs/reference/cli.md)
- [Fix a failing gate](../docs/reference/cli.md)
