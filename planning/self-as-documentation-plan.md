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
| 10 | The cost | **Accept the check on each call. If a command becomes slower than 10% on the booking fixture, the plan stops and records the time** | The decisions are small values, and each check is a few rules. Speed is a reason to stop, not a reason to skip the check quietly |
| 11 | Values of any JSON type | **The variants of a union can also be base types, told apart by their JSON type: a string, a number, a bool, a list or an object, with no tag. A union has at most one variant of each JSON type, and object variants still need a tag** | The arguments of a rule use (`minimum: 1`, `pattern: '^…'`, `enum: [a, b]`), the value of a Gherkin cell and the `choices` of an enum have no tag. One rule covers "any JSON value", with no `any` type |
| 12 | The meaning of each item of the vocabulary | **The vocabulary is a map, stated as a literal in a rule: each code to `{ fix, area }`, each gate to its check, each command to its options. An enum does not get a description for each choice** | It needs no new key of the manifest: maps come anyway. Each item then has its own sentence, and the rule checks that the real function gives the same |
| 13 | The standard set and the version | **No reference from one manifest to another. The test of decision 6 also checks that `self/`'s list of standard rules is the keys of `src/standard.manifest.yaml`, and that `self/`'s `manifest.version` is the version of the package** | A reference between manifests is the old hole D1, and a feature of its own. A test keeps the two lists equal, and the documentation names the version that it describes |
| 14 | A key of different types in different objects | **A property can have its own definition: `- rules: rule_uses` in `properties`, next to plain names. A plain name keeps the definition of its name. This reverses the rule that a property is named as its definition** | A manifest reuses keys: `rules` is a map at the top and a list in a definition, and `output` is a list in an operation and a name in a result. Many JSON formats do the same. Without it, `self/` cannot state a manifest exactly. Decided when layer 1 started |

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

## What was built: part 1

Part 1 builds steps 0 to 5 and step 3b. Each step is one commit, and each commit is green. Part 2 builds the rest: layer 1 (the language of a manifest, which replaces `manifest.schema.json`), layer 4 (the rule tree), layer 5 (the results), and step 7b (the meaning of each item of the vocabulary).

| Step | Result |
| --- | --- |
| 0 | `tests/maps.test.ts` and `tests/unions.test.ts`, with `it.fails` |
| 1 and 2 | `self/` declares the vocabulary as enums (each code, standard rule, function, step and gate), and six decisions on it: `fix_of`, `describe_standard_rule`, `signatures_of`, `match_step`, `judge_gate` and `fill_message`. `self/` has 12 operations and 128 scenarios. `tests/self.test.ts` keeps each enum equal to the package, and the pages naming each item and no other, and the version of `self/` equal to the package's |
| 3b | `src/self.ts` runs the operations of `self/` through the harness. The CLI and the gates use it for the fix of each code, the verdict of each gate, `judge_weaker_contract` and `judge_version_change`. A violation stops the command with the new code `internal-contract`. The time of `compile` and `verify` on the booking fixture did not change: about 850 ms each |
| 4 | Maps: `type: map`, with `values` and `keys`, the map forms of the rule language, the check of each key and value, and `diff` |
| 5 | Unions: `type: union`, with a tag and `variants: { value: variant }`, or of base types; a guard by the tag; gate 3 reports a variant that no scenario reaches (`uncovered-variant`); and `diff` |

Changes from the plan:

- **Steps 1 and 2 are one commit.** A vocabulary enum needs a scenario that breaks it, so each enum is the input of the decision that reads it.
- **The scenarios of each operation come with its step**, not all in step 0.
- **Layer 5 moves to part 2.** A result is an either-or by nature, so it needs unions first.
- **The gates decide in one way.** So that `judge_gate` declares a real function, each gate passes when none of its problems is an error (`gatePasses`), and a failing gate names its problem. Gate 2 with a tsconfig that cannot be read now reports `tsconfig-unreadable`.
- **Gate 2 does not see a direct call of a declared function.** It sees a call of the core, not of the function that the core wraps. A test of `tests/self.test.ts` fails when a file of the shell calls one directly.
- **A tagged union maps each tag value to its variant.** In a manifest, a property's definition is global by its name, so the variants share one definition of the tag. The map says which value is which variant.
- **A union of base types types as `any`.** No form of the rule language tells the JSON type of a value.
- **The package ships `self/`**, as `src/self.ts` uses it.

The sabotages of part 1, each caught:

1. The fix of `drift` changed in `src/codes.ts` → the scenario of `fix_of`.
3. A code in `AGENTS.md` that `self/` does not have → `tests/self.test.ts`.
5. A map check that skips the key rule → `tests/maps.test.ts`.
6. `allowsWeaker` called directly in `src/verify/contract.ts` → `tests/self.test.ts`.
7. `allowsWeaker` that allows the same version → a real `verify --base` stopped with `internal-contract`, and named the rule and the input.
8. A standard rule that `self/` does not list → `tests/self.test.ts`.
9. A union of a string and a number that takes a bool → `tests/unions.test.ts`.

Sabotages 2 and 4 belong to part 2.

## What was built: part 2

Part 2 builds layer 1 and layer 5, and the construct that layer 1 needs. Each step is one commit, and each commit is green. Layer 4 (the rule tree) and step 7b (the meaning of each item of the vocabulary) are left for a later plan: step 7b needs map literals in the rule language.

