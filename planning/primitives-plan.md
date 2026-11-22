# urn-forge primitives plan

Nov 21, 2026 · @Shadow Smith

The goal is a set of primitives and constraints that is MECE: mutually exclusive and collectively exhaustive. Each kind of single value has exactly one primitive. Each constraint restricts exactly one aspect of a value, and has the same name on every primitive that has that aspect. Together, the constraints of a primitive cover every aspect that applies to it.

Today's four primitives are not MECE, and the spec's plan for more would make it worse. This plan first makes the four MECE, then adds `decimal`, `date` and `timestamp`, then lists.

## The problem

| Problem | Kind | Where it shows |
| --- | --- | --- |
| `string` with `oneOf` is a closed set of names, not free text. Its `oneOf` overlaps `minLength`, `maxLength` and `regex` on the same field | Overlap | Pass 7 has to check each `oneOf` value against the length and `regex` constraints only because the two overlap |
| `min` and `max` are inclusive only | Gap | "a price above 0" cannot be written for a `float` |
| `notEqual` takes one value | Gap | "not 0 and not 13" cannot be written |
| No exact fraction, no calendar day, no instant | Gap | Money must be a `float`, and a domain has no dates |
| Spec §4.1 plans `format: iso-date` on `string` *and* a `timestamp` primitive | Overlap (planned) | One kind of value would have two spellings |
| Spec §4.1 plans `list`, `record` and `ref` as primitives | Two axes mixed (planned) | A list of integers would be both `list` and `integer` |

## The model

### Three layers, one question each

| Layer | Question it answers | Today |
| --- | --- | --- |
| The field: its primitive and constraints | What is one value, and which values are allowed? | Yes |
| The entity's field reference | Is the value present (`required`), and how many are there (one or a list)? | `required` only |
| Invariants (a later kind, spec §4.3) | Which combinations of fields are allowed? | No |

A rule belongs to exactly one layer. A field never says how many values there are, and an entity never says which values one field allows.

### Aspects

A single value can be restricted in these ways, and only these:

| Aspect | Meaning | Applies to |
| --- | --- | --- |
| Range | A lower bound, an upper bound, or both | Ordered kinds |
| Step | The spacing of allowed values | Exact number kinds |
| Size | The length of a value | Text |
| Shape | The form of a value | Text |
| Membership | The value must be one of a set | Closed kinds |
| Exclusion | The value must not be one of a set | Number kinds |

### Primitives

One primitive for each kind of value. A kind is new only when it needs a different value space or a different comparison than every other kind.

| Primitive | Value | In the shell and the core | Range | Step | Size | Shape | Membership | Exclusion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `boolean` | True or false | `boolean` | — | — | — | — | `mustBe` | — |
| `enum` *(new)* | One of a fixed set of names | Union of string literals | — | — | — | — | `values` | — |
| `string` | Free text | `string` | — | — | `minLength`, `maxLength` | `regex` **or** `format` | — | — |
| `integer` | An exact whole number (safe integer) | `number` | `min`, `max` | `multipleOf` | — | — | — | `notIn` |
| `decimal` *(new)* | An exact fraction, such as money | `string`, canonical form | `min`, `max`, `exclusiveMin`, `exclusiveMax` | `scale` | — | — | — | `notIn` |
| `float` | An approximate measurement | `number`, finite | `min`, `max`, `exclusiveMin`, `exclusiveMax` | — | — | — | — | `notIn` |
| `date` *(new)* | A calendar day, `YYYY-MM-DD` | `string` | `min`, `max` | — | — | — | — | — |
| `timestamp` *(new)* | An instant, ISO 8601 in UTC with `Z` | `string` | `min`, `max`, `exclusiveMin`, `exclusiveMax` | — | — | — | — | — |

Rules that keep the table MECE:

- **One name for one aspect.** `min` means an inclusive lower bound on every ordered primitive, `date` and `timestamp` included (not spec §4.1's `after` and `before`).
- **At most one constraint per side.** `min` and `exclusiveMin` together, `max` and `exclusiveMax` together, or `regex` and `format` together are an error: `conflicting-constraints`.
- **Exclusive bounds only on continuous kinds.** On `integer` and `date`, an exclusive bound always equals an inclusive one (`exclusiveMin: 0` is `min: 1`), so it would be a second spelling. They do not get one.
- **One step per kind.** `integer` uses `multipleOf`. `decimal` uses `scale`, the digits after the point (`scale: 2` is a step of `0.01`). `float` has no step.
- **No precision constraint.** Spec §4.1's `precision: [p, s]` mixes size with step. `scale` is the step; the range bounds the size. A SQL plugin derives `NUMERIC(p, s)` from both.
- **Membership is its own primitive.** A closed set is `enum`, not `string` with `oneOf`. Thus no length or shape constraint can meet a membership constraint on one field.
- **`format` is a closed list of named shapes:** `uuid`, `email` and `uri` to start. A name is new only if a `regex` cannot express it clearly.

### What the model does not cover

Collectively exhaustive means exhaustive for single values that a domain sends as JSON. These are not covered, and this plan does not add them:

| Value | Write it as | Why not a primitive |
| --- | --- | --- |
| A duration | `integer` with the unit in the name, such as `timeout_ms` | Its value space and comparison are those of `integer` |
| A time of day, a local date-time, a time zone | Not covered | No current domain needs it. A later plan adds it as its own kind |
| An integer larger than 2⁵³ | `string` with a `regex` | JSON numbers lose precision there |
| Binary data | Not covered | Not a domain value |

### Structure

Structure is not a primitive. A list is a property of the field reference:

```yaml
order.entity.order:
  fields:
    - ref: order.field.sku
      many: { minItems: 1, maxItems: 50, unique: true }
```

`required: false` says the list may be absent; `minItems: 0` says it may be empty. Nested entities, `ref` to another entity and `record` need their own decisions, so this plan stops at lists of fields.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where does a closed set live? | **A new `enum` primitive with `values`**. `oneOf` leaves `string` | It removes the only overlap among today's constraints. It breaks manifests that use `oneOf`; before 1.0 that is cheapest |
| 2 | How is a value excluded? | **`notIn: [ … ]`** on the number kinds, replacing `notEqual` | One value is a list of one. Two constraints for one aspect would not be mutually exclusive. It breaks the math example and the shop fixture |
| 3 | Is structure a primitive? | **No.** Lists go on the field reference | A primitive answers "what is one value"; a list answers "how many" |
| 4 | Order of work | **Part A** (today's four, made MECE), **then Part B** (`decimal`, `date`, `timestamp`), **then Part C** (lists) | Part A changes the rules that B and C extend |
| 5 | How are `decimal` literals written? | **As strings**: `min: "0.01"`. A YAML number is `invalid-value`, with a hint to quote it | A YAML number is a binary float, so `0.1` is not exact. The value crosses the boundary as a string too |
| 6 | How is the model enforced? | **In the registry.** Each constraint declares its aspect, and each primitive declares its exclusive groups. A test checks that one name has one aspect everywhere, and that the reference table in the docs matches the registry | Without a test, the next constraint can break MECE without a sign |
| 7 | Breaking changes and URNs | **Change in place**, keep each URN, and record it in *Departures from the specification* | Spec §3 says a changed primitive needs a new URN. No consumer exists before 1.0, so a new URN would only add noise |
| 8 | One PR or one per step? | **One PR** for all steps (decided when the work started), with one commit per step | The steps change the same registry and the same docs pages. One PR changes each page once |
| 9 | How does a table cell hold a list? | **`[a, b, c]`**: each item is a cell of the field's primitive, `[]` is the empty list | It reads like the YAML flow list in the manifest. An item cannot hold a comma; no domain here needs one |
| 10 | Boundary coverage of a list | **The items are the field's values** for its own cases. The lists add the counts at and beyond `minItems` and `maxItems`, and a repeated value for `unique` | The field's rules apply to each item, and the list's rules to the list, as the layers say |

## The target, written first

Before the code, step 0 writes:

- **A fixture** `tests/fixtures/primitives/` that declares one field for each primitive and constraint in the table above, with the expected generated files. It fails until each step makes its part.
- **A fixture of conflicts** with the expected diagnostics: `min` with `exclusiveMin`, `regex` with `format`, `exclusiveMin` on an `integer`, an empty `values`, a duplicate in `values`, `notIn` that excludes every allowed integer, and an unquoted `decimal` literal.
- **The boundary cases by hand**, for gate 3:

| Constraint | Required values |
| --- | --- |
| `values` (`enum`) | Each value, and one value that is not in the list |
| `exclusiveMin` | The bound itself (refused), and a value above it |
| `exclusiveMax` | The bound itself (refused), and a value below it |
| `multipleOf` | A multiple, and a value that is not a multiple |
| `notIn` | Each excluded value |
| `format` | One valid value, and one that is not valid |
| `scale` | A value with `scale` digits after the point, and one with `scale + 1` |
| `min` / `max` on `decimal` | The bound, and one step outside it at the scale (or any value outside it, with no `scale`) |
| `min` / `max` on `date` | The bound, and the day outside it |
| Bounds on `timestamp` | The bound, and a value outside it |

The existing cases (`min`, `max`, `minLength`, `maxLength`, `regex`, `mustBe`) stay as they are.

## Build order

All steps are in one PR (decision 8), one commit each. Each step left the repository green and ends with a check you can run. Each step that adds a primitive or a constraint does all of these:

- the descriptor: constraints, coherence, `parseCell` and `boundaries`;
- the Valibot translation;
- the conflict and coherence diagnostics;
- the fixtures;
- a case in `tests/every-code.test.ts` for each new code;
- the docs: [Primitives and constraints](../docs/reference/primitives.md), [The manifest](../docs/reference/manifest.md) and [Add a field](../docs/how-to/add-a-field.md).

### Part A: make today's primitives MECE

- [x] **0. The target.** The two fixtures and the boundary table above, with the registry's `aspect` and exclusive groups (decision 6) and their test. *Check:* the test passes on today's registry, and the new fixtures fail only where later steps add features.
  - *Done.* `ConstraintSpec` has `aspect` and an optional `required`; a descriptor has `exclusive` groups. Two tests: one name has one aspect on every primitive, and a group shares one aspect. A third test, added with the docs, compares the reference table with the registry row for row. A property an entry must have now gets its own code, `missing-property`, instead of a Valibot message. The fixtures were written as each step made their constraints exist: `primitives` (one field per constraint; tests parse values through its generated schemas), `conflicting-constraints` (pass 7) and `replaced-constraints` (pass 1). Pass 1 errors stop the compile before pass 7, which is why the conflicts are two fixtures, not one.
- [x] **1. `enum`.** Add the primitive (`v.picklist`). Remove `oneOf` from `string`. Change `self/`, the three tutorial snapshots, the fixtures and every page that uses `oneOf`. *Check:* every domain verifies with no warning; `oneOf` on a `string` is `constraint-not-allowed`, with a hint to use `enum`.
  - *Done*, with one change to the check: `oneOf` is now a constraint of no primitive, so it is `unknown-property`, with the hint `for a fixed set of values, use primitive: enum with values: [ … ]`. `values` is the first necessary constraint; without it, `missing-property`. The broken-references fixture had tested `oneOf` against the lengths and `regex`; that incoherence cannot exist any more, so it tests other incoherent fields.
- [x] **2. `notIn`.** It replaces `notEqual` on `integer` and `float` (`v.notValues`). Change the math example and the shop fixture. Coherence: `notIn` that excludes every allowed `integer` admits no value. *Check:* the math example still refuses a divisor of `0`.
  - *Done* (steps 2 to 5 are one commit). `v.notValues` refuses `-0` as it refuses `0`. `notEqual` gets `unknown-property` with the hint `to exclude values, use notIn: [ … ]`. Pass 7 lists the allowed integers (with `multipleOf`) when there are 100,000 or fewer.
- [x] **3. Exclusive bounds.** `exclusiveMin` and `exclusiveMax` on `float` (`v.gtValue`, `v.ltValue`), and `conflicting-constraints` for two bounds on one side. *Check:* `exclusiveMin: 0` refuses `0` and accepts `0.5`; `exclusiveMin` on an `integer` is `constraint-not-allowed`.
- [x] **4. `multipleOf`** on `integer` (`v.multipleOf`). Coherence: no multiple in the range admits no value. *Check:* `multipleOf: 5` with `min: 1, max: 4` is `incoherent-constraints`.
- [x] **5. `format`** on `string`: `uuid`, `email`, `uri` (`v.uuid`, `v.email`, `v.url`), in conflict with `regex`. *Check:* each format refuses a bad value; `regex` with `format` is `conflicting-constraints`.
  - *Done.* A `uuid` whose length constraints exclude 36 characters is `incoherent-constraints`. A field with `conflicting-constraints` skips the rest of pass 7.
- [x] **6. The explanation.** A page in *Explanation* about the MECE model: the layers, the aspects, the rules and what is not covered. *Check:* the docs test of decision 6 passes against the reference table.
  - *Done* with the docs, after Parts B and C, so the page and the table describe the whole model: [The MECE model of primitives](../docs/explanation/primitives-model.md), and a rewritten [Primitives and constraints](../docs/reference/primitives.md). Removing a row from that table fails the test.

### Part B: new kinds of value

- [x] **7. `decimal`.** A canonical decimal string (`-?(0|[1-9][0-9]*)(\.[0-9]+)?`, no exponent). Range with exclusive bounds, `scale`, `notIn`. Constraint literals are strings (decision 5). The generated runtime compares decimals exactly, without a library. The core receives the string. *Check:* `"0.1" + "0.2"` never happens in validation; `scale: 2` refuses `"1.005"`.
  - *Done* (steps 7 to 9 are one commit). Comparison uses `BigInt` on the digits, so a 25-digit value is exact. The generated schemas carry the helpers as fixed text, once per file and only when a field needs them; `tests/exact.test.ts` runs that text and checks it against the descriptors and a reference on 20,000 random pairs. `"1.10"` equals `"1.1"`, so `notIn: ["13.00"]` also refuses `"13"`. The helpers need the `ES2020` library for `BigInt`.
- [x] **8. `date`.** `YYYY-MM-DD`, a real calendar day (`2026-02-30` is refused). Range with inclusive bounds only. *Check:* the bounds and the day outside each one; YAML does not change a date literal into a `Date`.
  - *Done.* The `yaml` package keeps `2026-01-31` as text (its core schema has no timestamp type), so a date literal can be unquoted. The helper and the descriptor agree on every day of 1999 to 2001 and on days that do not exist.
- [x] **9. `timestamp`.** ISO 8601 in UTC with `Z`, with optional fractions of a second. Range with exclusive bounds. No constraint can mean "now", because that would break determinism (spec §6). *Check:* an offset such as `+02:00` is refused; the bounds compare as instants, not as text.
  - *Done.* The fraction has 1 to 3 digits, so `Date.parse` compares exactly.

### Part C: structure

- [x] **10. Lists.** `many: { minItems, maxItems, unique }` on a field reference (decision 3). It changes the IR, both plugins, the Gherkin steps (a list in a table cell) and boundary coverage (the item-count cases). It gets its own decisions on cell syntax before it starts. *Check:* a list of SKUs with `minItems: 1` refuses `[]`.
  - *Done*, with decisions 9 and 10. `many: true` is a list of any length. `unique` compares values as they cross (`===`), so `"1.10"` and `"1.1"` are two values. An error message placeholder cannot name a list. The `init` starter now splits a bill between a list of named people, so `init`, the tarball test and Cucumber run a list end to end; removing three rows from its feature gives exactly the three missing list cases.

## Done

The primitives are MECE when CI is green and each of these fails `verify` or `compile`:

| Sabotage | What catches it |
| --- | --- |
| `min` and `exclusiveMin` on one field | `conflicting-constraints` |
| `oneOf` on a `string` | `unknown-property`, with a hint to use `enum` |
| A new constraint whose name has a different aspect on another primitive | The registry test (decision 6) |
| A constraint in the registry that the reference table does not list | The docs test (decision 6) |
| A `decimal` bound written as a YAML number | `invalid-value` |
| A feature that does not send a value outside an `enum` | Gate 3, `uncovered-boundary` |

**Met.** Each sabotage fails, and CI is green: every domain verifies with no warning, every Cucumber profile passes, and the tarball test passes.

## Risks

- **Breaking changes.** Steps 1 and 2 change existing manifests. All are in this repository, and CI covers each one. A user of the tarball must change `oneOf` and `notEqual` by hand; the diagnostics say how.
- **Exact decimals without a library.** Comparison of canonical strings is simple, but it must be right for signs, zeros and different scales. Step 7 tests it against a reference implementation over many random pairs.
- **Text length.** `minLength` and `maxLength` count UTF-16 code units, as Valibot does, so one emoji can count as 2. The reference page says so. A change to code points would be its own decision.
- **Time.** `timestamp` with fractions of a second compares as an instant, so `…:00Z` and `…:00.000Z` are equal. Its boundary cases use the same comparison.
- **The `format` list grows.** Each new name must pass the rule "a `regex` cannot express it clearly", or `format` becomes a second `regex`.
