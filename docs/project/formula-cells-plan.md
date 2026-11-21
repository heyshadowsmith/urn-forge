# urn-forge formula cells plan

Nov 21, 2026 · @Shadow Smith

Strict boundary coverage asks for the value just past each limit. For `maxLength: 200`, a scenario must send a text of 201 characters. For `maxItems: 20`, it must send a list of 21 items. Today the only way is to write the value out in the table. The third blind trial wrote three such cells with a script, and its feature files became hard to read. Every domain with a long text or a long list meets this, and a feature file is meant to be read as the specification.

This plan adds formula cells: a cell that starts with `=` is a short formula that makes the value, as in a spreadsheet.

## What changes for a user

```gherkin
  Scenario: A claim with more than 20 lines is rejected
    When I run the operation with:
      | employee                             | claim_date | lines                                                                        |
      | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-11-21 | =repeat(21, { category: travel, amount: 10.00, receipt_date: 2026-11-01 }) |
    Then the input is rejected on "lines"

  Scenario Outline: A note longer than 200 characters is rejected
    When I run the operation with:
      | name   | note   |
      | Ada    | <note> |
    Then the input is rejected on "note"

    Examples:
      | note                    |
      | =repeat(201, "x")       |
      | ="a@" + repeat(198, "b") |
```

Gate 3 reads the same cells, so `=repeat(21, …)` counts as a list of 21 items for `maxItems`, and `=repeat(201, "x")` as a text of 201 characters for `maxLength`.

## The model

| Formula | Value | Example | Result |
| --- | --- | --- | --- |
| `repeat(n, "text")` | Text: the text `n` times | `=repeat(3, "ab")` | `"ababab"` |
| `repeat(n, value)` in a list property | A list: the value `n` times | `=repeat(2, fire)` | `["fire", "fire"]` |
| `a + b` | Text joined to text, or a list joined to a list | `="a@" + repeat(3, "b")`, `=[fire] + repeat(2, flood)` | `"a@bbb"`, `["fire", "flood", "flood"]` |
| A quoted text, a list or an object, as in a cell today | Itself | `="=x"` | `"=x"` |

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | How does a cell say that it is a formula? | **The first character is `=`**, after the spaces at the start | A spreadsheet does the same, so the form is known. Any other cell means what it means today |
| 2 | A text that starts with `=` | **Write it as a formula of one quoted text**: `="=x"` | One rule, and no escape character. Decision 10 finds each cell in the repository that changes its meaning |
| 3 | The functions | **`repeat(n, value)` only**, and `+` to join | These two make each long value of the trial. A function library would be a second language to learn. Others can come later as additions |
| 4 | What `repeat` makes | **Text if the value is a quoted text in a text property; a list if the property is a list.** The property decides, as it does for a cell today | One function for both cases, read as the cell is read |
| 5 | Inside a list or an object | **Yes.** A value in a list or an object cell can be a formula: `[{ note: =repeat(201, "x") }]` | The trial's long note is inside a list item. Without this, the formula helps only top-level cells |
| 6 | Text length | **Counts code points**, as `maxLength` does | `repeat(201, "é")` is 201 characters for the schema and for gate 3 |
| 7 | Limits | **`n` from 0 to 10 000**, and a value of at most 1 000 000 characters or items. Else the cell is malformed | A typo such as `repeat(2000000, …)` must not stop a test run |
| 8 | A malformed formula | **The same as a malformed list cell today**: the step fails with the column in the cell, and gate 3 reports `invalid-cell` | No new code; the same place to look |
| 9 | Where formulas work | **Every table that the cell reader reads**: the input, the output, the error and event fields, the records, and `Examples` values through their placeholders | The steps and gate 3 share one cell reader (`readCell`), so one change covers each table |
| 10 | Cells that change their meaning | **The check of step 1 lists each cell in the repository that starts with `=`. Today there is none.** The docs say that a cell such as `=x` now needs `="=x"` | A meaning that changes in silence is the risk of this plan. A cell such as `=x` is not a valid formula, so it fails with `invalid-cell`; it does not change in silence |
| 11 | Failure messages | **A message shows a long value shortened**: its first 40 characters, `…`, and its length, for example `xxxx…(201 characters)` | A step that fails on a 10 000-item list must not print it |
| 12 | Target | **The rules of the third blind trial**: a list of 21 lines, a note of 201 characters inside a line, and a reason of 301 characters, in a new fixture with strict coverage. **Insurance does not change**: its 41-character `remark` is a readable sentence, which a formula would make less clear | The trial is the case that found this. A formula is for a value that no one reads; a short literal stays the better cell |
| 13 | One PR? | **Yes**, one commit per step | |

