# Review an agent's change

A coding agent opens a pull request. CI is green. This page tells you what to read, in which order, and what you can skip. urn-forge has already checked that the code keeps the contract. Your review is about the contract and the expected values: only you can say if they are correct.

## 1. Read the change to the manifest

Read the diff of `domain.manifest.yaml` first. It is the contract, and it is short. For each change, ask:

- **Is this what I asked for?** A new rule, answer or operation must come from the request, not from the agent's guess.
- **Does each rule say the right thing?** Read the `rule` and the `message`. A limit of `5000` where you meant `5000 or less` is a real bug, and no gate can find it.
- **Do the rules of the answers exclude each other?** If two answers of an operation can both be true for one input, the code can give either one.
- **Does a refusal name what the caller needs?** A refusal is an answer. It carries the values that tell the caller what went wrong.

If the manifest did not change, the contract is the same. Then the change is in the code or the tests only, and the gates and the harness have checked it against the same rules.

## 2. Read what CI says about the change

CI runs gate 5 with `--base` against the target branch, and `urn-forge diff`. Both pass on a weaker contract only when the version changes. Then gate 5 shows each change as a warning:

```
gate 5  contract      PASS  2 change(s) make the contract weaker than HEAD, allowed by the version 0.1.0 → 0.2.0
    domain.manifest.yaml:10  warning  removed-rule  the rule maximum is removed from definitions.weight_grams
      fix: Put the rule back; if the contract must accept more, bump manifest.version to a new major version (in 0.x, to a new version) and say why in the change.
    features/quote_shipping.feature  warning  removed-scenario  1 of the 4 scenarios "A parcel that breaks a rule is rejected at the boundary" are removed
      fix: Put the scenario back, or bump manifest.version to a new major version (in 0.x, to a new version) when the behaviour it tests is removed on purpose.
verify passed with 2 warning(s) (gates 1, 2, 3, 4, 5)
```

```
breaking    definitions.weight_grams  the rule maximum is removed: it accepts more
diff passed: 1 change(s), 1 breaking, 0.1.0 → 0.2.0: allowed, as 0.2.0 is a 0.x version, where anything may change
```

Each warning is a decision for you. Here, a parcel can now weigh more than 30000 grams. If you did not ask for that, do not merge: the agent removed a check to make CI pass. The new version is the agent's claim that the change is on purpose. You decide if the claim is true.

## 3. Read the new scenarios

Open the changed `.feature` files. The gates make sure that each operation, answer and rule has a scenario. They cannot make sure that a scenario expects the correct value. Check:

- **The expected values.** `| 600 |` for the price of a parcel must be the price that you expect, not the price that the code gives.
- **The edges.** A rule such as "5000 grams or less" needs a scenario at 5000 and one at 5001. Gate 3 does not ask for these.
- **A changed expected value.** If a value in an existing scenario changed, the agent changed what the code must do. That must come from the request.

## 4. Skip what the gates check

You do not need to read:

- **The generated files** (`src/generated/`). Gate 4 fails if they are edited by hand or are not current.
- **The types of the code.** Gate 1 fails if an operation has no code or the code has the wrong type.
- **How the application calls the code.** Gate 2 fails if a call does not go through the harness, or if a file turns off a type check.
- **Each rule in the code.** The harness checks each input and each answer against the rules on each call, also in each scenario.

Read the code of an operation only where a scenario's expected value is in question, or where the logic chooses between answers that are all permitted. The contract says which answers are permitted. The code chooses one, and only the scenarios test that choice.
