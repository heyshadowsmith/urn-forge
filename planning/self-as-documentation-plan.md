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

## What was built: part 3

| Step | Result |
| --- | --- |
| 1 | `is_the_fix` of `fix_of` takes the fix of each of the 41 codes. A test checks that the map has each code, and runs each code through `fix_of` |
| 2 | `is_the_standard_rule` of `describe_standard_rule` takes the parameters, the text and the failure message of each of the 15 standard rules |
| 3 | `are_the_signatures` of `signatures_of` takes the signatures of each of the 40 functions |
| 4 | The dogfooding page says what `self/` states of each item, and that a change to one needs a change to `self/` |

Changes from the plan:

- **Step 0 is in each step.** The test of decision 18 came with each map, as in part 1.
- **The maps were written once from `src/`.** From then on, the harness and the test keep them equal.

The sabotages of part 3, each caught:

1. The fix of `drift` changed in `src/codes.ts` → the scenario of `fix_of`, 3 tests, and a real `verify` of the booking fixture with a stale generated file stopped with `internal-contract`.
2. The failure message of `minimum` changed in `src/standard.manifest.yaml` → the scenario of `describe_standard_rule`.
3. A new overload of `endsWith` → `tests/self.test.ts`, not a scenario: the scenarios of `signatures_of` name only some functions, and the CLI never runs `signatures_of`.
4. The fix of `drift` removed from the map → `tests/self.test.ts`.

`self/` now has 13 operations and 208 scenarios. Layer 4, the rule tree, is still open.

## Part 4: a manifest that a reader can find things in

A cold-reader test checked `self/` as documentation. An agent got only `self/domain.manifest.yaml` and ten questions that a user or a coding agent asks. It answered all ten correctly, which the code confirms, but finding each answer was slow. It named three causes:

1. **The meaning of an item is far from its list.** The codes are at line 195; their fixes are 1,100 lines lower, in the argument of a rule of `fix_of`, and nothing points from one to the other. The same holds for the standard rules and the functions.
2. **Nothing links a gate to its codes.** A gate is only a name. What it checks, and which codes it reports, is not in `self/`.
3. **The order is the order of the work.** The file has the sections in the order that the parts were built, and only some sections have a heading.

It also found four defects: the fix of `type-cycle` does not list `map` and `union`; four fixes are two sentences, although a fix is one sentence; the description of the rule `keeps_the_version_or_a_stable_major` says that it checks the major, which another rule checks; and some descriptions write ` - ` in place of `:` (`minimum - 1`).

### Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 19 | Layer 4, the rule tree | **Do not build it. The unit tests of the rule language stay its proof** | It would add hundreds of small definitions to a file whose problem is finding things. The test showed the cost before the layer |
| 20 | The meaning of each gate | **A map of each gate to what it checks and the codes that it reports, as the argument of a rule of `judge_gate`. The rule checks that each problem of the gate has one of its codes. `gateOutcome` already runs `judge_gate` with the problems of each real gate, so a gate that reports another code stops with `internal-contract`** | No new construct, and no new table in `src/`: the gates report their codes today, and the map states them. A test keeps the text of "what it checks" equal to the table of the gates in `AGENTS.md` |
| 21 | A pointer from each list to its meaning | **The description of `code`, `standard_rule_name`, `function_name` and `gate_name` names the operation and the rule that give the meaning of each item** | One sentence each; it is the shortest path from the list to the map |
| 22 | The order of the file | **One heading comment for each section, in the order a reader needs: the vocabulary, the decisions, the language of a manifest, the results; then the rules, then the operations. The operations keep the maps of meanings** | Order does not change the contract: `diff` and gate 5 compare by name |
| 23 | One sentence for each fix | **The four fixes of gate 5 become one sentence each, and `fix_is_a_sentence` also refuses a period followed by a space and a capital letter inside the fix** | The rule then checks what its description says |
| 24 | The version | **The package and `self/` go to 0.2.1** | A new text of a fix changes the argument of `is_the_fix`, and gate 5 refuses a changed argument at the same version: it cannot tell if the new text accepts more. Decision 13 keeps the two versions equal. The version is not on npm, so no user sees the bump |
| 25 | A meaning for each code, apart from its fix | **Not in this part** | The cold reader asked for it, but `src/` has no such text, and a fix with its gate tells what the code is about. Add it when a reader still cannot tell a code from its fix and gate |

### Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 1 | The four defects, the stronger `fix_is_a_sentence`, and the version 0.2.1 | `verify --base` of `self/` passes. `AGENTS.md`, the reference and the docs show the new fixes and version |
| 2 | The meaning of each gate, and the test of its text against `AGENTS.md` | A gate that reports a code of another gate fails the scenario of `judge_gate`, and a real `verify` stops with `internal-contract` |
| 3 | The pointers, the order and the headings | The graph of the manifest, made again, shows the same parts and references as before step 3 |
| 4 | The cold-reader test again, with the same ten questions, and the plan notes | Each answer stays correct, and the agent reports less friction for questions 1, 4 and 10 |

### Sabotages

1. Make gate 2 report `drift` → the scenario of `judge_gate`, and a real `verify` stops with `internal-contract`.
2. Write a fix as two sentences → the scenario of `fix_of`.
3. Change what a gate checks in `AGENTS.md` and not in `self/` → the test of decision 20.

## What was built: part 4

| Step | Result |
| --- | --- |
| 1 | The four defects are fixed, `fix_is_a_sentence` refuses a sentence break inside a fix, and the package and `self/` are 0.2.1. Gate 5 of `self/` allows the two changes as warnings, by the new version |
| 2 | `reports_its_codes` of `judge_gate` takes each gate, by its number, with its name, what makes it fail and its codes. A test keeps it equal to `AGENTS.md` and to the CLI reference, which did not list `tsconfig-unreadable` for gate 2 |
| 3 | Four headed sections of definitions (the vocabulary; the decisions, each under its operation; the language of a manifest; the results), headed rules and operations, a contents comment at the top, and a pointer from each list to its meanings. `diff` of the file before and after the move finds no change, and the graph has the same 202 parts and 284 references |
| 4 | The cold-reader test again, with the same ten questions and a fresh agent |

Changes from the plan:

- **No key rule for the map of gates.** A scenario cannot check a map as the root of its table, so a rule on the keys could not get a scenario. The keys are the numbers 1 to 5, and `reports_its_codes` reads them by the number of the gate.

### The cold-reader test, before and after

Both agents answered all ten questions correctly. The second one did it in 16 small calls, not by reading the whole file.

| Question | Before | After |
| --- | --- | --- |
| 1. The meaning of a code | The fix only, found 1,100 lines from the list | The fix, found from the pointer in the description of `code`. The meaning is still not stated (decision 25) |
| 4. The report of `verify` | Correct, with renamed definitions to follow | The same: the report is in one section, but its parts are still separate definitions |
| 10. A gate | Its name only; what it checks was not in the file | Its name, what makes it fail and its codes, with no friction |

Both agents ask for the same next change: a meaning and a severity for each code, next to its fix. The second agent also asks for a plain sentence next to each rule whose meaning is only in its rule text, such as the names that get `Value`. These are the candidates for a next part, by decision 25.

The second agent also reports the difference between `diff` and gate 5 at the same 0.x version as unstated. It is stated, in the descriptions of `allows_a_breaking_change` and `the_version_changed`, but only as two separate facts.

The sabotages of part 4, each caught:

1. Gate 2 that reports `drift` → a test of gate 2, and a real `verify` stopped with `internal-contract`: `reports_its_codes of judge_gate`.
2. A fix of two sentences → the scenario of `fix_of`, by `fix_is_a_sentence`.
3. A gate text of `AGENTS.md` that `self/` does not have → `tests/self.test.ts`.

`self/` has 13 operations and 211 scenarios. Layer 4 is not built (decision 19).

## Part 5: the meaning and the severity of each code

