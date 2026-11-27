# urn-forge plan: urn-forge's own contract as its documentation

Nov 27, 2026 · @Shadow Smith

`self/domain.manifest.yaml` declares 6 pure functions of urn-forge: about 1–2% of its source. The goal of this plan is a manifest that states urn-forge as completely as the contract can. A person or an agent can then read urn-forge's own contract to learn what urn-forge accepts, decides and answers. Each statement is checked, so the documentation cannot go stale.

urn-forge is a real domain, and it needs two shapes that the contract does not have yet:

| Shape | Where urn-forge needs it |
| --- | --- |
| **A map with free keys** | The `definitions`, `rules` and `operations` of a manifest, and the arguments of a rule use, are maps keyed by a name |
| **Either-or** | A definition is a value, a list or an object. A rule tree is a name, a literal, a call, a macro, and so on. A result is an answer, `InputRejected` or `ContractViolation` |

The rule language also has no recursion, on purpose. So the meaning of a recursive function, such as the parser or the printer, can only be stated node by node, never as a whole.

## What the manifest will state

| Layer | Declared as | Needs |
| --- | --- | --- |
| **1. The language of a manifest** | A definition for each key of a manifest, with its rules: the header, a definition, a rule, an operation, a rule use. This becomes the reference of the manifest. It replaces `manifest.schema.json`, and `manifest.md` points to it | Maps, either-or |
| **2. The vocabulary** | Each code with its fix, each standard rule, each Gherkin step, each gate, each CLI command and option, each key of the config, as enums | Nothing new |
| **3. The decisions** | An operation for each pure verdict that a user sees. Examples: the fix of a code (`fixOf`), the failure message of a rule (`fillMessage`), the type name, the URN, the version verdicts, `diff`'s class of each kind of change, the verdict of each gate from its facts, and the reading of a Gherkin cell | Nothing new; maps for some |
| **4. The rule language** | The rule tree as an either-or of node kinds, and the type of each node from the types of its children, by the table of functions | Either-or, maps |
| **5. The results** | `Failure`, `InputRejected`, `ContractViolation`, an answer, a diagnostic, and the JSON of `--format json` | Either-or |

**Stays out:**
- **The parser:** text to a tree, as a whole.
- **The printer and the code generator:** a tree or a model to text, as a whole.
- **The CLI's effects:** files, processes and git.

These remain in the unit tests. The manifest declares their inputs and outputs, and the descriptions say what the unit tests prove.

