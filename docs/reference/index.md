# Reference

The reference pages give the facts about urn-forge 0.1.0: the commands, the files, the names, the checks and the code that urn-forge makes. Each page is complete for its subject. For the reasons behind the design, refer to [Explanation](../explanation/).

## Inputs

| Page | Contents |
| --- | --- |
| [The CLI](./cli) | The `compile` and `verify` commands, their options and defaults, the text output, the exit codes and the npm scripts of the repository |
| [The configuration file](./configuration) | Each setting of `urn-forge.config.ts`, its type and its default, how urn-forge finds the file, and the plugin list |
| [The manifest](./manifest) | The header and each property of the five kinds of atom, with types, defaults and rules. Lists on a field reference |
| [The rule language](./rule-language) | The grammar of an invariant rule, the types of each element, the checks of pass 6, the canonical text and the translation to TypeScript |
| [Primitives and constraints](./primitives) | The eight primitives, their constraints and the aspect of each constraint, the Valibot code that each constraint makes, and the boundary cases |
| [URNs and names](./naming) | The URN grammar, short keys, brand identifiers, the generated export names and the name collisions |

## Compile and verify

| Page | Contents |
| --- | --- |
| [Compiler passes](./compiler-passes) | The passes that `compile` runs, in sequence, what each pass examines and its diagnostic codes |
| [Verification gates](./verification-gates) | The gates that `verify` runs, what each gate examines and when it fails |
| [Diagnostics](./diagnostics) | Each diagnostic code, with its message, its cause and the correction |
| [JSON output](./json-output) | The JSON lines that `--format json` writes |

## Outputs

| Page | Contents |
| --- | --- |
| [The generated schemas](./generated-schemas) | The contents of `domain.schemas.generated.ts` |
| [The generated runtime](./generated-runtime) | The contents of `domain.runtime.generated.ts`: `Result`, the handler types, `DispatchMap` and `executeOperation` |
| [Gherkin steps](./gherkin-steps) | The generic Cucumber steps, their tables and how a cell becomes a value |
| [The package API](./public-api) | Each export of `urn-forge`, `urn-forge/config` and `urn-forge/cucumber` |

## Terms and scope

| Page | Contents |
| --- | --- |
| [Glossary](./glossary) | Each term that this site uses, with a short definition |
| [Scope](./scope) | The parts of specification v1.1 that urn-forge 0.1.0 has, and the parts that it does not have |

## Related pages

- [Tutorials](../tutorials/)
- [How-to guides](../how-to/)
- [Explanation](../explanation/)