Both cold readers asked for the same change: next to the fix of each code, what the code means and whether it is an error or a warning. Today `self/` gives each code its fix, and the meaning is only in the table "Code | Cause" of the CLI reference. The severity is in no list: each place that reports a problem writes it.

What part 5 found before it started:

- **The meaning exists.** The table of causes in `docs/reference/cli.md` has each of the 41 codes, in 21 rows: some rows hold several codes with one cause, such as `manifest-unreadable` and `config-unreadable`.
- **The severity is fixed for 37 codes.** Each place that reports one of them writes the same severity. The four codes of gate 5 (`removed-rule`, `wider-rule`, `removed-output`, `removed-scenario`) are a warning when the new version allows the change, and an error when it does not.

### Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 26 | Where the meaning comes from | **`src/codes.ts` gives each code a `meaning`, from the table of causes of the CLI reference. A test keeps the two equal; codes in one row of the table share one meaning** | The text exists and users read it. No new sentences, and the reference keeps its rows |
| 27 | The severity | **`src/codes.ts` gives each code a `severity`: `error`, `warning`, or `by-version` for the four codes of gate 5. The places that report a problem keep their own severity; the harness checks it (decision 29)** | It states what the code does now, and changes no place that reports one |
| 28 | One map for each code | **The argument of `is_the_fix` becomes one map of each code to its meaning, its severity and its fix, under a new rule `is_the_code`. `fix_of` gives the meaning and the severity with the fix** | The reader finds the three facts in one place, as both readers asked. It replaces a map; it does not add one |
| 29 | A check of the severity | **The CLI asks for the fix of each problem with its code and its severity. The rule `has_its_severity` of `fix_of` checks the severity against the map, so a problem of the wrong severity stops the command with `internal-contract`** | Each problem already goes through `fix_of`. One more input property makes each severity checked on each run |
| 30 | `AGENTS.md` | **Its table of codes gets the meaning and the severity: `Code | Meaning | Severity | Fix`. The JSON report and the text output do not change** | The agent reads `AGENTS.md`. The output already has the message, which says what is wrong in this case |
| 31 | The version | **0.2.2** | A rule of `fix_of` is replaced and its output changes, which gate 5 refuses at the same version |

Not in part 5: a plain sentence next to each rule whose meaning is only in its rule text, which the second reader also asked for. Its source would be new text, not text that exists.

### Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 1 | `meaning` and `severity` in `src/codes.ts`; the table of `AGENTS.md`; the test against the reference | The test fails when a meaning differs from the reference |
| 2 | The map of each code in `self/`, `fix_of` with the severity, the CLI that sends it, and 0.2.2 | A problem reported with another severity stops a real command with `internal-contract` |
| 3 | The cold-reader questions 1 and 5 again, the docs and the plan notes | The reader gives the meaning and the severity of `rule-guard` and of `uncovered-rule` from the file alone |

### Sabotages

1. Report `deprecated-use` as an error → a real `compile` stops with `internal-contract`.
2. Change the meaning of a code in `src/codes.ts` → the scenario of `fix_of`, and the test against the reference.
3. Report a code of gate 5 as a warning when the version does not allow the change → not caught: `by-version` allows both. Record it as a limit, or split the four codes by severity, if you want it caught.

## What was built: part 5

| Step | Result |
| --- | --- |
| 1 | `src/codes.ts` gives each of the 41 codes its meaning and its severity. The code table of `AGENTS.md` is `Code \| Meaning \| Severity \| Fix`, and the CLI reference has one row for each meaning, with its severity. Tests keep both equal to `src/codes.ts` |
| 2 | One map in `self/`, the argument of `is_the_code` of `fix_of`, gives each code its meaning, severity and fix. `fix_of` takes the severity of the problem, and `has_its_severity` checks it. The CLI sends it with each problem. The package and `self/` are 0.2.2 |
| 3 | The cold-reader questions 1 and 5 again, and a new question on the severities; the docs and these notes |

Changes from the plan:

- **The table of causes did not have each code.** It had 30 codes. The 11 codes of gates 1 to 4 were only in the table of the gates, so their meanings come from that table's text.
- **The notes in some cells moved under the table.** "Only with `--format json`" for `usage`, the line of `rule-syntax`, and "fetch the base branch" for `base-unreadable` are now a paragraph, so that each cell is the meaning.
- **The four codes of gate 5 got their own meanings.** The third cold reader found that their shared cause, "the version does not allow it", contradicts the warning that a new version gives them. Each now says what changed: a rule is gone, a rule accepts more, an output is gone, a scenario is gone.
- **The texts of gates 3 and 5 name all their codes.** The same reader found that gate 3 did not name variants and gate 5 did not name an unreadable ref.

### The cold-reader test of part 5

A fresh agent answered three questions from the file alone, all correctly. One search gave the meaning, the severity and the fix of `rule-guard`, in one place. It also named which codes are warnings and when, from the map. It reported that the codes of the manifest and the rule language belong to no gate: `compile` reports them, and the file does not say so. It also reported a wrong rule, `has_its_severity`, but the rule is right: it compares the severity of the code in the answer with the severity of the problem in the input.

The sabotages of part 5:

1. `deprecated-use` reported as an error → a real `compile` stopped with `internal-contract`: `has_its_severity of fix_of`.
2. The meaning of `rule-guard` changed in `src/codes.ts` → `tests/agents.test.ts` and `tests/self.test.ts`, and each real report of `rule-guard`. Not the scenarios of `fix_of`: they name only some codes.
3. A code of gate 5 with the wrong severity → not caught, as planned: `by-version` takes both.

`self/` has 13 operations and 215 scenarios.

## Part 6: the last gaps that the cold readers found

Two gaps are left from the three cold-reader tests:

1. **Which command reports a code of the manifest.** Each code of a gate is in the map of `judge_gate`. The other 23 codes (the command line, the config, the manifest, the rule language, and `internal-contract`) are in no list of a command, so a reader cannot tell that `compile` reports the codes of the manifest and the rule language.
2. **Facts that only a rule text states.** A script compared the strings and lists of each rule text with its description. Four rules state a fact that their description does not name:
   - `is_the_type_name`: the nine names that get `Value`, such as `Failure` and `CheckResult`.
   - `direction_by_the_form`: the four rules whose bound is a lower bound (`minimum`, `exclusiveMinimum`, `minLength`, `minItems`).
   - `is_the_step_of_its_text` and `matches_no_step`: the form of the text of each step.

   The other differences are not facts for a reader, such as `input.code` or the `.` of a version.

A new description is not a change of the contract: `diff` of two manifests that differ only in a description finds no change. So part 6 needs no new version.

### Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 32 | Which command reports a code | **The description of `code` says that `compile`, and `verify` before its gates, reports each code that is in no gate; and that `diff` reports `usage` and the codes of the manifest** | One sentence answers it. A map of each command to its codes would need a decision of the CLI to check it, and no function of `src/` gives that list |
| 33 | Facts that only a rule text states | **The descriptions of the four rules name the facts: the nine names, the four rules, and the form of each step** | The text exists in the rule; the description gives it in words |
| 34 | A test that keeps them equal | **None** | The scenarios of each of the four operations fail if the rule changes. A test that compares a description with a rule text would compare prose |

### Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 1 | The description of `code`, and the four descriptions | `diff` against `main` finds no change, and `verify --base` of `self/` passes |
| 2 | The graph of the manifest, made again and published; the cold-reader question "Which command reports `rule-guard`, and what are the names that get `Value`?"; the plan notes | The reader answers from the file alone |

## What was built: part 6

| Step | Result |
| --- | --- |
| 1 | The description of `code` says which command reports a code that is in no gate. The descriptions of `is_the_type_name`, `is_the_step_of_its_text` and `matches_no_step` name the nine names that get `Value` and the seven forms of a step. `diff` against `main` finds no change |
| 2 | The graph of the manifest, made again and published: 206 parts and 291 references. The cold-reader questions on the three gaps, and these notes |