**urn-forge runs through its own harness.** Today, `self/`'s contract is checked only in its scenarios. In real use, the CLI calls `allowsWeaker` and the other functions directly, so nothing checks their answers. With this plan, the CLI calls each declared decision through `runOperation(selfCore, …)`. Each real run of `compile`, `verify` and `diff` then checks urn-forge's own answers against its contract, which is the promise urn-forge makes to its users. Only the decisions run this way. The parser, the printer, the code generator and the runtime helpers are not operations of `self/`.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Maps | **`type: map`, with `values: <definition>`, and optional `keys: <a string definition>` for the rules of a key. In TypeScript, `Readonly<Record<string, T>>`. In the rule language, CEL's map forms: `m[k]`, `k in m`, `size(m)`, `m.all(k, p)` and `m.exists(k, p)` over the keys** | It is CEL's own map, and the manifest is full of maps. The keys are names, so a key definition gives them their pattern |
| 2 | Either-or | **A tagged union: `type: union`, `tag: <property name>`, `variants: [<object definitions>]`. Each variant has the tag property with one value (an `enum` of one choice). In TypeScript, a union of the variants. In the rule language, `x.kind == 'call'` shows the variant, like a guard of `has()`: after it, a rule can read the properties of that variant** | A tag makes each value belong to one variant, with no guess. It is the form that agents and JSON already use (`kind`, `type`). The guard reuses the guard facts of `has()` |
| 3 | Gate 3 for a union | **Each variant needs a scenario, as each output of an operation does today** | A variant that no scenario reaches is a gap, as an output is |
| 4 | `diff` and gate 5 for the new shapes | **A new variant or a new map value is compatible for a reader and breaking for a writer, by the same rules as an output and a property. A removed variant is breaking** | The rules exist. Only the new kinds of part need a case |
| 5 | The manifest of a manifest | **Layer 1 replaces `manifest.schema.json`. compile can write a JSON Schema of any manifest's definitions later; this plan does not add that** | One source. Today the JSON Schema is written by hand, and it is already stale: it still says that the domain names a Postgres schema |
| 6 | The vocabulary and the docs | **A test checks that `AGENTS.md`, the skill and the reference pages name each item of the vocabulary enums of `self/`, and no other. The pages stay prose. They are not generated** | `self/` becomes the source of truth, and the pages cannot drift from it. Generating the pages would put a documentation generator in urn-forge, which is a feature that calls for more features |
| 7 | Recursive functions | **Declare them node by node, where a local rule states them. For example, "the type of each node follows from its children's types". Do not declare a whole parse or print** | The rule language has no recursion, on purpose, so that a rule always ends |
| 8 | The order | **Layers 2, 3 and 5 first, with no new construct. Then maps. Then unions. Then layers 1 and 4, which need both** | Each step is useful alone, and the new shapes come only when a layer needs them |
| 9 | urn-forge through its own harness | **The CLI calls each operation of `self/` through `runOperation(selfCore, …)`, and never calls the function directly. A `ContractViolation` stops the command with a new code, `internal-contract`, which names the operation, the rule and the input, and asks for an issue. Gate 2 checks it: `src/cli.ts` and `src/verify/` are the shell of `self/` in its config** | The contract then documents and checks the real behaviour. Gate 2 already finds a direct call to the core from a shell file, so this needs no new gate |
| 11 | Values of any JSON type | **The variants of a union can also be base types, told apart by their JSON type: a string, a number, a bool, a list or an object, with no tag. A union has at most one variant of each JSON type, and object variants still need a tag** | The arguments of a rule use (`minimum: 1`, `pattern: '^…'`, `enum: [a, b]`), the value of a Gherkin cell and the `choices` of an enum have no tag. One rule covers "any JSON value", with no `any` type |
| 12 | The meaning of each item of the vocabulary | **The vocabulary is a map, stated as a literal in a rule: each code to `{ fix, area }`, each gate to its check, each command to its options. An enum does not get a description for each choice** | It needs no new key of the manifest: maps come anyway. Each item then has its own sentence, and the rule checks that the real function gives the same |
| 13 | The standard set and the version | **No reference from one manifest to another. The test of decision 6 also checks that `self/`'s list of standard rules is the keys of `src/standard.manifest.yaml`, and that `self/`'s `manifest.version` is the version of the package** | A reference between manifests is the old hole D1, and a feature of its own. A test keeps the two lists equal, and the documentation names the version that it describes |
| 10 | The cost | **Accept the check on each call. If a command becomes slower than 10% on the booking fixture, the plan stops and records the time** | The decisions are small values, and each check is a few rules. Speed is a reason to stop, not a reason to skip the check quietly |

## Limits that this plan accepts

These stay out of the manifest. Each is a limit of a contract, not a gap that a construct closes:

| Limit | Why it stays |
| --- | --- |
| **No recursion in a rule.** The parser, the printer and the code generator are never stated as a whole | A rule always ends because it cannot call itself. Rules node by node, and the unit tests, are the split |
| **The meaning of CEL is circular.** The runtime helpers are CEL's meaning. A rule such as `output == input.s.substring(a, b)` would state CEL with CEL | The tests of the rule forms prove the helpers. The table of functions in layer 2 documents them |
| **Text tied to a file.** A diagnostic has a line of a YAML file, and the generated file is program text | They depend on the bytes of a file, not on values. The contract states the code and the message of a diagnostic; the unit tests check the lines and the generated text |

Already in reach, with no new construct:

- **Effects** (files, `tsc`, git, Cucumber): the shell gathers the facts, and the decisions take them as their input.
- **Names that refer to other parts** become rules once maps exist, such as `self.definitions.all(d, self.definitions[d].properties.all(p, p in self.definitions))`.
- **Examples:** the scenarios of `self/` are its examples, and gate 3 makes sure that each part has one.

