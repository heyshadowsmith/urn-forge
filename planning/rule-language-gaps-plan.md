# urn-forge plan: the gaps of the rule language

Nov 27, 2026 · @Shadow Smith

Each time a real domain met the rule language, the same few gaps stopped a rule. The last row is not a gap, but a form that is easier to read:

| Where | The rule that could not be written | The gap |
| --- | --- | --- |
| The Traitors | "Each player has exactly the number of votes that the tally says" | No count of the items that match a condition |
| The Traitors | "The endgame starts when four players are left" | The same |
| Tic-tac-toe | "The cell at row 2, column 3 is empty" | No index into a list |
| `self/` | "A new major version allows a breaking change" | No number from a text |
| `self/` | "The type name is the definition name in PascalCase" | No upper or lower case |
| Three contracts | "A claim id starts with CLM-", "a payment id starts with pay_" | None: a regular expression says it today. `startsWith` only makes it easier to read and to get right |

Each form below is standard CEL, or comes from the strings extension that Kubernetes enables. So each rule stays valid CEL, and an agent already knows each form. This plan adds no form that only urn-forge has.

## Decisions to confirm

| # | Form | Recommendation | What it gives | Why |
| --- | --- | --- | --- | --- |
| 1 | `l.filter(x, p)` | **Add.** A list of the items for which `p` is true. With `size()`, a count: `size(input.votes.filter(v, v.target == t.target)) == t.count`. With `sum()`, a total of some items | The count of matching items, which three domains needed | Standard CEL. It closes the largest gap with one macro, like `all` and `exists` |
| 2 | `l[i]` | **Add, for a list and an `int`.** An index out of the list breaks the rule, as a division by 0 does | A fixed position in a list: a cell of a board, the first item | Standard CEL. Maps stay out: the manifest has no map type |
| 3 | `int(x)`, `double(x)`, `string(x)` | **Add.** `int('12')` is `12`. A text that is not a number breaks the rule | A number from a text, and a text from a number | Standard CEL |
| 4 | `s.startsWith(t)`, `s.endsWith(t)`, `s.contains(t)` | **Add** | A prefix, a suffix or a part of a text, with no regular expression | Standard CEL. Today the same rule needs `matches()` and a regular expression that an agent can get wrong |
| 5 | `c ? a : b` | **Add.** `a` and `b` have one type | A value that depends on a condition: `input.express ? 2 * x : x` | Standard CEL. `!c \|\| r` already says "if c then r" for a bool, but not for a value |
| 6 | `s.split(t)`, `s.lowerAscii()`, `s.upperAscii()` | **Add these three, and no other function of the strings extension** | With 2 and 3, the major version of a text: `int(input.to_version.split('.')[0])`. Rules about case | Kubernetes enables these. They are the first forms from outside standard CEL, so this is the decision to watch for features that call for more features |
| 7 | `min()` and `max()` of a list | **Do not add.** The docs show the form that already works: `l.exists(x, l.all(y, y <= x) && …)` | Nothing new | Fewer forms. The gap was the count, which decision 1 closes |
| 8 | Calendar months and time zones | **Out of scope** | | A time-zone database is a large dependency, and months need rules that CEL does not have. A later plan, if a domain needs it |
| 9 | "Each other property is unchanged" | **Out of scope** | | CEL has no form to copy an object with one change. `==` on the whole object, and on each property, still work |

### For each new form

- **The type checker** gives its type and reports a wrong type with `rule-type`.
- **The generated code** is plain TypeScript, with no interpreter at run time. A form that can fail at run time (an index out of the list, `int()` of a text that is not a number) breaks the rule, as a division by 0 does today.
- **SQL:** `startsWith`, `endsWith`, `contains`, `lowerAscii`, `upperAscii`, `int()`, `double()`, `string()` and `c ? a : b` become SQL where their operands do. `filter`, an index and `split` are not in SQL: the schema's comment names the rule, as it names `all` and `exists` today.
- **`diff` and gate 5:** no change. A rule is compared by its text, so a new rule text is breaking where the rule is used, as now.
- **The docs:** the reference of the rule syntax, the package's `AGENTS.md`, and `contributing/add-a-cel-form.md`.

## The target, written first

