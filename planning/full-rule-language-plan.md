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
