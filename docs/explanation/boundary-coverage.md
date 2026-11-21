# Boundary coverage and the ratchet

Gate 3 looks at the values that the scenarios of each operation send. For each constrained input field, it asks for the values at the edges of the constraint, and one value past each edge. This page tells why gate 3 checks boundaries, why it checks presence and not success, and how a project moves from warnings to errors.

## Why boundaries

Many bugs are at an edge. A handler uses `>` where it must use `>=`, or a constraint says `max: 100` where the domain means 99. A scenario that sends only a value in the middle of the range does not exercise the edge. It passes if the edge is correct, and it also passes if the edge is not correct.

Specification v1.0 asked for one value at or past a bound. [Specification v1.1](../project/spec-v1-1) asks for both sides: for an `integer` with `min: 1`, the values `0` and `1`. One side shows that the schema refuses a bad value. The other side shows that it accepts the first good value.

Each constraint has its own cases. A `regex` needs one value that matches and one that does not. An `enum` needs each of its `values` and one value outside the list. [Verification gates](../reference/verification-gates) gives the full rules. Each primitive holds its own rules, in its descriptor, so a new primitive brings its rules with it.

These rules are not in specification v1.1:

- **`notIn` and `mustBe`.** The specification says nothing about them. urn-forge asks for each excluded value of `notIn`, and for both values of a `boolean` with `mustBe`. An excluded value is the case that the constraint exists for, such as the divisor `0` of the math example.
- **`float` bounds.** The specification gives the rule for `integer` (one step past the bound) and for `decimal` (one step at the declared scale). A `float` has no step. Thus urn-forge asks for the value at the bound and any value past it. A `decimal` with no `scale` has no step either, so it gets the same rule.
- **Exclusive bounds.** The specification has no `exclusiveMin` or `exclusiveMax`. urn-forge asks for the bound itself, which the schema refuses, and for one value inside it.
- **`multipleOf` and `scale`.** urn-forge asks for one value that obeys the step and one that does not.
- **Dates and instants.** A `date` needs the day at each bound and the day past it. A `timestamp` needs the instant at each bound and any instant past it, compared as instants and not as text.
- **Lists.** Each item of a list counts as a value of the field, so the rules of the field apply to each item. The list itself needs the item counts at and past `minItems` and `maxItems`, and a repeated value for `unique`. The field and the list are two layers, so each layer has its own cases. Refer to [The MECE model of primitives](./primitives-model).

## Presence, not success

Gate 3 reads the example values. It does not run the scenarios. Thus it shows that a boundary case is present. The Cucumber run shows if the case passes.

This division has a limit. A scenario that sends `-1` to a field with `min: 0` covers the case `below min 0`, even if the scenario expects success. Gate 3 is satisfied, and the Cucumber run fails. The two checks together find the problem. Gate 3 alone does not.

Gate 3 only counts the values in the input table of `When I run the operation with:`. Output tables do not count. A boundary is about what the operation accepts, and an output value is a result, not a case.

## Coverage for each operation

Gate 3 counts the values for each operation separately. A field that two operations use needs its boundary cases in the scenarios of each operation. In `self/`, the field `context` is in the input of `to_brand_identifier` and of `to_urn`. An invalid `context` in a scenario of `to_brand_identifier` does not cover `to_urn`.

This means more scenarios. But each operation can treat the same field in a different way, and coverage is about what each operation accepts. A case that one operation tests says nothing about a different operation.

Gate 3 gives one `uncovered-boundary` diagnostic for each field and operation, with all the cases that are not there. This is the output of the first tutorial, before the third tutorial closes the gaps:

```
gate 3  gherkin       PASS  1 feature(s), 2 scenario(s), 1/1 operations tagged, strict: 0/1 features
    tutorial/1-first-domain/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:weight_grams in the input of urn:demo:shipping:quote:operation:quote_shipping has no value at min 1, no value at max 30000, no value at max + 1 (30001)
    tutorial/1-first-domain/features  warning  uncovered-boundary  urn:demo:shipping:parcel:field:zone in the input of urn:demo:shipping:quote:operation:quote_shipping has no value outside values
```

One diagnostic for each case would bury the output. A field is the unit that a person fixes.

## Warn, then ratchet