Step 0 adds a test for each form: it parses, it has the right type, a wrong type gives `rule-type`, and the generated check gives the right answer for a value that keeps the rule and for one that breaks it. Each is `it.fails` until its step.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | `filter` | Its tests pass |
| 2 | An index | Its tests pass |
| 3 | `int()`, `double()`, `string()`, `startsWith`, `endsWith`, `contains` | Their tests pass, with SQL |
| 4 | `c ? a : b` | Its tests pass, with SQL |
| 5 | `split`, `lowerAscii`, `upperAscii` | Their tests pass |
| 6 | The proof: `self/` gets the rule `allows_a_breaking_change` (`int(input.to_version.split('.')[0]) > int(input.from_version.split('.')[0])`, or a 0.x version, or a pre-release). The corpus is scored again, and each promise that a new form makes declarable is declared | `npm run check` passes; the score of the corpus is recorded before and after |
| 7 | The docs | The docs build; the reference test passes |

## Sabotages at the end

Each must turn CI red:

1. Make `filter` keep the items for which `p` is false → its test, and the vote count of a scenario.
2. Make an index out of the list give `undefined` in place of breaking the rule → its test.
3. Make `int()` of `'1x'` give `1` → its test.

## Risks

- **Features that call for more features.** The strings extension has more functions. This plan takes three, and the reason for each. A later request for another one needs its own reason, from a real domain.
- **Rules that are harder to read.** `filter` and `?:` make longer rules possible. The `description` and the `failure_message` of a rule still say what it means.
- **Rules that do not become SQL.** A rule with `filter` or an index is checked by the harness, not by the database, as a rule with `all` is today.

## What was built

Each step is one commit, and each commit is green.

- **Step 0.** `tests/rule-forms.test.ts`, with a group for each form. Each group failed with the `rule-syntax` error of its form, such as `the method filter() is not in the subset`. The test runs the checks that the compiler generates, so `checksOf` is exported from `src/compile.ts`.
- **Steps 1 to 5.** The forms, in the parser, the printer, the type checker, the generated code and `toSql`. The new helpers of the generated code are `$index`, `$text`, `$int`, `$double`, `$string`, `$split` and `$case`, so each generated file of the repository was compiled again. In SQL, `startsWith` is `starts_with()`, `endsWith` is `right()`, `contains` is `strpos()`, the case functions are `translate()` of the letters A to Z, and `c ? a : b` is `CASE WHEN`.
- **Step 6.** `self/` gets `allows_a_breaking_change`. The corpus went from 64 to 65 of 143 promises (44.8% to 45.5%): ticketing P10 is declared with `standing_tickets_per_section`, a count with `filter`. A core that answers FLOOR x1 and PIT x2 for a hold of FLOOR x2 and PIT x1 is now a `ContractViolation`.
- **Step 7.** The reference of the rule syntax, the package's `AGENTS.md`, the methodology and `contributing/add-a-cel-form.md`.

Changes from the plan:

- **A test that compares SQL with the generated check.** Each form that becomes SQL runs on PGlite, row by row, beside the generated check. It found that Postgres casts `' 12'` and `'NaN'` to numbers, which `int()` and `double()` refuse. The SQL of a cast of a text now takes only the texts that the generated code takes. This is a separate commit, after step 5.
- **Two more rules in `self/`.** `keeps_the_major` on the refusal of `judge_version_change`, and `keeps_the_version_or_the_major` on the refusal of `judge_weaker_contract`. With `allows_a_breaking_change`, each verdict on a version is now stated exactly. A core that allows a breaking change within one major version breaks `allows_a_breaking_change` in 3 scenarios.
- **Not declarable yet:**
  - **`to_type_name`.** The language can split a name and change its case. But it cannot join a list of texts or take one character, so it cannot build the PascalCase name.
  - **Inventory P22.** Its rule needs the lines before a line, and `all` does not give the position of an item.
- **No rule text changed.** Each rule of `self/` and ticketing is new, so gate 5 sees a stronger contract.

The sabotages:

1. `filter` kept the items for which `p` is false. Its test failed, but no scenario did. No domain of the repository has a vote count, and the scenarios of ticketing have one standing section, where the sabotage gives the same count.
2. An index out of the list gave `undefined`. At first no test failed: each test compared the item with `==`, and `undefined == 'b'` is false anyway. The test now has `self.words[3] != 'a'` and `self.words[-1] != 'a'`, and the sabotage fails it.
3. `int('1x')` gave `1`. The test of the conversions and the SQL test of `int()` failed.
