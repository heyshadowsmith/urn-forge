# Write scenarios

Scenarios are Gherkin `.feature` files. urn-forge gives the steps for any manifest, so you write only the features. Each step names an operation, an output, a definition or a rule of the manifest, and gate 3 of `verify` reads the same names to find gaps. The [Gherkin steps reference](../reference/gherkin-steps) lists every step and cell format.

## Run an operation

Start with `When I run "<operation>" with:` and a table: a header row of the input's properties, and one row of values. End with the output you expect:

```gherkin
  Scenario: An express parcel over 5000 grams is refused
    When I run "quote_shipping" with:
      | weight_grams | zone     | express |
      | 5001         | domestic | true    |
    Then the output is "too_heavy_for_express":
      | weight_grams |
      | 5001         |
```

- An empty cell sends no value.
- A header with a dot names a property of an embedded object: `stored_booking.state`.
- The table under `Then the output is` compares only the properties it names. Leave out the colon and the table to check only the output's name.

## Break a rule of the input

End with `Then the input is rejected by "<rule>" of "<definition>"`. It passes when the harness refuses the input before the core runs, with that rule of that definition. A `Scenario Outline` breaks many rules in one place. From the starter:

<<< @/../packages/urn-forge/templates/starter/features/split.feature{19-32 gherkin}

The definition is the one that applies the rule: `minLength` is a rule of `person`, the item of the list `people`.

## Break a rule that no input reaches

The rules of an output's definition, such as the `required` rule of a refusal, apply only to answers. Check a value of the definition directly:

```gherkin
  Scenario: A refusal needs the weight
    When I check a "too_heavy_for_express" with:
      | weight_grams |
      |              |
    Then the value is rejected by "required" of "too_heavy_for_express"
```

`Then the value is accepted` shows that a value is valid.

## Cover the manifest

Gate 3 asks for:

- a scenario that runs each operation;
- a scenario that ends with each output of each operation;
- a scenario that breaks each rule that each definition applies.

The rules of outputs and operations need no breaking scenario: the harness checks them on every answer.

A gap is a warning. Once your scenarios cover the manifest, set `coverage: 'error'` in `urn-forge.config.ts`, so that each new operation, output or rule needs a scenario before `verify` passes.

## Test the edges

Gate 3 asks for one scenario per rule, not for the values at its edges. A core that is wrong by one passes every scenario that is far from the edge. For a weight from 1 to 30000, send `1` and `30000`; for a limit of 5000 grams, send `5000`. [Part 4 of the tutorial](../tutorials/first-domain#test-the-edges) shows a core that only an edge scenario catches.

## Run them

`npx cucumber-js` runs the scenarios through the harness. `npx urn-forge verify` reads them without a run, and shows the coverage on the line of gate 3:

```
gate 3  gherkin       PASS  1 feature(s), 15 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
```

CI runs both. Only a run finds a wrong value; only `verify` finds a scenario that is missing.
