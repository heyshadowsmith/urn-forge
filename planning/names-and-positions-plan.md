# urn-forge plan: names and positions in the rule language

Nov 27, 2026 · @Shadow Smith

The [plan of the gaps of the rule language](./rule-language-gaps-plan.md) left two rules that no form can state:

| Where | The rule that cannot be written | The gap |
| --- | --- | --- |
| `self/`, `to_type_name` | "The type name is the definition name in PascalCase, with `Value` after a name that the generated file declares itself" | No way to take a part of a text, or to join a list of texts |
| Inventory P22 | "The new on-hand count of each line is the count after the line before it with the same SKU and location, plus the received quantity" | No position of the item in `all` and `exists` |

Each form below comes from CEL's strings extension, or is the two-variable form of a macro. Kubernetes enables both. So each rule stays valid CEL. This plan adds three forms, and the reason for each is a rule above. The last plan named this as the risk to watch: features that call for more features.

## Decisions to confirm

| # | Form | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | `s.substring(a)`, `s.substring(a, b)` | **Add.** The characters of `s` from position `a`, up to position `b` (not included), counted in characters from 0, as `size()` counts them. A position out of the text, or `a` after `b`, breaks the rule | With it, the first letter of a word: `w.substring(0, 1).upperAscii() + w.substring(1)` |
| 2 | `s.charAt(i)` | **Do not add.** `s.substring(i, i + 1)` says the same | Fewer forms. In CEL, `charAt` at the end of the text gives `''`, and `substring` gives an error, and two forms with different edges are easy to confuse |
| 3 | `l.join()`, `l.join(t)` | **Add.** The texts of a list of strings, joined, with `t` between them | The other half of the type name: the words of a name, joined. It is the opposite of `split` |
| 4 | `l.all(i, x, p)`, `l.exists(i, x, p)` | **Add.** The same macros, with a second name: `i` is the position of the item `x`, from 0 | P22 needs the lines before a line. With `l[i]` from the last plan, `i` also reads the item at the same position of another list |
| 5 | `exists_one(i, x, p)`, `map(i, x, e)`, `filter(i, x, p)`, `transformList` | **Do not add** | P22 needs only `all` and `exists`. In CEL, the two-variable form of `exists_one` is `existsOne`, which is a second spelling of a form that the subset already has |
| 6 | `cel.bind(name, value, body)` | **Do not add** | It gives a name to a value that a rule uses two times. The rule of `to_type_name` is longer without it, but it is correct, and two rules can share the work |
| 7 | SQL | **None of the three becomes SQL.** A rule with any of them is checked by the harness, and the schema names it in a comment | `substring` in SQL takes positions out of the text with no error, so it would accept what the rule refuses. The last plan found the same kind of difference in casts. `join` and the macros read lists, which the CHECK of a row cannot read |

### The rules that the forms state

**`to_type_name`**, as two rules. `P` is the PascalCase name:

```
input.definition_name.split('_').filter(w, w != '').map(w, w.substring(0, 1).upperAscii() + w.substring(1)).join('')
```

- `is_the_pascal_case_name`: `output.type_name == P || output.type_name == P + 'Value'`
- `value_only_for_a_reserved_name`: `(output.type_name == P + 'Value') == (P in ['Failure', 'RuleError', …])`

The list of the reserved names is in the rule, and it must be the list of `src/generate/code.ts`. A scenario of `failure` and of `domain_core` already shows two of them. `at_most_the_name_and_value` stays, because gate 5 refuses to remove a rule unless the version changes.

**Inventory P22**, as one new rule of `receive_goods`, `counts_after_the_line_before`. For each line at position `i`, `output.levels[i]` has the on-hand count of the line before it with the same SKU and location, plus the quantity of line `i`. If no line before it has that SKU and location, it is the stored count plus the quantity. "The line before it" is a line at `j < i` with the same pair, and with no line between `j` and `i` with the same pair. This needs the levels in the order of the lines. `receives_each_line` today finds each level by its pair. The new rule is stronger: the core must answer in order. If the core does not, the step finds it, and the plan records it.

### For each new form

- **The type checker:** `substring` takes a string and one or two ints. `join` takes a list of strings and, optionally, a string. In the two-variable macros, `i` is an `int`, and `i` and `x` must be new names, different from each other.
- **The generated code:** `substring` counts characters as `size()` does, not the units of a JavaScript string. A position out of the text throws `RuleError`, so the rule breaks. `every((x, i) => …)` and `some((x, i) => …)` give the position.
- **`diff` and gate 5:** no change. The printer gives the two-variable form its own canonical text.
- **The docs:** the reference of the rule syntax, the package's `AGENTS.md`, and `contributing/dogfooding.md`.

## The target, written first

Step 0 adds a test for each form to `tests/rule-forms.test.ts`, as the last plan did:

- It parses, and prints its canonical text.
- It has its type, and a wrong type gives `rule-type`.
- The generated check keeps a value and breaks another.
- `substring` is tested with a character outside the Basic Multilingual Plane, such as an emoji, at a position before the position under test.

Each test is `it.fails` until its step.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `substring` | Its tests pass |
| 2 | `join` | Its tests pass |
| 3 | `all(i, x, p)` and `exists(i, x, p)` | Their tests pass |
| 4 | The proof: `to_type_name` gets its two rules. Inventory gets `counts_after_the_line_before`, and the score of the corpus is recorded before and after | `npm run check` passes. A core that names `seat_booking` as `Seatbooking` is a `ContractViolation` |
| 5 | The docs | The docs build |

## Sabotages at the end

Each must turn CI red:

1. Make `substring` count the units of a JavaScript string → its test with an emoji.
2. Make `pascal` in `src/generate/code.ts` keep the underscores → `is_the_pascal_case_name`, in the scenarios of `self/`.
3. Remove `Failure` from the reserved names of the generated file → `value_only_for_a_reserved_name`.
4. Make the two-variable `all` give the position from 1 → its test, and P22's scenario.

## Risks

- **Features that call for more features.** This is the second plan that adds a function of the strings extension. The next request for one needs a rule that it states, from a real domain, as here.
- **A rule that copies the code.** The rule of `to_type_name` repeats the list of the reserved names. If one list changes and the other does not, a scenario fails, which is the point. But a new reserved name with no scenario is not found.
- **Long rules.** The rule of P22 has three macros inside one another. Its `description` and `failure_message` must say what it means.
