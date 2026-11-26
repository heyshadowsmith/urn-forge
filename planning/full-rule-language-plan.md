# urn-forge plan: the full rule language for each primitive type

Nov 27, 2026 · @Shadow Smith

Until now, the rule language grew one form at a time, and only for a real need (decision 23 of the [redesign notes](./manifest-redesign-notes.md)). Each plan found the next gap: a count, then an index, then a part of a text, then a position. This plan changes the principle. The goal is to declare any rule about the primitive types of a manifest: string, integer, number, boolean, and the time strings.

**The new principle:** the rule language is CEL and its standard extensions, in full, for the types that a manifest has. It is proven by CEL's own conformance tests, not by our judgement.

The rule language has no loops, on purpose, so a rule always ends. "Any rule" means any rule that CEL can state. That covers the gaps that the corpus found in the rule language, the time zones of D3, and check digits such as Luhn (E1).

This plan replaces the plan of names and positions (#113, closed). Its two rules, `to_type_name` and inventory P22, are part of step 9.

## The proof: CEL's conformance tests

`cel-spec` has a test suite, `tests/simple/testdata/*.textproto`, under the Apache License 2.0. Each test is an expression and its value, or an error. Step 0 copies the files into `packages/urn-forge/tests/conformance/`, with their license and the commit that they come from. A test runner then does these things:

1. It reads each test.
2. It decides whether the test is **in scope**, or **out of scope** with a reason from a fixed list (decision 3).
3. It compiles each test in scope as a rule, with the parser, the type checker and the generated code that a manifest uses. It does not use a separate interpreter.
4. It compares the result with the test.

**The ratchet:** `tests/conformance/known-gaps.txt` lists each test in scope that does not pass yet. CI fails if:
- a test fails that the list does not name;
- a test passes that the list names. Remove it from the list.

Each step makes the list shorter. When the list is empty, the language is complete for the files in scope. The count of the tests in scope, the tests that pass, and the tests out of scope by reason are printed and recorded in this plan.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The principle | **Replace decision 23 with: "The rule language is CEL and its standard extensions, for the types of a manifest. A form is out only for a reason of decision 3."** | Agents already know CEL. A complete language stops the cycle of one plan per gap |
| 2 | The files in scope | **`basic`, `comparisons`, `conversions`, `fp_math`, `integer_math`, `logic`, `string`, `lists`, `macros`, `macros2`, `string_ext`, `math_ext`, `lists_ext`, `timestamps`, `bindings_ext`** | These are CEL and its extensions, for the types that a manifest has |
| 3 | What stays out, by reason | **Maps; `bytes`; `uint`; `null`; optional values (`optionals`); protocol buffers, wrappers and enums (`proto2`, `proto3`, `proto2_ext`, `wrappers`, `enums`); type values (`type(x)`, `dyn`); `cel.block` (`block_ext`); base64 (`encoders_ext`, of bytes); `sets_ext`; `network_ext`; `namespace`, `plumbing`, `unknowns`, `dynamic`, `type_deduction`, `parse`, `fields`** | A manifest has no map, bytes, unsigned or null value, and no protocol buffers. Each excluded file has a reason, and the runner prints how many tests each reason excludes. `sets_ext` and `network_ext` are in decision 4 |
| 4 | Kubernetes-only and the other extensions | **Out: `semver`, `url`, `ip`, `cidr`, `quantity` (Kubernetes), `network_ext` (IP and CIDR), and `sets_ext`** | They are general, but they are not about the primitive types. `sets.contains(a, b)` is `b.all(x, x in a)` today. A later plan can add one of them, for a real need |
| 5 | Integers | **An `int` is a JavaScript number. A result outside ±(2⁵³ − 1) is an error, so the rule breaks. Tests about the edges of 64-bit integers are out, with the reason "an int outside ±2⁵³"** | Values and JSON already have this limit. A BigInt in each rule would make every rule slower, and every core would need BigInt |
| 6 | Time | **A timestamp keeps milliseconds. Tests that need nanoseconds are out, with their reason. The accessors take a time zone: an IANA name, such as `'Europe/Paris'`, or a fixed offset, such as `'+02:00'`. Node's own `Intl` gives the zone data** | Values have milliseconds today. The last plan left zones out because of a large dependency, but `Intl` is built into Node: there is no dependency. An unknown zone is an error, so the rule breaks |
| 7 | The type checker | **It stays strict. A test whose expression only checks with `dyn`, or with mixed types in one list, is out, with the reason "needs dynamic types"** | The strict checker is what finds a wrong rule at compile time. That matters more than the few tests that need `dyn` |
| 8 | SQL | **A new form becomes SQL only where the PGlite test of `tests/rule-forms.test.ts` shows that SQL refuses what the generated check refuses. Otherwise, the schema names the rule in a comment** | The last plan found that Postgres casts accept more than CEL. Each translation needs that proof |
| 9 | The size of the generated file | **The generated file holds only the helpers that its rules use, and the helpers that they call** | The runtime grows several times larger. A domain that uses no time zone should not carry the time-zone code. It is a change to each generated file, made once, in step 1 |
| 10 | Error messages | **The runner checks that a test with an error gives an error. It does not compare the text** | CEL's error texts differ between implementations. The rule breaks either way |

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target: the files of `cel-spec`, the runner, the reasons, and the first `known-gaps.txt` | The runner passes, and its counts are recorded |
| 1 | Only the helpers that a file uses | Each generated file is compiled again. The tests and `npm run check` pass |
| 2 | The core files: `basic`, `comparisons`, `conversions`, `fp_math`, `integer_math`, `logic`, `string`, `lists`, `macros` | Their gaps are gone from the list |
| 3 | `string_ext`: `charAt`, `indexOf`, `lastIndexOf`, `replace`, `substring`, `trim`, `join`, `reverse`, `quote`, `format` | Its gaps are gone |
| 4 | `math_ext`: `math.greatest`, `math.least`, `math.abs`, `math.ceil`, `math.floor`, `math.round`, `math.trunc`, `math.sign`, `math.isNaN`, `math.isInf`, `math.isFinite`, and the bit functions of ints | Its gaps are gone |
| 5 | `lists_ext` and `macros2`: `lists.range`, `slice`, `distinct`, `flatten`, `reverse`, `sort`, `sortBy`, `first`, `last`, and the two-variable macros | Their gaps are gone |
| 6 | `timestamps`: the accessors of timestamps and durations, with time zones; `duration()` of a value that is not a literal | Its gaps are gone. The diff of a rule with a duration that is not a literal is "changed", as for any rule |
| 7 | `bindings_ext`: `cel.bind` | Its gaps are gone. `known-gaps.txt` is empty |
| 8 | SQL, where the PGlite test proves it, form by form | The test passes for each form that becomes SQL |
| 9 | The proof: `self/` states `to_type_name` exactly. The corpus is judged again for each hole that a new form closes: D3 (time zones), E1 (check digits), and P22. The score is recorded before and after | `npm run check` passes |
| 10 | The docs: the reference of the rule syntax by type, the package's `AGENTS.md`, `contributing/add-a-cel-form.md` (now "check a conformance file"), the methodology, and decision 23 of the redesign notes | The docs build |

## Sabotages at the end

Each must turn CI red:

1. Make `substring` count the units of a JavaScript string, not characters → a test of `string_ext`.
2. Make `getHours('Europe/Paris')` give the hour in UTC → a test of `timestamps`.
3. Make `math.round(-2.5)` give `-2`. CEL rounds half away from 0 → a test of `math_ext`.
4. Add a test of `known-gaps.txt` that passes → the runner fails, and asks to remove it from the list.
5. Remove a helper that a rule uses from the file of a domain → the drift gate, and the scenarios of the domain.

## Risks

- **A large language to document.** The reference of the rule syntax becomes a table for each type. The package's `AGENTS.md` stays short: it names the extensions and links to the reference, because agents already know CEL.
- **Long rules.** More forms make dense rules possible. The `description` and the `failure_message` of each rule still say what it means. A reviewer can ask for a rule to be split.
- **The source moves.** The test files are a copy of one commit of `cel-spec`. A newer version can change a test. A later plan updates the copy, and the list of gaps shows each change.
- **Rules that the database does not check.** Many new forms will not become SQL. Such a rule is checked by the harness, as `all` is today.
- **A reason that hides a gap.** Each reason of decision 3 must be about a type or a feature that a manifest does not have. A test that fails for another reason goes in `known-gaps.txt`, not out of scope.

## What was built

Each step is one commit, and each commit is green.

| Step | Result |
| --- | --- |
| 0 | The 15 files of cel-spec at commit `3dd8162`, with its license, a reader of their text format, and the runner. Of 1548 tests, 820 were in scope: 379 passed, and 441 were known gaps |
| 1 | A generated file holds only the helpers that it uses. Each generated file of the repository became about 100 lines shorter |
| 2 | Functions moved to one table of overloads, `src/cel/functions.ts`. The core files pass: the empty list, hex and `.5` literals, triple quotes and each escape, ordered bools, `bool()`, conversions of times, ints out of ±2⁵³ as errors, NaN in a list, and `&&`, `\|\|`, `all` and `exists` that absorb an error as CEL does |
| 3 to 7 | `string_ext`, `math_ext`, `lists_ext` and `macros2`, `timestamps`, `bindings_ext`. After step 7, `known-gaps.txt` is empty |
| 8 | SQL for `math.abs`, `math.sign`, `math.greatest` and `math.least` of ints, `math.ceil`, `math.floor`, `math.trunc`, `reverse()` of a string, and the accessors of a timestamp in UTC, each proved on PGlite |
| 9 | The proof: `self/`, the corpus, and a fix that the proof found |
| 10 | The docs |

The conformance tests now:

| | Tests |
| --- | --- |
| In scope, and pass | 764 of 764 |
| Out of scope | 784: unsigned integers 279, type values 139, dynamic types 122, protocol buffers 61, maps 58, bytes 45, null 32, ints outside ±2⁵³ 30, nanoseconds 18 |

### The proof

- **`self/`.** `is_the_type_name` states `to_type_name` exactly, with `split`, `filter`, `substring`, `upperAscii`, `join` and `cel.bind`. A `pascal()` that changes a part, or a reserved name that loses `Value`, is a `ContractViolation` in a scenario.
- **The corpus** went from 65 to 69 of 143 promises declared (45.5% to 48.3%), and the minimum is 48.3:

| Promise | Before | Now | How |
| --- | --- | --- | --- |
| Payments P04 | Workaround, E1 | Declared | `passes_the_luhn_check` |
| Payments P05 | Workaround, E1 | Declared | `passes_the_mod_97_check`, with a literal list of the powers of 10 modulo 97. Each check digit rule matched a reference on 20000 random values |
| Subscriptions P23 | Workaround, D3 | Declared | `period_is_the_plans` and `invoice_period_is_its_billing_period`: the end of a period in calendar months, leap years included. `is_a_real_time` refuses Feb 29 2026 and 10:60, which the pattern of `date-time` accepts |
| Ticketing P22 | Workaround, D3 | Declared | Each show states `local_starts_at`, the same instant as `starts_at` in its venue's time zone. `time_zone` is an IANA name of tzdata 2026e |
| Inventory P22 | Workaround, A2 | Workaround, C3 | `counts_after_the_line_before` states one call exactly, with positions. Two receipts at the same time can still break it |
| Bookings P03, P07, P12, P14, P15, P16 | Workaround, D3 | Workaround, D3 | Four rules tie each local date and time to `starts_at` in the booking's time zone. But no input holds the restaurant's time zone, so the core chooses it, and each window is counted to the start in that zone |

### Changes from the plan

- **Two forms need a literal.** The depth of `flatten(n)` is a literal, because the type of the result depends on it, as the text of `duration()` already was.
- **`double()` of a string is not SQL.** CEL's `double()` takes `'NaN'` and `'Infinity'`, which the last plan refused. Postgres orders NaN above each number, and CEL does not.
- **A fix that the proof found.** `math.least(x, l[i])` failed gate 1: the item of a list had the type `unknown` in the generated code. It is `any` now, and a test type-checks such a rule.
- **The completeness test of `AGENTS.md` reads the table of functions**, so a function that the page does not name fails it.
- **New input rules at version 1.0.0.** The rules that the proof added to bookings, subscriptions and ticketing accept fewer inputs. `diff` reports them as breaking. On the corpus, `diff` is a report, not a failure; for a real caller, they need a new major version.

### The sabotages

1. `substring` counted the units of a JavaScript string. **No test failed at first**: no conformance test of `substring` has a character outside the Basic Multilingual Plane before the position that it reads. `tests/rule-forms.test.ts` now has a test with an emoji for each function that counts characters, and the sabotage fails 2 of them.
2. `getHours('Europe/Paris')` gave the hour in UTC → `timestamps/timestamp_selectors_tz/getHours`.
3. `math.round(-2.5)` gave `-2` → `math_ext/round/negative_mid`.
4. A test that passes, written in `known-gaps.txt` → the conformance test, which names it.
5. `$least` removed from the generated file of subscriptions → gate 1, gate 4, and 138 of 226 scenarios.

## Changes after review

The forms that no rule of the corpus or of `self/` used are out of the language again: `format`, `strings.quote`, `trim`, `replace`, `reverse` (of a string and of a list), `sort`, `sortBy`, `distinct`, `slice`, `lists.range`, `math.round`, and the six `math.bit` functions. Each had no use, and a contract rarely checks how a text is printed or in which order a list is.

This changes decision 1. A form can now be out for a second kind of reason: it is unlikely to be used. The runner names it `unused`, and `UNUSED` lists its forms. A form comes back when a rule of a real domain needs it.

| | Tests |
| --- | --- |
| In scope, and pass | 622 of 622 |
| Out of scope | 926: 728 for a type or a feature that a manifest does not have, and 198 left out as unlikely to be used. Of these 198, 142 were in scope and passed, and 56 were already out for another reason |

The time accessors, `int()`, `substring()`, `cel.bind`, `c ? a : b`, `split`, `filter`, `transformList` and the two-variable macros stay: the rules of the proof used each of them.