Changes from the plan:

- **Three rules, not four.** The description of `direction_by_the_form` already names its four rules. The script that compared the texts missed it: the rule quotes the names, and the description does not.

### The cold-reader test of part 6

A fresh agent answered three questions from the file alone, all correctly. The names that get `Value` took one call, and the forms of a step took two. Which command reports `rule-guard` took five: the description of `code` gives the general sentence, and the reader must find that `rule-guard` is in no list of a gate. This is the cost of decision 32, one sentence and no map of each command to its codes.

It also noted two things that are on purpose:

- Some codes share one meaning, such as `unknown-definition`, `unknown-property` and `unknown-rule`, as the table of causes of the CLI reference groups them. Their fixes tell them apart.
- `tsconfig-unreadable` is a code of gate 1 and of gate 2: each of them reads the tsconfig.

The plan of urn-forge's own contract is complete. `self/` has 13 operations and 215 scenarios. Layer 4 is not built (decision 19), and the severity of the four codes of gate 5 is not checked (part 5).

## Part 7: the commands that report each code

The agent experience comes first. The cold reader of part 6 took five calls to find which command reports `rule-guard`: it read the general sentence of decision 32, then checked that the code is in no list of a gate. Part 7 puts the answer in the entry of each code, next to its meaning, severity and fix, and checks it on each run. It replaces decision 32.

What part 7 found before it started:

- **Three commands report codes: `compile`, `verify` and `diff`.** `init` gives a wrong command line as text, with no code.
- **Most codes come from more than one command.** `verify` compiles the manifest before its gates, and `diff` compiles both manifests. So each code of the manifest and the rule language comes from all three, except `deprecated-use`: `diff` reports only the errors of a manifest. The config codes come from `compile` and `verify`, as `diff` reads no config. The codes of the gates come only from `verify`. `usage` and `internal-contract` come from each of the three.

### Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 35 | The commands of a code | **Each code has a list of the commands that report it, in `src/codes.ts` and in its entry of `is_the_code`. The commands are a new list of the vocabulary: `compile`, `verify`, `diff`** | The reader finds it in the same entry, with one search. The vocabulary already lists the codes, the gates and the steps; the commands are the last list that a reader names |
| 36 | A check of the command | **The CLI sends the command with each problem to `fix_of`, and a rule `reported_by_its_command` checks that the command is in the list. A code from another command stops the command with `internal-contract`** | The report already knows its command: it checks its JSON as `compile_report`, `verify_report` or `diff_report`. As with the severity, each problem is then checked on each run |
| 37 | The codes of the gates | **They stay in the map of `judge_gate`. A test checks that the codes of the gates are the codes whose list is `[verify]`** | Taking them out would make `judge_gate` take the map of all 41 codes as its argument, a second copy of it |
| 38 | The docs | **`AGENTS.md` and the CLI reference get a column of the commands, and `self.test.ts` keeps the list of commands equal to the commands of the CLI** | The same pages as the meaning and the severity |
| 39 | The version | **0.2.3** | The input and the output of `fix_of` change |

### Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 1 | The commands of each code in `src/codes.ts`, the columns of the docs, and the tests | A test fails when a code of a gate has another list than `[verify]` |
| 2 | The list of commands in the vocabulary of `self/`, the commands in the map of `is_the_code`, `fix_of` with the command, the CLI that sends it, and 0.2.3 | A code reported by a command that is not in its list stops a real command with `internal-contract` |
| 3 | The cold-reader question "Which command reports `rule-guard`?" again; the graph; the plan notes | The reader answers it from the entry of the code |

### Sabotages

1. Make `diff` report `deprecated-use` → a real `diff` stops with `internal-contract`.
2. Remove `compile` from the list of `rule-guard` in `src/codes.ts` → the scenario of `fix_of` and a real `compile` that reports `rule-guard`.
3. Give `drift` the list `[compile, verify]` → the test of decision 37.