## Scope

**In:** the formula grammar in the cell reader (`src/gherkin/cells.ts`); `repeat` and `+`; formulas inside lists and objects; gate 3 through the same reader; shortened values in messages; a fixture; the docs (the steps reference, Write scenarios, Adopt strict coverage, the gate 3 reference).

**Out:** other functions (`upper`, `pad`, a counter in `repeat`); formulas in step text; a list of distinct items made by a formula (a `unique` list of 21 items still needs 21 written values); numbers made by a formula.

## The target, written first

Step 0 adds the fixture and its feature, with the three formula cells. Until step 1, gate 3 reads `=repeat(21, …)` as text, so the `maxItems` case stays uncovered, and Cucumber sends the text, which the schema refuses for the wrong reason. That is the check of step 0.

## Build order

One PR (decision 13), one commit per step. Each step leaves the repository green and ends with a check.

- [x] **0. The target.** As above. *Check:* gate 3 reports the `maxItems` and `maxLength` cases of the fixture as uncovered.
  - *Done.* The check was met: gate 3 reported `no list of 21 item(s) (above maxItems)`, `no value of length 201 (above maxLength)` for the note and `no value of length 301` for the reason. The feature is in `tests/formula-cells.test.ts`, next to the fixture `tests/fixtures/formula-cells/`. The target went in with step 1.
- [x] **1. The cell reader.** The grammar, `repeat`, `+`, formulas inside structures, the limits, and `invalid-cell` for a malformed formula. *Check:* the fixture passes gate 3 strict and Cucumber; a case for each malformed form; no cell of the repository starts with `=` (decision 10).
  - *Done.* The check was met, through the same cell reader that the steps use (`tableToObject`): each row of the target is refused on its field. A term of a formula is never bare, so `=x` is refused, not read as `x` (decision 10). A formula cannot hold another formula. A formula of a single value is read by its primitive, as a plain cell is.
- [x] **2. Messages.** Shortened long values in the failure messages of the steps. *Check:* a test of a 10 000-item list that fails.
  - *Done.* A text of more than 60 characters shows its first 40 and its length; a list of more than 10 items, its first 3 and its length. Two long texts that differ also give the first character where they differ (the risk below).
- [x] **3. Ship.** The docs and the notes. *Check:* CI green; every sabotage below fails.
  - *Done.* New section [Formula cells](../reference/gherkin-steps#formula-cells) in the steps reference, with each form and each message; a section in Write scenarios with the rows of the target; a line in Adopt strict coverage.

## Done

| Sabotage | What catches it | Result |
| --- | --- | --- |
| `=repeat(20, …)` in place of `=repeat(21, …)` | Gate 3 strict: `uncovered-boundary` for `maxItems` | Caught: `no list of 21 item(s) (above maxItems)` |
| `=repeat(21, { … }` with no `)` | Gate 3, `invalid-cell`; the step fails with the column | Caught: `expected ")" at the end of repeat`, with the column in the cell; gate 3 reports a malformed formula as `invalid-cell` |
| `=repeat(20000000, "x")` | `invalid-cell`: `n` is more than 10 000 | Caught: `repeat needs a count from 0 to 10000` |
| `=x`, an old literal | `invalid-cell`, with the advice to write `="=x"` | Caught |
| A formula in an output table that differs from the output | The step fails, with the value shortened | Caught: `expected [fire, fire, fire, …(10000 items)], got [fire]` |

**Met.**

## Risks

- **A small language in the cells.** It is two functions and one operator, and it does not grow without a plan. The docs give each form with an example.
- **Values that differ only after position 40.** A shortened message can hide where two long values differ. The message gives the length of each, and the first position where they differ.