Specification v1.1 was written for teams that already have Cucumber suites. If boundary coverage failed the build from the first day, a team with a large suite could not adopt urn-forge. Thus the check has three levels:

1. **Warn.** By default, each gap is a warning. `verify` passes and counts the warnings.
2. **Strict features.** The tag `@urn-forge:strict` on a feature makes the gaps of its operations errors. A team can make one feature strict at a time.
3. **Error.** When every feature is strict and gate 3 passes, `verify` shows the note `ratchet-ready`. The team then sets `boundaryCoverage: 'error'` in the configuration. From then on, every gap is an error, and every new feature is strict from the start.

Gate 3 shows the progress in its summary, for example `strict: 3/3 features (boundaryCoverage: error)`.

A ratchet turns one way. After a team sets `error`, the intent is that it does not go back to `warn`, but urn-forge does not prevent it. The specification sets the trigger: switch to `error` as soon as every feature is strict.

Strictness applies to operations. A feature with `@urn-forge:strict` makes strict every operation that it tags, and an operation is strict if any feature tagged with it is strict. The reason is that coverage is counted for each operation across all features. The tag must reach the gaps that it is there to fail.

The coverage of declared errors follows the same mode. A declared error with no scenario, `uncovered-error`, is a warning in `warn` mode and an error in a strict operation or in `error` mode.

The option `boundaryCoverage` is at the top level of `urn-forge.config.ts`. Specification v1.1 put it in the configuration of a `gherkin` plugin. urn-forge does not have that plugin, and gate 3 is not a plugin.

## Waivers are comments

Sometimes a boundary cannot have a scenario, or a team decides that a scenario does not pay. Specification v1.1 gives an escape: a waiver for one field. urn-forge writes a waiver as a comment in the feature file:

```gherkin
# urn-forge:waive <field URN> <reason…>
```

The specification wrote a waiver as a tag, `@urn-forge:waive(<field URN>, <reason>)`. That tag is not valid Gherkin. A Gherkin tag cannot contain a space, so a tag with a real reason makes the parser refuse the file. A comment can hold free text, and it keeps its line for the diagnostics.

A waiver must stay visible, or it hides gaps forever. urn-forge keeps waivers visible in these ways:

- An applied waiver is a `note` in the output of `verify`, with its reason. A note never fails a gate and is not counted as a warning. As a warning, a waiver would never let the count go to zero. As nothing, it would hide.
- A waiver for a field that the operations of the feature do not constrain is an error, `unknown-waiver`. A typo cannot hide.
- A waiver for a field that has no gap is a warning, `unused-waiver`. A team removes it before it can hide a gap in the future.

A waiver covers the whole field, not one case.

## The `""` cell

An empty cell in a table means "absent": the step sends the payload without that key. This is how a scenario tests a field that is not there. But it also meant that no table could send the empty string. Then a `string` field with `minLength: 1` could never be covered, because its case below the bound is the empty string.

urn-forge thus reads a cell of `""` as the empty string for a `string` field. The `string` primitive parses the cell, so the steps and gate 3 always agree on its value. The cost is small: a table cannot send the two-character text `""` to a `string` field. An `enum` reads `""` in the same way, so a scenario can send the empty string as a value outside the list.

## The limits

- Coverage is for the input of an operation. An entity that is only an output, or that the shell only stores, has no boundary cases to send. The schema and the generated SQL still enforce its constraints. To test them, make the entity the input of an operation, or test the shell.
- Gate 3 shows that the cases are present. It does not show that they expect the correct result.
- Every `Examples` header must be a field of the operation, or of an error or an event that a step of the outline expects, also a column that only the step text uses. Thus a Scenario Outline cannot have a column that names the field to reject. `self/` uses four scenarios for this reason.
- A `format` case accepts any valid value and any value that is not valid. One invalid `email` does not show all the ways that an `email` can be invalid.
- A list cell cannot hold an item with a comma. Refer to [Gherkin steps](../reference/gherkin-steps).

## Related pages

- [Tutorial: make the domain strict](../tutorials/strict-coverage)
- [Adopt strict coverage](../how-to/adopt-strict-coverage)
- [Waive a boundary](../how-to/waive-a-boundary)
- [Verification gates](../reference/verification-gates)
- [What the gates show](./what-the-gates-show)