## The target, written first

Step 0 adds the scenarios of each new operation and each new definition of `self/`, with a core that answers wrongly where it can. Like the self plan before it, it uses the tag `@target` to keep them out of the `self` profile until their step. For the new shapes, it adds `tests/maps.test.ts` and `tests/unions.test.ts` with `it.fails`.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | The new scenarios and tests fail for the reason expected |
| 1 | Layer 2: the vocabulary of `self/` as enums, and the test of decisions 6 and 13 | The test fails when a page names a code that the enum does not have, when a standard rule is missing from `self/`, or when the versions differ |
| 2 | Layer 3: the decisions with flat values. These are `fix_of`, `fill_message`, `classify_change`, `judge_gate_1` to `judge_gate_5` and `read_cell`; the core calls the real functions | Each scenario passes |
| 3 | Layer 5: the results and the diagnostics | Each scenario passes |
| 3b | urn-forge through its own harness: the CLI and the gates call the operations of `self/` through `runOperation`; `src/cli.ts` and `src/verify/` are the shell in `self/`'s config; the new code `internal-contract` | Gate 2 of `self/` passes. A direct call in the shell fails it. The time of `compile` and `verify` on the booking fixture is recorded before and after |
| 4 | Maps: the manifest, the model, the types, the checks, the rule language, gate 3, `diff` and gate 5 | `tests/maps.test.ts` passes |
| 5 | Unions: the same parts, with the guard of a tag, and variants of base types told apart by their JSON type | `tests/unions.test.ts` passes, also for a union of a string, a number and a list |
| 6 | Layer 1: the language of a manifest. `manifest.schema.json` goes, and the schema test reads `self/` | Each manifest of the repository is accepted by `self/`'s definition of a manifest, and a manifest with an unknown key is refused |
| 7 | Layer 4: the rule tree and the type of each node | Each scenario passes |
| 7b | The meaning of each item of the vocabulary, as maps of decision 12: `fix_of` reads the map of the codes | Each scenario passes, and a fix that differs from `src/codes.ts` fails one |
| 8 | The docs: the reference pages point to `self/` for each list. The methodology removes maps and either-or from what the contract cannot state | The docs build |

## Sabotages at the end

Each must turn CI red:

1. Change the fix of one code in `src/codes.ts` → the scenario of `fix_of`.
2. Make gate 3 pass a rule that no scenario breaks → the scenario of `judge_gate_3`.
3. Name a code in `AGENTS.md` that the enum of `self/` does not have → the test of decision 6.
4. Make a union value of two variants pass its check → `tests/unions.test.ts`.
5. Let a map key break its key rule → `tests/maps.test.ts`.
6. Call `allowsWeaker` directly in `src/verify/contract.ts` → gate 2 of `self/`.
7. Make `allowsWeaker` allow a weaker contract with the same version → a real `verify --base` stops with `internal-contract`, as well as the scenario.
8. Add a rule to `src/standard.manifest.yaml` and not to `self/` → the test of decision 13.
9. Make a union of a string and a number accept a bool → `tests/unions.test.ts`.

## Risks

- **New shapes call for more features.** Maps and unions are the first new kinds of value since the redesign. Each is CEL's own, or JSON's own, and urn-forge needs both. A request for a third kind needs its own reason.
- **A large `self/`.** The manifest could pass 1000 lines. It is documentation, so each part needs a `description` that a person can read. The layers become sections with a comment at the head of each.
- **A circle.** urn-forge compiles and checks its own contract. A bug that is in both the compiler and the contract of the compiler can hide. The unit tests and the booking fixture stay, and they do not use `self/`.
- **A check on each call.** It makes each command slower. Decision 10 gives the limit.
- **A wrong contract stops a real run.** If a rule of `self/` is wrong, a correct answer of urn-forge stops the user's command. The code `internal-contract` says so, and asks for an issue.
- **Node-by-node rules are weaker than the whole.** Layer 4 states the checker node by node, so a wrong order of the nodes, or a wrong tree, is not found. The unit tests of the parser and the printer stay.
