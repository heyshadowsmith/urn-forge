# Glossary

| Term | Definition |
| --- | --- |
| **answer** | What the core returns for a call: the name of one output and its value. The generated function `answer(output, value)` makes one. |
| **argument** | The value that a use of a rule gives to a parameter, for example `1` in `- minimum: 1`. |
| **base type** | One of the six types of JSON Schema that a definition has, directly or through a chain of definitions. |
| **breaking change** | A change after which a caller that worked before can fail. `urn-forge diff` reports it as `breaking`. |
| **CEL** | The Common Expression Language. The rule language is a subset of it. Refer to [The rule language](./rule-language). |
| **check** | The generated function that checks a value against a definition: its structure, then its rules. |
| **compatible change** | A change after which no caller that worked before can fail. |
| **contract** | The promises of a domain to the parties outside its core. The manifest states it. Refer to [The contract](../explanation/the-contract). |
| **ContractViolation** | A result of `runOperation` when the core answers what the contract does not allow. It shows a bug in the core. |
| **core** | The functions of a project, one for each operation. The core gets a checked input, does no I/O, and returns an answer. |
| **core file** | The file that exports the core with `satisfies DomainCore`, or a file in its folder that it imports. The default is `src/core.ts`. |
| **coverage** | The check of gate 3 that the scenarios run each operation, give each output, and break each rule of each definition. |
| **definition** | A named value of the manifest, in the section `definitions`: a number, a text, a true-or-false value, an object or a list. |
| **deprecated** | `deprecated: true` on a piece. The piece still works. Each use of it gets a warning. |
| **diagnostic** | One problem that urn-forge reports, with a file, a line, a severity, a code and a message. Refer to [Diagnostics](./diagnostics). |
| **DomainCore** | The generated interface of the core: a function for each operation. |
| **drift** | A difference between a generated file and the output of a new compile. Gate 4 finds it. |
| **failure** | One rule that a value breaks: the definition, the rule, the place of the value and the message. |
| **feature** | A Gherkin `.feature` file of scenarios. |
| **fingerprint** | The SHA-256 of the body of a generated file, in its header. |
| **gap** | A part of the manifest that no scenario covers: an operation, an output or a rule. It is a warning, or an error with `coverage: 'error'`. |
| **gate** | One check of `verify`: 1 completeness, 2 boundary, 3 Gherkin and 4 drift. Refer to [Verification gates](./verification-gates). |
| **generated file** | A file that `compile` writes. If you edit it, gate 4 fails. |
| **guard** | `has(x) && …` or `!has(x) \|\| …` in a rule. A rule reads an optional property only after a guard. |
| **harness** | The generated `runOperation`. It checks the input before the core runs, and the answer after it. |
| **identifier** | The property that tells two objects of one kind apart: `identifier: <property>` on an object. |
| **input** | The one object that an operation gets. In a rule of an operation or an output, the name `input`. |
| **InputRejected** | A result of `runOperation` when the input breaks a rule. The core does not run. |
| **item** | One value of a list. `items` names its definition. |
| **manifest** | The YAML file that states the contract of one domain. Refer to [The manifest](./manifest). |
| **message** | The text of a failure of a rule, with its arguments filled. |
| **object** | A definition with `type: object`: a map of properties. |
| **operation** | A signature in the manifest: one input, a list of outputs, and rules. The core has a function for it. |
| **output** | One of the objects that an operation can return. In a rule of an output, the name `output` is that object. |
| **parameter** | A value that a rule takes, listed in `parameters` by the name of a definition. |
| **property** | A value of an object. It has the name of its definition. |
| **refusal** | An output that refuses a request, for example `too_heavy_for_express`. It is an object like any other output. |
| **rule** | Something that must be true, with a name, a `rule` in the rule language and a `message`. Refer to [Rules and the standard rules](./rules). |
| **scenario** | One example in a feature. It runs an operation or checks a value, and examines the result. |
| **self** | In a rule of a definition, the value. |
| **severity** | The level of a diagnostic. An `error` fails the command. A `warning` does not. |
| **shell** | The code that calls `runOperation`. It does the I/O: it loads data into the input, and stores or sends the answer. |
| **shell file** | A file of the `shell` setting of the config. Gate 2 examines it. |
| **standard rules** | The keywords of JSON Schema, such as `minimum` and `required`, as rules that urn-forge ships. |
| **step** | One line of a scenario. urn-forge gives the steps. Refer to [Gherkin steps](./gherkin-steps). |
| **stored record** | A record that the shell loaded, as a property of the input, for example `stored_booking`. |
| **type** | One of the six types of JSON Schema, or the name of another definition. |

## Related pages

- [The contract](../explanation/the-contract)
- [Diagnostics](./diagnostics)