| Step | Result |
| --- | --- |
| Decision 14 | A property can have its own definition: `- address: street_address` in `properties`. The reader, the model, the types, the checks, the rule language, the Gherkin tables, gate 3 and `diff` follow it. `diff` reports a property whose definition changed |
| 6 | Layer 1: the definition `manifest` of `self/` states each key of a manifest and its rules. `manifest.schema.json`, its editor line in the starter, and Ajv are gone. The schema test checks each manifest of the repository with `self/`, and checks that the reader refuses each value that `self/` refuses |
| Layer 5 | The results: a failure, the result of `check` and of `runOperation` (a refused call is a union tagged by `kind`), a problem, and the report of `compile`, `verify` and `diff` with `--format json`. The CLI checks each report against `self/` before it writes it |
| Sabotage 2 | The operation `find_uncovered_rules`: gate 3 finds the rules that no scenario breaks through the harness of `self/` |

`self/` now has 13 operations and 207 scenarios. Gate 5 of `self/` found that `pattern` in place of `minLength` on `failure_text` removes a rule, so `failure_text` keeps both.

Changes from the plan:

- **Decision 14 is new.** A manifest reuses keys with different types: `rules` is a map at the top and a list in a definition, and `domain` is a name in the header and a URN in a result. Without a property of its own definition, `self/` could not state a manifest exactly.
- **The reader stays.** `self/` states the shape of a manifest, and the reader of `compile` keeps its own code, so that each message tells what to change. A test keeps the two equal.
- **The JSON report has no `null`.** A manifest has no null, so a key that does not apply is now absent. An output entry with no rules is now `- order`, not `- order:` with no value; no manifest used it.
- **A map's type is an index signature**, `{ readonly [key: string]: T }`, in place of `Readonly<Record<string, T>>`: TypeScript refuses a `Record` that holds itself through a union, and the JSON value of a rule argument does.
- **A table of a tagged union** is read as the variant that its tag column names, so that a scenario can check a refused call.
- **The flags `ok: true` and `ok: false` are rules** (`is_true`, `is_false`): the standard `const` takes only a string.
- **Not stated:** that the variants of a union with a tag are a map, and with no tag a list. No form of the rule language tells the JSON type of an untagged union.
- **Editors lose the schema of the manifest.** The editor line of the starter pointed to `manifest.schema.json`. `compile` gives each problem of shape with its fix.

The sabotages of part 2:

2. Gate 3 that skips the rule `minimum` → at first, no test failed: `judge_gate` judges the problems, and nothing stated which rules gate 3 must report. With `find_uncovered_rules`, the same change in `uncoveredRules` fails its scenario, and 5 tests of gate 3 stop with `internal-contract`.
4. A tagged union that checks each value with its first variant → `tests/unions.test.ts`.

## Part 3: the meaning of each item of the vocabulary

Part 3 builds step 7b. Today `self/` lists each code, standard rule and function as an enum, but it does not say what each one means. `fix_of` only checks that the fix is one sentence. After part 3, `self/` gives each item its meaning, and the harness holds the real function to it.

### What part 3 found before it started

The plan expected map literals in the rule language (decision 12). They are not necessary. Since part 1, a rule can take a map as its argument, and a rule use writes the argument as YAML. A test of this already passes:

```yaml
rules:
  is_the_fix:
    description: The fix is the fix of the code
    parameters: [fixes]
    rule: output.fix == fixes[input.code]
    failure_message: Must be the fix of the code
operations:
  fix_of:
    output:
      - code_fix:
          - is_the_fix:
              drift: Run urn-forge compile, and do not edit a generated file by hand.
              usage: Run urn-forge --help, and call the command with the arguments and options that it shows.
```

A core that answers another fix gives `ContractViolation` of `is_the_fix`. The rule language does not change.

### Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 15 | Map literals | **Do not build them. The meaning of each item is the argument of a rule use, a YAML map. This replaces "a literal in a rule" of decision 12** | No new construct. A YAML map is easier to read than a map in the text of a rule, and the manifest is the documentation. A map literal can come later, when a rule of a real domain needs one |
| 16 | Which lists get a meaning | **Each code to its fix (41). Each standard rule to its parameters, what it checks and what its failure says (15). Each function to its signatures (40). Not the gates and the steps: their names are their meaning, and the reference pages describe them** | These are the three decisions that today check only a name. Each becomes exact |
| 17 | The source of the text | **Both `src/` and `self/` keep the text. They are not generated from each other. The harness keeps them equal: each report of a code runs `fix_of`, so a fix that differs stops the command with `internal-contract`** | The contract states, and the code implements, as in any domain. Generating one from the other would make the check say nothing |
| 18 | A missing item | **A test of `tests/self.test.ts` checks that the keys of each map are the items of its enum** | `keys: code` checks that each key is a code, but not that each code has a key |

The rule `fix_is_a_sentence` stays: it states the style of every fix.

### Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target: the scenarios of `fix_of`, `describe_standard_rule` and `signatures_of` give the meaning, with a core that answers wrongly where it can; the test of decision 18 with `it.fails` | They fail for the reason expected |
| 1 | The fix of each code | Each scenario passes. A fix that differs from `src/codes.ts` fails one, and stops a real command with `internal-contract` |
| 2 | Each standard rule: its parameters, what it checks, what its failure says | A change to `src/standard.manifest.yaml` that `self/` does not have fails a scenario |
| 3 | The signatures of each function | A new overload in `src/cel/functions.ts` that `self/` does not have fails a scenario |
| 4 | Docs, sabotages, plan notes | The docs build. The dogfooding page says what `self/` states of each item |

### Sabotages

1. Change the fix of one code in `src/codes.ts` → the scenario of `fix_of`, and a real `verify` that reports the code stops with `internal-contract`.
2. Change the failure message of a standard rule → the scenario of `describe_standard_rule`.
3. Add an overload to a function → the scenario of `signatures_of`.
4. Remove a code from the map of fixes → the test of decision 18.

### Left out

- **Layer 4, the rule tree.** It is the largest layer, and the least readable. Decide on it after part 3, when the manifest shows how readable a large `self/` is.
